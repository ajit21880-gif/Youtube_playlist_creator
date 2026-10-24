import { useState } from 'react';
import { 
  X, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, 
  ExternalLink, Layers, Sparkles, ShieldCheck 
} from 'lucide-react';
import { SyncReport } from '../types';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDryRun: boolean;
  onSuccess?: () => void;
}

export function SyncProgressModal({
  isOpen,
  onClose,
  isDryRun,
  onSuccess,
}: SyncProgressModalProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<SyncReport[]>([]);
  const [quotaSummary, setQuotaSummary] = useState<string>('');

  if (!isOpen) return null;

  const handleExecute = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: isDryRun }),
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        setQuotaSummary(data.quota_summary || '');
        setCompleted(true);
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || 'Failed to execute playlist sync.');
      }
    } catch (err: any) {
      setError(err.message || 'Execution failed due to network error.');
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setCompleted(false);
    setError(null);
    setReports([]);
    setQuotaSummary('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              isDryRun ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-red-600/10 text-red-500 border border-red-500/20'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isDryRun ? 'Simulate Playlist Curation (Dry Run)' : 'Publish & Sync Playlists to YouTube'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDryRun 
                  ? 'Calculate score rankings and preview playlist item diffs without writing to YouTube.' 
                  : 'Creates or updates playlists and items directly on your authenticated YouTube Channel.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {!completed && !running && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Execution Plan</span>
                </div>
                <ul className="space-y-1.5 text-slate-400 pl-4 list-disc">
                  <li>Detects all verified Shorts on channel (duration $\le 60$s + HTTP HEAD check).</li>
                  <li>Calculates engagement score: $(Likes^{1.0}) \times (1 + EngagementBonus) \times RecencyMultiplier$.</li>
                  <li>Partitions items into Top Shorts, Rising Shorts, and Hidden Gems.</li>
                  <li>Executes smart diffing so only new/removed items consume quota (50 units each).</li>
                </ul>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Execution Error</div>
                    <div className="text-xs mt-1">{error}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {running && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
              <div>
                <div className="font-semibold text-white text-sm">Synchronizing with YouTube...</div>
                <div className="text-slate-400 text-xs mt-1">
                  Scanning uploads, applying scoring matrix, and updating playlist items via API.
                </div>
              </div>
            </div>
          )}

          {completed && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-emerald-300 text-sm">
                    {isDryRun ? 'Simulation Succeeded!' : 'Playlists Updated on YouTube!'}
                  </div>
                  <div className="text-emerald-400/80 text-xs mt-0.5">
                    {isDryRun
                      ? 'Diff verified. No YouTube write quota was spent.'
                      : 'Playlists are now live on your channel with fresh performance rankings.'}
                  </div>
                </div>
              </div>

              {/* Reports list */}
              <div className="space-y-3">
                <div className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                  Playlist Sync Details:
                </div>

                {reports.map((r) => (
                  <div
                    key={r.playlist_key}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-sm">{r.title}</div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                        {r.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-400 text-xs">
                      <span className="text-emerald-400 font-medium">+{r.added} added</span>
                      <span>·</span>
                      <span className="text-rose-400 font-medium">-{r.removed} removed</span>
                      <span>·</span>
                      <span className="text-slate-300">{r.retained} retained</span>
                    </div>

                    {r.url && (
                      <div className="pt-2 border-t border-slate-900 flex justify-end">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-semibold text-xs"
                        >
                          <span>Open Playlist on YouTube</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {quotaSummary && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 font-mono text-slate-400 text-[11px] whitespace-pre-wrap">
                  {quotaSummary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          {!completed ? (
            <>
              <button
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                disabled={running}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecute}
                disabled={running}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
                  isDryRun
                    ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                    : 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                }`}
              >
                {running ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>{running ? 'Executing...' : isDryRun ? 'Run Simulation' : 'Confirm & Post to YouTube'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
