import { useState, useEffect } from 'react';
import { 
  Sparkles, Flame, CheckCircle2, Clock, Lightbulb, 
  Copy, Check, ArrowRight, Zap, Target, BookOpen, Hash
} from 'lucide-react';
import { ViralAdvisorData } from '../types';

export function ViralHubView() {
  const [advisorData, setAdvisorData] = useState<ViralAdvisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Interactive Title Generator state
  const [inputTopic, setInputTopic] = useState('');
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchAdvisor = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/viral-advisor');
        if (res.ok) {
          const data = await res.json();
          setAdvisorData(data);
        }
      } catch (err) {
        console.error('Error fetching viral advisor data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdvisor();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleGenerateHooks = () => {
    if (!inputTopic.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const topic = inputTopic.trim();
      const hooks = [
        `Stop doing ${topic} the hard way in 2026 🛑 (Do this instead)`,
        `This 10-second ${topic} trick saved me 40 hours of pain ✨`,
        `99% of people get ${topic} completely wrong. Here's why 🤯`,
        `The secret ${topic} hack nobody on YouTube talks about 🤫`,
        `Before you touch ${topic}, watch this 20-second warning ⚠️`,
      ];
      setGeneratedHooks(hooks);
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          <span>Viral Advisor & Trending Topics Hub</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Actionable blueprints, algorithmic retention secrets, and high-demand trending topics engineered to maximize YouTube Shorts completion rates and trigger viral reach.
        </p>
      </div>

      {/* Top Banner: Channel Viral Readiness Score */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5" /> High Viral Readiness
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Shorts Health Score: {advisorData?.viral_health_score || 88}/100
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Your channel exhibits strong retention signals with above-average like-to-view ratios. Optimizing video duration and the first 1.5s hook will compound your reach.
          </p>
        </div>

        {/* 3 Key Benchmarks */}
        <div className="grid grid-cols-3 gap-4 w-full md:w-auto shrink-0 text-center">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-lg font-bold text-white">22-34s</div>
            <div className="text-[11px] text-slate-400">Sweet Spot</div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-lg font-bold text-emerald-400">&gt;110%</div>
            <div className="text-[11px] text-slate-400">Target APV</div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-lg font-bold text-amber-400">&gt;8%</div>
            <div className="text-[11px] text-slate-400">Like Ratio</div>
          </div>
        </div>
      </div>

      {/* Interactive Title Hook Generator */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <span>Interactive Viral Hook & Title Optimizer</span>
        </div>
        <p className="text-xs text-slate-400">
          Enter a topic, coding library, or video concept. We'll generate 5 psychological pattern-interrupt titles tailored for YouTube Shorts.
        </p>

        <div className="flex gap-2 max-w-2xl">
          <input
            type="text"
            placeholder="e.g. Python scripts, Docker tips, React hooks, Productivity tricks..."
            value={inputTopic}
            onChange={(e) => setInputTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateHooks()}
            className="flex-1 px-4 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleGenerateHooks}
            disabled={isGenerating || !inputTopic.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Hooks</span>
          </button>
        </div>

        {/* Generated Hooks Output */}
        {generatedHooks.length > 0 && (
          <div className="mt-4 space-y-2 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300">Generated Viral Titles:</div>
            <div className="space-y-2">
              {generatedHooks.map((hook, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-4 text-xs hover:border-slate-700 transition-colors"
                >
                  <span className="font-medium text-slate-200">{hook}</span>
                  <button
                    onClick={() => handleCopy(hook, `gen_${idx}`)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy hook to clipboard"
                  >
                    {copiedIndex === `gen_${idx}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Grid: Proven Hook Formulas & Trending Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Column 1: Proven Hook Blueprints */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-white">4 Proven Psychological Hook Blueprints</h2>
          </div>
          <p className="text-xs text-slate-400">
            Formulas designed to conquer the "Swipe-Away Rate" in the first 1.5 seconds.
          </p>

          <div className="space-y-3">
            {advisorData?.hook_blueprints.map((hook, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-xs sm:text-sm">{hook.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                    {hook.target_duration}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-200 font-mono italic">"{hook.hook_example}"</span>
                  <button
                    onClick={() => handleCopy(hook.hook_example, `blueprint_${idx}`)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title="Copy hook example"
                  >
                    {copiedIndex === `blueprint_${idx}` ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-400 pt-1">{hook.why_it_works}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Trending Topics by Niche */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">High-Velocity Trending Topics</h2>
          </div>
          <p className="text-xs text-slate-400">
            Curated high-search-intent topics with untapped algorithm demand.
          </p>

          <div className="space-y-4">
            {advisorData?.trending_topics.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3"
              >
                <div className="font-bold text-white text-sm flex items-center justify-between">
                  <span>{item.niche}</span>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300">
                  {item.topics.map((t, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-2">
                      <span className="text-red-400 font-bold shrink-0">·</span>
                      <span className="leading-snug">{t}</span>
                    </li>
                  ))}
                </ul>

                {/* Hot Keywords */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  {item.hot_keywords.map((kw, kIdx) => (
                    <span
                      key={kIdx}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pre-Publish Viral Checklist */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>5-Point Pre-Publish Shorts Checklist</span>
        </div>
        <p className="text-xs text-slate-400">
          Verify these 5 factors before publishing any video on YouTube to maximize initial 24-hour test batch distribution.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {advisorData?.pre_publish_checklist.map((c) => (
            <div
              key={c.step}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between"
            >
              <div>
                <div className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs mb-2">
                  {c.step}
                </div>
                <div className="font-semibold text-slate-200 text-xs mb-1">{c.rule}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
