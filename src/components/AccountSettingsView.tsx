'use client';
import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, UserPlus, Key, CheckCircle, XCircle } from 'lucide-react';
import { AppUser, AppSettings } from '@/lib/types';
import { useToast } from './Toast';

interface AccountSettingsViewProps {
  currentUser: AppUser;
  onOpenChangePassword: () => void;
}

export default function AccountSettingsView({ currentUser, onOpenChangePassword }: AccountSettingsViewProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'STAFF' | 'VIEWER'>('STAFF');
  const [newPassword, setNewPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const setRes = await fetch('/api/settings');
        const setData = await setRes.json();
        if (setData.ok) setSettings(setData.settings);

        if (currentUser.role === 'ADMIN') {
          const uRes = await fetch('/api/users');
          const uData = await uRes.json();
          if (uData.ok) setUsers(uData.users || []);
        }
      } catch (err: any) {
        toast(err?.message || 'Error loading settings', true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser.role, toast]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save settings.');
      toast('Application settings saved.');
    } catch (err: any) {
      toast(err?.message || 'Error saving settings', true);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          username: newUsername,
          fullName: newFullName,
          role: newRole,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create user.');

      toast(data.message || 'User created.');
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');

      // Reload users
      const uRes = await fetch('/api/users');
      const uData = await uRes.json();
      if (uData.ok) setUsers(uData.users || []);
    } catch (err: any) {
      toast(err?.message || 'Error creating user', true);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleToggleActive(userId: string, active: boolean) {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', userId, active }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update account.');

      toast(data.message || 'Status updated.');
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, active } : u)));
    } catch (err: any) {
      toast(err?.message || 'Error', true);
    }
  }

  async function handleUnlock(userId: string) {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unlock failed.');

      toast('Account unlocked.');
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, lockedUntil: null, failedAttempts: 0 } : u)));
    } catch (err: any) {
      toast(err?.message || 'Error', true);
    }
  }

  async function handleResetPassword(userId: string, username: string) {
    const pwd = prompt(`Enter temporary new password for @${username}:`, 'Cph!Balamban2026');
    if (!pwd) return;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', userId, password: pwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Reset failed.');

      toast(data.message || 'Password reset.');
    } catch (err: any) {
      toast(err?.message || 'Error', true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Profile Card (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-blue to-emerald-500 text-white font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-blue/20">
              {currentUser.fullName.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-black text-slate-900">{currentUser.fullName}</h3>
            <p className="text-xs font-semibold text-brand-blue">@{currentUser.username}</p>
            <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-brand-blue text-[10px] font-black uppercase mt-2">
              {currentUser.role} Role
            </span>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Account Status:</span>
              <span className="font-bold text-emerald-600">Active</span>
            </div>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Key className="w-4 h-4" />
              Change Password
            </button>
          </div>
        </div>

        {/* Application Configuration (8 cols - Admin Only) */}
        {currentUser.role === 'ADMIN' && settings && (
          <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Application & Deadline Rules</h3>
              <p className="text-xs text-slate-500 font-medium">
                Configure threshold alerts and compliance countdown periods.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                  Critical Alert (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.CRITICAL_DAYS}
                  onChange={e => setSettings({ ...settings, CRITICAL_DAYS: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
                <span className="text-[10px] text-slate-400">Red alert trigger (0 to N days)</span>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                  Warning Alert (Days)
                </label>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={settings.WARNING_DAYS}
                  onChange={e => setSettings({ ...settings, WARNING_DAYS: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
                <span className="text-[10px] text-slate-400">Orange alert trigger</span>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                  RTH Fallback Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={settings.RTH_DEADLINE_DAYS}
                  onChange={e => setSettings({ ...settings, RTH_DEADLINE_DAYS: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
                <span className="text-[10px] text-slate-400">Days from claim received if PDF deadline is absent</span>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                  Inpatient & HD Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={settings.INPATIENT_DEADLINE_DAYS}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      INPATIENT_DEADLINE_DAYS: Number(e.target.value),
                      HD_DEADLINE_DAYS: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
                <span className="text-[10px] text-slate-400">Days from discharge / encounter</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                  Alert Email Recipients
                </label>
                <input
                  type="text"
                  value={settings.ALERT_RECIPIENTS || ''}
                  onChange={e => setSettings({ ...settings, ALERT_RECIPIENTS: e.target.value })}
                  placeholder="admin@balamban.gov.ph, liaison@balamban.gov.ph"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-navy text-white text-xs font-bold shadow-md shadow-brand-blue/20 disabled:opacity-50"
                >
                  {savingSettings ? 'Saving…' : 'Save System Settings'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* User Manager (Admin Only) */}
      {currentUser.role === 'ADMIN' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-900">User Management</h3>
              <p className="text-xs text-slate-500 font-medium">Create staff accounts, reset passwords, and manage access</p>
            </div>
          </div>

          {/* Create User Form */}
          <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Add New User Account</h4>
            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="juan.delacruz"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="STAFF">Staff (Transmitter)</option>
                  <option value="ADMIN">Administrator</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Initial Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Cph!2026xyz"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingUser}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {creatingUser ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          {/* User List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">@{u.username}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{u.fullName}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue text-[10px] font-bold">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.lockedUntil ? (
                        <span className="text-red-600 font-bold">Locked</span>
                      ) : u.active ? (
                        <span className="text-emerald-600 font-bold">Active</span>
                      ) : (
                        <span className="text-slate-400 font-bold">Deactivated</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{u.lastLogin || 'Never'}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {u.lockedUntil && (
                        <button
                          type="button"
                          onClick={() => handleUnlock(u.id)}
                          className="px-2 py-1 rounded bg-amber-50 text-amber-800 text-[10px] font-bold"
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u.id, u.username)}
                        className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold hover:bg-slate-200"
                      >
                        Reset Password
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u.id, !u.active)}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            u.active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
