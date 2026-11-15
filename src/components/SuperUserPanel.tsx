import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AppDatabaseState,
  CloudConfig,
  EncounterPin,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';
import { SUPER_USER_EMAIL } from '../services/cloudSyncService';
import { HistoricalOutreachBuilder } from './HistoricalOutreachBuilder';

interface SuperUserPanelProps {
  currentUser: UserAccount;
  dbState: AppDatabaseState;
  onSaveHistoricalWalk: (walk: WalkSession, newPins: EncounterPin[]) => void;
  onSaveStandalonePin: (pin: EncounterPin) => void;
  onViewMap?: () => void;
  onUpdateCloudConfig: (config: CloudConfig) => void;
  onAddUser: (user: UserAccount) => void;
  onRemoveUser: (userId: string) => void;
  onClearAllWalkData: () => void;
  onRestoreDemoData: () => void;
  onImportDatabase: (imported: AppDatabaseState) => void;
  onTriggerSync: () => Promise<void>;
}

const SUPABASE_SQL_SCHEMA = `-- Run this once in your Supabase SQL Editor to enable multi-device cloud sync:
create table if not exists public.hope_dealers_walks (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.hope_dealers_pins (
  id text primary key,
  walk_id text,
  payload jsonb not null,
  updated_at timestamptz default now()
);

alter table public.hope_dealers_walks enable row level security;
alter table public.hope_dealers_pins enable row level security;

create policy "Allow public read/write for Hope Dealers"
  on public.hope_dealers_walks for all using (true) with check (true);

create policy "Allow public read/write for Hope Dealers Pins"
  on public.hope_dealers_pins for all using (true) with check (true);`;

