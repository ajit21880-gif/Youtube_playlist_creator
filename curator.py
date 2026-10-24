#!/usr/bin/env python3
"""
YouTube Shorts Playlist Curator
=================================
Automated, unattended YouTube Shorts playlist manager and ranker.
- Authenticates once via OAuth 2.0 and reuses refresh token indefinitely.
- Accurately detects Shorts via ISO-8601 duration + HTTP HEAD redirect check.
- Ranks Shorts via transparent, configurable engagement + recency formula.
- Refreshes playlists idempotently using smart diffing to minimize API quota.
- Gracefully handles quota limits, token revocation, and state checkpoints.

Author: Senior Backend Engineer
License: Apache-2.0
"""

import argparse
import datetime
import json
import logging
import math
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import requests
    import yaml
    from google.auth.exceptions import RefreshError
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    import googleapiclient.discovery
    import googleapiclient.errors
except ImportError as e:
    print(f"\n[ERROR] Missing required Python dependency: {e.name}")
    print("Please install requirements before running:")
    print("    pip install -r requirements.txt\n")
    sys.exit(1)

# OAuth 2.0 Scopes required for YouTube Data API playlist management
SCOPES = ["https://www.googleapis.com/auth/youtube"]

# Configure Logging
logger = logging.getLogger("shorts_curator")


# ==============================================================================
# Quota Tracker
# ==============================================================================
class QuotaTracker:
    """
    Tracks and estimates YouTube Data API v3 quota consumption.
    Default quota unit costs:
      - Read list operations: 1 unit
      - Batch video list (50 IDs): 1 unit
      - Playlist insert/update: 50 units
      - PlaylistItem insert/delete/update: 50 units
    """

    def __init__(self, daily_budget: int = 8000, reserve_buffer: int = 200):
        self.daily_budget = daily_budget
        self.reserve_buffer = reserve_buffer
        self.units_spent = 0
        self.calls_by_type: Dict[str, int] = {}

    def record(self, operation: str, units: int) -> None:
        self.units_spent += units
        self.calls_by_type[operation] = self.calls_by_type.get(operation, 0) + 1
        logger.debug(
            f"[Quota] +{units} units for '{operation}' (Total spent: {self.units_spent}/{self.daily_budget})"
        )

    def can_afford(self, units: int) -> bool:
        return (self.units_spent + units + self.reserve_buffer) <= self.daily_budget

    def remaining_budget(self) -> int:
        return max(0, self.daily_budget - self.units_spent)

    def summary(self) -> str:
        lines = [
            f"Quota used: {self.units_spent:,} / {self.daily_budget:,} units ({self.remaining_budget():,} remaining)"
        ]
        for op, count in self.calls_by_type.items():
            lines.append(f"  - {op}: {count} calls")
        return "\n".join(lines)


