import { useState } from 'react';
import { Sliders, Plus, RotateCcw, Info, Sparkles, Filter, Play } from 'lucide-react';
import { ShortVideo, ScoringConfig, PlaylistConfig } from '../types';
import { calculateShortScore } from '../utils/scoring';

interface RankingSimulatorProps {
  shorts: ShortVideo[];
  setShorts: React.Dispatch<React.SetStateAction<ShortVideo[]>>;
  scoringConfig: ScoringConfig;
  setScoringConfig: React.Dispatch<React.SetStateAction<ScoringConfig>>;
  playlistConfigs: PlaylistConfig[];
  onOpenDryRun: () => void;
}

export function RankingSimulator({
  shorts,
  setShorts,
  scoringConfig,
  setScoringConfig,
  playlistConfigs,
  onOpenDryRun,
}: RankingSimulatorProps) {
  const [selectedVideo, setSelectedVideo] = useState<ShortVideo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New video form state
  const [newTitle, setNewTitle] = useState('');
  const [newViews, setNewViews] = useState(150000);
  const [newLikes, setNewLikes] = useState(12500);
  const [newComments, setNewComments] = useState(650);
  const [newDuration, setNewDuration] = useState(35);
  const [newAgeDays, setNewAgeDays] = useState(3);

  // Score all videos with current config
  const scoredShorts = shorts
    .filter((v) => v.views >= scoringConfig.minViewsThreshold)
    .map((v) => calculateShortScore(v, scoringConfig))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((v, idx) => ({ ...v, rank: idx + 1 }));

  // Map playlist tiers
  const topPlaylistIds = new Set(
    scoredShorts.slice(0, playlistConfigs[0]?.maxItems || 10).map((v) => v.id)
  );
  const risingPlaylistIds = new Set(
    scoredShorts
      .slice(
        playlistConfigs[1]?.sliceStart || 10,
        (playlistConfigs[1]?.sliceStart || 10) + (playlistConfigs[1]?.maxItems || 10)
      )
      .map((v) => v.id)
  );

  // Hidden gems (highest engagement index)
  const hiddenGemsIds = new Set(
    [...scoredShorts]
      .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0))
      .slice(0, playlistConfigs[2]?.maxItems || 10)
      .map((v) => v.id)
  );

  const filteredShorts = scoredShorts.filter((s) => {
    if (searchQuery.trim() && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (activeFilter === 'top') return topPlaylistIds.has(s.id);
    if (activeFilter === 'rising') return risingPlaylistIds.has(s.id);
    if (activeFilter === 'gems') return hiddenGemsIds.has(s.id);
    return true;
  });

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newShort: ShortVideo = {
      id: `s_custom_${Date.now()}`,
      title: newTitle.trim(),
      duration: Number(newDuration),
      views: Number(newViews),
      likes: Number(newLikes),
      comments: Number(newComments),
      publishedAt: new Date(Date.now() - Number(newAgeDays) * 86400000).toISOString(),
    };

    setShorts([newShort, ...shorts]);
    setShowAddModal(false);
    setNewTitle('');
  };

  const handlePreset = (preset: 'balanced' | 'viral' | 'gems' | 'fresh') => {
    if (preset === 'balanced') {
      setScoringConfig({
        likesWeight: 1.0,
        likeRatioWeight: 3.5,
        maxLikeRatioCap: 0.35,
        commentRatioWeight: 5.0,
        maxCommentRatioCap: 0.1,
        halfLifeDays: 45.0,
        recencyFloor: 0.4,
        minViewsThreshold: 10,
      });
    } else if (preset === 'viral') {
      setScoringConfig({
        likesWeight: 1.25,
        likeRatioWeight: 1.5,
        maxLikeRatioCap: 0.25,
        commentRatioWeight: 2.0,
        maxCommentRatioCap: 0.08,
        halfLifeDays: 90.0,
        recencyFloor: 0.6,
        minViewsThreshold: 50,
      });
    } else if (preset === 'gems') {
      setScoringConfig({
        likesWeight: 0.7,
        likeRatioWeight: 8.0,
        maxLikeRatioCap: 0.45,
        commentRatioWeight: 12.0,
        maxCommentRatioCap: 0.15,
        halfLifeDays: 60.0,
        recencyFloor: 0.3,
        minViewsThreshold: 1000,
      });
    } else if (preset === 'fresh') {
      setScoringConfig({
        likesWeight: 1.0,
        likeRatioWeight: 3.0,
        maxLikeRatioCap: 0.35,
        commentRatioWeight: 4.0,
        maxCommentRatioCap: 0.1,
        halfLifeDays: 14.0,
        recencyFloor: 0.15,
        minViewsThreshold: 10,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Shorts Performance Ranking Simulator
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>{shorts.length} Channel Shorts</span>
              <span aria-hidden="true">·</span>
              <span>ISO-8601 &amp; HEAD Validated</span>
              <span aria-hidden="true">·</span>
              <span>Transparent Engagement Formula</span>
              <span aria-hidden="true">·</span>
              <span>Idempotent Auto-Refreshed</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Simulate New Short</span>
            </button>
            <button
              onClick={onOpenDryRun}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run CLI Simulation</span>
            </button>
          </div>
        </div>

        {/* Algorithm Presets */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-slate-300">Scoring Presets:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handlePreset('balanced')}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Standard Balanced
            </button>
            <button
              onClick={() => handlePreset('viral')}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Viral Volume Focus
            </button>
            <button
              onClick={() => handlePreset('gems')}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
            >
              High Engagement / Ratio
            </button>
            <button
              onClick={() => handlePreset('fresh')}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Freshness &amp; Recency Surge
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Live Config Sliders */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-slate-200">Scoring Weights</h3>
            </div>
            <button
              onClick={() => handlePreset('balanced')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              title="Reset weights to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Likes Weight */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Likes Driver Power</span>
                <span className="font-mono tabular-nums text-red-400">
                  {scoringConfig.likesWeight.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={scoringConfig.likesWeight}
                onChange={(e) =>
                  setScoringConfig({ ...scoringConfig, likesWeight: parseFloat(e.target.value) })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Base volume driver from raw likes</p>
            </div>

            {/* Like-to-View Ratio Weight */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Like/View Ratio Multiplier</span>
                <span className="font-mono tabular-nums text-red-400">
                  {scoringConfig.likeRatioWeight.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={scoringConfig.likeRatioWeight}
                onChange={(e) =>
                  setScoringConfig({ ...scoringConfig, likeRatioWeight: parseFloat(e.target.value) })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Reward videos with higher % of viewers liking
              </p>
            </div>

            {/* Comment Ratio Weight */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Comment Ratio Multiplier</span>
                <span className="font-mono tabular-nums text-red-400">
                  {scoringConfig.commentRatioWeight.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="12.0"
                step="0.5"
                value={scoringConfig.commentRatioWeight}
                onChange={(e) =>
                  setScoringConfig({
                    ...scoringConfig,
                    commentRatioWeight: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Conversation &amp; community resonance</p>
            </div>

            {/* Recency Half-Life */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Recency Half-Life</span>
                <span className="font-mono tabular-nums text-red-400">
                  {scoringConfig.halfLifeDays} days
                </span>
              </div>
              <input
                type="range"
                min="7"
                max="90"
                step="1"
                value={scoringConfig.halfLifeDays}
                onChange={(e) =>
                  setScoringConfig({ ...scoringConfig, halfLifeDays: parseInt(e.target.value) })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Days until recency boost drops by 50%
              </p>
            </div>

            {/* Recency Floor */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Evergreen Score Floor</span>
                <span className="font-mono tabular-nums text-red-400">
                  {Math.round(scoringConfig.recencyFloor * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={scoringConfig.recencyFloor}
                onChange={(e) =>
                  setScoringConfig({ ...scoringConfig, recencyFloor: parseFloat(e.target.value) })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Guarantees viral older hits never drop to zero
              </p>
            </div>
          </div>

          {/* Formula Callout */}
          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5 font-mono">
            <div className="text-slate-300 font-sans font-medium">Scoring Equation:</div>
            <div className="text-red-400 leading-tight">
              Score = (Likes^{scoringConfig.likesWeight.toFixed(1)}) · (1 + Bonus) · Recency
            </div>
          </div>
        </div>

        {/* Right Columns: Table of Ranked Videos */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* Table Header Controls */}
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Ranked ({scoredShorts.length})
              </button>
              <button
                onClick={() => setActiveFilter('top')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeFilter === 'top'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tier 1: Top Shorts ({topPlaylistIds.size})
              </button>
              <button
                onClick={() => setActiveFilter('rising')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeFilter === 'rising'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tier 2: Rising ({risingPlaylistIds.size})
              </button>
              <button
                onClick={() => setActiveFilter('gems')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeFilter === 'gems'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tier 3: Hidden Gems ({hiddenGemsIds.size})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Shorts titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* High-Density Data Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-4">Short Title</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Likes</th>
                  <th className="py-2.5 px-3 text-right">Views</th>
                  <th className="py-2.5 px-3 text-right">L/V Ratio</th>
                  <th className="py-2.5 px-3 text-right">Age</th>
                  <th className="py-2.5 px-3 text-center">Target Playlist</th>
                  <th className="py-2.5 px-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredShorts.map((short) => {
                  const isTop = topPlaylistIds.has(short.id);
                  const isRising = risingPlaylistIds.has(short.id);
                  const isGem = hiddenGemsIds.has(short.id);

                  let targetBadge = 'Dropped Out';
                  if (isTop) targetBadge = 'Top Shorts (Tier 1)';
                  else if (isRising) targetBadge = 'Rising Shorts (Tier 2)';
                  else if (isGem) targetBadge = 'Hidden Gems (Tier 3)';

                  return (
                    <tr
                      key={short.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-default"
                    >
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums font-semibold text-slate-400 group-hover:text-red-400">
                        #{short.rank}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-200 max-w-xs truncate">
                        <div className="truncate">{short.title}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{short.duration}s Short</span>
                          <span aria-hidden="true">·</span>
                          <span>{short.comments.toLocaleString()} comments</span>
                          <span aria-hidden="true">·</span>
                          <span>ID: {short.id}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-100">
                        {short.score?.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {short.likes.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {short.views.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                        {((short.likeRatio || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {short.ageDays}d
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] ${
                            isTop
                              ? 'text-amber-400 font-semibold'
                              : isRising
                              ? 'text-blue-400 font-medium'
                              : isGem
                              ? 'text-purple-400 font-medium'
                              : 'text-slate-400'
                          }`}
                        >
                          {targetBadge}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedVideo(short)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="View mathematical scoring breakdown"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inspect Mathematical Breakdown Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs text-red-400 font-mono">Rank #{selectedVideo.rank}</span>
                <h3 className="text-base font-bold text-slate-100 mt-1">{selectedVideo.title}</h3>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-slate-400 hover:text-white text-lg font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">1. Base Likes Factor:</span>
                  <span className="text-slate-200">
                    {selectedVideo.likes.toLocaleString()} ^ {scoringConfig.likesWeight.toFixed(2)} ={' '}
                    <strong className="text-white">
                      {Math.round(
                        Math.pow(selectedVideo.likes, scoringConfig.likesWeight)
                      ).toLocaleString()}
                    </strong>
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">2. Like/View Ratio:</span>
                  <span className="text-emerald-400">
                    {((selectedVideo.likeRatio || 0) * 100).toFixed(2)}% (Bonus: +
                    {(
                      (selectedVideo.likeRatio || 0) *
                      scoringConfig.likeRatioWeight *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">3. Comment Ratio:</span>
                  <span className="text-purple-400">
                    {((selectedVideo.commentRatio || 0) * 100).toFixed(2)}% (Bonus: +
                    {(
                      (selectedVideo.commentRatio || 0) *
                      scoringConfig.commentRatioWeight *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">4. Recency Multiplier:</span>
                  <span className="text-blue-400">
                    {selectedVideo.recencyMult}x (Age: {selectedVideo.ageDays} days)
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm">
                  <span className="text-slate-300 font-sans font-bold">Calculated Score:</span>
                  <span className="text-red-400 font-bold tabular-nums">
                    {selectedVideo.score?.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedVideo(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      {/* Add New Short Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">Simulate Channel Short</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVideo} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Short Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 CSS Tricks for 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Views</label>
                  <input
                    type="number"
                    min="1"
                    value={newViews}
                    onChange={(e) => setNewViews(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Likes</label>
                  <input
                    type="number"
                    min="0"
                    value={newLikes}
                    onChange={(e) => setNewLikes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Comments</label>
                  <input
                    type="number"
                    min="0"
                    value={newComments}
                    onChange={(e) => setNewComments(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Duration (s)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Age (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={newAgeDays}
                    onChange={(e) => setNewAgeDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Add &amp; Re-Rank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
