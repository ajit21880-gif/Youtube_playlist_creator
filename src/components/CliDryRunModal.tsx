import { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Play, RotateCcw } from 'lucide-react';
import { ShortVideo, ScoringConfig, PlaylistConfig } from '../types';
import { rankAndPartitionShorts } from '../utils/scoring';

interface CliDryRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: ShortVideo[];
  scoringConfig: ScoringConfig;
  playlistConfigs: PlaylistConfig[];
}

export function CliDryRunModal({
  isOpen,
  onClose,
  shorts,
  scoringConfig,
  playlistConfigs,
}: CliDryRunModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const { rankedVideos, playlistAssignments } = rankAndPartitionShorts(
    shorts,
    scoringConfig,
    playlistConfigs
  );

  const runSimulation = () => {
    setIsRunning(true);
    setLogs([]);

    const timestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

    const steps: { delay: number; text: string }[] = [
      { delay: 100, text: `${timestamp()} [INFO] Initializing YouTube Shorts Curator v3.1...` },
      { delay: 300, text: `${timestamp()} [INFO] Loaded configuration from config.yaml` },
      { delay: 500, text: `${timestamp()} [INFO] Loaded OAuth credentials from token.json` },
      { delay: 700, text: `${timestamp()} [INFO] Token active (expires in 3412s). Skipping refresh.` },
      { delay: 1000, text: `${timestamp()} [INFO] Scanning channel uploads via playlistItems.list... (Quota +1u)` },
      { delay: 1300, text: `${timestamp()} [INFO] Retrieved ${shorts.length} uploads from channel 'My Creator Studio'.` },
      { delay: 1600, text: `${timestamp()} [INFO] Batch lookup videos.list(50 IDs, part='contentDetails,statistics') (Quota +1u)` },
      { delay: 1900, text: `${timestamp()} [INFO] Verified ${rankedVideos.length} genuine Shorts <= 60s matching threshold.` },
      { delay: 2200, text: `${timestamp()} [INFO] Applying multi-signal engagement formula (Likes: ${scoringConfig.likesWeight.toFixed(2)}x, Ratio: ${scoringConfig.likeRatioWeight}x, HalfLife: ${scoringConfig.halfLifeDays}d)...` },
      { delay: 2500, text: `${timestamp()} [INFO] Top Short: '${rankedVideos[0]?.title}' (Score: ${rankedVideos[0]?.score})` },
      { delay: 2800, text: `${timestamp()} [INFO] --- Synchronizing Playlist: top_shorts ('${playlistConfigs[0]?.title}') ---` },
      { delay: 3100, text: `${timestamp()} [INFO] Inspecting current YouTube playlist PL_top_shorts_01 (Quota +1u)` },
      { delay: 3400, text: `${timestamp()} [INFO] Diff: +2 additions, -2 removals, 8 retained. (Est. Quota: 200 units)` },
      { delay: 3600, text: `${timestamp()} [DRY-RUN] Would remove item s_v117 from 'Top Shorts' (-50u)` },
      { delay: 3800, text: `${timestamp()} [DRY-RUN] Would insert video '${rankedVideos[0]?.id}' at position 0 (+50u)` },
      { delay: 4100, text: `${timestamp()} [INFO] --- Synchronizing Playlist: rising_shorts ('${playlistConfigs[1]?.title}') ---` },
      { delay: 4300, text: `${timestamp()} [INFO] Diff: +1 addition, -1 removal, 9 retained. (Est. Quota: 100 units)` },
      { delay: 4500, text: `${timestamp()} [INFO] --- Synchronizing Playlist: hidden_gems ('${playlistConfigs[2]?.title}') ---` },
      { delay: 4700, text: `${timestamp()} [INFO] Diff: +3 additions, -3 removals, 7 retained. (Est. Quota: 300 units)` },
      { delay: 5000, text: `${timestamp()} [INFO] [DRY-RUN] Dry run complete! Zero writes committed to YouTube.` },
      { delay: 5200, text: `${timestamp()} [INFO] Quota used in dry run: 4 / 8,000 units. (Full sync estimated at ~604 units).` },
      { delay: 5400, text: `${timestamp()} [INFO] State checkpoint recorded in state.json.` },
    ];

    steps.forEach(({ delay, text }, index) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, text]);
        if (index === steps.length - 1) {
          setIsRunning(false);
        }
      }, delay);
    });
  };

  useEffect(() => {
    if (isOpen) {
      runSimulation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Terminal Title Bar */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 ml-2">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>bash - python curator.py --dry-run -v</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              title="Rerun Simulation"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Output"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white font-mono text-sm px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 bg-slate-950 flex-1 leading-relaxed">
          {logs.map((log, index) => {
            const isError = log.includes('[ERROR]') || log.includes('[CRITICAL]');
            const isDryRun = log.includes('[DRY-RUN]');
            const isQuota = log.includes('Quota');

            let textColor = 'text-slate-300';
            if (isError) textColor = 'text-red-400 font-semibold';
            else if (isDryRun) textColor = 'text-amber-300 font-semibold';
            else if (isQuota) textColor = 'text-emerald-400';

            return (
              <div key={index} className={textColor}>
                {log}
              </div>
            );
          })}
          {isRunning && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <span className="w-2 h-4 bg-red-500 animate-pulse inline-block" />
              <span>executing unattended pipeline...</span>
            </div>
          )}
        </div>

        {/* Terminal Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>Status: {isRunning ? 'Running Simulation' : 'Process Exited (code 0)'}</div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition-colors cursor-pointer"
          >
            Close Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
