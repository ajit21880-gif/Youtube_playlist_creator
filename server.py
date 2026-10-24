#!/usr/bin/env python3
"""
Backend API Server for YouTube Shorts Playlist Curator Dashboard
Bridges the React frontend to curator.py, Google OAuth, and YouTube Data API v3.
"""

import os
import sys
import json
import math
import logging
import datetime
import threading
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS
import yaml

import curator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("curator_server")

app = Flask(__name__)
CORS(app)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")
CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")
STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")

# In-memory tracking for long-running operations (auth, scan, sync)
operation_status = {
    "auth": {"status": "idle", "message": "", "timestamp": None},
    "scan": {"status": "idle", "message": "", "timestamp": None, "count": 0},
    "sync": {"status": "idle", "message": "", "timestamp": None, "reports": []},
}

def load_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Error loading {CONFIG_PATH}: {e}")
    return {}

def save_config(cfg: Dict[str, Any]) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False, sort_keys=False)

_cached_channel_info: Optional[Dict[str, Any]] = None
_channel_info_timestamp: float = 0

def get_channel_info_if_auth(force_refresh: bool = False) -> Optional[Dict[str, Any]]:
    """Fetches authenticated YouTube channel info if credentials exist and are valid (cached for 10 min)."""
    global _cached_channel_info, _channel_info_timestamp
    if not os.path.exists(TOKEN_FILE):
        return None
    
    now = datetime.datetime.now().timestamp()
    if not force_refresh and _cached_channel_info is not None and (now - _channel_info_timestamp < 600):
        return _cached_channel_info

    try:
        youtube = curator.get_authenticated_service(
            token_file=TOKEN_FILE,
            client_secrets_file=CLIENT_SECRETS_FILE,
            auth_only=False
        )
        res = youtube.channels().list(mine=True, part="snippet,statistics,contentDetails").execute()
        items = res.get("items", [])
        if not items:
            return None
        ch = items[0]
        snippet = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        info = {
            "id": ch.get("id"),
            "title": snippet.get("title", "My Channel"),
            "customUrl": snippet.get("customUrl", ""),
            "description": snippet.get("description", ""),
            "publishedAt": snippet.get("publishedAt", ""),
            "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url") or snippet.get("thumbnails", {}).get("default", {}).get("url"),
            "subscriberCount": int(stats.get("subscriberCount", 0)),
            "videoCount": int(stats.get("videoCount", 0)),
            "viewCount": int(stats.get("viewCount", 0)),
        }
        _cached_channel_info = info
        _channel_info_timestamp = now
        operation_status["auth"]["status"] = "success"
        operation_status["auth"]["message"] = f"Connected to {info['title']}"
        return info
    except Exception as e:
        logger.warning(f"Could not fetch channel info: {e}")
        return None

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.route("/api/status", methods=["GET"])
def get_status():
    """Returns system status, auth status, channel info, and state."""
    has_client_secret = os.path.exists(CLIENT_SECRETS_FILE)
    has_token = os.path.exists(TOKEN_FILE)
    channel_info = get_channel_info_if_auth() if has_token else None
    
    state = curator.StateManager(STATE_FILE)
    config = load_config()
    
    return jsonify({
        "client_secret_present": has_client_secret,
        "token_present": has_token and (channel_info is not None),
        "channel": channel_info,
        "last_run": state.data.get("last_run"),
        "cached_shorts_count": len(state.data.get("known_shorts", {})),
        "managed_playlists": state.data.get("managed_playlists", {}),
        "operation_status": operation_status,
        "config": config,
    })

@app.route("/api/auth/connect", methods=["POST"])
def auth_connect():
    """Initiates OAuth 2.0 flow to link the user's YouTube Channel."""
    if not os.path.exists(CLIENT_SECRETS_FILE):
        return jsonify({
            "success": False,
            "error": "client_secret.json not found in project directory."
        }), 400

    def run_auth_thread():
        operation_status["auth"] = {
            "status": "running",
            "message": "Browser opened for Google account authorization...",
            "timestamp": datetime.datetime.now().isoformat()
        }
        try:
            curator.get_authenticated_service(
                token_file=TOKEN_FILE,
                client_secrets_file=CLIENT_SECRETS_FILE,
                auth_only=True
            )
            channel = get_channel_info_if_auth()
            channel_name = channel.get("title", "Channel") if channel else "Channel"
            operation_status["auth"] = {
                "status": "success",
                "message": f"Successfully connected to YouTube channel: {channel_name}!",
                "timestamp": datetime.datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"OAuth flow failed: {e}")
            operation_status["auth"] = {
                "status": "error",
                "message": f"Authorization error: {str(e)}",
                "timestamp": datetime.datetime.now().isoformat()
            }

    thread = threading.Thread(target=run_auth_thread)
    thread.start()

    return jsonify({
        "success": True,
        "message": "OAuth flow started. A browser window has opened for Google authorization."
    })

