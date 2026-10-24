import { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, 
  ExternalLink, Layers, Sparkles, ShieldCheck, Play, ArrowUpRight, Flame
} from 'lucide-react';
import { ManagedPlaylistStatus, ShortVideo, SyncReport } from '../types';

interface PlaylistReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: ManagedPlaylistStatus | null;
  onSyncComplete?: () => void;
}

export function PlaylistReviewModal({
  isOpen,
  onClose,
  playlist,
  onSyncComplete,
}: PlaylistReviewModalProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [quotaSummary, setQuotaSummary] = useState<string>('');

  const [items, setItems] = useState<ShortVideo[]>(playlist?.items || []);

  useEffect(() => {
    if (playlist?.items && playlist.items.length > 0) {
      setItems(playlist.items);
    } else if (playlist?.key) {
      fetch('/api/playlists')
        .then((res) => res.json())
        .then((data) => {
          const found = (data.playlists || []).find((p: any) => p.key === playlist.key);
          if (found?.items && found.items.length > 0) {
            setItems(found.items);
          }
        })
        .catch(console.error);
    }
  }, [playlist]);

  const handleSyncThisPlaylist = async (dryRun: boolean) => {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dry_run: dryRun,
          playlist_key: playlist?.key,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const found = (data.reports || []).find((r: SyncReport) => r.playlist_key === playlist?.key);
        setReport(found || data.reports?.[0] || null);
        setQuotaSummary(data.quota_summary || '');
        setCompleted(true);
        if (onSyncComplete) onSyncComplete();
      } else {
        setError(data.error || 'Failed to execute playlist sync.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while syncing playlist.');
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setCompleted(false);
    setError(null);
    setReport(null);
    setQuotaSummary('');
  };

  if (!isOpen || !playlist) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{playlist.title}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                  {playlist.privacy}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  {items.length} Videos Curated
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">{playlist.description}</p>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Explanation Alert */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-100">Review Before Posting: </span>
                These {items.length} Shorts were selected using engagement ratio and recency scoring. 
                Click any video title to watch it on YouTube Shorts. You can sync <b>only this playlist</b> to your channel.
              </div>
            </div>

            {playlist.url && (
              <a
                href={playlist.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold shrink-0"
              >
                <span>Live Playlist</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Sync result state */}
          {completed && report && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Playlist Successfully Curated!</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="text-emerald-400 font-medium">+{report.added} added</span>
                <span>·</span>
                <span className="text-rose-400 font-medium">-{report.removed} removed</span>
                <span>·</span>
                <span>{report.retained} retained</span>
              </div>
              {report.url && (
                <div className="pt-2 border-t border-emerald-900/50">
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    <span>Open Playlist on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Error</div>
                <div className="text-xs mt-1">{error}</div>
              </div>
            </div>
          )}

          {/* Video List */}
          <div className="space-y-2.5">
            <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Curated Videos in this Playlist ({items.length})</span>
              <span className="text-slate-400 font-normal">Ranked by algorithm score</span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                No videos assigned to this playlist yet. Run a channel scan first.
              </div>
            ) : (
              items.map((video, idx) => (
                <div
                  key={video.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-850 hover:border-slate-700 transition-colors flex items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-6 text-center font-mono font-bold text-slate-400 text-xs">
                      #{idx + 1}
                    </span>

                    <div className="relative w-12 h-16 rounded overflow-hidden bg-slate-800 shrink-0 group">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <a
                        href={video.youtubeUrl || `https://www.youtube.com/shorts/${video.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Watch video on YouTube Shorts"
                      >
                        <Play className="w-4 h-4 text-white" />
                      </a>
                      <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] px-1 rounded text-slate-300">
                        {video.duration}s
                      </span>
                    </div>

                    <div className="min-w-0">
                      <a
                        href={video.youtubeUrl || `https://www.youtube.com/shorts/${video.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-200 hover:text-red-400 transition-colors line-clamp-2 leading-snug inline-flex items-center gap-1 group"
                      >
                        <span>{video.title}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-red-400 shrink-0 inline" />
                      </a>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="font-mono text-slate-300">{video.views.toLocaleString()} views</span>
                        <span>·</span>
                        <span className="font-mono text-slate-300">{video.likes.toLocaleString()} likes</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {((video.likes / Math.max(video.views, 1)) * 100).toFixed(1)}% L/V
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score badge */}
                  <div className="shrink-0 text-right">
                    <div className="font-mono font-bold text-red-400 text-xs">
                      {(video.score || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">Score</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Posting modifies only: <b className="text-slate-200">{playlist.title}</b>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={running}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={() => handleSyncThisPlaylist(true)}
              disabled={running || items.length === 0}
              className="px-3.5 py-2 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Dry Run
            </button>

            <button
              onClick={() => handleSyncThisPlaylist(false)}
              disabled={running || items.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all shadow-lg shadow-red-900/40 cursor-pointer disabled:opacity-50"
            >
              {running ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>{running ? 'Curating...' : 'Approve & Post to YouTube'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
