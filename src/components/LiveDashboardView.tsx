import { useState, useEffect } from 'react';
import { 
  Play, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, 
  Sparkles, ListMusic, Eye, ThumbsUp, MessageSquare, Clock, 
  Search, ArrowUpRight, Flame, ShieldAlert, Radio, UploadCloud
} from 'lucide-react';
import { ShortVideo, ChannelInfo, ManagedPlaylistStatus, SyncReport } from '../types';
import { PlaylistReviewModal } from './PlaylistReviewModal';

interface LiveDashboardViewProps {
  onOpenSyncModal: (dryRun: boolean) => void;
  onNavigateToTrends: () => void;
  onNavigateToViral: () => void;
}

export function LiveDashboardView({
  onOpenSyncModal,
  onNavigateToTrends,
  onNavigateToViral,
}: LiveDashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);
  const [selectedReviewPlaylist, setSelectedReviewPlaylist] = useState<ManagedPlaylistStatus | null>(null);

  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [clientSecretPresent, setClientSecretPresent] = useState(false);
  const [tokenPresent, setTokenPresent] = useState(false);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [playlists, setPlaylists] = useState<ManagedPlaylistStatus[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlaylist, setFilterPlaylist] = useState<string>('all');

  // Load initial status and data
  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch system status
      const statusRes = await fetch('/api/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        setClientSecretPresent(data.client_secret_present);
        setTokenPresent(data.token_present);
        setChannel(data.channel);
      }

      // Fetch shorts
      const shortsRes = await fetch('/api/shorts');
      if (shortsRes.ok) {
        const sData = await shortsRes.json();
        setShorts(sData.shorts || []);
        setIsDemo(sData.is_demo);
      }

      // Fetch playlists
      const plRes = await fetch('/api/playlists');
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlaylists(plData.playlists || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll status while connecting
  useEffect(() => {
    let interval: any;
    if (connecting) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/status');
          if (res.ok) {
            const data = await res.json();
            const op = data.operation_status?.auth;
            if (op) {
              setAuthStatusMessage(op.message);
            }
            if (data.token_present || op?.status === 'success') {
              setConnecting(false);
              setTokenPresent(true);
              setChannel(data.channel);
              fetchData();
            } else if (op?.status === 'error') {
              setConnecting(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [connecting]);

  const handleConnectChannel = async () => {
    try {
      setConnecting(true);
      setAuthStatusMessage('Opening Google authorization window in your browser...');
      const res = await fetch('/api/auth/connect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setAuthStatusMessage(data.error || 'Failed to start authorization flow.');
        setConnecting(false);
      }
    } catch (err: any) {
      setAuthStatusMessage(err.message || 'Connection request failed.');
      setConnecting(false);
    }
  };

  const handleScanUploads = async () => {
    try {
      setScanning(true);
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setShorts(data.shorts);
        setIsDemo(false);
        fetchData();
      } else {
        alert('Scan error: ' + (data.error || 'Failed to scan channel'));
      }
    } catch (err: any) {
      alert('Network error while scanning: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  // Filter shorts
  const filteredShorts = shorts.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterPlaylist === 'all') return matchesSearch;
    if (filterPlaylist === 'unassigned') {
      return matchesSearch && (!s.assignedPlaylists || s.assignedPlaylists.length === 0);
    }
    return matchesSearch && s.assignedPlaylists?.some(p => p.toLowerCase().includes(filterPlaylist.toLowerCase()));
  });

  // Calculate summary stats
  const totalViews = shorts.reduce((acc, s) => acc + s.views, 0);
  const totalLikes = shorts.reduce((acc, s) => acc + s.likes, 0);
  const avgLikeRatio = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : '0';

  return (
    <div className="space-y-8">
      {/* Top Banner: Channel Connection & Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-red-950/40 border border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {channel?.thumbnail ? (
              <img
                src={channel.thumbnail}
                alt={channel.title}
                className="w-16 h-16 rounded-full border-2 border-red-500/80 shadow-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-red-500 font-bold text-2xl">
                ▶
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {channel ? channel.title : 'YouTube Shorts Playlist Creator'}
                </h1>
                {channel ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Radio className="w-3 h-3 animate-pulse" /> Ready to Link
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-400 mt-1">
                {channel ? (
                  <span>
                    {channel.customUrl || '@channel'} · {channel.subscriberCount?.toLocaleString()} subscribers · {channel.videoCount} total uploads
                  </span>
                ) : (
                  <span>
                    {clientSecretPresent 
                      ? 'Client secret credentials verified. Link your channel to curate and publish playlists automatically.'
                      : 'Place client_secret.json in project root to authenticate with YouTube.'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {!channel && (
              <button
                onClick={handleConnectChannel}
                disabled={connecting}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-900/30 cursor-pointer disabled:opacity-50"
              >
                <Radio className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
                <span>{connecting ? 'Authenticating...' : 'Link YouTube Channel'}</span>
              </button>
            )}

            {channel && (
              <button
                onClick={handleScanUploads}
                disabled={scanning}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Scan channel uploads and verify genuine Shorts"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Scanning...' : 'Scan Channel Uploads'}</span>
              </button>
            )}

            <button
              onClick={() => onOpenSyncModal(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Dry Run</span>
            </button>

            <button
              onClick={() => onOpenSyncModal(false)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all shadow-lg shadow-red-900/40 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Sync to YouTube</span>
            </button>
          </div>
        </div>

        {/* Live status alert message */}
        {authStatusMessage && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>{authStatusMessage}</span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Verified Shorts</span>
            <Play className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-white">
            {shorts.length}
            {isDemo && <span className="ml-2 text-xs font-normal text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Sample Data</span>}
          </div>
          <div className="text-xs text-slate-400 mt-1">Duration &lt;= 60s & HTTP verified</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Managed Playlists</span>
            <ListMusic className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{playlists.length || 3}</div>
          <div className="text-xs text-slate-400 mt-1">Auto-refreshed with diffing</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Avg. Like-to-View</span>
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{avgLikeRatio}%</div>
          <div className="text-xs text-emerald-400/90 mt-1">High engagement benchmark</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total Views</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-white">{(totalViews / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-slate-400 mt-1">Across all detected Shorts</div>
        </div>
      </div>

      {/* Managed Playlists Status Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-red-500" />
              <span>Target Curated Playlists</span>
            </h2>
            <p className="text-xs text-slate-400">
              Configured automated playlists created and synced on your YouTube channel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.key}
              className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-100 text-base">{pl.title}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-slate-800 text-slate-300">
                    {pl.privacy}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{pl.description}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  onClick={() => setSelectedReviewPlaylist(pl)}
                  className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preview ({pl.items?.length || pl.video_count || pl.max_items} videos)</span>
                </button>

                {pl.url ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedReviewPlaylist(pl)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                    <a
                      href={pl.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-medium"
                      title="Open on YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedReviewPlaylist(pl)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Click to view curated videos and sync only this playlist"
                  >
                    <span>⚡ Ready to sync</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Added Shorts Explorer & Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-red-500" />
              <span>Shorts Added & Performance Ranking</span>
            </h2>
            <p className="text-xs text-slate-400">
              Live status, engagement scoring, and current playlist assignments for each Short.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Shorts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-red-500 w-48 sm:w-60"
              />
            </div>

            <select
              value={filterPlaylist}
              onChange={(e) => setFilterPlaylist(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="all">All Playlists</option>
              <option value="top">🔥 Top Shorts</option>
              <option value="rising">⚡ Rising</option>
              <option value="gem">💎 Hidden Gems</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Shorts Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Video</th>
                <th className="py-3 px-4 text-right">Views</th>
                <th className="py-3 px-4 text-right">Likes</th>
                <th className="py-3 px-4 text-right">L/V Ratio</th>
                <th className="py-3 px-4 text-right">Score</th>
                <th className="py-3 px-4">Playlist Placement</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredShorts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No Shorts found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredShorts.map((short, idx) => (
                  <tr key={short.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Rank */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        idx === 1 ? 'bg-slate-400/20 text-slate-200 border border-slate-400/30' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' :
                        'text-slate-400'
                      }`}>
                        #{short.rank || idx + 1}
                      </span>
                    </td>

                    {/* Thumbnail & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 max-w-md">
                        <div className="relative w-12 h-16 rounded overflow-hidden bg-slate-800 shrink-0 group">
                          {short.thumbnail ? (
                            <img
                              src={short.thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] px-1 rounded text-slate-300">
                            {short.duration}s
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-200 line-clamp-2 leading-snug">
                            {short.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            ID: {short.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Views */}
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {short.views.toLocaleString()}
                    </td>

                    {/* Likes */}
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {short.likes.toLocaleString()}
                    </td>

                    {/* Like to View Ratio */}
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      <span className={`px-1.5 py-0.5 rounded ${
                        ((short.likes / Math.max(short.views, 1)) * 100) >= 9 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'text-slate-300'
                      }`}>
                        {((short.likes / Math.max(short.views, 1)) * 100).toFixed(1)}%
                      </span>
                    </td>

                    {/* Score */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                      {(short.score || 0).toLocaleString()}
                    </td>

                    {/* Assigned Playlist */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {short.assignedPlaylists && short.assignedPlaylists.length > 0 ? (
                          short.assignedPlaylists.map((plName, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-200 border border-slate-700"
                            >
                              {plName}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">In Queue</span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <a
                        href={short.youtubeUrl || `https://www.youtube.com/shorts/${short.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Watch on YouTube Shorts"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links to Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div
          onClick={onNavigateToTrends}
          className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-red-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-600/10 text-red-400 border border-red-500/20 group-hover:bg-red-600/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">
                  Analyze Trend Momentum & Suggestions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  See which rising Shorts are surging in velocity and recommended playlist placements.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </div>
        </div>

        <div
          onClick={onNavigateToViral}
          className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-600/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                  Viral Advisor & Trending Topics
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Get high-retention hook templates, optimal video duration benchmarks, and trending topics.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>

      {/* Single Playlist Review & Approval Modal */}
      <PlaylistReviewModal
        isOpen={!!selectedReviewPlaylist}
        playlist={selectedReviewPlaylist}
        onClose={() => setSelectedReviewPlaylist(null)}
        onSyncComplete={fetchData}
      />
    </div>
  );
}