@app.route("/api/scan", methods=["POST"])
def scan_channel():
    """Scans the authenticated YouTube channel for uploads and filters genuine Shorts."""
    if not os.path.exists(TOKEN_FILE):
        return jsonify({"success": False, "error": "Channel not authenticated yet. Please connect your YouTube account first."}), 400

    config = load_config()
    shorts_cfg = config.get("shorts_detection", {})
    state = curator.StateManager(STATE_FILE)
    quota = curator.QuotaTracker()

    try:
        operation_status["scan"] = {
            "status": "running",
            "message": "Scanning uploads and detecting Shorts...",
            "timestamp": datetime.datetime.now().isoformat(),
            "count": 0
        }

        youtube = curator.get_authenticated_service(token_file=TOKEN_FILE, client_secrets_file=CLIENT_SECRETS_FILE)
        shorts = curator.scan_channel_shorts(
            youtube=youtube,
            state=state,
            quota=quota,
            max_duration=shorts_cfg.get("max_duration_seconds", 60),
            verify_head=shorts_cfg.get("verify_head_request", True),
            cache_short_status=shorts_cfg.get("cache_short_status", True),
            min_views_threshold=shorts_cfg.get("min_views_threshold", 5),
            max_uploads_to_scan=shorts_cfg.get("max_uploads_to_scan", 150),
        )

        # Cache scanned shorts in state
        state.data["latest_scanned_shorts"] = shorts
        state.save()

        operation_status["scan"] = {
            "status": "success",
            "message": f"Scan complete! Discovered {len(shorts)} verified YouTube Shorts.",
            "timestamp": datetime.datetime.now().isoformat(),
            "count": len(shorts)
        }

        return jsonify({
            "success": True,
            "count": len(shorts),
            "shorts": shorts,
            "quota": quota.summary()
        })
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        operation_status["scan"] = {
            "status": "error",
            "message": f"Scan failed: {str(e)}",
            "timestamp": datetime.datetime.now().isoformat(),
            "count": 0
        }
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/shorts", methods=["GET"])
def get_shorts():
    """
    Returns detected Shorts.
    If authenticated, automatically scans/returns real channel Shorts.
    If not yet authenticated, returns sample shorts with is_demo flag.
    """
    config = load_config()
    shorts_cfg = config.get("shorts_detection", {})
    scoring_cfg = config.get("scoring", {})
    playlists_cfg = config.get("playlists", [])
    state = curator.StateManager(STATE_FILE)

    raw_shorts = state.data.get("latest_scanned_shorts")
    is_demo = False

    # If channel is authenticated but not yet scanned, auto-scan the channel now
    if not raw_shorts and os.path.exists(TOKEN_FILE):
        try:
            logger.info("Channel authenticated. Performing initial scan of recent uploads...")
            youtube = curator.get_authenticated_service(token_file=TOKEN_FILE, client_secrets_file=CLIENT_SECRETS_FILE)
            quota = curator.QuotaTracker()
            raw_shorts = curator.scan_channel_shorts(
                youtube=youtube,
                state=state,
                quota=quota,
                max_duration=shorts_cfg.get("max_duration_seconds", 60),
                verify_head=shorts_cfg.get("verify_head_request", True),
                cache_short_status=shorts_cfg.get("cache_short_status", True),
                min_views_threshold=shorts_cfg.get("min_views_threshold", 5),
                max_uploads_to_scan=shorts_cfg.get("max_uploads_to_scan", 150),
            )
            state.data["latest_scanned_shorts"] = raw_shorts
            state.save()
            is_demo = False
            logger.info(f"Initial scan completed: {len(raw_shorts)} Shorts detected from channel.")
        except Exception as e:
            logger.warning(f"Auto-scan failed: {e}. Falling back to sample shorts.")

    if not raw_shorts:
        # Load sample shorts from frontend data if real channel hasn't been scanned
        sample_path = os.path.join(os.path.dirname(__file__), "src", "data", "sampleShorts.ts")
        # Fallback list of rich sample shorts
        raw_shorts = [
            {"id": "s_v101", "title": "Top 3 Coding Tricks Every Developer Forgets 🚀", "duration": 38, "views": 482500, "likes": 42300, "comments": 1120, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=4)).isoformat()},
            {"id": "s_v102", "title": "Python One-Liners That Look Like Magic ✨", "duration": 44, "views": 890400, "likes": 78100, "comments": 2450, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=12)).isoformat()},
            {"id": "s_v103", "title": "Never Hardcode API Keys Again! (10s Fix) 🔒", "duration": 29, "views": 312000, "likes": 31900, "comments": 890, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)).isoformat()},
            {"id": "s_v104", "title": "Docker in 50 Seconds: The Visual Breakdown 🐳", "duration": 51, "views": 1240000, "likes": 98000, "comments": 3100, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=35)).isoformat()},
            {"id": "s_v105", "title": "PostgreSQL vs SQLite: Which Do You Actually Need? 🐘", "duration": 55, "views": 215000, "likes": 24200, "comments": 1340, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=8)).isoformat()},
            {"id": "s_v106", "title": "CSS Grid Trick That Solved My 3-Year Headache 🎨", "duration": 32, "views": 654000, "likes": 61000, "comments": 1780, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=20)).isoformat()},
            {"id": "s_v107", "title": "OAuth 2.0 Explained with Real Coffee Analogy ☕", "duration": 48, "views": 430000, "likes": 38500, "comments": 920, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=16)).isoformat()},
            {"id": "s_v108", "title": "Stop Using console.log! Use This Instead 🛑", "duration": 25, "views": 980000, "likes": 91200, "comments": 4120, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=6)).isoformat()},
            {"id": "s_v109", "title": "Why Senior Engineers Love Monorepos 🏗️", "duration": 42, "views": 189000, "likes": 16400, "comments": 680, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=28)).isoformat()},
            {"id": "s_v110", "title": "The Secret Git Command Nobody Talks About 🪄", "duration": 36, "views": 520000, "likes": 53000, "comments": 1420, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10)).isoformat()},
            {"id": "s_v111", "title": "Build a Full REST API in 40 Seconds ⚡", "duration": 40, "views": 710000, "likes": 68000, "comments": 2100, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=14)).isoformat()},
            {"id": "s_v112", "title": "How DNS Actually Finds a Website 🌐", "duration": 58, "views": 340000, "likes": 32000, "comments": 1150, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=22)).isoformat()},
        ]
        is_demo = True

    # Score and rank
    ranked_shorts = curator.score_and_rank_shorts([dict(s) for s in raw_shorts], scoring_cfg)
    partition_plan = curator.partition_shorts_for_playlists(ranked_shorts, playlists_cfg)

    # Attach assigned playlists to each short
    for s in ranked_shorts:
        vid_id = s["id"]
        assigned = []
        for pl_key, pl_meta in partition_plan.items():
            if vid_id in pl_meta["target_video_ids"]:
                assigned.append(pl_meta["config"].get("title", pl_key))
        s["assignedPlaylists"] = assigned
        # YouTube direct thumbnail & video links
        s["thumbnail"] = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
        s["youtubeUrl"] = f"https://www.youtube.com/shorts/{vid_id}"

    return jsonify({
        "is_demo": is_demo,
        "count": len(ranked_shorts),
        "shorts": ranked_shorts
    })

