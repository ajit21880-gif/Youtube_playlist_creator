import { useState, useEffect } from 'react';
import { 
  Flame, TrendingUp, Sparkles, ArrowRight, Play, ExternalLink, 
  CheckCircle2, AlertTriangle, Layers, ThumbsUp, MessageSquare, Zap
} from 'lucide-react';
import { TrendItem } from '../types';

interface TrendsRecommenderViewProps {
  onSyncPlaylists: () => void;
}

export function TrendsRecommenderView({ onSyncPlaylists }: TrendsRecommenderViewProps) {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/trends');
        if (res.ok) {
          const data = await res.json();
          setTrends(data.trends || []);
          setSummary(data.summary || null);
        }
      } catch (err) {
        console.error('Error fetching trends:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  const categories = [
    { id: 'all', label: 'All Recommendations' },
    { id: 'viral', label: '🔥 Viral Breakouts' },
    { id: 'gem', label: '💎 Hidden Gems' },
    { id: 'rising', label: '⚡ Rising Stars' },
    { id: 'pillar', label: '🌲 Evergreen Pillars' },
  ];

  const filteredTrends = trends.filter((item) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'viral') return item.category.includes('Viral');
    if (selectedCategory === 'gem') return item.category.includes('Gem') || item.category.includes('Favorite');
    if (selectedCategory === 'rising') return item.category.includes('Rising');
    if (selectedCategory === 'pillar') return item.category.includes('Evergreen');
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-red-500" />
            <span>Trend Velocity & Playlist Recommendations</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Real-time algorithmic velocity analysis. Identifies surging Shorts, evaluates engagement ratios, and recommends high-impact playlist additions to capitalize on YouTube algorithm spikes.
          </p>
        </div>

        <button
          onClick={onSyncPlaylists}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-900/30 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Apply Curation to Playlists</span>
        </button>
      </div>

      {/* Summary Highlight Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Top Velocity Short
            </div>
            <div className="text-lg font-bold text-white line-clamp-1">
              {summary.top_velocity_title}
            </div>
            <div className="text-xs text-red-400 font-semibold mt-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span>+{Number(summary.top_velocity_rate).toLocaleString()} views / day</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Average Like Ratio
            </div>
            <div className="text-2xl font-bold text-white">{summary.avg_like_ratio}%</div>
            <div className="text-xs text-emerald-400 font-medium mt-1">
              Benchmark: &gt;7.5% signals high viral potential
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Analyzed Pool
            </div>
            <div className="text-2xl font-bold text-white">{summary.total_analyzed} Shorts</div>
            <div className="text-xs text-slate-400 mt-1">
              Continuous recency decay & engagement scoring
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-red-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Recommendation Feed */}
      <div className="space-y-4">
        {filteredTrends.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-900/30 border border-slate-800 text-slate-400">
            No recommendations in this category.
          </div>
        ) : (
          filteredTrends.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            >
              {/* Video Thumbnail & Info */}
              <div className="flex items-start gap-4 flex-1">
                <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-slate-800 shrink-0 group">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e: any) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <a
                    href={item.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play className="w-5 h-5 text-white" />
                  </a>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Published {item.age_days}d ago
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-100 text-sm sm:text-base leading-snug">
                    {item.title}
                  </h3>

                  {/* Stat pills */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                    <span className="font-mono text-slate-300">
                      {item.views.toLocaleString()} views
                    </span>
                    <span>·</span>
                    <span className="font-mono text-red-400 font-medium">
                      +{item.velocity_views_per_day.toLocaleString()} views/day
                    </span>
                    <span>·</span>
                    <span className="font-mono text-emerald-400 font-medium">
                      {item.like_percentage}% like ratio
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendation Callout Box */}
              <div className="w-full md:w-80 shrink-0 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-red-400 font-semibold mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Target Playlist:</span>
                    <span className="text-white uppercase font-mono tracking-wide text-[10px] bg-red-600/30 px-1.5 py-0.5 rounded">
                      {item.recommended_playlist.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {item.recommendation_reason}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Rank Score: {item.score.toLocaleString()}</span>
                  <a
                    href={item.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-medium"
                  >
                    <span>Inspect Short</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
