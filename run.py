#!/usr/bin/env python3
"""
Launcher for YouTube Shorts Playlist Creator & Dashboard
Starts both the Flask API server (port 5000) and the Vite frontend (port 3000),
then opens your browser to http://localhost:3000.
"""

import os
import sys
import time
import subprocess
import webbrowser

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root_dir)

    print("=" * 60)
    print("  YouTube Shorts Playlist Creator & Growth Dashboard")
    print("=" * 60)
    print("  Backend API   : http://127.0.0.1:5000")
    print("  Web Dashboard : http://localhost:3000")
    print("=" * 60)

    # 1. Start Python Flask API Server
    print("[1/2] Starting Backend API Server (server.py)...")
    server_process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=root_dir
    )

    # 2. Start Vite Frontend Server
    print("[2/2] Starting Frontend Dashboard (Vite)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=root_dir
    )

    # Give servers a moment to initialize
    time.sleep(2)

    # 3. Open Browser
    print("\n[READY] Launching Dashboard in your default browser...")
    webbrowser.open("http://localhost:3000")

    print("\nPress Ctrl+C anytime to stop both servers.")

    try:
        server_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        server_process.terminate()
        frontend_process.terminate()
        server_process.wait()
        frontend_process.wait()
        print("Done.")

if __name__ == "__main__":
    main()