@app.route("/api/playlists", methods=["GET"])
def get_playlists():
    """Returns managed playlists with live status, counts, URLs, and curated items."""
    config = load_config()
    playlists_cfg = config.get("playlists", [])
    scoring_cfg = config.get("scoring", {})
    state = curator.StateManager(STATE_FILE)
    managed = state.data.get("managed_playlists", {})

    shorts = state.data.get("latest_scanned_shorts") or []
    if shorts:
        ranked = curator.score_and_rank_shorts([dict(s) for s in shorts], scoring_cfg)
        partition = curator.partition_shorts_for_playlists(ranked, playlists_cfg)
    else:
        partition = {}

    result = []
    for pl in playlists_cfg:
        key = pl.get("id_key")
        info = managed.get(key, {})
        pl_id = info.get("playlist_id")
        pl_shorts = partition.get(key, {}).get("shorts", [])
        for s in pl_shorts:
            vid_id = s.get("id")
            s["thumbnail"] = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
            s["youtubeUrl"] = f"https://www.youtube.com/shorts/{vid_id}"

        result.append({
            "key": key,
            "title": pl.get("title"),
            "description": pl.get("description"),
            "privacy": pl.get("privacy", "public"),
            "strategy": pl.get("strategy", "rank_slice"),
            "max_items": pl.get("max_items", 15),
            "playlist_id": pl_id,
            "url": f"https://www.youtube.com/playlist?list={pl_id}" if pl_id else None,
            "video_count": info.get("video_count", len(pl_shorts)),
            "last_synced": info.get("last_synced"),
            "items": pl_shorts,
        })

    return jsonify({"playlists": result})

@app.route("/api/sync", methods=["POST"])
def run_sync():
    """
    Executes playlist synchronization.
    Supports dry_run=true (simulation) or dry_run=false (live write to YouTube).
    Supports playlist_key to sync ONLY one specific playlist if requested.
    """
    data = request.get_json() or {}
    dry_run = data.get("dry_run", True)
    playlist_key = data.get("playlist_key")

    if not dry_run and not os.path.exists(TOKEN_FILE):
        return jsonify({"success": False, "error": "Cannot run live sync without linking your YouTube account."}), 400

    config = load_config()
    shorts_cfg = config.get("shorts_detection", {})
    scoring_cfg = config.get("scoring", {})
    quota_cfg = config.get("quota", {})
    playlists_cfg = config.get("playlists", [])

    state = curator.StateManager(STATE_FILE)
    quota = curator.QuotaTracker(
        daily_budget=quota_cfg.get("max_daily_budget_units", 8000),
        reserve_buffer=quota_cfg.get("reserve_buffer_units", 200),
    )

    try:
        if os.path.exists(TOKEN_FILE):
            youtube = curator.get_authenticated_service(token_file=TOKEN_FILE, client_secrets_file=CLIENT_SECRETS_FILE)
            # Use cached shorts if available, or scan
            shorts = state.data.get("latest_scanned_shorts")
            if not shorts:
                shorts = curator.scan_channel_shorts(youtube, state, quota)
        else:
            # Fallback for dry-run simulation in demo mode
            shorts = [
                {"id": "s_v101", "title": "Top 3 Coding Tricks Every Developer Forgets 🚀", "duration": 38, "views": 482500, "likes": 42300, "comments": 1120, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=4)).isoformat()},
                {"id": "s_v102", "title": "Python One-Liners That Look Like Magic ✨", "duration": 44, "views": 890400, "likes": 78100, "comments": 2450, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=12)).isoformat()},
            ]
            youtube = None

        ranked = curator.score_and_rank_shorts(shorts, scoring_cfg)
        partition = curator.partition_shorts_for_playlists(ranked, playlists_cfg)

        # Filter to only the requested playlist if playlist_key is provided
        if playlist_key:
            partition = {k: v for k, v in partition.items() if k == playlist_key}

        sync_reports = []
        for key, pl_meta in partition.items():
            if dry_run or not youtube:
                # Simulated diff calculation
                added = len(pl_meta["shorts"])
                removed = 0
                retained = 0
                pl_id = state.get_playlist_id(key) or f"sim_pl_{key}"
                sync_reports.append({
                    "playlist_key": key,
                    "playlist_id": pl_id,
                    "title": pl_meta["config"]["title"],
                    "action": "simulated_sync",
                    "added": added,
                    "removed": removed,
                    "retained": retained,
                    "url": f"https://www.youtube.com/playlist?list={pl_id}"
                })
            else:
                report = curator.sync_playlist(
                    youtube=youtube,
                    playlist_key=key,
                    playlist_meta=pl_meta,
                    target_shorts=pl_meta["shorts"],
                    state=state,
                    quota=quota,
                    dry_run=dry_run
                )
                report["url"] = f"https://www.youtube.com/playlist?list={report['playlist_id']}"
                sync_reports.append(report)

        state.save()

        operation_status["sync"] = {
            "status": "success",
            "message": f"{'Dry run simulation' if dry_run else 'Live YouTube sync'} completed successfully!",
            "timestamp": datetime.datetime.now().isoformat(),
            "reports": sync_reports
        }

        return jsonify({
            "success": True,
            "dry_run": dry_run,
            "reports": sync_reports,
            "quota_summary": quota.summary(),
            "timestamp": datetime.datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/trends", methods=["GET"])
def get_trends():
    """
    Computes algorithmic trend velocity, momentum categories, and intelligent
    recommendations on which videos to add to which playlists.
    """
    config = load_config()
    scoring_cfg = config.get("scoring", {})
    state = curator.StateManager(STATE_FILE)

    raw_shorts = state.data.get("latest_scanned_shorts")
    if not raw_shorts:
        # Use rich baseline
        raw_shorts = [
            {"id": "s_v101", "title": "Top 3 Coding Tricks Every Developer Forgets 🚀", "duration": 38, "views": 482500, "likes": 42300, "comments": 1120, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=4)).isoformat()},
            {"id": "s_v102", "title": "Python One-Liners That Look Like Magic ✨", "duration": 44, "views": 890400, "likes": 78100, "comments": 2450, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=12)).isoformat()},
            {"id": "s_v103", "title": "Never Hardcode API Keys Again! (10s Fix) 🔒", "duration": 29, "views": 312000, "likes": 31900, "comments": 890, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)).isoformat()},
            {"id": "s_v104", "title": "Docker in 50 Seconds: The Visual Breakdown 🐳", "duration": 51, "views": 1240000, "likes": 98000, "comments": 3100, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=35)).isoformat()},
            {"id": "s_v105", "title": "PostgreSQL vs SQLite: Which Do You Actually Need? 🐘", "duration": 55, "views": 215000, "likes": 24200, "comments": 1340, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=8)).isoformat()},
            {"id": "s_v106", "title": "CSS Grid Trick That Solved My 3-Year Headache 🎨", "duration": 32, "views": 654000, "likes": 61000, "comments": 1780, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=20)).isoformat()},
            {"id": "s_v107", "title": "OAuth 2.0 Explained with Real Coffee Analogy ☕", "duration": 48, "views": 430000, "likes": 38500, "comments": 920, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=16)).isoformat()},
            {"id": "s_v108", "title": "Stop Using console.log! Use This Instead 🛑", "duration": 25, "views": 980000, "likes": 91200, "comments": 4120, "publishedAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=6)).isoformat()},
        ]

    ranked = curator.score_and_rank_shorts([dict(s) for s in raw_shorts], scoring_cfg)

    insights = []
    for s in ranked:
        views = max(s.get("views", 1), 1)
        likes = s.get("likes", 0)
        comments = s.get("comments", 0)
        age = max(s.get("age_days", 1.0), 0.5)

        velocity = round(views / age, 0)
        like_pct = round((likes / views) * 100, 2)
        comment_pct = round((comments / views) * 100, 2)

        # Classification
        if velocity > 50000 and age <= 10:
            category = "🔥 Viral Breakout"
            rec_playlist = "top_shorts"
            rec_reason = f"Surging at {int(velocity):,} views/day. Feature at the very top of 'Top Shorts' to capitalize on YouTube algorithm momentum."
        elif like_pct >= 9.5:
            category = "💎 Hidden Gem / Fan Favorite"
            rec_playlist = "hidden_gems"
            rec_reason = f"Outstanding {like_pct}% like-to-view ratio (industry benchmark: 6-8%). High audience retention makes this ideal for 'Hidden Gems'."
        elif age <= 14 and velocity > 20000:
            category = "⚡ Rising Star"
            rec_playlist = "rising_shorts"
            rec_reason = f"Fast-growing with {int(velocity):,} views/day. Add to 'Rising Shorts' to push it into the viral threshold."
        elif age > 30 and views > 500000:
            category = "🌲 Evergreen Pillar"
            rec_playlist = "top_shorts"
            rec_reason = "Proven long-tail evergreen hit. Keep in 'Top Shorts' as a flagship anchor to attract new subscribers."
        else:
            category = "📈 Steady Performer"
            rec_playlist = "rising_shorts"
            rec_reason = "Solid engagement base. Re-energize with higher playlist placement."

        insights.append({
            "id": s["id"],
            "title": s["title"],
            "views": views,
            "likes": likes,
            "comments": comments,
            "age_days": age,
            "velocity_views_per_day": velocity,
            "like_percentage": like_pct,
            "comment_percentage": comment_pct,
            "score": s["score"],
            "category": category,
            "recommended_playlist": rec_playlist,
            "recommendation_reason": rec_reason,
            "thumbnail": f"https://i.ytimg.com/vi/{s['id']}/hqdefault.jpg",
            "youtubeUrl": f"https://www.youtube.com/shorts/{s['id']}"
        })

    # Summary metrics
    avg_like_ratio = round(sum(i["like_percentage"] for i in insights) / max(len(insights), 1), 2)
    top_velocity_video = max(insights, key=lambda x: x["velocity_views_per_day"]) if insights else None

    return jsonify({
        "summary": {
            "total_analyzed": len(insights),
            "avg_like_ratio": avg_like_ratio,
            "top_velocity_title": top_velocity_video["title"] if top_velocity_video else "N/A",
            "top_velocity_rate": top_velocity_video["velocity_views_per_day"] if top_velocity_video else 0,
        },
        "trends": insights
    })

