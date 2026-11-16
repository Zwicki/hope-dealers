import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Lock,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
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
  onUpdateUser?: (user: UserAccount) => void;
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
  onUpdateUser,
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
  const [volPhone, setVolPhone] = useState('');
  const [volPassword, setVolPassword] = useState('HopeDealer1!');
  const [volRole, setVolRole] = useState<'volunteer' | 'superuser'>('volunteer');
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit Volunteer Profile Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'volunteer' | 'superuser'>('volunteer');
  const [editActive, setEditActive] = useState(true);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

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
      phone: volPhone.trim() || undefined,
      password: volPassword.trim() || 'HopeDealer1!',
      role: volRole,
      createdAt: new Date().toISOString(),
      active: true,
    };
    onAddUser(newUser);
    setVolName('');
    setVolEmail('');
    setVolPhone('');
    showToast(`Added volunteer account for ${newUser.name} with password set.`);
  };

  const handleOpenEditModal = (u: UserAccount) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditPassword(u.password || '');
    setEditRole(u.role);
    setEditActive(u.active !== false);
    setShowEditPassword(false);
  };

  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      showToast('Name and email are required.');
      return;
    }

    const isProtectedSuper =
      editingUser.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase();

    const updated: UserAccount = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim() || undefined,
      password: editPassword.trim() || editingUser.password || 'HopeDealer1!',
      role: isProtectedSuper ? 'superuser' : editRole,
      active: isProtectedSuper ? true : editActive,
    };

    if (onUpdateUser) {
      onUpdateUser(updated);
    }
    setEditingUser(null);
    showToast(
      `Updated profile & password for ${updated.name} & synced to cloud!`
    );
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    const isProtectedSuper =
      userToDelete.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase();
    if (isProtectedSuper) {
      showToast('Cannot delete the primary Super User account.');
      setUserToDelete(null);
      return;
    }

    onRemoveUser(userToDelete.id);
    showToast(`Permanently deleted volunteer profile for ${userToDelete.name}.`);
    setUserToDelete(null);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-phoenix-400" />
            <div>
              <h2 className="text-base font-extrabold text-white">
                3. Hope Dealers Volunteer Roster ({users.length})
              </h2>
              <p className="text-xs text-slate-400">
                Manage volunteer profiles, reset passwords, change roles, or delete inactive profiles
              </p>
            </div>
          </div>
        </div>

        {/* Add New Volunteer Form */}
        <form
          onSubmit={handleCreateVolunteer}
          className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-phoenix-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            <span>Create New Volunteer Account</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <input
              type="text"
              required
              value={volName}
              onChange={(e) => setVolName(e.target.value)}
              placeholder="Full Name (e.g., Tiffany Scott)"
              className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />
            <input
              type="email"
              required
              value={volEmail}
              onChange={(e) => setVolEmail(e.target.value)}
              placeholder="Email Address"
              className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />
            <input
              type="tel"
              value={volPhone}
              onChange={(e) => setVolPhone(e.target.value)}
              placeholder="Phone (Optional)"
              className="px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />

            <div className="relative">
              <input
                type={showAddPassword ? 'text' : 'password'}
                required
                value={volPassword}
                onChange={(e) => setVolPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-3 pr-8 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAddPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                tabIndex={-1}
              >
                {showAddPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={volRole}
                onChange={(e) =>
                  setVolRole(e.target.value as 'volunteer' | 'superuser')
                }
                className="px-2 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-phoenix-500"
              >
                <option value="volunteer">Volunteer</option>
                <option value="superuser">Super User</option>
              </select>
              <button
                type="submit"
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slateDark-950 font-black text-xs flex items-center justify-center gap-1 shadow transition active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </form>

        {/* Existing Users Roster */}
        <div className="space-y-2">
          {users.map((u) => {
            const isProtectedSuper =
              u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase();
            const isActive = u.active !== false;

            return (
              <div
                key={u.id}
                className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-white">
                      {u.name}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                        u.role === 'superuser'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-phoenix-500/20 text-phoenix-300 border border-phoenix-500/30'
                      }`}
                    >
                      {u.role === 'superuser' ? '🛡️ Super User' : '🤝 Volunteer'}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>

                    {isProtectedSuper && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        Primary Root Account
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>📧 {u.email}</span>
                    {u.phone && <span>📞 {u.phone}</span>}
                    <span className="text-slate-500 font-mono">
                      🔑 Password:{' '}
                      {u.password ? '••••••••' : '(Not configured)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(u)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-xs inline-flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Profile & Password</span>
                  </button>

                  {!isProtectedSuper && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(u)}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 transition"
                      title="Delete Volunteer Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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

      {/* MODAL: EDIT VOLUNTEER PROFILE & PASSWORD */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slateDark-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slateDark-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Edit Volunteer Profile: {editingUser.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update account details, role, status, or set a new password
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-phoenix-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-phoenix-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(740) 555-0199"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>

              {/* Password Management */}
              <div className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Set New Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditPassword('HopeDealer2026!')}
                    className="text-[11px] font-semibold text-phoenix-400 hover:text-phoenix-300 underline"
                  >
                    Reset to HopeDealer2026!
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password (or leave current)"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slateDark-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    tabIndex={-1}
                  >
                    {showEditPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Account Role
                  </label>
                  {editingUser.email.toLowerCase() ===
                  SUPER_USER_EMAIL.toLowerCase() ? (
                    <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-extrabold text-amber-300">
                      🛡️ Primary Super User
                    </div>
                  ) : (
                    <select
                      value={editRole}
                      onChange={(e) =>
                        setEditRole(e.target.value as 'volunteer' | 'superuser')
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-phoenix-500"
                    >
                      <option value="volunteer">Volunteer</option>
                      <option value="superuser">Super User</option>
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Account Status
                  </label>
                  <select
                    value={editActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditActive(e.target.value === 'active')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-phoenix-500"
                  >
                    <option value="active">Active (Can Log In)</option>
                    <option value="inactive">Inactive (Access Paused)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slateDark-950 font-black text-xs shadow-lg shadow-emerald-600/30 transition active:scale-95"
                >
                  Save Profile & Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE VOLUNTEER PROFILE CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slateDark-900 border border-rose-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Delete Volunteer Account?
                </h3>
                <p className="text-xs text-slate-400">
                  This action permanently removes this profile across all devices.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-1">
              <div className="text-sm font-black text-white">
                {userToDelete.name}
              </div>
              <div className="text-xs text-slate-400">
                Email: {userToDelete.email}
              </div>
              <div className="text-xs text-slate-400">
                Role: {userToDelete.role}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
