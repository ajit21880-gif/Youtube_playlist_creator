import { useState, useEffect } from 'react';
import { 
  Sparkles, Clapperboard, Copy, Check, Music, Video, 
  Lightbulb, ArrowRight, RefreshCw, Layers, Film
} from 'lucide-react';

interface ViralScriptStudioViewProps {
  initialTopic?: string;
  onSendToHashtags: (title: string) => void;
}

export function ViralScriptStudioView({
  initialTopic = 'Chai time comedy moment',
  onSendToHashtags,
}: ViralScriptStudioViewProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [scriptData, setScriptData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const presets = [
    'Chai Ke Deewane (Morning Tea Addict)',
    'Pati-Patni Shopping Reality Drama',
    'Mehmaan Aur Unki Shaadi Waali Advice',
    'Festival Sweets Secret Fight at Home',
    'Bhabhi Ne Meri Tareef Ki Ya Beizzati?!'
  ];

  const fetchScript = async (customTopic: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: customTopic }),
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
    fetchScript(topic);
  }, []);

  const handleCopyScript = () => {
    if (!scriptData) return;
    const text = `
TITLE: ${scriptData.title}
DURATION: ${scriptData.duration}
AUDIO: ${scriptData.audio_suggestion}

${scriptData.scenes.map((s: any) => `[${s.time}] ${s.label}\nAction: ${s.action}\nDialogue: "${s.dialogue}"\nCamera: ${s.camera}\n`).join('\n')}

HASHTAGS: ${scriptData.hashtags.join(' ')}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Clapperboard className="w-6 h-6 text-red-500" />
          <span>Viral Script & Storyboard Studio</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Complete 20-25 second viral Short production scripts with scene-by-scene acting directions, visual pattern interrupts, punchlines, and audio cues tailored for your channel.
        </p>
      </div>

      {/* Preset Topics & Custom Input */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Choose a High-Impact Comedy Concept or Enter Your Own:
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTopic(p);
                fetchScript(p);
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

        {/* Custom Input */}
        <div className="flex gap-2 max-w-2xl pt-1">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchScript(topic)}
            placeholder="Type your funny idea or situation..."
            className="flex-1 px-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => fetchScript(topic)}
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Script</span>
          </button>
        </div>
      </div>

      {/* Generated Script Display */}
      {scriptData && (
        <div className="space-y-6">
          {/* Script Overview Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{scriptData.title}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  {scriptData.duration}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Audio suggestion: <b>{scriptData.audio_suggestion}</b></span>
              </p>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Scene-by-Scene Timeline & Storyboard */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-red-500" />
              <span>Scene-by-Scene Storyboard & Camera Directions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scriptData.scenes.map((scene: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{scene.label}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-600/20 text-red-400 border border-red-500/30">
                        {scene.time}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Dialogue / Voiceover:
                      </div>
                      <div className="text-xs font-medium text-emerald-300 italic">
                        "{scene.dialogue}"
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      <div>
                        <b className="text-slate-400">Visual Action: </b>
                        {scene.action}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Video className="w-3 h-3 text-cyan-400" />
                      <span>{scene.camera}</span>
                    </span>
                  </div>
                </div>
              ))}
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
