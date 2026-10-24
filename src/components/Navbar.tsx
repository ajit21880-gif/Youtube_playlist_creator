import { useState } from 'react';
import { Download, Terminal } from 'lucide-react';
import { downloadPythonBundle } from '../utils/exportBundle';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDryRun: () => void;
}

export function Navbar({ activeTab, setActiveTab, onOpenDryRun }: NavbarProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadPythonBundle();
    } finally {
      setDownloading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Live Dashboard' },
    { id: 'trending', label: 'Trending Hub (India & Niche)' },
    { id: 'scripts', label: 'Script Studio' },
    { id: 'hashtags', label: 'Hashtag Post Studio' },
    { id: 'viral', label: 'Viral Blueprint' },
    { id: 'tools', label: 'Tools & Setup' },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 font-bold text-sm">
            ▶
          </div>
          <span className="text-base font-bold text-slate-100 tracking-tight whitespace-nowrap">
            Shorts Playlist Curator
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer border-b-2 text-sm ${
                  isActive
                    ? 'text-white border-red-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenDryRun}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700/80 rounded-lg hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Simulate command line --dry-run"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">CLI Dry Run</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Export Python ZIP'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