@app.route("/api/viral-advisor", methods=["GET"])
def get_viral_advisor():
    """
    Actionable viral video tips, retention blueprints, and trending topic suggestions.
    """
    # Proven viral hooks & structures
    hook_blueprints = [
        {
            "name": "The 'Before You Do X' Pattern Interrupt",
            "hook_example": "Stop doing this in 2026 before you regret it...",
            "why_it_works": "Triggers loss aversion and immediate curiosity within the first 1.5 seconds.",
            "target_duration": "20 - 32 seconds"
        },
        {
            "name": "The High-Contrast Speed Tutorial",
            "hook_example": "This 10-second trick took me 4 years to learn.",
            "why_it_works": "Creates massive perceived value exchange (years of pain for 10 seconds of attention).",
            "target_duration": "18 - 28 seconds"
        },
        {
            "name": "The Seamless Infinite Loop",
            "hook_example": "End your video mid-sentence matching the exact opening frame audio.",
            "why_it_works": "Triggers 120%+ average percentage viewed (APV), which is the #1 viral signal for YouTube Shorts.",
            "target_duration": "25 - 35 seconds"
        },
        {
            "name": "The Controversial Stance / Unpopular Truth",
            "hook_example": "Everyone is wrong about this topic, and here is why...",
            "why_it_works": "Sparks intense debate in the comments section, driving 4x-8x higher comment ratios.",
            "target_duration": "30 - 45 seconds"
        }
    ]

    trending_topics = [
        {
            "niche": "Tech, AI & Automation",
            "topics": [
                "New AI tools that replace entire software stacks in 30 seconds",
                "Automating mundane daily tasks with local Python scripts",
                "Hidden developer shortcuts nobody shows in tutorials",
                "Free alternatives to expensive SaaS tools"
            ],
            "hot_keywords": ["#coding", "#aitools", "#developer", "#productivity", "#techtok"]
        },
        {
            "niche": "Creator Growth & YouTube Algorithms",
            "topics": [
                "How the 2026 YouTube Shorts algorithm actually ranks your videos",
                "Why 30-second Shorts get 3x more views than 55-second ones",
                "The 3 thumbnail and title mistakes killing your Shorts CTR",
                "How to get viewers to re-watch your Shorts on loop"
            ],
            "hot_keywords": ["#youtubegrowth", "#algorithm", "#viralshorts", "#contentcreator"]
        },
        {
            "niche": "Productivity & Life Optimization",
            "topics": [
                "The 2-minute rule that permanently beats procrastination",
                "How to organize your digital workspace for zero friction",
                "Secret keyboard shortcuts that save 1 hour every single day"
            ],
            "hot_keywords": ["#productivityhacks", "#focus", "#lifehacks", "#efficiency"]
        }
    ]

    checklist = [
        {"step": 1, "rule": "Visual Hook in First 1.5 Seconds", "detail": "Add rapid movement, bold text overlay, or unexpected sound in frame 1. No logo intros."},
        {"step": 2, "rule": "Optimal Length Sweet Spot", "detail": "Target 22 to 34 seconds. Completion rate drops by 45% once a Short exceeds 45 seconds."},
        {"step": 3, "rule": "Comment Spark in Description/End Frame", "detail": "Ask a polarized choice question (e.g., 'Option A or B? Let me know below') to drive comments."},
        {"step": 4, "rule": "Audio Waveform & Pace", "detail": "Cut every pause longer than 0.3 seconds. Keep speaking cadence at 160-190 words per minute."},
        {"step": 5, "rule": "High-Contrast Title (Under 50 Characters)", "detail": "Ensure title doesn't get clipped on mobile viewports. Place emotional keywords first."}
    ]

    return jsonify({
        "viral_health_score": 88,
        "score_verdict": "High Viral Potential",
        "hook_blueprints": hook_blueprints,
        "trending_topics": trending_topics,
        "pre_publish_checklist": checklist
    })