# ==============================================================================
# State Manager
# ==============================================================================
class StateManager:
    """
    Persists managed playlist IDs, cached Shorts detection results, and last sync
    timestamps to disk to guarantee idempotency across unattended executions.
    """

    def __init__(self, filepath: str = "state.json"):
        self.filepath = filepath
        self.data: Dict[str, Any] = {
            "managed_playlists": {},
            "known_shorts": {},
            "last_run": None,
            "quota_stats": {},
        }
        self.load()

    def load(self) -> None:
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                logger.info(f"Loaded existing state from {self.filepath}")
            except Exception as e:
                logger.warning(f"Could not parse state file {self.filepath}: {e}. Initializing fresh state.")

    def save(self) -> None:
        try:
            self.data["last_run"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2)
            logger.debug(f"Saved state checkpoint to {self.filepath}")
        except Exception as e:
            logger.error(f"Failed to save state to {self.filepath}: {e}")

    def get_playlist_id(self, key: str) -> Optional[str]:
        return self.data.get("managed_playlists", {}).get(key, {}).get("playlist_id")

    def set_playlist(self, key: str, playlist_id: str, title: str, video_count: int) -> None:
        if "managed_playlists" not in self.data:
            self.data["managed_playlists"] = {}
        self.data["managed_playlists"][key] = {
            "playlist_id": playlist_id,
            "title": title,
            "video_count": video_count,
            "last_synced": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        self.save()

    def get_cached_short(self, video_id: str) -> Optional[bool]:
        return self.data.get("known_shorts", {}).get(video_id)

    def set_cached_short(self, video_id: str, is_short: bool) -> None:
        if "known_shorts" not in self.data:
            self.data["known_shorts"] = {}
        self.data["known_shorts"][video_id] = is_short


# ==============================================================================
# Authentication & Credentials Manager
# ==============================================================================
def get_authenticated_service(
    token_file: str = "token.json",
    client_secrets_file: str = "client_secret.json",
    auth_only: bool = False,
) -> googleapiclient.discovery.Resource:
    """
    Manages OAuth 2.0 credentials for unattended execution.
    1. Looks for YOUTUBE_TOKEN_JSON environment variable or local token_file.
    2. Automatically refreshes expired tokens using stored refresh_token.
    3. Fails with clear instructions if token is revoked or missing in headless mode.
    4. Triggers local browser consent flow only when running interactively or with --auth-only.
    """
    creds: Optional[Credentials] = None

    # Check environment variable first (convenient for GitHub Actions / Docker secrets)
    env_token = os.getenv("YOUTUBE_TOKEN_JSON")
    if env_token:
        try:
            token_info = json.loads(env_token)
            creds = Credentials.from_authorized_user_info(token_info, SCOPES)
            logger.info("Loaded OAuth credentials from YOUTUBE_TOKEN_JSON environment variable.")
        except Exception as e:
            logger.warning(f"Failed to parse YOUTUBE_TOKEN_JSON env var: {e}")

    # Fall back to token_file on disk
    if not creds and os.path.exists(token_file):
        try:
            creds = Credentials.from_authorized_user_file(token_file, SCOPES)
            logger.info(f"Loaded OAuth credentials from {token_file}.")
        except Exception as e:
            logger.warning(f"Failed to parse {token_file}: {e}")

    # Handle Token Refresh or Consent Flow
    if creds and creds.expired and creds.refresh_token:
        logger.info("Access token expired. Refreshing token via refresh_token...")
        try:
            creds.refresh(Request())
            # Save refreshed credentials
            with open(token_file, "w", encoding="utf-8") as f:
                f.write(creds.to_json())
            logger.info(f"Token refreshed successfully and updated in {token_file}.")
        except RefreshError as e:
            logger.critical("=" * 70)
            logger.critical("CRITICAL AUTHENTICATION ERROR: Refresh token has expired or was revoked!")
            logger.critical("Google OAuth refresh tokens may expire if your GCP App is in 'Testing' mode")
            logger.critical("(Testing mode tokens expire in 7 days). Move app to 'In Production' to avoid this.")
            logger.critical("")
            logger.critical("To re-authenticate once interactively, run:")
            logger.critical(f"    python {os.path.basename(__file__)} --auth-only")
            logger.critical("=" * 70)
            sys.exit(1)
        except Exception as e:
            logger.critical(f"Unexpected error during token refresh: {e}")
            sys.exit(1)

    # If still no valid credentials, run interactive flow
    if not creds or not creds.valid:
        if not os.path.exists(client_secrets_file):
            logger.critical("=" * 70)
            logger.critical(f"Missing OAuth credentials file: '{client_secrets_file}' not found.")
            logger.critical("Please download client_secret.json from Google Cloud Console:")
            logger.critical("APIs & Services > Credentials > OAuth 2.0 Client IDs (Desktop App)")
            logger.critical("=" * 70)
            sys.exit(1)

        # Check if headless / non-interactive environment
        is_headless = not sys.stdin.isatty() and not auth_only
        if is_headless:
            logger.critical("=" * 70)
            logger.critical("HEADLESS ENVIRONMENT DETECTED WITHOUT VALID TOKEN!")
            logger.critical(f"Cannot open browser for OAuth consent in unattended mode without '{token_file}'.")
            logger.critical("Step 1: Run 'python curator.py --auth-only' locally once.")
            logger.critical(f"Step 2: Copy the generated '{token_file}' to this environment or set YOUTUBE_TOKEN_JSON.")
            logger.critical("=" * 70)
            sys.exit(1)

        try:
            import google_auth_oauthlib.flow

            logger.info("Initiating one-time interactive OAuth 2.0 authorization flow in browser...")
            flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
                client_secrets_file, SCOPES
            )
            creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

            with open(token_file, "w", encoding="utf-8") as f:
                f.write(creds.to_json())
            logger.info(f"Authentication successful! Refresh token saved securely to {token_file}.")

            if auth_only:
                print("\n[SUCCESS] Authentication completed. You can now run unattended scheduled runs.")
                sys.exit(0)
        except Exception as e:
            logger.critical(f"Interactive authentication failed: {e}")
            sys.exit(1)

    return googleapiclient.discovery.build("youtube", "v3", credentials=creds, cache_discovery=False)


