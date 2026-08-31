'use client';
import React, { useState } from 'react';
import { X, Lock, Key } from 'lucide-react';
import { useToast } from './Toast';

interface PasswordModalProps {
  mustChange?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PasswordModal({ mustChange = false, onClose, onSuccess }: PasswordModalProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('New password must contain both letters and numbers.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update password.');

      toast('Password changed successfully.');
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {mustChange ? 'Change Temporary Password' : 'Change Password'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Keep your account credentials secure</p>
            </div>
          </div>
          {!mustChange && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters, letters & numbers"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-blue focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {!mustChange && (
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${
                mustChange ? 'w-full' : 'w-1/2'
              } py-2.5 rounded-xl bg-brand-blue hover:bg-navy text-white text-xs font-bold shadow-md shadow-brand-blue/20 disabled:opacity-50`}
            >
              {loading ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