@app.route("/api/trending-india", methods=["GET"])
def get_trending_india():
    """Fetches real-time trending YouTube videos and Shorts in India."""
    try:
        if not os.path.exists(TOKEN_FILE):
            return jsonify({"success": False, "error": "Channel not authenticated."}), 400

        youtube = curator.get_authenticated_service(token_file=TOKEN_FILE, client_secrets_file=CLIENT_SECRETS_FILE)
        res = youtube.videos().list(
            part="snippet,statistics,contentDetails",
            chart="mostPopular",
            regionCode="IN",
            maxResults=25
        ).execute()

        items = []
        for v in res.get("items", []):
            dur_iso = v.get("contentDetails", {}).get("duration", "")
            dur_sec = curator.parse_iso8601_duration(dur_iso)
            vid_id = v["id"]
            stats = v.get("statistics", {})
            snippet = v.get("snippet", {})
            
            # Format views
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            is_short = dur_sec <= 60 and dur_sec > 0

            items.append({
                "id": vid_id,
                "title": snippet.get("title", ""),
                "channelTitle": snippet.get("channelTitle", ""),
                "publishedAt": snippet.get("publishedAt", ""),
                "duration": dur_sec,
                "is_short": is_short,
                "views": views,
                "likes": likes,
                "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url") or f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg",
                "youtubeUrl": f"https://www.youtube.com/shorts/{vid_id}" if is_short else f"https://www.youtube.com/watch?v={vid_id}",
                "tags": snippet.get("tags", [])[:5]
            })

        return jsonify({"success": True, "videos": items})
    except Exception as e:
        logger.error(f"Error fetching India trends: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/trending-niche", methods=["GET"])
def get_trending_niche():
    """Returns curated viral trends tailored to the channel's niche (Hindi Comedy, Family & Relatable Sketches)."""
    niche_trends = [
        {
            "id": "t_n1",
            "concept": "Chai Aur Shaadi Ki Baatein (Chai Addict Relatable)",
            "hook": "Jab subah chai na mile toh pura ghar hil jata hai... ☕",
            "benchmark_views": "4.2M views in 7 days",
            "why_it_works": "Extreme cultural relatability across Indian households. Triggers high comment tagging of siblings and spouses.",
            "trending_hashtags": ["#chai", "#chailover", "#comedy", "#shortsfeed", "#relatable", "#funny"]
        },
        {
            "id": "t_n2",
            "concept": "Pati-Patni Shopping Reality (Husband vs Wife Drama)",
            "hook": "Shopping pe 5 minute bolkar 5 ghante nikal gaye! 🛍️😂",
            "benchmark_views": "6.8M views in 14 days",
            "why_it_works": "Universal couple dynamic. Relatable exaggeration leads to 130%+ loop retention.",
            "trending_hashtags": ["#couplecomedy", "#husbandwife", "#funnyvideo", "#viralshorts", "#comedy"]
        },
        {
            "id": "t_n3",
            "concept": "Mehmaan Aur Unki Advice (Relatable Relatives Encounter)",
            "hook": "Woh rishtedaar jo sirf marks aur shaadi puchne aate hain! 🏃‍♀️🤣",
            "benchmark_views": "3.5M views in 10 days",
            "why_it_works": "High emotional resonance with viewers of all age groups. Strong shareability on WhatsApp status.",
            "trending_hashtags": ["#relatives", "#familyshorts", "#desi", "#desicomedy", "#shortsfeed"]
        },
        {
            "id": "t_n4",
            "concept": "Bhabhi Ji Ki Taareef / Saas-Bahu Banter",
            "hook": "Bhabhi ne meri aisi tareef ki ki samajh hi nahi aaya beizzati thi ya tareef! 😳🤣",
            "benchmark_views": "5.1M views in 5 days",
            "why_it_works": "Family relationship dynamics are the highest viewed Shorts format in Northern and Central India.",
            "trending_hashtags": ["#bhabhi", "#familymemes", "#comedyshorts", "#ytshorts", "#trending"]
        }
    ]
    return jsonify({"success": True, "niche": "Hindi Comedy & Family Sketches", "trends": niche_trends})