# ==============================================================================
# Shorts Detection & Metadata Extraction
# ==============================================================================
def parse_iso8601_duration(duration_str: str) -> int:
    """
    Parses ISO 8601 duration string (e.g. 'PT54S', 'PT1M5S', 'PT1H2M') into seconds.
    """
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


def is_youtube_short(video_id: str, duration_seconds: int, max_duration: int = 60, verify_head: bool = True) -> bool:
    """
    Reliable two-step Shorts detection:
    1. Duration check: Video duration must be <= max_duration seconds.
    2. HTTP HEAD check: youtube.com/shorts/{id} returns HTTP 200 for Shorts,
       and HTTP 303 redirect for horizontal standard videos.
    """
    if duration_seconds > max_duration or duration_seconds == 0:
        return False

    if not verify_head:
        return True

    # High-accuracy verification via HTTP HEAD redirect test
    url = f"https://www.youtube.com/shorts/{video_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    cookies = {
        "SOCS": "CAESEwgDEgk1ODE2MDUyNjQaAmRhIAEaBgiA_LWaBg"
    }
    try:
        r = requests.head(url, headers=headers, cookies=cookies, allow_redirects=False, timeout=6)
        # HTTP 200 = Genuine YouTube Short
        if r.status_code == 200:
            return True
        # If redirect to consent page, check continue URL
        if r.status_code in (301, 302, 307):
            loc = r.headers.get("Location", "")
            if "consent.youtube.com" in loc and f"shorts%2F{video_id}" in loc:
                return True
            if f"/shorts/{video_id}" in loc:
                return True
            # HTTP 303 or redirect to /watch?v= means standard horizontal video
            if "/watch" in loc:
                return False
        return duration_seconds <= max_duration
    except requests.RequestException as e:
        logger.debug(f"HEAD check network exception for video {video_id}: {e}. Falling back to duration.")
        return duration_seconds <= max_duration


