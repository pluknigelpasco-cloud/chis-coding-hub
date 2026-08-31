'use client';
import React, { useState, useEffect } from 'react';
import { History, RefreshCw, User } from 'lucide-react';
import { AuditLogItem } from '@/lib/types';
import { useToast } from './Toast';

export default function ActivityLogView() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchActivity() {
    setLoading(true);
    try {
      const res = await fetch('/api/activity');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load activity logs.');
      setLogs(data.activity || []);
    } catch (err: any) {
      toast(err?.message || 'Error fetching activity', true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivity();
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Audit Trail & Activity Log</h3>
          <p className="text-xs text-slate-500 font-medium">Recent security and transmittal modifications</p>
        </div>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-blue' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  {loading ? 'Loading activity logs…' : 'No activity logs recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      @{log.username}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-brand-blue">{log.module || '—'}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{log.source_ref || '—'}</td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-500" title={JSON.stringify(log.details)}>
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