@app.route("/api/generate-script", methods=["POST"])
def generate_script():
    """
    Generates a viral Short production script tailored for Hindi comedy/family channels.
    Supports 4 archetypes (family banter, trending sound, kids reaction, expectation vs reality),
    customizable durations (10s, 15s, 22s), punchline variations, on-screen text hooks,
    and seamless retention loops.
    """
    data = request.get_json() or {}
    topic = data.get("topic", "Chai time funny moment").strip()
    archetype = data.get("archetype", "family_banter")
    duration_mode = data.get("duration", "15s")
    punchline_idx = int(data.get("punchline_idx", 0))

    # Catalog of archetypes with authentic Hinglish comedy scripts & dynamic generators
    archetypes_info = {
        "family_banter": {
            "name": "Pati-Patni & Family Banter",
            "icon": "🎭",
            "description": "Rapid sarcastic dialogue & relatable everyday conflict between couples, siblings, or in-laws."
        },
        "trending_sound": {
            "name": "Trending Audio & Lip-Sync Guide",
            "icon": "🎵",
            "description": "Timestamped facial expression & physical comedy cues synced to viral beats like Jhinga la la."
        },
        "kids_reaction": {
            "name": "Kids & Cute Reaction Challenge",
            "icon": "👶",
            "description": "Spontaneous funny interactions and innocence-turned-savage punchlines (like Naksh dance)."
        },
        "expectation_vs_reality": {
            "name": "Expectation vs Reality / Desi Jugaad",
            "icon": "🤯",
            "description": "High-confidence start followed by an instant, hilarious reality check or failed desi hack."
        }
    }

    if archetype not in archetypes_info:
        archetype = "family_banter"

    clean_topic_tag = "".join(c for c in topic.title() if c.isalnum())

    if archetype == "family_banter":
        titles = [
            f"Jab Ghar Mein {topic} Par Jung Chhid Gayi! 😂 #shorts",
            f"Yeh Desi Gharon Ki Roz Ki Kahani Hai! 😭🤣 #shorts",
            f"Pati Ka Dimag Ya Patni Ka Order?! 💀 #shorts"
        ]
        hook_text = f"Ghar pe {topic} bolkar aisi aafat aayi... 😭"
        audio = "Bollywood comedic dholak beat / playful shehnai / dramatic vine boom"
        
        punchline_options = [
            "Maine toh bas pucha tha... inhone 5 saal puraana hisaab nikaal diya! 💀",
            "Ab batao, iska jawab haan du toh pitun, na du toh bhookha rahu! 😂",
            "Itna gussa toh CBI wale bhi inquiry me nahi dikhate jitna yahan mila! 🤣"
        ]
        active_punchline = punchline_options[punchline_idx % len(punchline_options)]

        if duration_mode == "10s":
            scenes = [
                {
                    "time": "0:00 - 0:04",
                    "label": "Hook: The Innocent Question (0-4s)",
                    "action": "Camera close-up on face with innocent, polite smile asking a simple household question.",
                    "dialogue": f"Suno na... bas itna bata do ki {topic} kab tak hoga?",
                    "camera": "0.5x wide angle close-up with quick snap zoom",
                    "onscreen_text": "Galti se pucch liya... 💀"
                },
                {
                    "time": "0:04 - 0:10",
                    "label": "Twist & Climax: The Explosive Comeback (4-10s)",
                    "action": "Sudden sharp pan to second person giving a death stare or hilarious dramatic monologue.",
                    "dialogue": active_punchline,
                    "camera": "Over-the-shoulder dramatic tilt",
                    "onscreen_text": "Pura hisaab barabar! 😂"
                }
            ]
            duration_str = "10 seconds (Ultra-Viral Loop)"
        elif duration_mode == "22s":
            scenes = [
                {
                    "time": "0:00 - 0:04",
                    "label": "Hook: Dramatic Setup (0-4s)",
                    "action": "Walking into room with extreme confidence, addressing family/spouse.",
                    "dialogue": f"Aaj maine decide kiya hai, {topic} main apne style se handle karunga!",
                    "camera": "Low-angle hero shot moving forward",
                    "onscreen_text": "Confidence check: 100% 😂"
                },
                {
                    "time": "0:04 - 0:10",
                    "label": "Escalation: The Reality Check (4-10s)",
                    "action": "Second character doesn't even look up, just utters one savage sarcastic line with a ladle or tea cup in hand.",
                    "dialogue": "Pehle subah ka geela tauliya bed se uthaya? Ya uske liye bhi shubh muhurat nikalwana padega?",
                    "camera": "Mid two-person kitchen/hall frame",
                    "onscreen_text": "Confidence down to 0% 😭"
                },
                {
                    "time": "0:10 - 0:17",
                    "label": "Climax: Savage Punchline (10-17s)",
                    "action": "Rapid facial expression breakdown. Frozen with shock. Hands automatically reaching out to obey.",
                    "dialogue": active_punchline,
                    "camera": "Slow cinematic zoom on defeated face with vine boom",
                    "onscreen_text": "Ghar ka kanoon! ⚖️😂"
                },
                {
                    "time": "0:17 - 0:22",
                    "label": "Loop Resolution: Comment Trigger (17-22s)",
                    "action": "Whispers directly into camera mic: 'Aapke ghar ka boss kaun hai? Comment me batao!'",
                    "dialogue": "Sach bolna, mummy ya papa? Ya tum dono hi darte ho? 😂👇",
                    "camera": "Front selfie eye-level closing frame",
                    "onscreen_text": "Comment karo jaldi! 👇"
                }
            ]
            duration_str = "22 seconds (Story Skit)"
        else: # 15s default
            scenes = [
                {
                    "time": "0:00 - 0:03",
                    "label": "Hook: Sudden Pattern Interrupt (0-3s)",
                    "action": "Starts speaking mid-sentence looking completely flabbergasted at camera.",
                    "dialogue": f"Yaar ek baat batao, {topic} me itna nakhra kyun hota hai?!",
                    "camera": "Close-up with quick snap zoom",
                    "onscreen_text": "Yeh roz ka scene hai! 🤦‍♂️"
                },
                {
                    "time": "0:03 - 0:09",
                    "label": "Escalation: The Dialogue Confrontation (3-9s)",
                    "action": "Cut to spouse/family member rolling eyes and dropping the cold truth with desi attitude.",
                    "dialogue": "Nakhra hum nahi karte! Nakhra toh tumhare dimaag me chalta hai 24 ghante!",
                    "camera": "Side-profile snappy cut",
                    "onscreen_text": "Full counter-attack! 🔥"
                },
                {
                    "time": "0:09 - 0:15",
                    "label": "Punchline & Loop Spark (9-15s)",
                    "action": "Blank blink expression, looking at camera like 'did you hear that?'. Cuts sound instantly.",
                    "dialogue": active_punchline,
                    "camera": "Direct front-facing frozen comic pose",
                    "onscreen_text": "Aapke sath bhi aisa hota hai? 😂"
                }
            ]
            duration_str = "15 seconds (Sweet-Spot Retention)"

        loop_technique = "Sound abruptly cuts on the final eye-blink so the re-play feels like the confrontation is looping continuously."
        comment_spark = "Aapke ghar me aisi ladayi me kaun jeetta hai? Pati ya Patni? Comment me batao! 😂👇"

    elif archetype == "trending_sound":
        titles = [
            f"Jhinga La La Vibe Check! 🤣🔥 #shorts #{clean_topic_tag}",
            f"When This Song Plays in Desi House! 😂💃 #shorts",
            f"Wait For The Beat Drop Reaction! 😳💥 #shorts"
        ]
        hook_text = "End tak expression dekho! 🤣"
        audio = "Viral 'Jhinga Lala Hu Hu' / 'Kaka Dada Mama' / Trending Bollywood Bass Drop"
        
        punchline_options = [
            "Beat drop pe aisi acting ki padosi bhi window se dekhne lage! 🤣💃",
            "Dance karne gaye the... pairo me moch alag aa gayi! 😭😂",
            "Yeh step dekhkar mummy boli: padhai me itna dhyan lagata toh collector hota! 💀"
        ]
        active_punchline = punchline_options[punchline_idx % len(punchline_options)]

        scenes = [
            {
                "time": "0:00 - 0:03",
                "label": "Beat Setup: The Serious Face (0-3s)",
                "action": "Standing completely serious with folded arms while the slow intro of trending audio plays.",
                "dialogue": "Dil me tha serious banna... lekin beat ne majboor kar diya! 🎵",
                "camera": "Still medium shot",
                "onscreen_text": "Wait for beat drop... ⏳"
            },
            {
                "time": "0:03 - 0:08",
                "label": "Beat Drop: Sudden Energetic Dance / Expression (3-8s)",
                "action": "Instant chaos! Hilarious lip-sync, crazy eye movements, sudden desi hook steps perfectly on beat.",
                "dialogue": "Jhinga lala hu hu! 🕺💃 (Lip-sync high energy)",
                "camera": "Fast hand-held shaky cam with speed ramps",
                "onscreen_text": "Energy 200% 🔥😂"
            },
            {
                "time": "0:08 - 0:12",
                "label": "The Unexpected Interruption / Climax (8-12s)",
                "action": "Mummy/Spouse walks in holding broom or tea cup, watching with complete disbelief.",
                "dialogue": active_punchline,
                "camera": "Rapid zoom into their stunned reaction",
                "onscreen_text": "Caught in 4K! 😳💀"
            }
        ]
        duration_str = "12 seconds (Audio-Sync Loop)"
        loop_technique = "Audio loop matches the beat seamlessly so viewers rewatch 2-3 times to catch all facial expressions."
        comment_spark = "Kiska dance step zyada khatarnak tha? Vote in comments! 💃👇"

    elif archetype == "kids_reaction":
        titles = [
            f"Bache Ne Sach Bol Diya Sabke Samne! 😳🤣 #shorts",
            f"Naksh Ne Diya Aisa Savage Jawab! 😭👏 #shorts",
            f"Innocent Question Ka Bada Dhamaka! 😂 #shorts"
        ]
        hook_text = "Bache jhoot nahi bolte... 😭"
        audio = "Cute whimsical whistle + Sudden dramatic meme sting ('Oooooh' meme sound)"
        
        punchline_options = [
            "Bacha bola: 'Mummy toh papa ko roz yehi bolti hain!' 😳💀",
            "Itna sach bhi nahi bolna tha beta, ghar me aag lag gayi! 😭🤣",
            "Ab batao isko chocolate du ya phone band karu?! 😂"
        ]
        active_punchline = punchline_options[punchline_idx % len(punchline_options)]

        scenes = [
            {
                "time": "0:00 - 0:03",
                "label": "The Innocent Question (0-3s)",
                "action": "Holding phone camera asking child/kid casually while they are playing or eating.",
                "dialogue": f"Beta ek baat batao... ghar me sabse zyada {topic} kaun karta hai?",
                "camera": "Eye-level warm natural angle",
                "onscreen_text": "Innocent question... 😇"
            },
            {
                "time": "0:03 - 0:08",
                "label": "The Unfiltered Savage Answer (3-8s)",
                "action": "Child pauses, looks straight into lens without hesitation, drops the bomb.",
                "dialogue": active_punchline,
                "camera": "Slow punch-in zoom on kid's confident innocent face",
                "onscreen_text": "Savage reply! 💥😂"
            },
            {
                "time": "0:08 - 0:13",
                "label": "Parent's Frozen Reaction (8-13s)",
                "action": "Camera flips or pans to parent's jaw dropped, eyes wide, trying to cover child's mouth playfully.",
                "dialogue": "Are chup karo! Yeh camera on hai! 🤫😭",
                "camera": "Handheld selfie panic reaction",
                "onscreen_text": "Pura pol khol diya! 🤦‍♀️"
            }
        ]
        duration_str = "13 seconds (High Shareability Loop)"
        loop_technique = "Ends on the playful scramble so the audio seamlessly transitions back into the innocent question."
        comment_spark = "Kya aapke bache bhi sabke samne aisi pol kholte hain? 😂👇"

    else: # expectation_vs_reality
        titles = [
            f"Expectation vs Reality: {topic} Edition! 😭😂 #shorts",
            f"Instagram Reel vs Asli Zindagi! 💀 #shorts",
            f"Yeh Hack Kabhi Mat Try Karna! 🤣 #shorts"
        ]
        hook_text = "Expectation vs Reality 😳"
        audio = "Smooth aesthetic lofi intro -> Instant record scratch & funny fail brass sound"
        
        punchline_options = [
            "Reels me hero lag rahe the... asaliyat me cartoon ban gaye! 😭😂",
            "5 minute ka desi jugaad ab 5 din tak thik nahi hoga! 💀",
            "Mene socha tha tareef hogi... yahan sab milkar has rahe hain! 🤣"
        ]
        active_punchline = punchline_options[punchline_idx % len(punchline_options)]

        scenes = [
            {
                "time": "0:00 - 0:05",
                "label": "Part 1: Expectation (Aesthetic & Perfect) (0-5s)",
                "action": "Posing gracefully in slow-mo with aesthetic smile or trying a viral trending hack confidently.",
                "dialogue": f"Maine socha {topic} kitna aasan aur aesthetic hoga...",
                "camera": "Smooth cinematic slow pan with bright lighting",
                "onscreen_text": "Expectation ✨😍"
            },
            {
                "time": "0:05 - 0:12",
                "label": "Part 2: Reality (Instant Desi Chaos) (5-12s)",
                "action": "Sudden record scratch! Everything goes wrong: slipped, spilled, funny face covered in chaos.",
                "dialogue": active_punchline,
                "camera": "0.5x wide ultra-raw zoom on the mess",
                "onscreen_text": "Reality 💀😭"
            },
            {
                "time": "0:12 - 0:15",
                "label": "The Silent Stare (12-15s)",
                "action": "Looking deadpan into the lens with defeat while sad comedic music or cricket chirp sound plays.",
                "dialogue": "Kripya karke koi mujhe bacha lo... 😂",
                "camera": "Freeze frame on expression",
                "onscreen_text": "Tag that one friend who always does this! 👇"
            }
        ]
        duration_str = "15 seconds (Relatable Twist Loop)"
        loop_technique = "Freeze frame cut directly back into the glamorous slow-mo intro for extreme contrast looping."
        comment_spark = "Aapke sath bhi aisa kata hai kabhi? Sach sach batao! 😂👇"

    script_payload = {
        "title": titles[0],
        "titles_pool": titles,
        "hook": hook_text,
        "archetype": archetype,
        "archetype_name": archetypes_info[archetype]["name"],
        "duration": duration_str,
        "duration_mode": duration_mode,
        "audio_suggestion": audio,
        "onscreen_hook_text": hook_text,
        "loop_ending_technique": loop_technique,
        "comment_spark": comment_spark,
        "scenes": scenes,
        "punchline_variations": punchline_options,
        "current_punchline_idx": punchline_idx % len(punchline_options),
        "hashtags": [
            f"#{clean_topic_tag.lower()}" if clean_topic_tag else "#desicomedy",
            "#funny",
            "#comedy",
            "#shortsfeed",
            "#viralshorts",
            "#youtubeshorts",
            "#trending"
        ]
    }

    return jsonify({"success": True, "script": script_payload, "archetypes": archetypes_info})