def scan_channel_shorts(
    youtube: googleapiclient.discovery.Resource,
    state: StateManager,
    quota: QuotaTracker,
    max_duration: int = 60,
    verify_head: bool = True,
    cache_short_status: bool = True,
    min_views_threshold: int = 10,
    max_uploads_to_scan: Optional[int] = 150,
) -> List[Dict[str, Any]]:
    """
    Retrieves uploads from the authenticated channel, filters for Shorts,
    and pulls statistics (views, likes, comments) in 50-ID batches.
    Caps scan to max_uploads_to_scan (default 150) for fast performance on large channels.
    """
    logger.info("Scanning authenticated YouTube channel for uploads...")

    # 1. Get uploads playlist ID for the channel (1 quota unit)
    quota.record("channels.list", 1)
    channel_res = youtube.channels().list(mine=True, part="contentDetails,snippet").execute()
    items = channel_res.get("items", [])
    if not items:
        logger.error("No YouTube channel found for the authenticated account.")
        return []

    channel_title = items[0]["snippet"].get("title", "My Channel")
    uploads_id = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    logger.info(f"Connected to channel: '{channel_title}' (Uploads playlist ID: {uploads_id})")

    # 2. Page through uploaded video IDs (1 quota unit per page of 50)
    raw_video_items = []
    page_token = None
    while True:
        quota.record("playlistItems.list(uploads)", 1)
        res = (
            youtube.playlistItems()
            .list(playlistId=uploads_id, part="snippet,contentDetails", maxResults=50, pageToken=page_token)
            .execute()
        )

        for item in res.get("items", []):
            vid_id = item["contentDetails"]["videoId"]
            raw_video_items.append(
                {
                    "id": vid_id,
                    "title": item["snippet"]["title"],
                    "publishedAt": item["snippet"]["publishedAt"],
                }
            )

        page_token = res.get("nextPageToken")
        if not page_token:
            break
        if max_uploads_to_scan and len(raw_video_items) >= max_uploads_to_scan:
            logger.info(f"Reached max upload scan threshold ({max_uploads_to_scan} videos). Proceeding with filtering.")
            raw_video_items = raw_video_items[:max_uploads_to_scan]
            break

    logger.info(f"Total uploads discovered on channel: {len(raw_video_items)}. Fetching metadata and filtering...")

    # 3. Pull video details and statistics in batches of 50 (1 quota unit per 50 videos)
    shorts_candidates: List[Dict[str, Any]] = []

    for i in range(0, len(raw_video_items), 50):
        chunk = raw_video_items[i : i + 50]
        ids = ",".join(item["id"] for item in chunk)
        quota.record("videos.list(batch 50)", 1)

        v_res = youtube.videos().list(id=ids, part="contentDetails,statistics,snippet").execute()

        for v_item in v_res.get("items", []):
            vid_id = v_item["id"]
            duration_iso = v_item.get("contentDetails", {}).get("duration", "")
            duration_sec = parse_iso8601_duration(duration_iso)
            stats = v_item.get("statistics", {})

            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            comments = int(stats.get("commentCount", 0))

            # Filter out videos below minimum views threshold to eliminate noise
            if views < min_views_threshold:
                continue

            # Check cached Short status
            cached_status = state.get_cached_short(vid_id) if cache_short_status else None
            if cached_status is not None:
                short_verified = cached_status
            else:
                short_verified = is_youtube_short(
                    vid_id, duration_sec, max_duration=max_duration, verify_head=verify_head
                )
                if cache_short_status:
                    state.set_cached_short(vid_id, short_verified)

            if short_verified:
                shorts_candidates.append(
                    {
                        "id": vid_id,
                        "title": v_item.get("snippet", {}).get("title", ""),
                        "publishedAt": v_item.get("snippet", {}).get("publishedAt", ""),
                        "duration": duration_sec,
                        "views": views,
                        "likes": likes,
                        "comments": comments,
                    }
                )

    state.save()
    logger.info(f"Verified genuine Shorts meeting threshold criteria: {len(shorts_candidates)}")
    return shorts_candidates


