import JSZip from 'jszip';

export async function downloadPythonBundle() {
  const zip = new JSZip();

  // Load the content of the files created in workspace
  const curatorPy = `#!/usr/bin/env python3
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
    print(f"\\n[ERROR] Missing required Python dependency: {e.name}")
    print("Please install requirements before running:")
    print("    pip install -r requirements.txt\\n")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/youtube"]
logger = logging.getLogger("shorts_curator")

class QuotaTracker:
    def __init__(self, daily_budget: int = 8000, reserve_buffer: int = 200):
        self.daily_budget = daily_budget
        self.reserve_buffer = reserve_buffer
        self.units_spent = 0
        self.calls_by_type: Dict[str, int] = {}

    def record(self, operation: str, units: int) -> None:
        self.units_spent += units
        self.calls_by_type[operation] = self.calls_by_type.get(operation, 0) + 1
        logger.debug(f"[Quota] +{units} units for '{operation}' (Total spent: {self.units_spent}/{self.daily_budget})")

    def can_afford(self, units: int) -> bool:
        return (self.units_spent + units + self.reserve_buffer) <= self.daily_budget

    def remaining_budget(self) -> int:
        return max(0, self.daily_budget - self.units_spent)

    def summary(self) -> str:
        lines = [f"Quota used: {self.units_spent:,} / {self.daily_budget:,} units ({self.remaining_budget():,} remaining)"]
        for op, count in self.calls_by_type.items():
            lines.append(f"  - {op}: {count} calls")
        return "\\n".join(lines)

class StateManager:
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

def get_authenticated_service(
    token_file: str = "token.json",
    client_secrets_file: str = "client_secret.json",
    auth_only: bool = False,
) -> googleapiclient.discovery.Resource:
    creds: Optional[Credentials] = None
    env_token = os.getenv("YOUTUBE_TOKEN_JSON")
    if env_token:
        try:
            token_info = json.loads(env_token)
            creds = Credentials.from_authorized_user_info(token_info, SCOPES)
            logger.info("Loaded OAuth credentials from YOUTUBE_TOKEN_JSON environment variable.")
        except Exception as e:
            logger.warning(f"Failed to parse YOUTUBE_TOKEN_JSON env var: {e}")

    if not creds and os.path.exists(token_file):
        try:
            creds = Credentials.from_authorized_user_file(token_file, SCOPES)
            logger.info(f"Loaded OAuth credentials from {token_file}.")
        except Exception as e:
            logger.warning(f"Failed to parse {token_file}: {e}")

    if creds and creds.expired and creds.refresh_token:
        logger.info("Access token expired. Refreshing token via refresh_token...")
        try:
            creds.refresh(Request())
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

    if not creds or not creds.valid:
        if not os.path.exists(client_secrets_file):
            logger.critical("=" * 70)
            logger.critical(f"Missing OAuth credentials file: '{client_secrets_file}' not found.")
            logger.critical("Please download client_secret.json from Google Cloud Console:")
            logger.critical("APIs & Services > Credentials > OAuth 2.0 Client IDs (Desktop App)")
            logger.critical("=" * 70)
            sys.exit(1)

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
                print("\\n[SUCCESS] Authentication completed. You can now run unattended scheduled runs.")
                sys.exit(0)
        except Exception as e:
            logger.critical(f"Interactive authentication failed: {e}")
            sys.exit(1)

    return googleapiclient.discovery.build("youtube", "v3", credentials=creds)

def parse_iso8601_duration(duration_str: str) -> int:
    match = re.match(r"PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds

def is_youtube_short(video_id: str, duration_seconds: int, max_duration: int = 60, verify_head: bool = True) -> bool:
    if duration_seconds > max_duration or duration_seconds == 0:
        return False
    if not verify_head:
        return True
    url = f"https://www.youtube.com/shorts/{video_id}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.head(url, headers=headers, allow_redirects=False, timeout=6)
        return r.status_code == 200
    except requests.RequestException:
        return duration_seconds <= max_duration

def scan_channel_shorts(youtube, state, quota, max_duration=60, verify_head=True, cache_short_status=True, min_views_threshold=10):
    quota.record("channels.list", 1)
    channel_res = youtube.channels().list(mine=True, part="contentDetails,snippet").execute()
    items = channel_res.get("items", [])
    if not items:
        return []
    uploads_id = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    raw_video_items = []
    page_token = None
    while True:
        quota.record("playlistItems.list(uploads)", 1)
        res = youtube.playlistItems().list(playlistId=uploads_id, part="snippet,contentDetails", maxResults=50, pageToken=page_token).execute()
        for item in res.get("items", []):
            raw_video_items.append({
                "id": item["contentDetails"]["videoId"],
                "title": item["snippet"]["title"],
                "publishedAt": item["snippet"]["publishedAt"],
            })
        page_token = res.get("nextPageToken")
        if not page_token:
            break

    shorts_candidates = []
    for i in range(0, len(raw_video_items), 50):
        chunk = raw_video_items[i:i + 50]
        ids = ",".join(item["id"] for item in chunk)
        quota.record("videos.list(batch 50)", 1)
        v_res = youtube.videos().list(id=ids, part="contentDetails,statistics,snippet").execute()
        for v_item in v_res.get("items", []):
            vid_id = v_item["id"]
            duration_iso = v_item.get("contentDetails", {}).get("duration", "")
            duration_sec = parse_iso8601_duration(duration_iso)
            stats = v_item.get("statistics", {})
            views = int(stats.get("viewCount", 0))
            if views < min_views_threshold:
                continue
            cached_status = state.get_cached_short(vid_id) if cache_short_status else None
            if cached_status is not None:
                short_verified = cached_status
            else:
                short_verified = is_youtube_short(vid_id, duration_sec, max_duration, verify_head)
                if cache_short_status:
                    state.set_cached_short(vid_id, short_verified)
            if short_verified:
                shorts_candidates.append({
                    "id": vid_id,
                    "title": v_item.get("snippet", {}).get("title", ""),
                    "publishedAt": v_item.get("snippet", {}).get("publishedAt", ""),
                    "duration": duration_sec,
                    "views": views,
                    "likes": int(stats.get("likeCount", 0)),
                    "comments": int(stats.get("commentCount", 0)),
                })
    state.save()
    return shorts_candidates

def score_and_rank_shorts(shorts, scoring_cfg):
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
        like_ratio = min(likes / views, max_like_ratio_cap)
        comment_ratio = min(comments / views, max_comment_ratio_cap)
        engagement_bonus = (like_ratio * like_ratio_weight) + (comment_ratio * comment_ratio_weight)
        pub_str = item.get("publishedAt", "")
        try:
            pub_dt = datetime.datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
            age_days = max(0.0, (now_utc - pub_dt).total_seconds() / 86400.0)
        except Exception:
            age_days = 30.0
        decay = math.exp(-math.log(2) * (age_days / max(half_life_days, 1.0)))
        recency_multiplier = (1.0 - recency_floor) * decay + recency_floor
        base_likes = max(likes, 0) ** likes_weight
        final_score = base_likes * (1.0 + engagement_bonus) * recency_multiplier
        engagement_score = (like_ratio * 100.0) + (comment_ratio * 250.0)
        item["like_ratio"] = round(like_ratio, 4)
        item["comment_ratio"] = round(comment_ratio, 4)
        item["age_days"] = round(age_days, 1)
        item["recency_mult"] = round(recency_multiplier, 3)
        item["engagement_score"] = round(engagement_score, 2)
        item["score"] = round(final_score, 2)

    ranked = sorted(shorts, key=lambda x: x["score"], reverse=True)
    for rank, item in enumerate(ranked, 1):
        item["rank"] = rank
    return ranked

def partition_shorts_for_playlists(ranked_shorts, playlist_configs):
    plan = {}
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
            engagement_ranked = sorted(ranked_shorts, key=lambda x: x["engagement_score"], reverse=True)
            selected = engagement_ranked[:max_items]
        elif strategy == "most_recent":
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

def fetch_playlist_items(youtube, playlist_id, quota):
    items = []
    page_token = None
    while True:
        quota.record("playlistItems.list", 1)
        res = youtube.playlistItems().list(playlistId=playlist_id, part="snippet,contentDetails", maxResults=50, pageToken=page_token).execute()
        for idx, item in enumerate(res.get("items", [])):
            items.append({
                "item_id": item["id"],
                "video_id": item["contentDetails"]["videoId"],
                "position": item["snippet"].get("position", idx),
            })
        page_token = res.get("nextPageToken")
        if not page_token:
            break
    return items

def sync_playlist(youtube, playlist_key, playlist_meta, target_shorts, state, quota, dry_run=False):
    cfg = playlist_meta["config"]
    title = cfg.get("title", f"Shorts Playlist ({playlist_key})")
    description = cfg.get("description", "Auto-curated YouTube Shorts playlist.")
    privacy = cfg.get("privacy", "public")
    target_ids = [s["id"] for s in target_shorts]
    report = {"playlist_key": playlist_key, "title": title, "playlist_id": None, "action": "none", "added": 0, "removed": 0, "retained": 0, "quota_estimated": 0}

    existing_id = state.get_playlist_id(playlist_key)
    valid_playlist = False
    if existing_id:
        quota.record("playlists.list(verify)", 1)
        try:
            pl_check = youtube.playlists().list(id=existing_id, part="snippet,status").execute()
            if pl_check.get("items"):
                valid_playlist = True
                playlist_id = existing_id
        except Exception:
            pass

    if not valid_playlist:
        report["action"] = "create"
        report["quota_estimated"] += 50
        if dry_run:
            playlist_id = f"mock_pl_{playlist_key}"
        else:
            if not quota.can_afford(50):
                return report
            quota.record("playlists.insert", 50)
            pl_res = youtube.playlists().insert(
                part="snippet,status",
                body={"snippet": {"title": title, "description": description}, "status": {"privacyStatus": privacy}}
            ).execute()
            playlist_id = pl_res["id"]
            state.set_playlist(playlist_key, playlist_id, title, len(target_ids))
    else:
        playlist_id = existing_id

    report["playlist_id"] = playlist_id
    current_items = [] if (dry_run and not valid_playlist) else fetch_playlist_items(youtube, playlist_id, quota)
    current_video_ids = [item["video_id"] for item in current_items]
    target_set = set(target_ids)

    items_to_remove = [item for item in current_items if item["video_id"] not in target_set]
    current_set = set(current_video_ids)
    videos_to_add = [vid for vid in target_ids if vid not in current_set]
    retained_ids = [vid for vid in current_video_ids if vid in target_set]

    report["removed"] = len(items_to_remove)
    report["added"] = len(videos_to_add)
    report["retained"] = len(retained_ids)
    report["quota_estimated"] += (len(items_to_remove) * 50) + (len(videos_to_add) * 50)

    if dry_run:
        return report

    for item in items_to_remove:
        if not quota.can_afford(50):
            break
        try:
            quota.record("playlistItems.delete", 50)
            youtube.playlistItems().delete(id=item["item_id"]).execute()
        except Exception as e:
            if "quotaExceeded" in str(e):
                state.save()
                raise

    for target_pos, vid_id in enumerate(target_ids):
        if vid_id in current_set:
            continue
        if not quota.can_afford(50):
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
                }
            ).execute()
        except Exception as e:
            if "quotaExceeded" in str(e):
                state.save()
                raise

    state.set_playlist(playlist_key, playlist_id, title, len(target_ids))
    return report

def run_curator(config_path="config.yaml", dry_run=False, auth_only=False, status_only=False):
    if not os.path.exists(config_path):
        logger.critical(f"Config file not found: {config_path}")
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
    quota = QuotaTracker(daily_budget=quota_cfg.get("max_daily_budget_units", 8000))

    youtube = get_authenticated_service(token_file, client_secrets, auth_only)
    if auth_only:
        return

    shorts = scan_channel_shorts(
        youtube, state, quota,
        max_duration=shorts_cfg.get("max_duration_seconds", 60),
        verify_head=shorts_cfg.get("verify_head_request", True),
        cache_short_status=shorts_cfg.get("cache_short_status", True),
        min_views_threshold=shorts_cfg.get("min_views_threshold", 10),
    )
    if not shorts:
        logger.warning("No Shorts found matching criteria.")
        return

    ranked_shorts = score_and_rank_shorts(shorts, scoring_cfg)
    partition_plan = partition_shorts_for_playlists(ranked_shorts, playlists_cfg)

    sync_reports = []
    for key, pl_meta in partition_plan.items():
        report = sync_playlist(youtube, key, pl_meta, pl_meta["shorts"], state, quota, dry_run)
        sync_reports.append(report)

    state.save()
    print("\\n=== Sync Summary ===")
    for r in sync_reports:
        print(f"[{r['playlist_key']}] {r['title']} -> +{r['added']}, -{r['removed']}, ={r['retained']}")
    print(quota.summary())

def main():
    parser = argparse.ArgumentParser(description="YouTube Shorts Playlist Curator")
    parser.add_argument("--config", "-c", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--auth-only", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    run_curator(args.config, args.dry_run, args.auth_only, args.status)

if __name__ == "__main__":
    main()
`;

  const configYaml = `# ==============================================================================
# YouTube Shorts Playlist Curator - Configuration
# ==============================================================================
auth:
  client_secrets_file: "client_secret.json"
  token_file: "token.json"
  state_file: "state.json"

shorts_detection:
  max_duration_seconds: 60
  verify_via_head_request: true
  cache_short_status: true
  min_views_threshold: 10

scoring:
  likes_weight: 1.0
  like_ratio_weight: 3.5
  max_like_ratio_cap: 0.35
  comment_ratio_weight: 5.0
  max_comment_ratio_cap: 0.10
  half_life_days: 45.0
  recency_floor: 0.40

quota:
  max_daily_budget_units: 8000
  reserve_buffer_units: 200

playlists:
  - id_key: "top_shorts"
    title: "🔥 Top Shorts: Channel Best"
    description: "The most popular, highest-rated Shorts on the channel. Ranked by likes and viewer engagement. Refreshed automatically."
    privacy: "public"
    strategy: "top_overall"
    max_items: 15
    slice_start: 0
    slice_end: 15

  - id_key: "rising_shorts"
    title: "⚡ Rising & Fan-Favorite Shorts"
    description: "Trending and high-performing Shorts you cannot miss. Updated regularly."
    privacy: "public"
    strategy: "rank_slice"
    max_items: 15
    slice_start: 15
    slice_end: 30

  - id_key: "hidden_gems"
    title: "💎 Hidden Gems | Highest Viewer Love"
    description: "Shorts with the highest like-to-view ratios and conversation rates. The real community favorites!"
    privacy: "public"
    strategy: "high_engagement"
    max_items: 15
    slice_start: 0
    slice_end: 15
`;

  const requirementsTxt = `google-api-python-client>=2.115.0
google-auth-oauthlib>=1.2.0
google-auth-httplib2>=0.2.0
requests>=2.31.0
pyyaml>=6.0.1
isodate>=0.6.1
`;

  const githubWorkflow = `name: Refresh YouTube Shorts Playlists

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  curate-shorts:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run Curator (Unattended)
        env:
          YOUTUBE_TOKEN_JSON: \${{ secrets.YOUTUBE_TOKEN_JSON }}
        run: |
          python curator.py --config config.yaml

      - name: Commit & Push Updated State
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add state.json
          git diff-index --quiet HEAD || git commit -m "Auto-update YouTube Shorts curator state [skip ci]"
          git push
`;

  const setupGuide = `# YouTube Shorts Playlist Curator - Setup Guide
See SETUP_GUIDE.md for complete details.
1. Download client_secret.json from Google Cloud Console.
2. Run: pip install -r requirements.txt
3. Run: python curator.py --auth-only
4. Test: python curator.py --dry-run
5. Run automated: python curator.py
`;

  zip.file('curator.py', curatorPy);
  zip.file('config.yaml', configYaml);
  zip.file('requirements.txt', requirementsTxt);
  zip.file('SETUP_GUIDE.md', setupGuide);
  zip.file('.github/workflows/refresh_shorts_playlists.yml', githubWorkflow);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'youtube-shorts-playlist-curator.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
