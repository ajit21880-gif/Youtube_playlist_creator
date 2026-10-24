# YouTube Shorts Playlist Curator - Complete Setup & Operations Guide

This guide walks you through setting up unattended, automatic YouTube Shorts playlist curation with Google OAuth 2.0 and YouTube Data API v3.

---

## 1. Google Cloud Project & API Credentials (One-Time Setup)

### Step 1.1: Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top bar, click the project selector dropdown and click **"New Project"**.
3. Name it `YouTube-Shorts-Curator` and click **Create**.

### Step 1.2: Enable YouTube Data API v3
1. In the Cloud Console search bar, search for **"YouTube Data API v3"**.
2. Click on it and press **Enable**.

### Step 1.3: Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace organization) and click **Create**.
3. Fill in:
   - **App name**: `Shorts Playlist Curator`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the **Scopes** page:
   - Click **Add or Remove Scopes**.
   - Search for `https://www.googleapis.com/auth/youtube` and select it (allows viewing and managing your YouTube account and playlists).
   - Click **Update** and **Save and Continue**.
6. On the **Test users** page:
   - Click **Add Users** and add the Google Account associated with your YouTube Channel.
7. Click **Save and Continue**.

> 💡 **CRITICAL TIP ON TOKEN EXPIRATION**:
> If your OAuth consent status is left in **"Testing"**, Google automatically expires refresh tokens after **7 days**, requiring re-authentication. To allow indefinite unattended execution, go to the OAuth consent screen and click **"Publish App"** (move to Production). Because this is your personal tool for your own channel, you do not need Google verification—you can bypass the unverified app warning when logging in.

### Step 1.4: Create OAuth 2.0 Client ID Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials** at the top > select **OAuth client ID**.
3. For **Application type**, choose **Desktop app**.
4. Set name: `Shorts Curator Desktop Client`.
5. Click **Create**.
6. In the modal that appears, click **Download JSON**.
7. Rename this downloaded file to `client_secret.json` and place it in the same directory as `curator.py`.

---

## 2. One-Time Authentication Flow

On your local machine (where you have a web browser):

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Authenticate once interactively
python curator.py --auth-only
```

- A browser window will open automatically asking you to log into Google and grant access to manage your YouTube channel.
- Complete the consent prompt.
- The script will securely write your refresh token into `token.json`.
- **That's it!** You never need to open a browser again. All subsequent runs will use this token to auto-refresh in the background without user prompts.

---

## 3. Testing with Dry-Run Mode

Before modifying any real playlists, test your channel scan and ranking without touching YouTube:

```bash
python curator.py --dry-run -v
```

This will:
1. Scan your uploads and detect all genuine Shorts (using ISO-8601 duration and HEAD redirect checks).
2. Rank your Shorts using the engagement scoring formula.
3. Compute the exact diff (+additions, -removals, reordering) needed for each playlist.
4. Output the estimated YouTube API quota consumption.
5. Exit without making any writes to your channel.

---

## 4. Unattended Automated Scheduling

### Method A: GitHub Actions (Recommended Cloud Automation)
This repository includes `.github/workflows/refresh_shorts_playlists.yml`.

1. Open your generated `token.json` file on your computer and copy its entire JSON text.
2. In your GitHub repository:
   - Go to **Settings > Secrets and variables > Actions**.
   - Click **New repository secret**.
   - Name: `YOUTUBE_TOKEN_JSON`
   - Value: Paste the JSON contents of `token.json`.
   - Click **Add secret**.
3. Commit `curator.py`, `config.yaml`, `requirements.txt`, and the workflow file.
4. The workflow will run daily at 06:00 UTC, refresh your playlists, and commit the updated `state.json` cache automatically.

---

### Method B: Linux / macOS Crontab
If you run on a Linux VPS, Raspberry Pi, or home server:

```bash
# Open crontab editor
crontab -e

# Run daily at 04:00 AM (server local time)
0 4 * * * cd /path/to/shorts_curator && /usr/bin/python3 curator.py --config config.yaml >> curator.log 2>&1

# Or run every Monday at 05:00 AM
0 5 * * 1 cd /path/to/shorts_curator && /usr/bin/python3 curator.py --config config.yaml >> curator.log 2>&1
```

---

### Method C: Windows Task Scheduler
1. Open **Task Scheduler** in Windows (`taskschd.msc`).
2. Click **Create Basic Task...** in the right panel.
3. Name: `YouTube Shorts Playlist Curator`.
4. Trigger: Choose **Daily** or **Weekly** and specify the time.
5. Action: **Start a program**.
   - Program/script: `C:\Users\YourUser\AppData\Local\Programs\Python\Python311\python.exe`
   - Add arguments: `curator.py --config config.yaml`
   - Start in: `C:\path\to\shorts_curator\`
6. Click **Finish**.

---

## 5. YouTube API Quota Awareness & Strategy

### API Unit Costs:
| API Call | Operation | Quota Cost |
| :--- | :--- | :--- |
| `channels.list` | Get channel uploads playlist | 1 unit |
| `playlistItems.list` | List videos in playlist (50 items) | 1 unit |
| `videos.list` | Fetch stats for 50 videos | 1 unit |
| `playlists.insert` | Create a new playlist | 50 units |
| `playlistItems.insert` | Add a video to a playlist | 50 units |
| `playlistItems.delete` | Remove a video from playlist | 50 units |

### How This Tool Preserves Quota:
1. **Batching**: Uploads and video statistics are fetched in maximum batches of 50 IDs per call.
2. **Smart Diffing**: The tool checks what is *already* in your playlist. If a video is already present, it is not touched (saving 50 units per item).
3. **Short Status Caching**: Once a video is verified as a Short, the result is saved in `state.json` so future runs don't waste network requests.
4. **Budget Protection**: Configured with a default `max_daily_budget_units: 8000` (leaving 2,000 units safe margin against YouTube's 10,000 daily limit).
5. **State Checkpointing**: Saves state after every playlist modification so that even if network drops or quotas are met, the next run picks up exactly where it left off.
