import { useState, useEffect } from 'react';
import { 
  Sparkles, Clapperboard, Copy, Check, Music, Video, 
  ArrowRight, RefreshCw, Film, Shuffle, Clock,
  MessageCircle, Eye, Flame, Smile, Laugh
} from 'lucide-react';
import { ViralScriptData } from '../types';

interface ViralScriptStudioViewProps {
  initialTopic?: string;
  onSendToHashtags: (title: string) => void;
}

export function ViralScriptStudioView({
  initialTopic = 'Chai time comedy drama',
  onSendToHashtags,
}: ViralScriptStudioViewProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [archetype, setArchetype] = useState<string>('family_banter');
  const [durationMode, setDurationMode] = useState<string>('15s');
  const [punchlineIdx, setPunchlineIdx] = useState<number>(0);
  const [scriptData, setScriptData] = useState<ViralScriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const archetypes = [
    {
      id: 'family_banter',
      name: 'Pati-Patni & Family Banter',
      icon: '🎭',
      desc: 'Rapid sarcastic dialogue, husband-wife banter & desi household battles.'
    },
    {
      id: 'trending_sound',
      name: 'Trending Audio & Lip-Sync Guide',
      icon: '🎵',
      desc: 'Beat-synced facial expressions and funny physical comedy (like Jhinga la la).'
    },
    {
      id: 'kids_reaction',
      name: 'Kids & Cute Reaction Challenge',
      icon: '👶',
      desc: 'Innocent questions turning into savage unscripted punchlines (like Naksh dance).'
    },
    {
      id: 'expectation_vs_reality',
      name: 'Expectation vs Reality / Jugaad',
      icon: '🤯',
      desc: 'Aesthetic start followed by instant desi reality check and hilarious failure.'
    }
  ];

  const presetsByArchetype: Record<string, string[]> = {
    family_banter: [
      'Chai Ke Deewane (Morning Tea Addict)',
      'Pati-Patni Shopping Reality Drama',
      'Mehmaan Aur Unki Shaadi Waali Advice',
      'Bhabhi Ne Meri Tareef Ki Ya Beizzati?!',
      'Ghar Ka Geela Tauliya Kalesh'
    ],
    trending_sound: [
      'Jhinga Lala Hu Hu (Crazy Dance Beat)',
      'Kaka Dada Mama Vibe Check',
      'When Beat Drops in Desi Kitchen',
      'Serious Face to Sudden Dance Step'
    ],
    kids_reaction: [
      'Naksh Dance Challenge (Bacha Dance Kar Ke Dikhao)',
      'Bache Se Pucha: Ghar Ka Asli Boss Kaun?',
      'Papa Ki Pol Bache Ne Khol Di',
      'Innocent Question Ka Savage Jawab'
    ],
    expectation_vs_reality: [
      'Instagram Cooking Reel vs Asli Zindagi',
      '5-Minute Desi Jugaad Fail',
      'Morning Aesthetic Routine Reality',
      'Dieting on Day 1 vs Golgappe'
    ]
  };

  const fetchScript = async (
    customTopic: string,
    arch = archetype,
    dur = durationMode,
    pIdx = punchlineIdx
  ) => {
    try {
      setLoading(true);
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTopic,
          archetype: arch,
          duration: dur,
          punchline_idx: pIdx
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScriptData(data.script || null);
      }
    } catch (err) {
      console.error('Error generating script:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScript(topic, archetype, durationMode, punchlineIdx);
  }, []);

  const handleArchetypeChange = (newArch: string) => {
    setArchetype(newArch);
    const newPresets = presetsByArchetype[newArch] || [];
    const firstPreset = newPresets[0] || topic;
    setTopic(firstPreset);
    setPunchlineIdx(0);
    fetchScript(firstPreset, newArch, durationMode, 0);
  };

  const handleDurationChange = (newDur: string) => {
    setDurationMode(newDur);
    fetchScript(topic, archetype, newDur, punchlineIdx);
  };

  const handleShufflePunchline = () => {
    const nextIdx = punchlineIdx + 1;
    setPunchlineIdx(nextIdx);
    fetchScript(topic, archetype, durationMode, nextIdx);
  };

  const handleCopyScript = () => {
    if (!scriptData) return;
    const text = `
TITLE: ${scriptData.title}
ARCHETYPE: ${scriptData.archetype_name}
DURATION: ${scriptData.duration}
AUDIO: ${scriptData.audio_suggestion}
ON-SCREEN TEXT HOOK: ${scriptData.onscreen_hook_text}
RETENTION LOOP TECHNIQUE: ${scriptData.loop_ending_technique}
PINNED COMMENT SPARK: ${scriptData.comment_spark}

SCENE BREAKDOWN:
${scriptData.scenes.map((s, idx) => `
[${s.time}] Scene ${idx + 1}: ${s.label}
• On-Screen Text: "${s.onscreen_text || 'None'}"
• Dialogue: "${s.dialogue}"
• Action: ${s.action}
• Camera: ${s.camera}
`).join('\n')}

HASHTAGS:
${scriptData.hashtags.join(' ')}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPresets = presetsByArchetype[archetype] || presetsByArchetype.family_banter;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Clapperboard className="w-6 h-6 text-red-500" />
            <span>Viral Script & Storyboard Studio</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Algorithm-optimized Short scripts with authentic conversational Hindi dialogue, facial cues, viral loops, and zero cringe outros.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl">
          <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-300 font-medium">Sweet spot: 10–14s for 130%+ retention loops</span>
        </div>
      </div>

      {/* Step 1: Select Format Archetype */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>1. Select Viral Script Format / Archetype:</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {archetypes.map((arch) => {
            const isSelected = archetype === arch.id;
            return (
              <button
                key={arch.id}
                onClick={() => handleArchetypeChange(arch.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-red-600/15 border-red-500 shadow-md shadow-red-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1.5">{arch.icon}</div>
                  <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {arch.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {arch.desc}
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                    <span>Active Format</span>
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Choose Duration & Topic */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>2. Choose Target Duration & Pacing:</span>
          </span>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: '10s', label: '⚡ 10s Micro-Loop', sub: 'Max views & replays' },
              { id: '15s', label: '⏱️ 15s Sweet-Spot', sub: 'Standard comedy skit' },
              { id: '22s', label: '🎬 22s Story Twist', sub: 'Family conflict skit' }
            ].map((dur) => (
              <button
                key={dur.id}
                onClick={() => handleDurationChange(dur.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  durationMode === dur.id
                    ? 'bg-red-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={dur.sub}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Presets for Selected Archetype */}
        <div className="space-y-2">
          <span className="text-[11px] text-slate-400 font-medium">
            Quick-load trending concepts for this format:
          </span>
          <div className="flex flex-wrap gap-2">
            {currentPresets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTopic(p);
                  setPunchlineIdx(0);
                  fetchScript(p, archetype, durationMode, 0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  topic === p
                    ? 'bg-red-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchScript(topic, archetype, durationMode, punchlineIdx)}
            placeholder="Or type any specific situational idea (e.g. Chai lover, Sunday subah ka jhagda)..."
            className="flex-1 px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => fetchScript(topic, archetype, durationMode, punchlineIdx)}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{loading ? 'Generating...' : 'Generate Script'}</span>
          </button>
        </div>
      </div>

      {/* Generated Script Display */}
      {scriptData && (
        <div className="space-y-6">
          {/* Script Overview Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{scriptData.title}</h2>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-semibold">
                    {scriptData.duration}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20">
                    {scriptData.archetype_name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Audio Cue: <b className="text-white">{scriptData.audio_suggestion}</b></span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Script!' : 'Copy Full Script'}</span>
                </button>

                <button
                  onClick={() => onSendToHashtags(scriptData.title)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Create Hashtag Post</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Retention Hacks Callout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-850 flex items-start gap-2.5">
                <Eye className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    On-Screen Text Hook (Put in First 0–3 Seconds)
                  </div>
                  <div className="text-xs font-semibold text-white">
                    "{scriptData.onscreen_hook_text}"
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Stops the viewer from scrolling before the audio even registers.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-850 flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    Seamless Loop Retention Technique
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {scriptData.loop_ending_technique}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    No "subscribe" outro. Keeps viewers in a loop to double your view multiplier.
                  </p>
                </div>
              </div>
            </div>

            {/* Punchline Variations Swapper */}
            {scriptData.punchline_variations && scriptData.punchline_variations.length > 0 && (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Laugh className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                      Selected Punchline Joke (Variation {(scriptData.current_punchline_idx % scriptData.punchline_variations.length) + 1} of {scriptData.punchline_variations.length}):
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white italic">
                    "{scriptData.punchline_variations[scriptData.current_punchline_idx % scriptData.punchline_variations.length]}"
                  </div>
                </div>

                <button
                  onClick={handleShufflePunchline}
                  disabled={loading}
                  className="px-3.5 py-2 text-xs font-semibold bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5 text-red-300" />
                  <span>Shuffle Alternate Punchline</span>
                </button>
              </div>
            )}
          </div>

          {/* Scene-by-Scene Timeline & Storyboard */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-red-500" />
              <span>Scene-by-Scene Acting & Camera Guide</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scriptData.scenes.map((scene, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between space-y-3.5 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{scene.label}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-600/20 text-red-400 border border-red-500/30">
                        {scene.time}
                      </span>
                    </div>

                    {scene.onscreen_text && (
                      <div className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-amber-400">On-Screen:</span>
                        <span>"{scene.onscreen_text}"</span>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Dialogue / Lip-Sync Voice:
                      </div>
                      <div className="text-xs font-medium text-emerald-300 italic">
                        "{scene.dialogue}"
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      <div>
                        <b className="text-slate-400">Acting & Expression: </b>
                        {scene.action}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{scene.camera}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comment Spark Card */}
          <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
                High-Engagement Pinned Comment Trigger (Pin this immediately after posting):
              </span>
              <p className="text-white font-medium">
                "{scriptData.comment_spark}"
              </p>
              <p className="text-[11px] text-slate-400">
                Videos that spark 50+ comments in the first hour receive 3x more impressions on the YouTube Shorts feed.
              </p>
            </div>
          </div>

          {/* Recommended Hashtag Cluster */}
          <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300">
              Recommended Hashtags for this Script:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {scriptData.hashtags.map((h: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-950 text-slate-300 border border-slate-800"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
