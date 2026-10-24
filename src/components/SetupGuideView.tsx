import { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, ShieldAlert, Clock, Cloud } from 'lucide-react';

export function SetupGuideView() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-slate-100">
          Setup &amp; Scheduling Guide
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span>GCP Project Setup</span>
          <span aria-hidden="true">·</span>
          <span>YouTube Data API v3</span>
          <span aria-hidden="true">·</span>
          <span>One-Time Local Auth</span>
          <span aria-hidden="true">·</span>
          <span>Unattended Automation (Cron / CI)</span>
        </div>
      </div>

      {/* 5-Step Visual Stepper */}
      <div className="space-y-6 text-xs text-slate-300">
        {/* Step 1: GCP Setup */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0 border border-red-500/30">
              1
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Create Google Cloud Project &amp; Enable YouTube Data API v3
            </h3>
          </div>

          <p className="text-slate-400 leading-relaxed pl-8">
            1. Open{' '}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
              className="text-red-400 hover:underline inline-flex items-center gap-0.5"
            >
              Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>{' '}
            and create a new project named <strong className="text-slate-200">YouTube-Shorts-Curator</strong>.
            <br />
            2. In the search bar, search for <strong className="text-slate-200">YouTube Data API v3</strong> and click <strong className="text-slate-200">Enable</strong>.
          </p>
        </div>

        {/* Step 2: OAuth Consent & 7-Day Expiry Fix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0 border border-red-500/30">
              2
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Configure OAuth Consent Screen &amp; Permanent Refresh Token
            </h3>
          </div>

          <div className="pl-8 space-y-3">
            <p className="text-slate-400 leading-relaxed">
              1. Navigate to <strong>APIs &amp; Services &gt; OAuth consent screen</strong>.<br />
              2. Choose <strong>External</strong>, and fill in App Name (e.g. <em>Shorts Curator</em>) and your email.<br />
              3. Under <strong>Scopes</strong>, add <code className="text-slate-200 font-mono">https://www.googleapis.com/auth/youtube</code>.<br />
              4. Under <strong>Test users</strong>, add the Google Account of your YouTube channel.
            </p>

            {/* Warning Callout */}
            <div className="bg-amber-950/20 border border-amber-900/50 rounded-lg p-3 text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Prevent 7-Day Token Revocation:</strong> In Google's policy, OAuth tokens in "Testing" mode expire after 7 days! On the OAuth Consent Screen summary page, click <strong>"Publish App"</strong> (In Production). You do not need verification because this app is used exclusively by you for your own channel.
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Download Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0 border border-red-500/30">
              3
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Create Desktop OAuth Client ID &amp; Download client_secret.json
            </h3>
          </div>

          <div className="pl-8 space-y-2">
            <p className="text-slate-400 leading-relaxed">
              1. Go to <strong>APIs &amp; Services &gt; Credentials</strong>.<br />
              2. Click <strong>Create Credentials &gt; OAuth client ID</strong>.<br />
              3. Select <strong>Desktop app</strong> as the Application Type.<br />
              4. Download the resulting JSON file, rename it to <code className="text-slate-200 font-mono">client_secret.json</code>, and place it in your curator script folder.
            </p>
          </div>
        </div>

        {/* Step 4: One-Time Local Auth */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0 border border-red-500/30">
              4
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              One-Time Interactive Authentication &amp; Dry Run
            </h3>
          </div>

          <div className="pl-8 space-y-3">
            <p className="text-slate-400 leading-relaxed">
              Run this once on your local machine with a browser. It prompts you to sign in to your YouTube account and securely generates <code className="text-slate-200 font-mono">token.json</code>:
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-slate-300">
              <code>python curator.py --auth-only</code>
              <button
                onClick={() => copySnippet('auth_cmd', 'python curator.py --auth-only')}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                {copiedId === 'auth_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Now test your channel scan and ranking with zero YouTube API writes:
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-slate-300">
              <code>python curator.py --dry-run -v</code>
              <button
                onClick={() => copySnippet('dry_cmd', 'python curator.py --dry-run -v')}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                {copiedId === 'dry_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Step 5: Unattended Automation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0 border border-red-500/30">
              5
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Schedule Unattended Runs (Cron / GitHub Actions / Windows Task)
            </h3>
          </div>

          <div className="pl-8 space-y-4">
            {/* Option A: GitHub Actions */}
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span>Option A: GitHub Actions (Recommended Serverless Cloud Runner)</span>
              </div>
              <p className="text-slate-400">
                Copy the text of your generated <code className="text-slate-300">token.json</code> and add it as a secret named <code className="text-slate-200">YOUTUBE_TOKEN_JSON</code> in your GitHub repository (Settings &gt; Secrets &gt; Actions). The workflow in <code className="text-slate-300">.github/workflows/refresh_shorts_playlists.yml</code> will run daily at 06:00 UTC and commit updated state back automatically.
              </p>
            </div>

            {/* Option B: Linux Crontab */}
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Option B: Linux / macOS Crontab</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 flex items-center justify-between">
                <code>0 4 * * * cd /path/to/curator && python3 curator.py --config config.yaml &gt;&gt; curator.log 2&gt;&amp;1</code>
                <button
                  onClick={() =>
                    copySnippet(
                      'cron_cmd',
                      '0 4 * * * cd /path/to/curator && python3 curator.py --config config.yaml >> curator.log 2>&1'
                    )
                  }
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {copiedId === 'cron_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Option C: Windows Task Scheduler */}
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>Option C: Windows Task Scheduler</span>
              </div>
              <p className="text-slate-400">
                In Windows Task Scheduler (<code className="text-slate-300">taskschd.msc</code>), create a Basic Task triggered daily. Under Action &gt; Start a program:
                <br />
                Program: <code className="text-slate-300">python.exe</code> | Arguments: <code className="text-slate-300">curator.py --config config.yaml</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
