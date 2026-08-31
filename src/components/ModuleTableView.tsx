'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Printer, Trash2, ArrowUpDown, RefreshCw, MessageSquare } from 'lucide-react';
import { BaseRecord, ModuleType, AppUser } from '@/lib/types';
import { useToast } from './Toast';
import { formatCurrency } from '@/lib/calculations';

interface ModuleTableViewProps {
  module: ModuleType;
  title: string;
  subtitle: string;
  user: AppUser;
  transmitters: { userId: string; username: string; fullName: string }[];
  initialStatus?: string;
  onOpenPrint: (records: BaseRecord[]) => void;
}

export default function ModuleTableView({
  module,
  title,
  subtitle,
  user,
  transmitters,
  initialStatus = 'ALL',
  onOpenPrint,
}: ModuleTableViewProps) {
  const { toast } = useToast();
  const [records, setRecords] = useState<BaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [sortKey, setSortKey] = useState('baseDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Date filters
  const [expiryMonth, setExpiryMonth] = useState('');
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [dischargeFrom, setDischargeFrom] = useState('');
  const [dischargeTo, setDischargeTo] = useState('');
  const [transmittedFrom, setTransmittedFrom] = useState('');
  const [transmittedTo, setTransmittedTo] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let expFrom = '';
      let expTo = '';
      if (expiryMonth && /^\d{4}-\d{2}$/.test(expiryMonth)) {
        const [y, m] = expiryMonth.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        expFrom = `${expiryMonth}-01`;
        expTo = `${expiryMonth}-${String(lastDay).padStart(2, '0')}`;
      }

      const res = await fetch('/api/records/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          search,
          status,
          sortKey,
          sortDir,
          admissionFrom: module === 'HD' ? admissionFrom : '',
          admissionTo: module === 'HD' ? admissionTo : '',
          dischargeFrom: module === 'INPATIENT' ? dischargeFrom : '',
          dischargeTo: module === 'INPATIENT' ? dischargeTo : '',
          transmittedFrom,
          transmittedTo,
          expiryFrom: expFrom,
          expiryTo: expTo,
          offset: 0,
          limit: 500,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to fetch records.');

      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast(err?.message || 'Error fetching records', true);
    } finally {
      setLoading(false);
    }
  }, [
    module,
    search,
    status,
    sortKey,
    sortDir,
    expiryMonth,
    admissionFrom,
    admissionTo,
    dischargeFrom,
    dischargeTo,
    transmittedFrom,
    transmittedTo,
    toast,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(records.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleSelectRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function updateRecord(id: string, updates: Record<string, any>) {
    try {
      const res = await fetch('/api/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, module, ...updates }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update record.');

      toast(data.message || 'Record updated.');
      setRecords(prev =>
        prev.map(r => {
          if (r.id === id) {
            return {
              ...r,
              ...updates,
              transmittedBy: data.transmittedBy ?? r.transmittedBy,
              refiledDate: data.refiledDate ?? r.refiledDate,
              transmittedDate: data.transmittedDate ?? r.transmittedDate,
            };
          }
          return r;
        })
      );
    } catch (err: any) {
      toast(err?.message || 'Update failed', true);
    }
  }

  async function deleteRecord(id: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete record for ${name}?`)) return;
    try {
      const res = await fetch('/api/records/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, module }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed.');

      toast(data.message || 'Record deleted.');
      setRecords(prev => prev.filter(r => r.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err: any) {
      toast(err?.message || 'Delete error', true);
    }
  }

  const isNoticeModule = module === 'RTH' || module === 'DENIED';

  return (
    <div className="space-y-4">
      {/* Panel Head */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 font-medium">{subtitle} ({total} total records)</p>
          </div>

          <div className="flex items-center gap-2">
            {isNoticeModule && (
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const selectedRecords = records.filter(r => selectedIds.has(r.id));
                  onOpenPrint(selectedRecords);
                }}
                className="px-4 py-2 rounded-xl theme-primary-btn text-white text-xs font-bold shadow-md transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Selected ({selectedIds.size})
              </button>
            )}

            <button
              onClick={fetchRecords}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh table"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-blue' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchRecords()}
              placeholder="Search date, patient, deficiency, remarks…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          </div>

          <div className="sm:col-span-3">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="CRITICAL">Critical (≤7 days)</option>
              <option value="WARNING">Warning (≤15 days)</option>
              <option value="SAFE">Safe (&gt;15 days)</option>
              <option value="EXPIRED">Expired</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            {isNoticeModule ? (
              <input
                type="month"
                value={expiryMonth}
                onChange={e => setExpiryMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                title="Filter by Expiry Month"
              />
            ) : (
              <button
                onClick={fetchRecords}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Apply Filters
              </button>
            )}
          </div>
        </div>

        {/* Inpatient / HD Custom Range Controls */}
        {!isNoticeModule && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                {module === 'INPATIENT' ? 'Discharge Date Range' : 'Encounter Date Range'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={module === 'INPATIENT' ? dischargeFrom : admissionFrom}
                  onChange={e =>
                    module === 'INPATIENT' ? setDischargeFrom(e.target.value) : setAdmissionFrom(e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={module === 'INPATIENT' ? dischargeTo : admissionTo}
                  onChange={e =>
                    module === 'INPATIENT' ? setDischargeTo(e.target.value) : setAdmissionTo(e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                Transmitted Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={transmittedFrom}
                  onChange={e => setTransmittedFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={transmittedTo}
                  onChange={e => setTransmittedTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 z-10">
              <tr>
                {isNoticeModule && (
                  <th className="py-3.5 px-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={e => toggleSelectAll(e.target.checked)}
                      className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('baseDate')} className="flex items-center gap-1">
                    {module === 'INPATIENT'
                      ? 'Discharge Date'
                      : module === 'HD'
                      ? 'Encounter Date'
                      : 'Reference / Series'}
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('memberCategory')} className="flex items-center gap-1">
                    Category
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                {!isNoticeModule && (
                  <th className="py-3.5 px-4">
                    <button onClick={() => toggleSort('transmittedDate')} className="flex items-center gap-1">
                      Transmitted Date
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                )}
                {isNoticeModule && (
                  <th className="py-3.5 px-4">
                    <button onClick={() => toggleSort('patientName')} className="flex items-center gap-1">
                      Patient Name
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </th>
                )}
                {isNoticeModule && <th className="py-3.5 px-4 text-right">Claim Amount</th>}
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('expiryDate')} className="flex items-center gap-1">
                    Expiry Deadline
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('daysLeft')} className="flex items-center gap-1">
                    Countdown
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4">Status</th>
                {isNoticeModule && <th className="py-3.5 px-4 min-w-[140px]">Transmitter</th>}
                <th className="py-3.5 px-4 min-w-[200px]">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    Remarks
                  </span>
                </th>
                <th className="py-3.5 px-4 text-center">Action</th>
                {user.role === 'ADMIN' && isNoticeModule && <th className="py-3.5 px-4 text-right">Delete</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400 font-bold">
                    {loading ? 'Loading records…' : 'No records found matching filters.'}
                  </td>
                </tr>
              ) : (
                records.map(r => {
                  const isSelected = selectedIds.has(r.id);
                  const isCompleted = r.completed === true;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {isNoticeModule && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(r.id)}
                            className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-black text-slate-900">
                        {r.reference}
                        {r.controlNumber && (
                          <span className="block text-[10px] text-slate-400 font-normal">{r.controlNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {r.memberCategory || (module === 'INPATIENT' ? 'Inpatient' : 'Hemodialysis')}
                      </td>
                      {!isNoticeModule && (
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {r.transmittedDate || (
                            <span className="text-slate-400 italic">Not transmitted</span>
                          )}
                        </td>
                      )}
                      {isNoticeModule && (
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {r.patientName}
                        </td>
                      )}
                      {isNoticeModule && (
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          ₱{formatCurrency(r.claimAmount)}
                        </td>
                      )}
                      <td className="py-3 px-4 font-bold text-slate-800">{r.expiryDate || '—'}</td>
                      <td className="py-3 px-4 font-black">
                        {r.daysLeft !== null && r.daysLeft !== undefined ? (
                          <span
                            className={
                              r.daysLeft <= 0 ? 'text-red-600' : r.daysLeft <= 7 ? 'text-red-500' : 'text-amber-600'
                            }
                          >
                            {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft} day(s)`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            r.status === 'CRITICAL'
                              ? 'bg-red-100 text-red-700'
                              : r.status === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : r.status === 'EXPIRED'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : r.status === 'COMPLETED'
                              ? 'bg-blue-100 text-brand-blue'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Transmitter Selector */}
                      {isNoticeModule && (
                        <td className="py-3 px-4">
                          <select
                            value={r.ownerUserId || ''}
                            disabled={user.role === 'VIEWER'}
                            onChange={e => updateRecord(r.id, { transmittedByUserId: e.target.value })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:ring-1 focus:ring-brand-blue"
                          >
                            <option value="">Unassigned</option>
                            {transmitters.map(t => (
                              <option key={t.userId} value={t.userId}>
                                {t.fullName}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* Interactive Remarks Field */}
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <input
                          type="text"
                          key={`remarks-${r.id}-${r.remarks || ''}`}
                          defaultValue={r.remarks || ''}
                          disabled={user.role === 'VIEWER'}
                          placeholder="Add remarks…"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (r.remarks || '')) {
                              updateRecord(r.id, { remarks: val });
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-xs text-slate-800 bg-white placeholder:text-slate-400 placeholder:italic transition-all"
                          title={r.remarks ? `Remarks: ${r.remarks}` : 'Type remarks and press Enter or click outside to save'}
                        />
                      </td>

                      {/* Checklist Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {module === 'RTH' && (
                            <>
                              <button
                                type="button"
                                disabled={user.role === 'VIEWER'}
                                onClick={() => updateRecord(r.id, { retrieved: !r.retrieved })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                  r.retrieved
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {r.retrieved ? '✓ Retrieved' : 'Retrieve'}
                              </button>
                              <button
                                type="button"
                                disabled={user.role === 'VIEWER'}
                                onClick={() => updateRecord(r.id, { completed: !r.completed })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                  r.completed
                                    ? 'bg-blue-50 text-brand-blue border-blue-300'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {r.completed ? '✓ Refiled' : 'Refile'}
                              </button>
                            </>
                          )}

                          {module === 'DENIED' && (
                            <button
                              type="button"
                              disabled={user.role === 'VIEWER'}
                              onClick={() => updateRecord(r.id, { retrieved: !r.retrieved })}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                r.retrieved
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {r.retrieved ? '✓ MR Transmitted' : 'Transmitted MR'}
                            </button>
                          )}

                          {(module === 'INPATIENT' || module === 'HD') && (
                            <button
                              type="button"
                              disabled={user.role === 'VIEWER'}
                              onClick={() => updateRecord(r.id, { completed: !isCompleted })}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
                              }`}
                            >
                              {isCompleted ? '✓ Undo Transmitted' : 'Mark Transmitted'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Admin Delete */}
                      {user.role === 'ADMIN' && isNoticeModule && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteRecord(r.id, r.patientName || r.reference)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete notice permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
