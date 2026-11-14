import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Footprints,
  HeartHandshake,
  MapPin,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  EncounterPin,
  NEED_CATEGORIES,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';

interface ImpactReportPublisherProps {
  walks: WalkSession[];
  pins: EncounterPin[];
  currentUser: UserAccount | null;
  onDeleteWalk?: (walkId: string) => void;
  onViewMap: () => void;
}

export const ImpactReportPublisher: React.FC<ImpactReportPublisherProps> = ({
  walks,
  pins,
  currentUser,
  onDeleteWalk,
  onViewMap,
}) => {
  const [period, setPeriod] = useState<'all' | '30d' | '7d' | 'custom'>('all');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [copiedSocial, setCopiedSocial] = useState(false);

  // Filter walks and pins by chosen period
  const { filteredWalks, filteredPins, periodLabel } = useMemo(() => {
    const now = new Date();
    let cutoffDate = '1970-01-01';
    let label = 'All-Time Cumulative Impact';

    if (period === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      cutoffDate = d.toISOString().slice(0, 10);
      label = 'Last 7 Days Impact';
    } else if (period === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      cutoffDate = d.toISOString().slice(0, 10);
      label = 'Last 30 Days Impact';
    } else if (period === 'custom') {
      label = `${startDate} to ${endDate}`;
    }

    const fw = walks.filter((w) => {
      if (period === 'all') return true;
      if (period === 'custom') return w.date >= startDate && w.date <= endDate;
      return w.date >= cutoffDate;
    });

    const fp = pins.filter((p) => {
      const pDate = p.timestamp.slice(0, 10);
      if (period === 'all') return true;
      if (period === 'custom') return pDate >= startDate && pDate <= endDate;
      return pDate >= cutoffDate;
    });

    return { filteredWalks: fw, filteredPins: fp, periodLabel: label };
  }, [walks, pins, period, startDate, endDate]);

  // Compute aggregated metrics
  const stats = useMemo(() => {
    const totalInteractions = filteredWalks.reduce(
      (sum, w) => sum + w.interactionsCount,
      0
    );
    const totalPrayers = Math.max(
      filteredWalks.reduce((sum, w) => sum + w.prayersCount, 0),
      filteredPins.filter((p) => p.type === 'prayer' || p.type === 'both').length
    );
    const totalServiceLinkages = Math.max(
      filteredWalks.reduce((sum, w) => sum + w.serviceLinkagesCount, 0),
      filteredPins.filter((p) => p.type === 'service' || p.type === 'both').length
    );
    const totalMiles = Number(
      filteredWalks.reduce((sum, w) => sum + w.milesWalked, 0).toFixed(1)
    );
    const totalWalkHours = Number(
      (
        filteredWalks.reduce((sum, w) => sum + w.durationMinutes, 0) / 60
      ).toFixed(1)
    );
    const totalVolunteerHours = Number(
      filteredWalks.reduce((sum, w) => sum + w.volunteerHours, 0).toFixed(1)
    );
    const totalTrashBags = filteredWalks.reduce(
      (sum, w) => sum + w.trashBagsCount,
      0
    );
    const totalTrashLbs = filteredWalks.reduce(
      (sum, w) => sum + w.trashWeightLbs,
      0
    );

    const uniqueStreets = new Set<string>();
    filteredWalks.forEach((w) =>
      w.streetsWalked.forEach((s) => uniqueStreets.add(s))
    );
    filteredPins.forEach((p) => {
      if (p.streetName) uniqueStreets.add(p.streetName);
    });

    const needCounts: Record<string, number> = {};
    NEED_CATEGORIES.forEach((c) => {
      needCounts[c.id] = 0;
    });
    filteredPins.forEach((p) => {
      p.needCategories.forEach((id) => {
        needCounts[id] = (needCounts[id] || 0) + 1;
      });
    });

    return {
      walksCount: filteredWalks.length,
      totalInteractions,
      totalPrayers,
      totalServiceLinkages,
      totalMiles,
      totalWalkHours,
      totalVolunteerHours,
      totalTrashBags,
      totalTrashLbs,
      uniqueStreets: Array.from(uniqueStreets),
      needCounts,
    };
  }, [filteredWalks, filteredPins]);

  // Generate Ready-to-Publish Social Media & Newsletter Post
  const socialSummaryText = useMemo(() => {
    const streetsList = stats.uniqueStreets.slice(0, 8).join(', ');
    return `🔥 HOPE DEALERS COMMUNITY IMPACT UPDATE 🔥
Life Recovery Society — Street Ministry (${periodLabel})

Our Hope Dealers teams have been out walking the streets of Chillicothe in groups of 2–3—meeting neighbors where they are, praying with them, connecting immediate needs to services, and picking up trash to help transform our community!

📊 ${periodLabel.toUpperCase()} BY THE NUMBERS:
👋 ${stats.totalInteractions} Public Interactions & Check-Ins
🙏 ${stats.totalPrayers} Neighbors Prayed With on the Street
🤝 ${stats.totalServiceLinkages} Immediate Service Linkages (Food, Shelter, Recovery, Medical)
🗑️ ${stats.totalTrashBags} Bags of Trash Cleared (~${stats.totalTrashLbs} lbs removed!)
👟 ${stats.totalMiles} Street Miles Walked (${stats.totalVolunteerHours} Total Volunteer Hours invested)
📍 Streets Walked: ${streetsList || 'Downtown Chillicothe'}

"Love • Pray • Serve • Restore — Giving the Hopeless Hope"
"Rescuing Addicts • Reconnecting Families • Repairing Brokenness • Restoring Communities"
🌐 Learn more: https://liferecoverysociety.org
🔗 Community Resources: https://chillicothecommunityresources.com/`;
  }, [stats, periodLabel]);

  const handleCopySocialSummary = async () => {
    try {
      await navigator.clipboard.writeText(socialSummaryText);
      setCopiedSocial(true);
      setTimeout(() => setCopiedSocial(false), 3500);
    } catch {
      // Fallback
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Recorder',
      'Group Members',
      'Group Size',
      'Duration (Mins)',
      'Total Volunteer Hours',
      'Miles Walked',
      'Streets Walked',
      'Public Interactions',
      'People Prayed For',
      'Service Linkages',
      'Trash Bags',
      'Trash Weight (Lbs)',
      'Notes',
    ];
    const rows = filteredWalks.map((w) => [
      w.date,
      `"${w.recorderName}"`,
      `"${w.groupMembers.join('; ')}"`,
      w.groupSize,
      w.durationMinutes,
      w.volunteerHours,
      w.milesWalked,
      `"${w.streetsWalked.join('; ')}"`,
      w.interactionsCount,
      w.prayersCount,
      w.serviceLinkagesCount,
      w.trashBagsCount,
      w.trashWeightLbs,
      `"${(w.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Hope_Dealers_Impact_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6">
      {/* Hero Banner & Period Selector */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-phoenix-900/50 via-slateDark-900 to-slateDark-900 border border-phoenix-500/30 shadow-2xl print-only-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <img
              src="/hope-dealers-logo.png"
              alt="Hope Dealers Logo"
              className="h-24 sm:h-28 w-auto object-contain drop-shadow-xl shrink-0"
            />
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-phoenix-500/20 border border-phoenix-500/30 text-phoenix-300 text-xs font-extrabold">
                <Flame className="w-3.5 h-3.5" />
                <span>LOVE • PRAY • SERVE • RESTORE — GIVING THE HOPELESS HOPE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Hope Dealers Community Impact Report
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Live street ministry metrics captured by Life Recovery Society teams walking in groups of 2–3 across Chillicothe & Ross County.
              </p>
            </div>
          </div>

          {/* Date Range Filter Controls */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slateDark-950 p-1.5 rounded-2xl border border-slate-800 no-print">
            <Calendar className="w-4 h-4 text-phoenix-400 ml-2 mr-1" />
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                period === 'all'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All-Time
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                period === '30d'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                period === '7d'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                period === 'custom'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Dates
            </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3 no-print">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slateDark-950 border border-slate-700 text-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slateDark-950 border border-slate-700 text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* 6 Primary Impact KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
            👋 Public Interactions
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-1">
            {stats.totalInteractions}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Neighbors greeted, encouraged & checked on
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
            🙏 People Prayed For
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-1">
            {stats.totalPrayers}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Personal street prayers offered by name
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            🤝 Linked to Services
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-1">
            {stats.totalServiceLinkages}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Immediate needs connected to local resources
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-purple-400">
            🗑️ Trash Cleared
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-white">
              {stats.totalTrashLbs}
            </span>
            <span className="text-sm font-bold text-purple-300">lbs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.totalTrashBags} trash bags picked up along streets
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-phoenix-400">
            👟 Street Miles Walked
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-white">
              {stats.totalMiles}
            </span>
            <span className="text-sm font-bold text-phoenix-300">miles</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {stats.uniqueStreets.length} streets ({stats.walksCount} group walks)
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-lg print-only-card">
          <div className="text-xs font-extrabold uppercase tracking-wider text-teal-400">
            ⏱️ Total Volunteer Hours
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-white">
              {stats.totalVolunteerHours}
            </span>
            <span className="text-sm font-bold text-teal-300">hrs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.totalWalkHours} route hrs × 2–3 Hope Dealers per group
          </p>
        </div>
      </div>

      {/* PERIODIC IMPACT PUBLISHING STUDIO & IMMEDIATE NEEDS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Publishable Social Media / Board Summary Box */}
        <div className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4 no-print">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-phoenix-400" />
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Publish Periodic Impact Summary
                </h2>
                <p className="text-xs text-slate-400">
                  1-click copy for Facebook, newsletters, donors, or board reports
                </p>
              </div>
            </div>
          </div>

          <pre className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
            {socialSummaryText}
          </pre>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopySocialSummary}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-phoenix-500 to-phoenix-600 hover:from-phoenix-600 hover:to-phoenix-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-phoenix-600/20 transition"
            >
              {copiedSocial ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied Impact Post to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Impact Summary Post</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print / PDF Report</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Service Linkages by Immediate Need Category */}
        <div className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4 print-only-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white">
                Immediate Needs & Service Linkages Breakdown
              </h2>
              <p className="text-xs text-slate-400">
                Categories of support connected during street outreach
              </p>
            </div>
            <a
              href="https://chillicothecommunityresources.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 no-print"
            >
              <span>Resource Directory</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-3">
            {NEED_CATEGORIES.map((cat) => {
              const count = stats.needCounts[cat.id] || 0;
              const maxCount = Math.max(
                1,
                ...Object.values(stats.needCounts)
              );
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="font-extrabold text-phoenix-300">
                      {count} {count === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slateDark-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-phoenix-500 to-amber-400 transition-all duration-500"
                      style={{ width: `${Math.max(count > 0 ? 10 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COMPLETED GROUP WALKS LOG */}
      <section className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4 print-only-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Footprints className="w-5 h-5 text-phoenix-400" />
              <span>Outreach Group Walk Log ({filteredWalks.length})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Every street walk logged by Hope Dealers volunteer teams
            </p>
          </div>
          <button
            type="button"
            onClick={onViewMap}
            className="px-3.5 py-2 rounded-xl bg-phoenix-500/20 hover:bg-phoenix-500/30 text-phoenix-300 border border-phoenix-500/40 text-xs font-bold flex items-center gap-1.5 no-print"
          >
            <MapPin className="w-4 h-4" />
            <span>View All Streets on Map</span>
          </button>
        </div>

        <div className="space-y-3">
          {filteredWalks.map((walk) => (
            <div
              key={walk.id}
              className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-phoenix-500/20 text-phoenix-300 text-xs font-extrabold">
                    📅 {walk.date}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>
                      Group of {walk.groupSize}: {walk.groupMembers.join(', ')}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {walk.durationMinutes} mins ({walk.volunteerHours} Vol. Hrs)
                  </span>
                  {currentUser?.role === 'superuser' && onDeleteWalk && (
                    <button
                      type="button"
                      onClick={() => onDeleteWalk(walk.id)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 no-print"
                      title="Delete Walk Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Streets Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400">
                  Streets ({walk.milesWalked} mi):
                </span>
                {walk.streetsWalked.map((st) => (
                  <span
                    key={st}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200"
                  >
                    📍 {st}
                  </span>
                ))}
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs">
                  <span className="text-slate-400">Interactions: </span>
                  <span className="font-extrabold text-blue-300">
                    {walk.interactionsCount}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs">
                  <span className="text-slate-400">Prayed For: </span>
                  <span className="font-extrabold text-amber-300">
                    {walk.prayersCount}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs">
                  <span className="text-slate-400">Service Links: </span>
                  <span className="font-extrabold text-emerald-300">
                    {walk.serviceLinkagesCount}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs">
                  <span className="text-slate-400">Trash: </span>
                  <span className="font-extrabold text-purple-300">
                    {walk.trashBagsCount} bags ({walk.trashWeightLbs} lbs)
                  </span>
                </div>
              </div>

              {walk.notes && (
                <p className="text-xs text-slate-300 italic pt-1 border-t border-slate-800/80">
                  "{walk.notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* PRAYER & SERVICE ROSTER (Visible with First Names & Descriptions only when Logged In) */}
      {currentUser && (
        <section className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4 print-only-card">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-amber-400" />
              <span>
                Prayer & Service Roster — First Names & Prayer Descriptions (
                {filteredPins.length})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Visible to logged-in Hope Dealers volunteers and Super User so your team can continue praying for each person by name
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPins.map((pin) => (
              <div
                key={pin.id}
                className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-phoenix-400" />
                    <span>{pin.firstName}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-phoenix-300">
                    📍 {pin.streetName} •{' '}
                    {new Date(pin.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {pin.description}
                </p>
                <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                  <span>👥 Group: {pin.groupMembers.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
