import React from 'react';
import {
  Cloud,
  CloudOff,
  ExternalLink,
  Flame,
  Footprints,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { UserAccount } from '../types/hopeDealers';

export type ActiveTab = 'walk' | 'map' | 'impact' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncedAt?: string;
  onManualSync: () => void;
  hasActiveWalkRunning: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenLogin,
  onLogout,
  isOnline,
  pendingSyncCount,
  onManualSync,
  hasActiveWalkRunning,
}) => {
  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slateDark-950/95 backdrop-blur-md border-b border-slate-800/80 no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <button
            onClick={() => setActiveTab(currentUser ? 'walk' : 'impact')}
            className="flex items-center gap-2.5 text-left group"
          >
            <img
              src="/hope-dealers-logo.png"
              alt="Hope Dealers Logo"
              className="h-11 sm:h-12 w-auto object-contain drop-shadow-md transition-transform group-hover:scale-105"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg tracking-tight text-white">
                  HOPE DEALERS
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-phoenix-500/20 text-phoenix-300 border border-phoenix-500/30">
                  Love • Pray • Serve • Restore
                </span>
              </div>
              <p className="text-[11px] text-amber-400/90 font-semibold leading-none">
                Giving the Hopeless Hope • Life Recovery Society
              </p>
            </div>
          </button>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slateDark-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('walk')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'walk'
                  ? 'bg-phoenix-600 text-white shadow-md shadow-phoenix-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>Log Walk & Counters</span>
              {hasActiveWalkRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'map'
                  ? 'bg-phoenix-600 text-white shadow-md shadow-phoenix-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Street & Prayer Map</span>
            </button>

            <button
              onClick={() => setActiveTab('impact')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'impact'
                  ? 'bg-phoenix-600 text-white shadow-md shadow-phoenix-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Impact & Publish</span>
            </button>

            {currentUser?.role === 'superuser' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Super User & Cloud</span>
              </button>
            )}
          </nav>

          {/* Right Controls: Resource Link, Cloud Status & Auth */}
          <div className="flex items-center gap-2">
            {/* Quick Link to ChillicotheCommunityResources.com */}
            <a
              href="https://chillicothecommunityresources.com/"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Chillicothe Community Resources Directory"
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
            >
              <span>Community Services</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Cloud Sync Status Indicator */}
            <button
              onClick={onManualSync}
              title={
                isOnline
                  ? pendingSyncCount > 0
                    ? `${pendingSyncCount} items syncing to cloud...`
                    : 'Cloud Synced — Click to refresh'
                  : 'Offline Mode — Changes saved on phone and will auto-sync'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                !isOnline
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : pendingSyncCount > 0
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-slate-900 text-emerald-400 border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              {isOnline ? (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {pendingSyncCount > 0 ? `Syncing (${pendingSyncCount})` : 'Cloud Synced'}
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Offline Saved</span>
                </>
              )}
              <RefreshCw className="w-3 h-3 opacity-60" />
            </button>

            {/* User Login / Profile */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-right">
                  <div className="flex items-center gap-1">
                    {currentUser.role === 'superuser' && (
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[150px]">
                      {currentUser.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-phoenix-400 font-semibold leading-none">
                    {currentUser.role === 'superuser' ? 'Super User' : 'Hope Dealer'}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-phoenix-500 to-phoenix-600 hover:from-phoenix-600 hover:to-phoenix-700 text-white text-xs font-bold shadow-md shadow-phoenix-600/25 transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Volunteer / Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Thumb-Friendly) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slateDark-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 no-print">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('walk')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeTab === 'walk'
                ? 'bg-phoenix-600/20 text-phoenix-400 border border-phoenix-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Footprints className="w-5 h-5 mb-0.5" />
              {hasActiveWalkRunning && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <span>Log Walk</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeTab === 'map'
                ? 'bg-phoenix-600/20 text-phoenix-400 border border-phoenix-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-5 h-5 mb-0.5" />
            <span>Street Map</span>
          </button>

          <button
            onClick={() => setActiveTab('impact')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeTab === 'impact'
                ? 'bg-phoenix-600/20 text-phoenix-400 border border-phoenix-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>Impact</span>
          </button>

          {currentUser?.role === 'superuser' ? (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <ShieldCheck className="w-5 h-5 mb-0.5" />
              <span>Super User</span>
            </button>
          ) : (
            <a
              href="https://chillicothecommunityresources.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition"
            >
              <ExternalLink className="w-5 h-5 mb-0.5" />
              <span>Resources</span>
            </a>
          )}
        </div>
      </nav>
    </>
  );
};
