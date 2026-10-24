export interface ShortVideo {
  id: string;
  title: string;
  duration: number; // in seconds
  views: number;
  likes: number;
  comments: number;
  publishedAt: string; // ISO date
  // Computed fields
  ageDays?: number;
  age_days?: number;
  likeRatio?: number;
  like_ratio?: number;
  commentRatio?: number;
  comment_ratio?: number;
  recencyMult?: number;
  recency_mult?: number;
  engagementScore?: number;
  engagement_score?: number;
  score?: number;
  rank?: number;
  assignedPlaylist?: string;
  assignedPlaylists?: string[];
  thumbnail?: string;
  youtubeUrl?: string;
}

export interface ScoringConfig {
  likesWeight: number;
  likeRatioWeight: number;
  maxLikeRatioCap: number;
  commentRatioWeight: number;
  maxCommentRatioCap: number;
  halfLifeDays: number;
  recencyFloor: number;
  minViewsThreshold: number;
}

export interface PlaylistConfig {
  idKey: string;
  title: string;
  description: string;
  privacy: 'public' | 'unlisted' | 'private';
  strategy: 'top_overall' | 'rank_slice' | 'high_engagement' | 'most_recent';
  maxItems: number;
  sliceStart: number;
  sliceEnd: number;
}

export interface DiffItem {
  id: string;
  title: string;
  status: 'added' | 'removed' | 'retained';
  previousPosition?: number;
  newPosition?: number;
  views: number;
  likes: number;
  score: number;
}

export interface ChannelInfo {
  id: string;
  title: string;
  customUrl: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export interface ManagedPlaylistStatus {
  key: string;
  title: string;
  description: string;
  privacy: string;
  strategy: string;
  max_items: number;
  playlist_id: string | null;
  url: string | null;
  video_count: number;
  last_synced: string | null;
  items?: ShortVideo[];
}

export interface TrendItem {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  age_days: number;
  velocity_views_per_day: number;
  like_percentage: number;
  comment_percentage: number;
  score: number;
  category: string;
  recommended_playlist: string;
  recommendation_reason: string;
  thumbnail: string;
  youtubeUrl: string;
}

export interface ViralAdvisorData {
  viral_health_score: number;
  score_verdict: string;
  hook_blueprints: Array<{
    name: string;
    hook_example: string;
    why_it_works: string;
    target_duration: string;
  }>;
  trending_topics: Array<{
    niche: string;
    topics: string[];
    hot_keywords: string[];
  }>;
  pre_publish_checklist: Array<{
    step: number;
    rule: string;
    detail: string;
  }>;
}

export interface SyncReport {
  playlist_key: string;
  playlist_id: string;
  title: string;
  action: string;
  added: number;
  removed: number;
  retained: number;
  url?: string;
}

export interface ScriptScene {
  time: string;
  label: string;
  action: string;
  dialogue: string;
  camera: string;
  onscreen_text?: string;
}

export interface ViralScriptData {
  title: string;
  titles_pool?: string[];
  hook: string;
  archetype: string;
  archetype_name: string;
  duration: string;
  duration_mode: string;
  audio_suggestion: string;
  onscreen_hook_text: string;
  loop_ending_technique: string;
  comment_spark: string;
  scenes: ScriptScene[];
  punchline_variations: string[];
  current_punchline_idx: number;
  hashtags: string[];
}