export const SuperUserPanel: React.FC<SuperUserPanelProps> = ({
  currentUser,
  dbState,
  onSaveHistoricalWalk,
  onSaveStandalonePin,
  onViewMap,
  onUpdateCloudConfig,
  onAddUser,
  onRemoveUser,
  onClearAllWalkData,
  onImportDatabase,
  onTriggerSync,
}) => {
  const { cloudConfig, users } = dbState;

  const [teamCode, setTeamCode] = useState(cloudConfig.teamAccessCode);
  const [lbsPerBag, setLbsPerBag] = useState(cloudConfig.lbsPerTrashBag);
  const [supabaseUrl, setSupabaseUrl] = useState(cloudConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    cloudConfig.supabaseAnonKey
  );
  const [webhookUrl, setWebhookUrl] = useState(
    cloudConfig.customWebhookUrl || ''
  );

  // Add Volunteer Form
  const [volName, setVolName] = useState('');
  const [volEmail, setVolEmail] = useState('');
  const [volPassword, setVolPassword] = useState('HopeDealer1!');
  const [volRole, setVolRole] = useState<'volunteer' | 'superuser'>('volunteer');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCloudConfig({
      ...cloudConfig,
      teamAccessCode: teamCode.trim().toUpperCase() || 'HOPE2026',
      lbsPerTrashBag: Math.max(1, Number(lbsPerBag) || 15),
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      customWebhookUrl: webhookUrl.trim(),
    });
    showToast('Saved Super User & Cloud Sync settings!');
  };

  const handleCreateVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volName.trim() || !volEmail.trim()) return;
    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      name: volName.trim(),
      email: volEmail.trim(),
      password: volPassword.trim() || 'HopeDealer1!',
      role: volRole,
      createdAt: new Date().toISOString(),
      active: true,
    };
    onAddUser(newUser);
    setVolName('');
    setVolEmail('');
    showToast(`Added volunteer account for ${newUser.name}`);
  };

  const handleExportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(dbState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hope_Dealers_Cloud_Backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as AppDatabaseState;
        if (parsed.walks && parsed.pins) {
          onImportDatabase(parsed);
          showToast('Restored full Hope Dealers database backup!');
        }
      } catch {
        showToast('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slateDark-900 to-slateDark-900 border border-amber-500/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              Super User & Cloud Control Center
            </h1>
            <p className="text-xs text-slate-300">
              Logged in as Super User ({SUPER_USER_EMAIL}) • Manage Volunteers, Team Code & Cloud Sync
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await onTriggerSync();
            showToast('Cloud synchronization completed!');
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slateDark-950 font-extrabold text-xs flex items-center gap-2 shadow-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Sync All Data to Cloud Now</span>
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-bold">
          ✓ {statusMsg}
        </div>
      )}

      {/* Historical / Past Outreach Entry Builder for Super User */}
      <HistoricalOutreachBuilder
        currentUser={currentUser}
        allUsers={users}
        allKnownPeople={[
          ...users.map((u) => u.name),
          ...dbState.walks.flatMap((w) => [w.recorderName, ...w.groupMembers]),
        ]}
        onAddNewPerson={(newName) => {
          const clean = newName.trim();
          if (!clean) return;
          const exists = users.some(
            (u) => u.name.toLowerCase() === clean.toLowerCase()
          );
          if (!exists) {
            onAddUser({
              id: `vol-${Date.now()}`,
              name: clean,
              email: `${clean.toLowerCase().replace(/[^a-z0-9]/g, '.')}@hopedealers.local`,
              role: 'volunteer',
              active: true,
              createdAt: new Date().toISOString(),
            });
          }
        }}
        lbsPerTrashBag={cloudConfig.lbsPerTrashBag}
        onSaveHistoricalWalk={onSaveHistoricalWalk}
        onSaveStandalonePin={onSaveStandalonePin}
        onViewMap={onViewMap}
      />

      {/* 1. Team Access Code & Outreach Defaults */}
      <form
        onSubmit={handleSaveSettings}
        className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-5"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-phoenix-400" />
          <div>
            <h2 className="text-base font-extrabold text-white">
              1. Volunteer Team Access Code & Trash Weight Settings
            </h2>
            <p className="text-xs text-slate-400">
              Share the Team Access Code with walk-up volunteers so they can sign in with just their name
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Shared Volunteer Team Access Code
            </label>
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black uppercase tracking-wider text-phoenix-300 focus:outline-none focus:border-phoenix-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Estimated Pounds per Trash Bag Collected
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={lbsPerBag}
              onChange={(e) => setLbsPerBag(parseInt(e.target.value) || 15)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-phoenix-500"
            />
          </div>
        </div>

        {/* 2. Cloud Database Sync Connection */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">
                2. Cloud Database Synchronization (Supabase / Cloud Webhook)
              </h2>
              <p className="text-xs text-slate-400">
                All data saves with offline-first protection and syncs automatically to your cloud database
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Supabase Project URL (Optional for multi-phone live sync)
              </label>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Supabase Anon Public Key
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Optional Webhook / Zapier / Google Sheets Sync URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/... (Automatically receives JSON on every walk/pin)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />
          </div>

          {/* Collapsible SQL Snippet for Supabase */}
          <details className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 text-xs">
            <summary className="cursor-pointer font-bold text-slate-300 hover:text-white">
              View 1-Click Supabase SQL Table Setup Script
            </summary>
            <div className="mt-3 space-y-2">
              <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-emerald-300 overflow-x-auto">
                {SUPABASE_SQL_SCHEMA}
              </pre>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Setup Script</span>
                  </>
                )}
              </button>
            </div>
          </details>
        </div>

        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-phoenix-600 hover:bg-phoenix-500 text-white font-extrabold text-xs shadow-lg shadow-phoenix-600/20 transition"
        >
          Save Super User & Cloud Configuration
        </button>
      </form>

      {/* 3. Volunteer Roster & Account Management */}
      <section className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-phoenix-400" />
          <div>
            <h2 className="text-base font-extrabold text-white">
              3. Hope Dealers Volunteer Roster ({users.length})
            </h2>
            <p className="text-xs text-slate-400">
              Volunteers listed here also appear as 1-tap group partners when starting a walk
            </p>
          </div>
        </div>

        {/* Add New Volunteer Form */}
        <form
          onSubmit={handleCreateVolunteer}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slateDark-950 border border-slate-800"
        >
          <input
            type="text"
            required
            value={volName}
            onChange={(e) => setVolName(e.target.value)}
            placeholder="Full Name"
            className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white"
          />
          <input
            type="email"
            required
            value={volEmail}
            onChange={(e) => setVolEmail(e.target.value)}
            placeholder="Email Address"
            className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white"
          />
          <input
            type="text"
            required
            value={volPassword}
            onChange={(e) => setVolPassword(e.target.value)}
            placeholder="Password"
            className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white"
          />
          <div className="flex gap-2">
            <select
              value={volRole}
              onChange={(e) =>
                setVolRole(e.target.value as 'volunteer' | 'superuser')
              }
              className="px-2 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white"
            >
              <option value="volunteer">Volunteer</option>
              <option value="superuser">Super User</option>
            </select>
            <button
              type="submit"
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slateDark-950 font-extrabold text-xs flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Existing Users List */}
        <div className="space-y-2">
          {users.map((u) => {
            const isProtectedSuper =
              u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase();
            return (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-white">
                      {u.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        u.role === 'superuser'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-phoenix-500/20 text-phoenix-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>

                {!isProtectedSuper && (
                  <button
                    type="button"
                    onClick={() => onRemoveUser(u.id)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="Remove Volunteer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Data Backup, Restore & Demo Reset */}
      <section className="p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-extrabold text-white">
              4. Cloud Data Backup & Demo Data Controls
            </h2>
            <p className="text-xs text-slate-400">
              Export or import your full database JSON, or clear the sample Chillicothe walks when ready
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportJsonBackup}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Full Cloud Backup (.JSON)</span>
          </button>

          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 border border-slate-700">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Restore Backup (.JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonBackup}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to clear all walk & pin records to start fresh?'
                )
              ) {
                onClearAllWalkData();
                showToast('Cleared all walks and pins — ready for fresh street logs!');
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Walks & Pins</span>
          </button>
        </div>
      </section>
    </div>
  );
};