@app.route("/api/generate-hashtag-post", methods=["POST"])
def generate_hashtag_post():
    """
    Generates a full SEO-optimized hashtag post description
    matching the format from the user's reference screenshot:
    - Primary title with front hashtag (#shorts / #timelapse)
    - Compelling storytelling description with emojis
    - Curated hashtag cluster at bottom for maximum discovery
    """
    data = request.get_json() or {}
    title = data.get("title", "Desi Comedy Short")
    video_id = data.get("video_id", "")

    # Clean title
    clean_title = title.replace("#shorts", "").replace("#shortsfeed", "").replace("#viral", "").strip()

    formatted_title = f"{clean_title} 😂 #shorts"
    description = (
        f"Experience the funniest relatable moment from our daily desi life! 🤣✨\n"
        f"This short brings you genuine laughter, family humor, and everyday relatable twists.\n"
        f"🧡 😭 🤣 👉 Watch till the end for the unexpected climax that will make you smile!\n\n"
        f"Perfect for family comedy lovers, desi sketch fans, and anyone who loves good laughter. 🔔 ✨ "
        f"Subscribe to @sasikalasingh-o4j for daily funny Shorts and comedy sketches!\n\n"
        f"#shortsfeed #shorts #youtubeshorts #funnyvideo #comedy #comedyshorts #viralshorts #trending #desicomedy"
    )

    return jsonify({
        "success": True,
        "formatted_title": formatted_title,
        "description": description,
        "hashtags": ["#shortsfeed", "#shorts", "#youtubeshorts", "#funnyvideo", "#comedy", "#comedyshorts", "#viralshorts", "#trending", "#desicomedy"]
    })

