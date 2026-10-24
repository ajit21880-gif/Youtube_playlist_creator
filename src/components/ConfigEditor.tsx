import { useState } from 'react';
import { Copy, Check, Download, FileCode } from 'lucide-react';
import { ScoringConfig, PlaylistConfig } from '../types';

interface ConfigEditorProps {
  scoringConfig: ScoringConfig;
  playlistConfigs: PlaylistConfig[];
}

export function ConfigEditor({ scoringConfig, playlistConfigs }: ConfigEditorProps) {
  const [copied, setCopied] = useState(false);

  // Generate synchronized YAML string
  const yamlContent = `# ==============================================================================
# YouTube Shorts Playlist Curator - Configuration (config.yaml)
# ==============================================================================
# Controls authentication paths, detection parameters, ranking weights,
# daily quota limits, and managed playlist tier definitions.
# ==============================================================================

auth:
  client_secrets_file: "client_secret.json"
  token_file: "token.json"
  state_file: "state.json"

shorts_detection:
  max_duration_seconds: 60
  verify_via_head_request: true
  cache_short_status: true
  min_views_threshold: ${scoringConfig.minViewsThreshold}

scoring:
  # Primary volume driver
  likes_weight: ${scoringConfig.likesWeight.toFixed(2)}
  # Engagement ratio bonus multipliers
  like_ratio_weight: ${scoringConfig.likeRatioWeight.toFixed(1)}
  max_like_ratio_cap: ${scoringConfig.maxLikeRatioCap.toFixed(2)}
  comment_ratio_weight: ${scoringConfig.commentRatioWeight.toFixed(1)}
  max_comment_ratio_cap: ${scoringConfig.maxCommentRatioCap.toFixed(2)}
  # Exponential recency decay
  half_life_days: ${scoringConfig.halfLifeDays.toFixed(1)}
  recency_floor: ${scoringConfig.recencyFloor.toFixed(2)}

quota:
  max_daily_budget_units: 8000
  reserve_buffer_units: 200

playlists:
${playlistConfigs
  .map(
    (pl) => `  - id_key: "${pl.idKey}"
    title: "${pl.title}"
    description: "${pl.description}"
    privacy: "${pl.privacy}"
    strategy: "${pl.strategy}"
    max_items: ${pl.maxItems}
    slice_start: ${pl.sliceStart}
    slice_end: ${pl.sliceEnd}`
  )
  .join('\n\n')}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Configuration File (config.yaml)
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Single Point of Truth</span>
              <span aria-hidden="true">·</span>
              <span>Fully Commented</span>
              <span aria-hidden="true">·</span>
              <span>Hot-Reloaded in CLI</span>
              <span aria-hidden="true">·</span>
              <span>Dynamic Weights Linked</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy YAML</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download config.yaml</span>
            </button>
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <FileCode className="w-4 h-4 text-slate-400" />
            <span>config.yaml</span>
          </div>
          <span>YAML Format</span>
        </div>
        <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed bg-slate-950/80">
          {yamlContent}
        </pre>
      </div>
    </div>
  );
}
