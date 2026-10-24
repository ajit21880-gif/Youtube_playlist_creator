import { useState } from 'react';
import { ArrowRight, CheckCircle2, Trash2, PlusCircle, ShieldCheck, Zap } from 'lucide-react';
import { ShortVideo, PlaylistConfig, ScoringConfig } from '../types';
import { rankAndPartitionShorts } from '../utils/scoring';

interface PlaylistDiffVisualizerProps {
  shorts: ShortVideo[];
  scoringConfig: ScoringConfig;
  playlistConfigs: PlaylistConfig[];
}

export function PlaylistDiffVisualizer({
  shorts,
  scoringConfig,
  playlistConfigs,
}: PlaylistDiffVisualizerProps) {
  const [selectedPlaylistKey, setSelectedPlaylistKey] = useState<string>('top_shorts');

  // Simulated "current" state in YouTube (pre-existing playlist before this run)
  const [previousStates, setPreviousStates] = useState<Record<string, string[]>>({
    top_shorts: ['s_v104', 's_v102', 's_v113', 's_v111', 's_v106', 's_v116', 's_v109', 's_v119', 's_v101', 's_v117'], // s_v117 is low scoring, will be dropped
    rising_shorts: ['s_v108', 's_v114', 's_v103', 's_v112', 's_v125', 's_v121', 's_v115', 's_v107', 's_v120', 's_v124'],
    hidden_gems: ['s_v101', 's_v103', 's_v107', 's_v105', 's_v115', 's_v120', 's_v110', 's_v118', 's_v122', 's_v123'],
  });

  const { playlistAssignments } = rankAndPartitionShorts(shorts, scoringConfig, playlistConfigs);

  const currentConfig = playlistConfigs.find((p) => p.idKey === selectedPlaylistKey) || playlistConfigs[0];
  const targetVideos = playlistAssignments[selectedPlaylistKey] || [];
  const targetIds = targetVideos.map((v) => v.id);

  const currentIds = previousStates[selectedPlaylistKey] || [];

  // Compute diff
  const targetSet = new Set(targetIds);
  const currentSet = new Set(currentIds);

  const toRemoveIds = currentIds.filter((id) => !targetSet.has(id));
  const toAddIds = targetIds.filter((id) => !currentSet.has(id));
  const retainedIds = currentIds.filter((id) => targetSet.has(id));

  // Quota costs
  const naiveRecreateCost = 50 + (targetIds.length * 50); // Create playlist (50) + Add all items (50 each)
  const diffCost = (toRemoveIds.length * 50) + (toAddIds.length * 50); // only deletes and adds
  const quotaSavingsPercent = Math.max(0, Math.round(((naiveRecreateCost - diffCost) / naiveRecreateCost) * 100));

  const handleApplySync = () => {
    setPreviousStates({
      ...previousStates,
      [selectedPlaylistKey]: [...targetIds],
    });
  };

  const handleResetSimState = () => {
    setPreviousStates({
      top_shorts: ['s_v104', 's_v102', 's_v113', 's_v111', 's_v106', 's_v116', 's_v109', 's_v119', 's_v101', 's_v117'],
      rising_shorts: ['s_v108', 's_v114', 's_v103', 's_v112', 's_v125', 's_v121', 's_v115', 's_v107', 's_v120', 's_v124'],
      hidden_gems: ['s_v101', 's_v103', 's_v107', 's_v105', 's_v115', 's_v120', 's_v110', 's_v118', 's_v122', 's_v123'],
    });
  };

  const getVideoById = (id: string) => shorts.find((s) => s.id === id);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Idempotent Playlist Diff &amp; Quota Engine
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Zero Duplicate Writes</span>
              <span aria-hidden="true">·</span>
              <span>Diff-Driven Playlist Updates</span>
              <span aria-hidden="true">·</span>
              <span>YouTube API Cost: 50 Units Per Change</span>
              <span aria-hidden="true">·</span>
              <span>Estimated {quotaSavingsPercent}% Quota Saved</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSimState}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Reset Mock State
            </button>
            <button
              onClick={handleApplySync}
              disabled={toAddIds.length === 0 && toRemoveIds.length === 0}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Simulate Apply Sync ({diffCost} units)</span>
            </button>
          </div>
        </div>

        {/* Playlist Selector Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {playlistConfigs.map((pl) => {
            const isSelected = pl.idKey === selectedPlaylistKey;
            return (
              <button
                key={pl.idKey}
                onClick={() => setSelectedPlaylistKey(pl.idKey)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {pl.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quota Comparison KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Smart Diff API Cost</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {diffCost} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {toAddIds.length} adds (+{toAddIds.length * 50}u), {toRemoveIds.length} deletes (+{toRemoveIds.length * 50}u)
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Naive Recreate Cost (No Diff)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-400 mt-1">
            {naiveRecreateCost} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Wasteful delete &amp; rebuild would burn 800+ quota units
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Daily Quota Preservation</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-400 mt-1">
            {quotaSavingsPercent}% <span className="text-xs font-sans text-slate-400 font-normal">saved</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Preserves 10,000 daily budget for channel growth</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Diff Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Current Playlist State on YouTube */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Current YouTube Playlist State
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentIds.length} videos currently published on your channel
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              ID: PL_{selectedPlaylistKey}_live
            </span>
          </div>

          <div className="p-4 space-y-2 flex-1 overflow-y-auto max-h-[500px]">
            {currentIds.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                Playlist does not exist yet. Will be created on first sync.
              </div>
            ) : (
              currentIds.map((id, index) => {
                const video = getVideoById(id);
                const isDropping = toRemoveIds.includes(id);

                return (
                  <div
                    key={id}
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                      isDropping
                        ? 'bg-red-950/20 border-red-900/50 text-red-300'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono tabular-nums text-slate-400 w-5 text-right shrink-0">
                        {index + 1}.
                      </span>
                      <div className="truncate">
                        <div className="font-medium truncate">
                          {video?.title || `Video ID: ${id}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {video ? `${video.views.toLocaleString()} views · ${video.likes.toLocaleString()} likes` : id}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isDropping ? (
                        <span className="text-[11px] font-mono text-red-400 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                          <span>Will Remove (-50u)</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">Retained (0u)</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Target State Calculated by Algorithm */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Calculated Target Playlist
              </h3>
              <p className="text-[11px] text-slate-400">
                {targetVideos.length} top-ranked Shorts based on current scoring weights
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">Target Fresh Sync</span>
          </div>

          <div className="p-4 space-y-2 flex-1 overflow-y-auto max-h-[500px]">
            {targetVideos.map((video, index) => {
              const isNewlyAdded = toAddIds.includes(video.id);

              return (
                <div
                  key={video.id}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                    isNewlyAdded
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="font-mono tabular-nums text-slate-400 w-5 text-right shrink-0">
                      {index + 1}.
                    </span>
                    <div className="truncate">
                      <div className="font-medium truncate">{video.title}</div>
                      <div className="text-[11px] text-slate-400">
                        Score: {video.score?.toLocaleString()} · {video.views.toLocaleString()} views
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isNewlyAdded ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <PlusCircle className="w-3 h-3" />
                        <span>Will Add (+50u)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">Unchanged (0u)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sync Strategy Explanation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-xs text-slate-300 space-y-2">
        <h4 className="font-semibold text-slate-100 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Idempotent Synchronization Guarantee</span>
        </h4>
        <p className="text-slate-400 leading-relaxed">
          The Python backend queries YouTube using <code className="text-slate-200">playlistItems().list</code> (1 unit per 50 videos) to inspect existing tracks before writing anything. It computes set differences (<code className="text-slate-200">target_set - current_set</code> and <code className="text-slate-200">current_set - target_set</code>) and executes only the net modifications. If a daily run detects that the top 15 videos are identical to yesterday's run, the quota spent is <strong>only 1 unit</strong> instead of 800 units.
        </p>
      </div>
    </div>
  );
}