@app.route("/api/update-video-metadata", methods=["POST"])
def update_video_metadata():
    """Updates the title, description, and tags on a real YouTube video via YouTube Data API."""
    data = request.get_json() or {}
    video_id = data.get("video_id")
    new_title = data.get("title")
    new_description = data.get("description")
    tags = data.get("tags", ["shorts", "comedy", "funny", "shortsfeed", "viral"])

    if not video_id or not new_title:
        return jsonify({"success": False, "error": "Video ID and title are required."}), 400

    try:
        if not os.path.exists(TOKEN_FILE):
            return jsonify({"success": False, "error": "Channel not authenticated."}), 400

        youtube = curator.get_authenticated_service(token_file=TOKEN_FILE, client_secrets_file=CLIENT_SECRETS_FILE)
        
        # Get existing categoryId to preserve video category
        v_get = youtube.videos().list(id=video_id, part="snippet").execute()
        items = v_get.get("items", [])
        if not items:
            return jsonify({"success": False, "error": "Video not found on YouTube."}), 404

        cat_id = items[0]["snippet"].get("categoryId", "23")

        update_res = youtube.videos().update(
            part="snippet",
            body={
                "id": video_id,
                "snippet": {
                    "title": new_title,
                    "description": new_description,
                    "tags": tags,
                    "categoryId": cat_id
                }
            }
        ).execute()

        return jsonify({
            "success": True,
            "message": f"Successfully updated video metadata and hashtags on YouTube for video {video_id}!",
            "video_url": f"https://www.youtube.com/shorts/{video_id}"
        })
    except Exception as e:
        logger.error(f"Error updating video metadata: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/config", methods=["GET", "POST"])
def handle_config():
    """Reads or updates configuration."""
    if request.method == "POST":
        new_cfg = request.get_json()
        if not new_cfg:
            return jsonify({"success": False, "error": "No config payload provided"}), 400
        save_config(new_cfg)
        return jsonify({"success": True, "config": new_cfg})
    return jsonify({"config": load_config()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting Curator API server on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
