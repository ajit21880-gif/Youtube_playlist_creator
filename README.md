# YouTube Shorts Playlist Creator & Growth Dashboard

Automated, unattended backend tool and interactive web dashboard that creates, analyzes, and continuously refreshes performance-ranked YouTube Shorts playlists on your channel.

---

## ✨ Features & Capabilities

- 📊 **Interactive Web Dashboard**: View connected channel details, live verified Shorts feed, video duration, view counts, like-to-view ratios, and current playlist placements.
- ⚡ **Trend Velocity & Playlist Recommendations**: Evaluates acceleration (views/day) and engagement ratios to intelligently recommend which Shorts should be added to which playlists (Top Shorts, Rising, or Hidden Gems).
- 💡 **Viral Advisor & Trending Topics Hub**: Built-in viral health scorecard, 4 proven psychological hook blueprints, 5-point pre-publish checklist, and high-demand trending topics.
- 🔗 **One-Click Channel Linking & Sync**: Link your Google/YouTube account via OAuth 2.0 directly in the dashboard, scan channel uploads, and publish/update playlists with real-time feedback.
- 🎯 **Reliable Shorts Detection**: Combines YouTube API ISO-8601 duration $\le 60\text{s}$ with HTTP HEAD redirect verification (`youtube.com/shorts/{id}` returns 200 for Shorts, 303 redirect for horizontal videos).
- 📐 **Transparent Scoring**: Ranks Shorts using configurable weights for likes (primary driver), like-to-view ratio, comment rate, and exponential recency half-life decay.
- 🔄 **Idempotent Smart Diffing**: Compares target rankings against current playlist items and only executes necessary adds and deletes, preventing duplicates.
- 🛡️ **Strict Quota Awareness**: Batches lookups in 50-ID chunks, tracks daily unit costs (50 units per playlist write), and halts before hitting YouTube's 10,000 unit daily quota limit.
- ⏰ **Scheduled Automations**: Ready-to-use configs for GitHub Actions, Linux `cron`, and Windows Task Scheduler.

---

## 🚀 Quick Start (Web Dashboard)

1. **Launch the Application**:
   - Double-click **`start.bat`** (on Windows) or run:
     ```bash
     python run.py
     ```
2. The browser will automatically open to **`http://localhost:3000`**.
3. In the Dashboard:
   - Click **"Link YouTube Channel"** to authorize your account.
   - Click **"Scan Channel Uploads"** to detect and rank your Shorts.
   - Explore **"Trend Suggestions"** and **"Viral Hub"**.
   - Click **"Sync to YouTube"** to publish or update the playlists on your channel!

---

## 💻 CLI Usage (Headless / Cron)

You can also run unattended directly via command line:

```bash
# 1. One-time interactive OAuth authorization (if not already done via UI)
python curator.py --auth-only

# 2. Run simulation dry-run
python curator.py --dry-run

# 3. Run unattended sync
python curator.py
```

### CLI Arguments
```
usage: curator.py [-h] [--config CONFIG] [--dry-run] [--auth-only] [--status] [--verbose]

optional arguments:
  --config CONFIG, -c CONFIG   Path to YAML config (default: config.yaml)
  --dry-run                    Simulate without writing to YouTube
  --auth-only                  Perform one-time interactive OAuth 2.0 authorization
  --status                     Show currently managed playlists and sync timestamps
  --verbose, -v                Enable verbose debug logs
```

For full details on GCP project setup and crontab/GitHub Actions workflows, read [SETUP_GUIDE.md](SETUP_GUIDE.md).
