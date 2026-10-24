import { useState, useEffect } from 'react';
import { 
  Flame, TrendingUp, Sparkles, Play, ExternalLink, 
  RefreshCw, Hash, Eye, ThumbsUp, ArrowRight, Zap, Globe
} from 'lucide-react';

interface TrendingHubViewProps {
  onSelectConceptForScript: (concept: string) => void;
}

export function TrendingHubView({ onSelectConceptForScript }: TrendingHubViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'india' | 'niche'>('niche');
  const [indiaVideos, setIndiaVideos] = useState<any[]>([]);
  const [nicheTrends, setNicheTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      // Fetch niche trends
      const nicheRes = await fetch('/api/trending-niche');
      if (nicheRes.ok) {
        const nData = await nicheRes.json();
        setNicheTrends(nData.trends || []);
      }

      // Fetch live India trends
      const indiaRes = await fetch('/api/trending-india');
      if (indiaRes.ok) {
        const iData = await indiaRes.json();
        setIndiaVideos(iData.videos || []);
      }
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-red-500" />
            <span>Trending Intelligence Hub</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Live algorithm trend data: explore recent viral Shorts in your channel's niche (Hindi Comedy & Sketches) and top trending videos across India.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveSubTab('niche')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'niche'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎭 My Channel Niche (Comedy)
          </button>
          <button
            onClick={() => setActiveSubTab('india')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'india'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🇮🇳 Top Trending in India
          </button>
        </div>
      </div>

      {/* View 1: Channel Niche Viral Trends */}
      {activeSubTab === 'niche' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/30 via-slate-900 to-slate-900 border border-red-500/20 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                These concepts represent the <b>highest-velocity formats</b> in Hindi relatable comedy and family humor right now. Click any idea to open the Script & Storyboard Studio!
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {nicheTrends.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-white text-base leading-snug">{t.concept}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      {t.benchmark_views}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 text-xs font-mono text-slate-200">
                    "{t.hook}"
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    <b className="text-slate-300">Why it goes viral: </b>{t.why_it_works}
                  </p>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.trending_hashtags.map((h: string, hIdx: number) => (
                      <span
                        key={hIdx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Target duration: 20-25s</span>
                  <button
                    onClick={() => onSelectConceptForScript(t.concept)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Generate Script</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Live India YouTube Trending */}
      {activeSubTab === 'india' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Direct live feed from YouTube India Trending chart (`regionCode='IN'`):</span>
            <button
              onClick={fetchTrends}
              disabled={loading}
              className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Trends</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {indiaVideos.map((v) => (
              <div
                key={v.id}
                className="rounded-xl overflow-hidden bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video w-full bg-slate-800 overflow-hidden group">
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <a
                      href={v.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-8 h-8 text-white drop-shadow" />
                    </a>
                    {v.is_short && (
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        SHORT
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {v.duration}s
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <a
                      href={v.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-200 hover:text-red-400 transition-colors text-xs line-clamp-2 leading-snug inline-flex items-center gap-1"
                    >
                      <span>{v.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>

                    <div className="text-[11px] text-slate-400 font-medium">
                      {v.channelTitle}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 font-mono">
                      <span>{v.views.toLocaleString()} views</span>
                      <span>·</span>
                      <span className="text-emerald-400">{v.likes.toLocaleString()} likes</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex justify-end">
                  <button
                    onClick={() => onSelectConceptForScript(v.title)}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Use as Idea</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
