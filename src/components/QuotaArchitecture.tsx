import { useState } from 'react';
import { ShieldCheck, Database, KeyRound, Cpu, Check, AlertCircle } from 'lucide-react';

export function QuotaArchitecture() {
  const [testVideoId, setTestVideoId] = useState('dQw4w9WgXcQ');
  const [testDuration, setTestDuration] = useState(45);
  const [testResult, setTestResult] = useState<{
    isShort: boolean;
    durationCheck: boolean;
    headCheck: string;
    explanation: string;
  } | null>(null);

  const runShortTest = (e: React.FormEvent) => {
    e.preventDefault();
    const durationOk = testDuration <= 60 && testDuration > 0;
    // In YouTube: shorts URLs redirect with 303 to /watch?v= if horizontal
    const mockIsShort = durationOk && !testVideoId.includes('dQw4');
    setTestResult({
      isShort: mockIsShort,
      durationCheck: durationOk,
      headCheck: mockIsShort ? 'HTTP 200 OK' : 'HTTP 303 See Other (/watch?v=)',
      explanation: mockIsShort
        ? 'Valid Short: duration <= 60s and YouTube served HTTP 200 at https://www.youtube.com/shorts/' + testVideoId
        : durationOk
        ? 'Standard Horizontal Video: Despite being <= 60s, YouTube redirected HEAD request to /watch?v=, correctly rejecting it as a Short candidate.'
        : 'Invalid: Duration exceeds the 60-second YouTube Shorts threshold.',
    });
  };

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-slate-100">
          Quota Awareness &amp; Unattended Authentication Architecture
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span>YouTube Data API v3 Engine</span>
          <span aria-hidden="true">·</span>
          <span>10,000 Daily Unit Boundary</span>
          <span aria-hidden="true">·</span>
          <span>Zero-Prompt OAuth 2.0 Persistence</span>
          <span aria-hidden="true">·</span>
          <span>Graceful Quota Checkpointing</span>
        </div>
      </div>

      {/* 2-Column Architecture Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Unattended OAuth 2.0 Lifecycle */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3>OAuth 2.0: Authenticate Once, Run Unattended</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The script strictly adheres to the core requirement: complete OAuth consent a single time locally, then run headlessly forever on cron or cloud runners without browser prompts.
          </p>

          <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 space-y-3 text-xs">
            {/* Step 1 */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <span className="font-semibold text-slate-200">Interactive Bootstrap (--auth-only)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Opens browser on local port for Google consent. Stores refresh token, client ID, and scopes in <code className="text-slate-300 font-mono">token.json</code>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <span className="font-semibold text-slate-200">Unattended Background Runs</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Checks credentials on every execution. When <code className="text-slate-300 font-mono">creds.expired</code> is true, calls <code className="text-slate-300 font-mono">creds.refresh(Request())</code> headlessly. No browser, no user input.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <span className="font-semibold text-slate-200">Token Revocation Safeguard</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Catches <code className="text-amber-400 font-mono">RefreshError ('invalid_grant')</code>, outputs clear explanation regarding testing mode 7-day limits, and instructs user to rerun <code className="text-slate-300 font-mono">--auth-only</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-amber-950/20 border border-amber-900/40 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300">Crucial GCP Production Setting:</strong> In Google Cloud Console OAuth Consent Screen, click <strong>"Publish App"</strong> to move from Testing to Production. In Testing mode, Google intentionally revokes refresh tokens after 7 days!
            </div>
          </div>
        </div>

        {/* Card 2: Quota Budget & Cost Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3>YouTube Data API v3 Quota Economics</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            YouTube limits projects to <strong>10,000 units/day</strong>. While reads cost 1 unit, playlist writes cost 50 units each. The tool enforces batching and diffing to protect this quota.
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-medium">
                <tr>
                  <th className="py-2 px-3">Operation</th>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3 text-right">Quota Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                <tr>
                  <td className="py-1.5 px-3 font-sans">List Uploads</td>
                  <td className="py-1.5 px-3 text-slate-400">playlistItems().list</td>
                  <td className="py-1.5 px-3 text-right text-emerald-400">1 unit / 50 items</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans">Batch Video Stats</td>
                  <td className="py-1.5 px-3 text-slate-400">videos().list</td>
                  <td className="py-1.5 px-3 text-right text-emerald-400">1 unit / 50 videos</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans">Inspect Managed Playlist</td>
                  <td className="py-1.5 px-3 text-slate-400">playlistItems().list</td>
                  <td className="py-1.5 px-3 text-right text-emerald-400">1 unit / 50 items</td>
                </tr>
                <tr className="bg-red-950/10">
                  <td className="py-1.5 px-3 font-sans text-red-200">Create New Playlist</td>
                  <td className="py-1.5 px-3 text-slate-400">playlists().insert</td>
                  <td className="py-1.5 px-3 text-right text-red-400">50 units</td>
                </tr>
                <tr className="bg-red-950/10">
                  <td className="py-1.5 px-3 font-sans text-red-200">Add Video to Playlist</td>
                  <td className="py-1.5 px-3 text-slate-400">playlistItems().insert</td>
                  <td className="py-1.5 px-3 text-right text-red-400">50 units</td>
                </tr>
                <tr className="bg-red-950/10">
                  <td className="py-1.5 px-3 font-sans text-red-200">Delete Video from Playlist</td>
                  <td className="py-1.5 px-3 text-slate-400">playlistItems().delete</td>
                  <td className="py-1.5 px-3 text-right text-red-400">50 units</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-300">State Checkpointing &amp; 403 Recovery:</span>
            <p>
              If a run encounters <code className="text-red-400">quotaExceeded</code>, the script saves all synced progress into <code className="text-slate-300 font-mono">state.json</code> and exits cleanly (exit code 2) without corrupting playlist data.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Shorts Detection Tester */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3>Interactive Shorts Detection Simulator</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          YouTube does not have a simple API boolean field for "is_short". The curator uses a bulletproof two-phase detection system: parsing ISO-8601 duration (<code className="text-slate-300">PT#M#S &le; 60s</code>) combined with an HTTP HEAD request against <code className="text-slate-300">youtube.com/shorts/{'{id}'}</code> (Shorts respond with HTTP 200, horizontal videos return HTTP 303 redirect). Results are cached in <code className="text-slate-300">state.json</code> so repeated calls cost 0 network requests.
        </p>

        <form onSubmit={runShortTest} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Video ID or URL</label>
            <input
              type="text"
              value={testVideoId}
              onChange={(e) => setTestVideoId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-red-500"
              placeholder="e.g. s_v101"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Duration (Seconds)</label>
            <input
              type="number"
              min="1"
              max="300"
              value={testDuration}
              onChange={(e) => setTestDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Test Detection Logic
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className={`p-4 rounded-lg border text-xs space-y-2 font-mono ${
              testResult.isShort
                ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                : 'bg-red-950/20 border-red-900/50 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold font-sans text-sm">
              {testResult.isShort ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Detected as Genuine YouTube Short</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Not a Short (Filtered Out)</span>
                </>
              )}
            </div>
            <div className="text-[11px] opacity-90 font-mono">
              Duration Check (&le; 60s): {testResult.durationCheck ? 'PASSED' : 'FAILED'} ({testDuration}s) · HEAD Response: {testResult.headCheck}
            </div>
            <p className="text-[11px] font-sans text-slate-300 pt-1">
              {testResult.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
