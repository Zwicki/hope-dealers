import React, { useState } from 'react';
import {
  Flame,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { UserAccount } from '../types/hopeDealers';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  teamAccessCode: string;
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  teamAccessCode,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'account' | 'quick_code'>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [volunteerName, setVolunteerName] = useState('');
  const [enteredTeamCode, setEnteredTeamCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAccountLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    const matched = users.find(
      (u) =>
        u.active &&
        u.email.toLowerCase() === trimmedEmail &&
        u.password === password
    );

    if (!matched) {
      setError('Invalid email or password. Please check your credentials.');
      return;
    }

    onLoginSuccess(matched);
    onClose();
  };

  const handleQuickCodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!volunteerName.trim()) {
      setError('Please enter your name so we can credit your walk.');
      return;
    }

    if (
      enteredTeamCode.trim().toUpperCase() !==
      teamAccessCode.trim().toUpperCase()
    ) {
      setError('Invalid Team Access Code. Ask your team leader for today’s code.');
      return;
    }

    const tempVolunteer: UserAccount = {
      id: `vol-${Date.now()}`,
      name: volunteerName.trim(),
      email: `${volunteerName.trim().toLowerCase().replace(/\s+/g, '.')}@volunteer.lrs`,
      role: 'volunteer',
      createdAt: new Date().toISOString(),
      active: true,
    };

    onLoginSuccess(tempVolunteer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slateDark-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-slateDark-950 via-slateDark-900 to-slateDark-900 p-5 border-b border-slate-800 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <img
            src="/hope-dealers-logo.png"
            alt="Hope Dealers — Love • Pray • Serve • Restore"
            className="h-28 w-auto mx-auto object-contain drop-shadow-xl mb-2"
          />
          <h2 className="text-lg font-extrabold text-white">
            Hope Dealers Portal Sign In
          </h2>
          <p className="text-xs text-amber-400 font-semibold">
            Love • Pray • Serve • Restore — Giving the Hopeless Hope
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-2 gap-1.5 bg-slateDark-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('account');
                setError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
                mode === 'account'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Email & Password</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('quick_code');
                setError('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
                mode === 'quick_code'
                  ? 'bg-phoenix-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Quick Team PIN</span>
            </button>
          </div>
        </div>

        {/* Forms */}
        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-semibold text-rose-300">
              {error}
            </div>
          )}

          {mode === 'account' ? (
            <form onSubmit={handleAccountLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="RFannin25@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-phoenix-500 to-phoenix-600 hover:from-phoenix-600 hover:to-phoenix-700 text-white font-extrabold text-sm shadow-lg shadow-phoenix-600/30 transition"
              >
                Sign In to Hope Dealers
              </button>
            </form>
          ) : (
            <form onSubmit={handleQuickCodeLogin} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Heading out on a street walk right now? Enter your name and the{' '}
                <span className="text-phoenix-300 font-semibold">
                  Hope Dealers Team Code
                </span>{' '}
                to start logging immediately.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Your Name (Recorder)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={volunteerName}
                    onChange={(e) => setVolunteerName(e.target.value)}
                    placeholder="e.g., Sarah Jenkins"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Team Access Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={enteredTeamCode}
                    onChange={(e) => setEnteredTeamCode(e.target.value)}
                    placeholder="e.g., HOPE2026"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white uppercase tracking-wider placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 transition"
              >
                Start Logging as Volunteer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
