import { ShortVideo, ScoringConfig, PlaylistConfig } from '../types';

export function calculateShortScore(
  video: ShortVideo,
  config: ScoringConfig,
  nowUtc: Date = new Date()
): ShortVideo {
  const views = Math.max(video.views, 1);
  const likes = Math.max(video.likes, 0);
  const comments = Math.max(video.comments, 0);

  // 1. Engagement Ratios with Capping
  const likeRatio = Math.min(likes / views, config.maxLikeRatioCap);
  const commentRatio = Math.min(comments / views, config.maxCommentRatioCap);
  const engagementBonus =
    likeRatio * config.likeRatioWeight + commentRatio * config.commentRatioWeight;

  // 2. Recency Decay
  let ageDays = 30;
  try {
    const pubDate = new Date(video.publishedAt);
    ageDays = Math.max(0, (nowUtc.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    ageDays = 30;
  }

  const decay = Math.exp(-Math.log(2) * (ageDays / Math.max(config.halfLifeDays, 1)));
  const recencyMultiplier = (1.0 - config.recencyFloor) * decay + config.recencyFloor;

  // 3. Final Multi-Signal Performance Score
  const likesTerm = Math.pow(likes, config.likesWeight);
  const finalScore = likesTerm * (1.0 + engagementBonus) * recencyMultiplier;

  // Secondary score for pure community appreciation (Hidden Gems)
  const engagementScore = likeRatio * 100 + commentRatio * 250;

  return {
    ...video,
    ageDays: Math.round(ageDays * 10) / 10,
    likeRatio: Math.round(likeRatio * 10000) / 10000,
    commentRatio: Math.round(commentRatio * 10000) / 10000,
    recencyMult: Math.round(recencyMultiplier * 1000) / 1000,
    engagementScore: Math.round(engagementScore * 100) / 100,
    score: Math.round(finalScore * 10) / 10,
  };
}

export function rankAndPartitionShorts(
  videos: ShortVideo[],
  scoringCfg: ScoringConfig,
  playlistConfigs: PlaylistConfig[]
): {
  rankedVideos: ShortVideo[];
  playlistAssignments: Record<string, ShortVideo[]>;
} {
  // Filter out videos below view threshold
  const filtered = videos.filter((v) => v.views >= scoringCfg.minViewsThreshold);

  // Score all
  const scored = filtered.map((v) => calculateShortScore(v, scoringCfg));

  // Sort descending by primary performance score
  const ranked = scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  ranked.forEach((v, idx) => {
    v.rank = idx + 1;
  });

  const playlistAssignments: Record<string, ShortVideo[]> = {};

  for (const pl of playlistConfigs) {
    if (pl.strategy === 'top_overall') {
      playlistAssignments[pl.idKey] = ranked.slice(0, pl.maxItems);
    } else if (pl.strategy === 'rank_slice') {
      playlistAssignments[pl.idKey] = ranked.slice(pl.sliceStart, pl.sliceEnd).slice(0, pl.maxItems);
    } else if (pl.strategy === 'high_engagement') {
      const byEng = [...ranked].sort(
        (a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)
      );
      playlistAssignments[pl.idKey] = byEng.slice(0, pl.maxItems);
    } else if (pl.strategy === 'most_recent') {
      const byRecent = [...ranked].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      playlistAssignments[pl.idKey] = byRecent.slice(0, pl.maxItems);
    }
  }

  return {
    rankedVideos: ranked,
    playlistAssignments,
  };
}
