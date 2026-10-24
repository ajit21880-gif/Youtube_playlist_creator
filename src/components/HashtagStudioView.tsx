import { useState, useEffect } from 'react';
import { 
  Hash, Copy, Check, UploadCloud, RefreshCw, ExternalLink, 
  Sparkles, CheckCircle2, AlertCircle, Eye, Film, Flame
} from 'lucide-react';
import { ShortVideo } from '../types';

interface HashtagStudioViewProps {
  initialTitle?: string;
}

export function HashtagStudioView({ initialTitle }: HashtagStudioViewProps) {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState(initialTitle || 'Chai time comedy drama');
  
  const [formattedTitle, setFormattedTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shorts')
      .then(res => res.json())
      .then(data => {
        const sList = data.shorts || [];
        setShorts(sList);
        if (sList.length > 0) {
          setSelectedVideoId(sList[0].id);
          generatePost(sList[0].title, sList[0].id);
        } else {
          generatePost(customTitle, '');
        }
      })
      .catch(console.error);
  }, []);

  const generatePost = async (title: string, vidId: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/generate-hashtag-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, video_id: vidId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFormattedTitle(data.formatted_title);
        setDescription(data.description);
        setHashtags(data.hashtags || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (vidId: string) => {
    setSelectedVideoId(vidId);
    const found = shorts.find(s => s.id === vidId);
    if (found) {
      setCustomTitle(found.title);
      generatePost(found.title, vidId);
    }
  };

  const handleCopy = () => {
    const fullText = `${formattedTitle}\n\n${description}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublishToYouTube = async () => {
    if (!selectedVideoId) {
      alert('Please select one of your channel videos to update.');
      return;
    }
    try {
      setUpdating(true);
      setUpdateSuccess(null);
      setUpdateError(null);
      const res = await fetch('/api/update-video-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: selectedVideoId,
          title: formattedTitle,
          description: description,
          tags: hashtags.map(h => h.replace('#', ''))
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUpdateSuccess(`Successfully updated "${formattedTitle}" on your YouTube channel!`);
      } else {
        setUpdateError(data.error || 'Failed to update video metadata on YouTube.');
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Network error while updating video.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Hash className="w-6 h-6 text-red-500" />
          <span>Hashtag Post & Description Studio</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Generate high-ranking YouTube description posts formatted with clickable hashtags, storytelling summary, and emojis. Publish directly to your YouTube video in one click.
        </p>
      </div>

      {/* Select Video or Custom Title */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select One of Your Channel's Uploaded Shorts:
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => handleSelectVideo(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              {shorts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.duration}s · {s.views.toLocaleString()} views)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Or Customize the Short Title / Concept:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generatePost(customTitle, selectedVideoId)}
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-red-500"
              />
              <button
                onClick={() => generatePost(customTitle, selectedVideoId)}
                disabled={loading}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {updateSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{updateSuccess}</span>
          </div>
          <a
            href={`https://www.youtube.com/shorts/${selectedVideoId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0"
          >
            <span>View on YouTube</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {updateError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{updateError}</span>
        </div>
      )}

      {/* 2-Column: Editor & Reference Card (Matching User's Screenshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Column 1: Editable Fields */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Edit Generated Post Details
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Optimized Short Title (with #shorts)</label>
              <input
                type="text"
                value={formattedTitle}
                onChange={(e) => setFormattedTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Description Body & Hashtags</label>
              <textarea
                rows={9}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 leading-relaxed font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Post Text'}</span>
              </button>

              <button
                onClick={handlePublishToYouTube}
                disabled={updating || !selectedVideoId}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl transition-all shadow-lg shadow-red-900/40 cursor-pointer disabled:opacity-50"
              >
                {updating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>{updating ? 'Publishing...' : 'Update on YouTube Directly'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Live YouTube Card Preview (Styled Exactly Like User Screenshot) */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Live YouTube App Preview</span>
            <span className="text-[10px] text-emerald-400 font-mono">Matched to Reference Screenshot</span>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/90 shadow-2xl space-y-4 font-sans">
            {/* Title with front blue hashtag */}
            <div className="text-base font-bold text-white leading-snug">
              <span className="text-cyan-400 mr-1.5">#shorts</span>
              {formattedTitle.replace('#shorts', '').trim()}
            </div>

            {/* Channel header */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-600/30 border border-red-500/40 flex items-center justify-center font-bold text-red-500 text-xs">
                  SS
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Shashi Singh</div>
                  <div className="text-[10px] text-slate-400">@sasikalasingh-o4j</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <div>
                  <div className="font-bold text-white">1.4K</div>
                  <div className="text-[10px] text-slate-400">Views</div>
                </div>
                <div>
                  <div className="font-bold text-white">24 Oct</div>
                  <div className="text-[10px] text-slate-400">2026</div>
                </div>
              </div>
            </div>

            {/* Gray Description Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-850 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {description}
            </div>

            {/* Hashtag pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hashtags.map((h, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[11px] font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-800/40"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
