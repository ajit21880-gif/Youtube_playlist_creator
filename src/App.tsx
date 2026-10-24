/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LiveDashboardView } from './components/LiveDashboardView';
import { TrendingHubView } from './components/TrendingHubView';
import { ViralScriptStudioView } from './components/ViralScriptStudioView';
import { HashtagStudioView } from './components/HashtagStudioView';
import { ViralHubView } from './components/ViralHubView';
import { TrendsRecommenderView } from './components/TrendsRecommenderView';
import { RankingSimulator } from './components/RankingSimulator';
import { PlaylistDiffVisualizer } from './components/PlaylistDiffVisualizer';
import { QuotaArchitecture } from './components/QuotaArchitecture';
import { ConfigEditor } from './components/ConfigEditor';
import { SetupGuideView } from './components/SetupGuideView';
import { CliDryRunModal } from './components/CliDryRunModal';
import { SyncProgressModal } from './components/SyncProgressModal';
import { INITIAL_SHORTS, DEFAULT_SCORING_CONFIG, DEFAULT_PLAYLIST_CONFIGS } from './data/sampleShorts';
import { ShortVideo, ScoringConfig, PlaylistConfig } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toolsSubTab, setToolsSubTab] = useState<string>('setup');
  const [shorts, setShorts] = useState<ShortVideo[]>(INITIAL_SHORTS);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [playlistConfigs] = useState<PlaylistConfig[]>(DEFAULT_PLAYLIST_CONFIGS);

  // Workflow cross-tab state
  const [scriptTopic, setScriptTopic] = useState('Chai time funny moment');
  const [hashtagTitle, setHashtagTitle] = useState('Chai time comedy drama');

  // Modals state
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncIsDryRun, setSyncIsDryRun] = useState(false);

  const handleOpenSync = (dryRun: boolean) => {
    setSyncIsDryRun(dryRun);
    setIsSyncModalOpen(true);
  };

  const handleSelectConceptForScript = (concept: string) => {
    setScriptTopic(concept);
    setActiveTab('scripts');
  };

  const handleSendToHashtags = (title: string) => {
    setHashtagTitle(title);
    setActiveTab('hashtags');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* 3-Zone Navigation Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDryRun={() => setIsDryRunModalOpen(true)}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 1. Live Channel & Added Shorts Dashboard */}
        {activeTab === 'dashboard' && (
          <LiveDashboardView
            onOpenSyncModal={handleOpenSync}
            onNavigateToTrends={() => setActiveTab('trending')}
            onNavigateToViral={() => setActiveTab('viral')}
          />
        )}

        {/* 2. Trending Hub (India & Channel Niche) */}
        {activeTab === 'trending' && (
          <TrendingHubView
            onSelectConceptForScript={handleSelectConceptForScript}
          />
        )}

        {/* 3. Viral Script & Storyboard Studio */}
        {activeTab === 'scripts' && (
          <ViralScriptStudioView
            initialTopic={scriptTopic}
            onSendToHashtags={handleSendToHashtags}
          />
        )}

        {/* 4. Hashtag Post Studio (Matching user reference screenshot) */}
        {activeTab === 'hashtags' && (
          <HashtagStudioView
            initialTitle={hashtagTitle}
          />
        )}

        {/* 5. Viral Growth Blueprint & Retention Advice */}
        {activeTab === 'viral' && <ViralHubView />}

        {/* 6. Advanced Tools & Setup (Consolidated sub-tabs) */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
              <button
                onClick={() => setToolsSubTab('setup')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  toolsSubTab === 'setup' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Setup Guide
              </button>
              <button
                onClick={() => setToolsSubTab('simulator')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  toolsSubTab === 'simulator' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ranking Simulator
              </button>
              <button
                onClick={() => setToolsSubTab('diff')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  toolsSubTab === 'diff' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Diff Engine
              </button>
              <button
                onClick={() => setToolsSubTab('quota')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  toolsSubTab === 'quota' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Quota Architecture
              </button>
              <button
                onClick={() => setToolsSubTab('config')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  toolsSubTab === 'config' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                config.yaml
              </button>
            </div>

            {toolsSubTab === 'setup' && <SetupGuideView />}
            {toolsSubTab === 'simulator' && (
              <RankingSimulator
                shorts={shorts}
                setShorts={setShorts}
                scoringConfig={scoringConfig}
                setScoringConfig={setScoringConfig}
                playlistConfigs={playlistConfigs}
                onOpenDryRun={() => handleOpenSync(true)}
              />
            )}
            {toolsSubTab === 'diff' && (
              <PlaylistDiffVisualizer
                shorts={shorts}
                scoringConfig={scoringConfig}
                playlistConfigs={playlistConfigs}
              />
            )}
            {toolsSubTab === 'quota' && <QuotaArchitecture />}
            {toolsSubTab === 'config' && (
              <ConfigEditor
                scoringConfig={scoringConfig}
                playlistConfigs={playlistConfigs}
              />
            )}
          </div>
        )}
      </main>

      {/* Live YouTube Sync & Diff Modal */}
      <SyncProgressModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isDryRun={syncIsDryRun}
      />

      {/* CLI Dry-Run Terminal Simulator Modal */}
      <CliDryRunModal
        isOpen={isDryRunModalOpen}
        onClose={() => setIsDryRunModalOpen(false)}
        shorts={shorts}
        scoringConfig={scoringConfig}
        playlistConfigs={playlistConfigs}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span>YouTube Shorts Playlist Curator & Growth Engine</span>
            <span aria-hidden="true">·</span>
            <span>YouTube Data API v3</span>
            <span aria-hidden="true">·</span>
            <span>Google OAuth 2.0</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Trending Hub
            </button>
            <button
              onClick={() => setActiveTab('scripts')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Script Studio
            </button>
            <button
              onClick={() => setActiveTab('hashtags')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Hashtags & SEO
            </button>
            <button
              onClick={() => setActiveTab('viral')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Viral Blueprint
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
