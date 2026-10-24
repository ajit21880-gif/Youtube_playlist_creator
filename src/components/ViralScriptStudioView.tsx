import { useState, useEffect } from 'react';
import { 
  Sparkles, Clapperboard, Copy, Check, Music, Video, 
  ArrowRight, RefreshCw, Film, Shuffle, Clock,
  MessageCircle, Eye, Flame, Key, ExternalLink, X, AlertCircle
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini AI Integration States
  const [useGemini, setUseGemini] = useState<boolean>(() => {
    return localStorage.getItem('use_gemini_engine') === 'true';
  });
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);

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

  const checkGeminiStatus = async () => {
    try {
      const res = await fetch('/api/gemini-status');
      if (res.ok) {
        const data = await res.json();
        setHasGeminiKey(Boolean(data.has_key));
        setMaskedKey(data.masked_key || '');
      }
    } catch (e) {
      console.error('Error checking gemini status:', e);
    }
  };

  const fetchScript = async (
    customTopic: string,
    arch = archetype,
    dur = durationMode,
    pIdx = punchlineIdx,
    geminiActive = useGemini
  ) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTopic,
          archetype: arch,
          duration: dur,
          punchline_idx: pIdx,
          use_gemini: geminiActive
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requires_key) {
          setShowKeyModal(true);
        }
        setErrorMessage(data.error || 'Failed to generate script.');
        return;
      }

      setScriptData(data.script || null);
    } catch (err: any) {
      console.error('Error generating script:', err);
      setErrorMessage(err.message || 'Network error occurred while generating script.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGeminiStatus();
    fetchScript(topic, archetype, durationMode, punchlineIdx, useGemini);
  }, []);

  const handleToggleGemini = (enable: boolean) => {
    if (enable && !hasGeminiKey) {
      setShowKeyModal(true);
      return;
    }
    setUseGemini(enable);
    localStorage.setItem('use_gemini_engine', String(enable));
    fetchScript(topic, archetype, durationMode, punchlineIdx, enable);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      setSavingKey(true);
      const res = await fetch('/api/save-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKeyInput.trim() }),
      });
      if (res.ok) {
        setHasGeminiKey(true);
        setUseGemini(true);
        localStorage.setItem('use_gemini_engine', 'true');
        setShowKeyModal(false);
        setApiKeyInput('');
        await checkGeminiStatus();
        fetchScript(topic, archetype, durationMode, punchlineIdx, true);
      }
    } catch (e) {
      console.error('Error saving Gemini key:', e);
    } finally {
      setSavingKey(false);
    }
  };

  const handleArchetypeChange = (newArch: string) => {
    setArchetype(newArch);
    const newPresets = presetsByArchetype[newArch] || [];
    const firstPreset = newPresets[0] || topic;
    setTopic(firstPreset);
    setPunchlineIdx(0);
    fetchScript(firstPreset, newArch, durationMode, 0, useGemini);
  };

  const handleDurationChange = (newDur: string) => {
    setDurationMode(newDur);
    fetchScript(topic, archetype, newDur, punchlineIdx, useGemini);
  };

  const handleShufflePunchline = () => {
    const nextIdx = punchlineIdx + 1;
    setPunchlineIdx(nextIdx);
    fetchScript(topic, archetype, durationMode, nextIdx, useGemini);
  };

  const handleCopyScript = () => {
    if (!scriptData) return;
    const text = `
TITLE: ${scriptData.title}
ARCHETYPE: ${scriptData.archetype_name}
DURATION: ${scriptData.duration}
ENGINE: ${scriptData.powered_by === 'gemini' ? 'Google Gemini AI (100% Unique)' : 'Built-in Smart Engine'}
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
            Generate viral comedy Short scripts tailored for Hindi creators. Use the offline Built-in Engine or toggle Google Gemini AI for 100% unique, unscripted dialogues every time.
          </p>
        </div>

        {/* Engine Mode Toggle Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => handleToggleGemini(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                !useGemini
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚡ Built-in Engine</span>
            </button>

            <button
              onClick={() => handleToggleGemini(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                useGemini
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>✨ Google Gemini AI</span>
            </button>
          </div>

          {hasGeminiKey ? (
            <button
              onClick={() => setShowKeyModal(true)}
              className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer"
              title="Click to manage Gemini API Key"
            >
              <Key className="w-3 h-3" />
              <span>Key: {maskedKey || 'Saved'}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowKeyModal(true)}
              className="text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Key className="w-3 h-3" />
              <span>Set Free AI Key</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start justify-between gap-3 text-xs text-red-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{errorMessage}</span>
              {useGemini && (
                <div className="mt-1 text-slate-300">
                  Tip: You can switch back to the <b>Built-in Engine</b> above or update your API key.
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => handleToggleGemini(false)}
            className="px-2.5 py-1 text-[11px] font-semibold bg-red-900/60 hover:bg-red-900 text-white rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Use Built-in Engine
          </button>
        </div>
      )}

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
                    ? useGemini
                      ? 'bg-purple-950/20 border-purple-500 shadow-md shadow-purple-500/10'
                      : 'bg-red-600/15 border-red-500 shadow-md shadow-red-500/10'
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
                  <div className={`mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${useGemini ? 'text-purple-400' : 'text-red-400'}`}>
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
                    ? useGemini
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'bg-red-600 text-white font-semibold shadow-sm'
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
                  fetchScript(p, archetype, durationMode, 0, useGemini);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  topic === p
                    ? useGemini
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'bg-red-600 text-white font-semibold shadow-sm'
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
            onKeyDown={(e) => e.key === 'Enter' && fetchScript(topic, archetype, durationMode, punchlineIdx, useGemini)}
            placeholder={
              useGemini
                ? 'Type any unique situation (Gemini will write a 100% brand-new script)...'
                : 'Or type any specific situational idea (e.g. Chai lover, Sunday subah ka jhagda)...'
            }
            className="flex-1 px-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => fetchScript(topic, archetype, durationMode, punchlineIdx, useGemini)}
            disabled={loading}
            className={`px-5 py-2.5 text-xs font-semibold text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${
              useGemini
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {loading
                ? useGemini
                  ? 'Generating with Gemini AI...'
                  : 'Generating Script...'
                : useGemini
                ? 'Generate with Gemini AI ✨'
                : 'Generate Script'}
            </span>
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
                  {scriptData.powered_by === 'gemini' ? (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Google Gemini AI</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700">
                      ⚡ Built-in Engine
                    </span>
                  )}
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
                    <Flame className="w-4 h-4 text-red-400" />
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

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Google Gemini AI Engine</h3>
                  <p className="text-xs text-slate-400">Unlimited unique scripts using free AI</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                Google AI Studio provides a <b>completely free API key</b> with 15 requests/minute and zero credit card requirements.
              </p>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold underline"
              >
                <span>Get your free Gemini API key on Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="pt-2 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Paste Gemini API Key:
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasGeminiKey ? `Current Key: ${maskedKey}` : 'AIzaSy...'}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setUseGemini(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Use Built-in Engine
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={savingKey || !apiKeyInput.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Key & Enable AI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