# ==============================================================================
# Transparent Scoring & Ranking Algorithm
# ==============================================================================
def score_and_rank_shorts(
    shorts: List[Dict[str, Any]], scoring_cfg: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Calculates a transparent, multi-signal performance score for each Short.

    MATHEMATICAL FORMULA:
    -------------------------------------------------------------------------
    FinalScore = (Likes ^ likes_weight) * (1.0 + EngagementBonus) * RecencyMultiplier

    Where:
      1. Likes term:
         - Raw like count is the primary volume driver.
         - likes_weight (default 1.0) ensures scale without distortion.

      2. Engagement Bonus:
         - LikeToViewRatio = min(likes / max(views, 1), max_like_ratio_cap)
         - CommentToViewRatio = min(comments / max(views, 1), max_comment_ratio_cap)
         - EngagementBonus = (LikeToViewRatio * like_ratio_weight) +
                             (CommentToViewRatio * comment_ratio_weight)
         - Capping ratios prevents 100% ratios from 3-view anomaly uploads.

      3. Recency Multiplier (Exponential Half-Life):
         - age_days = (current_time - published_at) in days
         - lambda = ln(2) / half_life_days
         - decay = exp(-lambda * age_days)
         - RecencyMultiplier = (1.0 - recency_floor) * decay + recency_floor
         - Ensures newer Shorts receive a competitive boost, while legendary
           evergreen Shorts never drop below recency_floor (default 0.40).
    -------------------------------------------------------------------------
    """
    likes_weight = float(scoring_cfg.get("likes_weight", 1.0))
    like_ratio_weight = float(scoring_cfg.get("like_ratio_weight", 3.5))
    max_like_ratio_cap = float(scoring_cfg.get("max_like_ratio_cap", 0.35))
    comment_ratio_weight = float(scoring_cfg.get("comment_ratio_weight", 5.0))
    max_comment_ratio_cap = float(scoring_cfg.get("max_comment_ratio_cap", 0.10))
    half_life_days = float(scoring_cfg.get("half_life_days", 45.0))
    recency_floor = float(scoring_cfg.get("recency_floor", 0.40))

    now_utc = datetime.datetime.now(datetime.timezone.utc)

    for item in shorts:
        views = max(item.get("views", 0), 1)
        likes = item.get("likes", 0)
        comments = item.get("comments", 0)

        # Engagement ratios
        like_ratio = min(likes / views, max_like_ratio_cap)
        comment_ratio = min(comments / views, max_comment_ratio_cap)
        engagement_bonus = (like_ratio * like_ratio_weight) + (comment_ratio * comment_ratio_weight)

        # Recency decay
        pub_str = item.get("publishedAt", "")
        try:
            pub_dt = datetime.datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
            age_days = max(0.0, (now_utc - pub_dt).total_seconds() / 86400.0)
        except Exception:
            age_days = 30.0

        decay = math.exp(-math.log(2) * (age_days / max(half_life_days, 1.0)))
        recency_multiplier = (1.0 - recency_floor) * decay + recency_floor

        # Final computed score
        base_likes = max(likes, 0) ** likes_weight
        final_score = base_likes * (1.0 + engagement_bonus) * recency_multiplier

        # Secondary score: Pure engagement index (useful for "Hidden Gems" playlist)
        engagement_score = (like_ratio * 100.0) + (comment_ratio * 250.0)

        item["like_ratio"] = round(like_ratio, 4)
        item["comment_ratio"] = round(comment_ratio, 4)
        item["age_days"] = round(age_days, 1)
        item["recency_mult"] = round(recency_multiplier, 3)
        item["engagement_score"] = round(engagement_score, 2)
        item["score"] = round(final_score, 2)

    # Sort descending by primary performance score
    ranked = sorted(shorts, key=lambda x: x["score"], reverse=True)
    for rank, item in enumerate(ranked, 1):
        item["rank"] = rank

    return ranked


# ==============================================================================
# Playlist Selection & Grouping
# ==============================================================================
def partition_shorts_for_playlists(
    ranked_shorts: List[Dict[str, Any]], playlist_configs: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Groups ranked Shorts into designated playlists based on configured strategies:
    - 'top_overall': Top N overall highest scores
    - 'rank_slice': Items from rank slice_start to slice_end
    - 'high_engagement': Items sorted by pure engagement ratio (like-to-view & comments)
    - 'most_recent': Fresh shorts sorted by publish date among top performers
    """
    plan: Dict[str, Dict[str, Any]] = {}

    for pl_cfg in playlist_configs:
        key = pl_cfg.get("id_key", "playlist")
        strategy = pl_cfg.get("strategy", "rank_slice")
        max_items = int(pl_cfg.get("max_items", 15))
        start = int(pl_cfg.get("slice_start", 0))
        end = int(pl_cfg.get("slice_end", start + max_items))

        if strategy == "top_overall":
            selected = ranked_shorts[:max_items]
        elif strategy == "rank_slice":
            selected = ranked_shorts[start:end][:max_items]
        elif strategy == "high_engagement":
            # Sort by engagement_score
            engagement_ranked = sorted(ranked_shorts, key=lambda x: x["engagement_score"], reverse=True)
            selected = engagement_ranked[:max_items]
        elif strategy == "most_recent":
            # Sort by publish date descending
            recent_ranked = sorted(ranked_shorts, key=lambda x: x["publishedAt"], reverse=True)
            selected = recent_ranked[:max_items]
        else:
            selected = ranked_shorts[start:end][:max_items]

        plan[key] = {
            "config": pl_cfg,
            "shorts": selected,
            "target_video_ids": [s["id"] for s in selected],
        }

    return plan


# ==============================================================================
# Idempotent Diffing & Synchronization Engine
# ==============================================================================
def fetch_playlist_items(
    youtube: googleapiclient.discovery.Resource, playlist_id: str, quota: QuotaTracker
) -> List[Dict[str, Any]]:
    """
    Retrieves current items in a YouTube playlist (1 quota unit per 50 items).
    Returns list of dicts: {'item_id': str, 'video_id': str, 'position': int}
    """
    items = []
    page_token = None
    while True:
        quota.record("playlistItems.list", 1)
        res = (
            youtube.playlistItems()
            .list(playlistId=playlist_id, part="snippet,contentDetails", maxResults=50, pageToken=page_token)
            .execute()
        )
        for idx, item in enumerate(res.get("items", [])):
            items.append(
                {
                    "item_id": item["id"],
                    "video_id": item["contentDetails"]["videoId"],
                    "position": item["snippet"].get("position", idx),
                }
            )
        page_token = res.get("nextPageToken")
        if not page_token:
            break
    return items


def sync_playlist(
    youtube: googleapiclient.discovery.Resource,
    playlist_key: str,
    playlist_meta: Dict[str, Any],
    target_shorts: List[Dict[str, Any]],
    state: StateManager,
    quota: QuotaTracker,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Synchronizes a single playlist idempotently against target Shorts.
    - Creates playlist if it does not exist yet (50 units).
    - Fetches current items (1 unit per 50).
    - Diffs: Deletes videos that dropped out (50 units each).
    - Inserts newly ranked videos (50 units each).
    - Preserves ordering.
    """
    cfg = playlist_meta["config"]
    title = cfg.get("title", f"Shorts Playlist ({playlist_key})")
    description = cfg.get("description", "Auto-curated YouTube Shorts playlist.")
    privacy = cfg.get("privacy", "public")
    target_ids = [s["id"] for s in target_shorts]

    report = {
        "playlist_key": playlist_key,
        "title": title,
        "playlist_id": None,
        "action": "none",
        "added": 0,
        "removed": 0,
        "retained": 0,
        "quota_estimated": 0,
    }

    # 1. Resolve Playlist ID
    existing_id = state.get_playlist_id(playlist_key)
    valid_playlist = False

    if existing_id:
        # Verify playlist still exists on channel (1 unit)
        quota.record("playlists.list(verify)", 1)
        try:
            pl_check = youtube.playlists().list(id=existing_id, part="snippet,status").execute()
            if pl_check.get("items"):
                valid_playlist = True
                playlist_id = existing_id
                logger.info(f"Verified managed playlist '{title}' (ID: {playlist_id})")
        except googleapiclient.errors.HttpError as e:
            logger.warning(f"Failed to verify playlist {existing_id}: {e}")

    if not valid_playlist and not dry_run:
        # Check channel's existing playlists to avoid creating duplicates
        try:
            quota.record("playlists.list(search_existing)", 1)
            mine_pls = youtube.playlists().list(mine=True, part="snippet", maxResults=50).execute()
            for p in mine_pls.get("items", []):
                p_title = p.get("snippet", {}).get("title", "").strip().lower()
                clean_target = title.strip().lower().replace("🔥", "").replace("⚡", "").replace("💎", "").strip()
                if p_title == title.strip().lower() or clean_target in p_title:
                    playlist_id = p["id"]
                    valid_playlist = True
                    logger.info(f"Discovered existing playlist '{p['snippet']['title']}' (ID: {playlist_id}) on channel. Reusing to prevent duplicates.")
                    state.set_playlist(playlist_key, playlist_id, title, len(target_ids))
                    break
        except Exception as e:
            logger.warning(f"Error checking existing playlists for duplicates: {e}")

    if not valid_playlist:
        report["action"] = "create"
        report["quota_estimated"] += 50
        if dry_run:
            logger.info(f"[DRY-RUN] Would create new playlist: '{title}' ({privacy})")
            playlist_id = f"mock_pl_{playlist_key}"
        else:
            if not quota.can_afford(50):
                logger.warning(f"Insufficient quota budget to create playlist '{title}'. Skipping.")
                return report

            quota.record("playlists.insert", 50)
            pl_res = (
                youtube.playlists()
                .insert(
                    part="snippet,status",
                    body={
                        "snippet": {"title": title, "description": description},
                        "status": {"privacyStatus": privacy},
                    },
                )
                .execute()
            )
            playlist_id = pl_res["id"]
            logger.info(f"Created new playlist '{title}' (ID: {playlist_id})")
            state.set_playlist(playlist_key, playlist_id, title, len(target_ids))
    else:
        playlist_id = existing_id  # type: ignore

    report["playlist_id"] = playlist_id

    # 2. Fetch current items in playlist
    if dry_run and not valid_playlist:
        current_items = []
    else:
        current_items = fetch_playlist_items(youtube, playlist_id, quota)

    current_video_ids = [item["video_id"] for item in current_items]
    target_set = set(target_ids)

    # 3. Compute Diff
    # Identify items to remove (current videos not in target)
    items_to_remove = [item for item in current_items if item["video_id"] not in target_set]

    # Identify items to add (target videos not in current playlist)
    current_set = set(current_video_ids)
    videos_to_add = [vid for vid in target_ids if vid not in current_set]

    # Retained items
    retained_ids = [vid for vid in current_video_ids if vid in target_set]
    report["removed"] = len(items_to_remove)
    report["added"] = len(videos_to_add)
    report["retained"] = len(retained_ids)

    estimated_units = (len(items_to_remove) * 50) + (len(videos_to_add) * 50)
    report["quota_estimated"] += estimated_units

    logger.info(
        f"Diff for '{title}': +{len(videos_to_add)} to add, -{len(items_to_remove)} to remove, {len(retained_ids)} retained. (Est. {estimated_units} units)"
    )

    if dry_run:
        logger.info(f"[DRY-RUN] Playlist '{title}' simulated sync complete.")
        return report

    # 4. Execute Deletions (50 units each)
    for item in items_to_remove:
        if not quota.can_afford(50):
            logger.warning(f"Quota safety reserve reached. Stopping removals for '{title}'.")
            break
        try:
            quota.record("playlistItems.delete", 50)
            youtube.playlistItems().delete(id=item["item_id"]).execute()
            logger.info(f"  [-] Removed video {item['video_id']} from '{title}'")
        except googleapiclient.errors.HttpError as e:
            if "quotaExceeded" in str(e):
                logger.error("Daily YouTube API quota exceeded during deletion!")
                state.save()
                raise
            logger.error(f"Failed to delete playlistItem {item['item_id']}: {e}")

    # 5. Execute Insertions in Target Order (50 units each)
    # If the playlist was newly created or emptied, we insert all in sequence.
    # If appending, we insert at designated position.
    for target_pos, vid_id in enumerate(target_ids):
        if vid_id in current_set:
            continue  # Already in playlist

        if not quota.can_afford(50):
            logger.warning(f"Quota safety reserve reached. Stopping insertions for '{title}'.")
            break

        try:
            quota.record("playlistItems.insert", 50)
            youtube.playlistItems().insert(
                part="snippet",
                body={
                    "snippet": {
                        "playlistId": playlist_id,
                        "resourceId": {"kind": "youtube#video", "videoId": vid_id},
                        "position": target_pos,
                    }
                },
            ).execute()
            logger.info(f"  [+] Added video {vid_id} at position {target_pos} to '{title}'")
        except googleapiclient.errors.HttpError as e:
            if "quotaExceeded" in str(e):
                logger.error("Daily YouTube API quota exceeded during insertion!")
                state.save()
                raise
            logger.error(f"Failed to add video {vid_id} to '{title}': {e}")

    state.set_playlist(playlist_key, playlist_id, title, len(target_ids))
    return report


# ==============================================================================
# Main Orchestrator
# ==============================================================================
def run_curator(
    config_path: str = "config.yaml",
    dry_run: bool = False,
    auth_only: bool = False,
    status_only: bool = False,
) -> None:
    # 1. Load Configuration
    if not os.path.exists(config_path):
        logger.critical(f"Configuration file not found: {config_path}")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    auth_cfg = config.get("auth", {})
    shorts_cfg = config.get("shorts_detection", {})
    scoring_cfg = config.get("scoring", {})
    quota_cfg = config.get("quota", {})
    playlists_cfg = config.get("playlists", [])

    token_file = auth_cfg.get("token_file", "token.json")
    client_secrets = auth_cfg.get("client_secrets_file", "client_secret.json")
    state_file = auth_cfg.get("state_file", "state.json")

    state = StateManager(state_file)
    quota = QuotaTracker(
        daily_budget=quota_cfg.get("max_daily_budget_units", 8000),
        reserve_buffer=quota_cfg.get("reserve_buffer_units", 200),
    )

    if status_only:
        print("\n" + "=" * 60)
        print("YOUTUBE SHORTS PLAYLIST CURATOR - STATUS REPORT")
        print("=" * 60)
        print(f"State file: {state_file}")
        print(f"Last run: {state.data.get('last_run', 'Never')}")
        print(f"Known shorts cached: {len(state.data.get('known_shorts', {}))}")
        print("\nManaged Playlists:")
        for key, pl_info in state.data.get("managed_playlists", {}).items():
            print(f"  • [{key}] '{pl_info.get('title')}'")
            print(f"    Playlist ID : {pl_info.get('playlist_id')}")
            print(f"    Videos count: {pl_info.get('video_count')}")
            print(f"    Last synced : {pl_info.get('last_synced')}")
        print("=" * 60)
        return

    # 2. Authenticate
    youtube = get_authenticated_service(
        token_file=token_file,
        client_secrets_file=client_secrets,
        auth_only=auth_only,
    )

    if auth_only:
        return

    # 3. Scan & Filter Shorts
    shorts = scan_channel_shorts(
        youtube=youtube,
        state=state,
        quota=quota,
        max_duration=shorts_cfg.get("max_duration_seconds", 60),
        verify_head=shorts_cfg.get("verify_head_request", True),
        cache_short_status=shorts_cfg.get("cache_short_status", True),
        min_views_threshold=shorts_cfg.get("min_views_threshold", 10),
        max_uploads_to_scan=shorts_cfg.get("max_uploads_to_scan", 150),
    )

    if not shorts:
        logger.warning("No Shorts found matching criteria on this channel. Exiting.")
        return

    # 4. Score and Rank Shorts
    ranked_shorts = score_and_rank_shorts(shorts, scoring_cfg)
    logger.info(f"Successfully ranked {len(ranked_shorts)} Shorts.")

    print("\n" + "=" * 80)
    print("TOP 10 RANKED SHORTS BY ENGAGEMENT SCORE:")
    print("=" * 80)
    print(f"{'Rank':<5} {'Score':<8} {'Likes':<8} {'Views':<10} {'L/V Ratio':<10} {'Title'}")
    print("-" * 80)
    for s in ranked_shorts[:10]:
        title_snip = (s["title"][:38] + "..") if len(s["title"]) > 38 else s["title"]
        print(
            f"#{s['rank']:<4} {s['score']:<8.1f} {s['likes']:<8,d} {s['views']:<10,d} {s['like_ratio']:<10.2%} {title_snip}"
        )
    print("=" * 80 + "\n")

    # 5. Partition Shorts into Playlists
    partition_plan = partition_shorts_for_playlists(ranked_shorts, playlists_cfg)

    # 6. Synchronize Playlists
    sync_reports = []
    try:
        for key, pl_meta in partition_plan.items():
            logger.info(f"--- Synchronizing playlist: {key} ---")
            report = sync_playlist(
                youtube=youtube,
                playlist_key=key,
                playlist_meta=pl_meta,
                target_shorts=pl_meta["shorts"],
                state=state,
                quota=quota,
                dry_run=dry_run,
            )
            sync_reports.append(report)
    except googleapiclient.errors.HttpError as e:
        if "quotaExceeded" in str(e):
            logger.error("Execution halted due to YouTube API quota limit. State saved safely.")
            sys.exit(2)
        else:
            raise

    # 7. Final Summary
    state.save()
    print("\n" + "=" * 60)
    print("PLAYLIST CURATION SUMMARY" + (" [DRY RUN]" if dry_run else ""))
    print("=" * 60)
    for r in sync_reports:
        print(f"Playlist : '{r['title']}' ({r['playlist_key']})")
        print(f"  Action : {r['action'].upper()} | ID: {r['playlist_id']}")
        print(f"  Changes: +{r['added']} added, -{r['removed']} removed, {r['retained']} retained")
    print("-" * 60)
    print(quota.summary())
    print("=" * 60)
    logger.info("Curator run completed successfully.")


# ==============================================================================
# CLI Entrypoint
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="YouTube Shorts Playlist Curator - Unattended Performance-Ranked Playlist Manager"
    )
    parser.add_argument(
        "--config",
        "-c",
        default="config.yaml",
        help="Path to YAML configuration file (default: config.yaml)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate scan, ranking, and playlist diffs without executing YouTube writes",
    )
    parser.add_argument(
        "--auth-only",
        action="store_true",
        help="Run interactive one-time OAuth 2.0 flow to generate token.json, then exit",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print current managed playlists, cached state, and exit",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable detailed debug logging",
    )

    args = parser.parse_args()

    # Logging format
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    run_curator(
        config_path=args.config,
        dry_run=args.dry_run,
        auth_only=args.auth_only,
        status_only=args.status,
    )


if __name__ == "__main__":
    main()
