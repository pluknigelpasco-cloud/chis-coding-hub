'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Printer,
  Trash2,
  ArrowUpDown,
  RefreshCw,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Filter,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { BaseRecord, MonitoringClaimStatus, MonitoringStats, AppUser } from '@/lib/types';
import { useToast } from './Toast';
import { formatCurrency } from '@/lib/calculations';

interface RTHDeniedMonitoringViewProps {
  user: AppUser;
  transmitters: { userId: string; username: string; fullName: string }[];
  onOpenPrint: (records: BaseRecord[]) => void;
}

const MONITORING_STATUSES: MonitoringClaimStatus[] = ['IN PROCESS', 'RTH', 'DENIED', 'WITH CHEQUE'];

export default function RTHDeniedMonitoringView({
  user,
  transmitters,
  onOpenPrint,
}: RTHDeniedMonitoringViewProps) {
  const { toast } = useToast();
  const [records, setRecords] = useState<BaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MonitoringStats | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [noticeType, setNoticeType] = useState<'ALL' | 'RTH' | 'DENIED'>('ALL');
  const [monitoringStatus, setMonitoringStatus] = useState<string>('ALL');
  const [refileFrom, setRefileFrom] = useState('');
  const [refileTo, setRefileTo] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState('dateOfRefileReappeal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch action state
  const [batchStatus, setBatchStatus] = useState<MonitoringClaimStatus>('IN PROCESS');
  const [batchRefileDate, setBatchRefileDate] = useState('');
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);

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
          module: 'MONITORING',
          search,
          noticeType,
          monitoringStatus,
          refileFrom,
          refileTo,
          expiryFrom: expFrom,
          expiryTo: expTo,
          sortKey,
          sortDir,
          offset: 0,
          limit: 500,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to fetch monitoring records.');

      setRecords(data.records || []);
      setTotal(data.total || 0);
      if (data.monitoringStats) {
        setStats(data.monitoringStats);
      }
    } catch (err: any) {
      toast(err?.message || 'Error fetching monitoring records', true);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    noticeType,
    monitoringStatus,
    refileFrom,
    refileTo,
    expiryMonth,
    sortKey,
    sortDir,
    toast,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Update a single record
  async function updateRecord(id: string, updates: Partial<BaseRecord> & { transmittedByUserId?: string }) {
    // Optimistic UI update
    setRecords(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.dateOfRefileReappeal !== undefined) {
          updated.dateOfRefileReappeal = updates.dateOfRefileReappeal;
          updated.refiledDate = updates.dateOfRefileReappeal;
        }
        if (updates.monitoringStatus !== undefined) {
          updated.monitoringStatus = updates.monitoringStatus;
        }
        return updated;
      })
    );

    try {
      const record = records.find(r => r.id === id);
      const res = await fetch('/api/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          module: 'MONITORING',
          noticeType: record?.noticeType || 'RTH',
          ...updates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed');

      toast('Record updated successfully.');
      fetchRecords();
    } catch (err: any) {
      toast(err?.message || 'Update failed', true);
      fetchRecords();
    }
  }

  // Batch update status or refile date
  async function handleBatchUpdateStatus() {
    if (selectedIds.size === 0) return;
    setIsApplyingBatch(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await fetch('/api/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'MONITORING',
          ids: idsArray,
          monitoringStatus: batchStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Batch update failed');

      toast(`Updated status to ${batchStatus} for ${idsArray.length} claim(s).`);
      setSelectedIds(new Set());
      fetchRecords();
    } catch (err: any) {
      toast(err?.message || 'Batch update failed', true);
    } finally {
      setIsApplyingBatch(false);
    }
  }

  async function handleBatchUpdateRefileDate() {
    if (selectedIds.size === 0 || !batchRefileDate) return;
    setIsApplyingBatch(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await fetch('/api/records/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'MONITORING',
          ids: idsArray,
          dateOfRefileReappeal: batchRefileDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Batch update failed');

      toast(`Updated Date of Refile/Re-Appeal for ${idsArray.length} claim(s).`);
      setSelectedIds(new Set());
      setBatchRefileDate('');
      fetchRecords();
    } catch (err: any) {
      toast(err?.message || 'Batch update failed', true);
    } finally {
      setIsApplyingBatch(false);
    }
  }

  // Delete record
  async function deleteRecord(id: string, name: string, noticeType?: string) {
    if (!window.confirm(`Permanently delete record for "${name}"?\nThis cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch('/api/records/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, module: 'MONITORING', noticeType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed');

      toast(data.message || 'Record deleted permanently.');
      fetchRecords();
    } catch (err: any) {
      toast(err?.message || 'Delete error', true);
    }
  }

  // Selection handlers
  function toggleSelectAll() {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  }

  function toggleSelectRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function getTodayIso() {
    return new Date().toISOString().split('T')[0];
  }

  const isAnyFilterActive =
    search ||
    noticeType !== 'ALL' ||
    monitoringStatus !== 'ALL' ||
    refileFrom ||
    refileTo ||
    expiryMonth;

  function clearAllFilters() {
    setSearch('');
    setNoticeType('ALL');
    setMonitoringStatus('ALL');
    setRefileFrom('');
    setRefileTo('');
    setExpiryMonth('');
  }

  // Badge helper for status
  function renderStatusBadge(st?: MonitoringClaimStatus) {
    switch (st) {
      case 'IN PROCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
            IN PROCESS
          </span>
        );
      case 'RTH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            RTH
          </span>
        );
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
            <X className="w-3 h-3 text-rose-600 shrink-0" />
            DENIED
          </span>
        );
      case 'WITH CHEQUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            WITH CHEQUE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
            {st || 'UNASSIGNED'}
          </span>
        );
    }
  }

  const selectedRecords = records.filter(r => selectedIds.has(r.id));
  const totalClaimAmountCurrent = records.reduce((sum, r) => sum + (r.claimAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-dark-blue to-brand-blue rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold uppercase tracking-wider backdrop-blur-md mb-2">
              <FileCheck2 className="w-3.5 h-3.5 text-blue-300" />
              PhilHealth Notice Claims Tracking
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              RTH & Denied Monitoring Module
            </h1>
            <p className="text-sm text-blue-100/90 mt-1 max-w-2xl font-medium">
              Monitor refile/re-appeal status, compliance dates, and cheque settlements across all returned and denied claims.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenPrint(selectedIds.size > 0 ? selectedRecords : records)}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-2 shadow-sm border border-white/20 transition-all cursor-pointer"
              title="Print official transmittal checklist"
            >
              <Printer className="w-4 h-4 text-white" />
              {selectedIds.size > 0 ? `Print Selected (${selectedIds.size})` : 'Print All Records'}
            </button>
            <button
              onClick={fetchRecords}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs shadow-sm border border-white/20 transition-all cursor-pointer"
              title="Refresh records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Monitored */}
        <button
          type="button"
          onClick={() => setMonitoringStatus('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            monitoringStatus === 'ALL'
              ? 'bg-white border-brand-blue ring-2 ring-brand-blue/20 shadow-md scale-[1.02]'
              : 'bg-white/80 border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Monitored</span>
            <FileCheck2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{stats?.total ?? total}</span>
            <span className="text-[11px] font-bold text-slate-600">
              ₱{formatCurrency(stats?.totalAmount ?? totalClaimAmountCurrent)}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-400">All RTH & Denied claims</div>
        </button>

        {/* IN PROCESS */}
        <button
          type="button"
          onClick={() => setMonitoringStatus(monitoringStatus === 'IN PROCESS' ? 'ALL' : 'IN PROCESS')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            monitoringStatus === 'IN PROCESS'
              ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-md scale-[1.02]'
              : 'bg-white/80 border-slate-200 hover:border-blue-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">IN PROCESS</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900">{stats?.inProcess ?? 0}</span>
            <span className="text-[11px] font-bold text-blue-700">
              ₱{formatCurrency(stats?.inProcessAmount ?? 0)}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-blue-600">Refiled / Re-appealed</div>
        </button>

        {/* RTH */}
        <button
          type="button"
          onClick={() => setMonitoringStatus(monitoringStatus === 'RTH' ? 'ALL' : 'RTH')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            monitoringStatus === 'RTH'
              ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-md scale-[1.02]'
              : 'bg-white/80 border-slate-200 hover:border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">RTH</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-900">{stats?.rth ?? 0}</span>
            <span className="text-[11px] font-bold text-amber-700">
              ₱{formatCurrency(stats?.rthAmount ?? 0)}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-amber-600">Pending compliance</div>
        </button>

        {/* DENIED */}
        <button
          type="button"
          onClick={() => setMonitoringStatus(monitoringStatus === 'DENIED' ? 'ALL' : 'DENIED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            monitoringStatus === 'DENIED'
              ? 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-500/20 shadow-md scale-[1.02]'
              : 'bg-white/80 border-slate-200 hover:border-rose-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">DENIED</span>
            <X className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-900">{stats?.denied ?? 0}</span>
            <span className="text-[11px] font-bold text-rose-700">
              ₱{formatCurrency(stats?.deniedAmount ?? 0)}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-rose-600">Pending MR Appeal</div>
        </button>

        {/* WITH CHEQUE */}
        <button
          type="button"
          onClick={() => setMonitoringStatus(monitoringStatus === 'WITH CHEQUE' ? 'ALL' : 'WITH CHEQUE')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            monitoringStatus === 'WITH CHEQUE'
              ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md scale-[1.02]'
              : 'bg-white/80 border-slate-200 hover:border-emerald-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">WITH CHEQUE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-900">{stats?.withCheque ?? 0}</span>
            <span className="text-[11px] font-bold text-emerald-700">
              ₱{formatCurrency(stats?.withChequeAmount ?? 0)}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-emerald-600">Settled / Reconciled</div>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search series, patient, deficiency, remarks, control #…"
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 text-xs text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Notice Type Filter */}
          <div>
            <select
              value={noticeType}
              onChange={e => setNoticeType(e.target.value as any)}
              className="w-full py-2.5 px-3 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="ALL">All Notice Types (RTH & Denied)</option>
              <option value="RTH">RTH Notices Only</option>
              <option value="DENIED">Denied Notices Only</option>
            </select>
          </div>

          {/* Monitoring Status Filter */}
          <div>
            <select
              value={monitoringStatus}
              onChange={e => setMonitoringStatus(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN PROCESS">IN PROCESS</option>
              <option value="RTH">RTH</option>
              <option value="DENIED">DENIED</option>
              <option value="WITH CHEQUE">WITH CHEQUE</option>
            </select>
          </div>

          {/* Expiry Month Filter */}
          <div className="relative">
            <input
              type="month"
              value={expiryMonth}
              onChange={e => setExpiryMonth(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              title="Filter by Expiry Deadline Month"
            />
          </div>
        </div>

        {/* Date of Refile Range & Clear Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Date of Refile / Re-Appeal Range:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={refileFrom}
                onChange={e => setRefileFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 text-slate-800"
                title="From Date"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={refileTo}
                onChange={e => setRefileTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 text-slate-800"
                title="To Date"
              />
              {(refileFrom || refileTo) && (
                <button
                  onClick={() => {
                    setRefileFrom('');
                    setRefileTo('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="Clear refile date filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAnyFilterActive && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
            <div className="text-xs font-bold text-slate-500">
              Showing <span className="text-slate-900 font-black">{records.length}</span> of {total} claims
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Selection Batch Actions Bar (Floating/Sticky when active) */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-brand-blue rounded-xl text-xs font-black">
              {selectedIds.size} Selected
            </span>
            <p className="text-xs text-slate-300 font-medium">Batch apply updates across selected claims:</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Batch Status */}
            <div className="flex items-center gap-1.5">
              <select
                value={batchStatus}
                onChange={e => setBatchStatus(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white focus:ring-1 focus:ring-brand-blue"
              >
                {MONITORING_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBatchUpdateStatus}
                disabled={isApplyingBatch}
                className="px-3 py-1.5 rounded-xl bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Apply Status
              </button>
            </div>

            <div className="w-px h-6 bg-slate-700 hidden sm:block" />

            {/* Batch Date of Refile */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={batchRefileDate}
                onChange={e => setBatchRefileDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => setBatchRefileDate(getTodayIso())}
                className="px-2 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-slate-200"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleBatchUpdateRefileDate}
                disabled={isApplyingBatch || !batchRefileDate}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Apply Date
              </button>
            </div>

            <div className="w-px h-6 bg-slate-700 hidden sm:block" />

            <button
              onClick={() => onOpenPrint(selectedRecords)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Selected
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds.size === records.length}
                    onChange={toggleSelectAll}
                    className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('reference')} className="flex items-center gap-1 cursor-pointer">
                    Series / Control #
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4 min-w-[220px]">
                  <button onClick={() => toggleSort('patientName')} className="flex items-center gap-1 cursor-pointer">
                    Patient Name / Deficiency
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">Confinement</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Date Claim Received</th>
                <th className="py-3.5 px-4">
                  <button onClick={() => toggleSort('expiryDate')} className="flex items-center gap-1 cursor-pointer">
                    Expiry Deadline
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <button onClick={() => toggleSort('claimAmount')} className="flex items-center gap-1 ml-auto cursor-pointer">
                    Claim Amount
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                {/* DATE OF REFILE / RE-APPEAL COLUMN */}
                <th className="py-3.5 px-4 min-w-[190px] bg-blue-50/40 text-blue-900 border-x border-blue-100">
                  <button onClick={() => toggleSort('dateOfRefileReappeal')} className="flex items-center gap-1 cursor-pointer">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Date of Refile / Re-Appeal
                    <ArrowUpDown className="w-3 h-3 text-blue-500" />
                  </button>
                </th>
                {/* STATUS COLUMN */}
                <th className="py-3.5 px-4 min-w-[160px] bg-slate-100/60 text-slate-900">
                  <button onClick={() => toggleSort('monitoringStatus')} className="flex items-center gap-1 cursor-pointer">
                    Status
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3.5 px-4 min-w-[140px]">Transmitter</th>
                <th className="py-3.5 px-4 min-w-[180px]">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    Remarks
                  </span>
                </th>
                {user.role === 'ADMIN' && <th className="py-3.5 px-4 text-right">Delete</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-20 text-center text-slate-400 font-bold">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
                        <span>Loading monitored claims…</span>
                      </div>
                    ) : (
                      'No matching records found in RTH / Denied monitoring queue.'
                    )}
                  </td>
                </tr>
              ) : (
                records.map(r => {
                  const isSelected = selectedIds.has(r.id);
                  const isRTH = r.noticeType === 'RTH';

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(r.id)}
                          className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            isRTH
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {r.noticeType}
                        </span>
                      </td>

                      {/* Series & Control # */}
                      <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                        {r.reference}
                        {r.controlNumber && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Ctrl: {r.controlNumber}
                          </span>
                        )}
                      </td>

                      {/* Patient Name & Deficiency */}
                      <td className="py-3.5 px-4 min-w-[220px] max-w-[320px]">
                        <div className="font-semibold text-slate-900">{r.patientName}</div>
                        {r.deficiency ? (
                          <p
                            className="mt-1 text-[10px] text-slate-500 leading-snug line-clamp-2 border-t border-slate-100 pt-1"
                            title={r.deficiency}
                          >
                            <span className="font-bold text-slate-400 uppercase tracking-wide">
                              Deficiency:
                            </span>{' '}
                            {r.deficiency}
                          </p>
                        ) : null}
                      </td>

                      {/* Confinement */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {r.admittedDate && r.dischargedDate
                          ? `${r.admittedDate} – ${r.dischargedDate}`
                          : r.admittedDate || '—'}
                      </td>

                      {/* Date Claim Received */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {r.claimReceivedDate || '—'}
                      </td>

                      {/* Expiry Deadline & Countdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{r.expiryDate || '—'}</div>
                        {r.daysLeft !== null && r.daysLeft !== undefined && (
                          <div
                            className={`text-[10px] font-black mt-0.5 ${
                              r.daysLeft <= 0
                                ? 'text-red-600'
                                : r.daysLeft <= 7
                                ? 'text-red-500'
                                : 'text-amber-600'
                            }`}
                          >
                            {r.daysLeft < 0
                              ? `${Math.abs(r.daysLeft)}d overdue`
                              : `${r.daysLeft} day(s) left`}
                          </div>
                        )}
                      </td>

                      {/* Claim Amount */}
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        ₱{formatCurrency(r.claimAmount)}
                      </td>

                      {/* DATE OF REFILE / RE-APPEAL COLUMN */}
                      <td className="py-2.5 px-3 min-w-[190px] bg-blue-50/20 border-x border-blue-100/70">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            key={`refile-${r.id}-${r.dateOfRefileReappeal || ''}`}
                            defaultValue={r.dateOfRefileReappeal || ''}
                            disabled={user.role === 'VIEWER'}
                            onChange={e => {
                              // Only fire update if a complete valid date is entered (YYYY-MM-DD, 10 chars)
                              const val = e.target.value;
                              if (val && val.length === 10) {
                                updateRecord(r.id, { dateOfRefileReappeal: val });
                              }
                            }}
                            onBlur={e => {
                              // Also catch any complete date on blur (covers manual typing)
                              const val = e.target.value;
                              if (val && val.length === 10 && val !== (r.dateOfRefileReappeal || '')) {
                                updateRecord(r.id, { dateOfRefileReappeal: val });
                              }
                            }}
                            className="w-full px-2 py-1 rounded-xl border border-slate-200 hover:border-brand-blue focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-xs font-semibold bg-white text-slate-800 shadow-sm transition-all"
                            title="Set Date of Refile / Re-Appeal"
                          />
                          {!r.dateOfRefileReappeal ? (
                            <button
                              type="button"
                              disabled={user.role === 'VIEWER'}
                              onClick={() => updateRecord(r.id, { dateOfRefileReappeal: getTodayIso() })}
                              className="px-2 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-brand-blue text-[10px] font-black shrink-0 transition-colors cursor-pointer"
                              title="Set to today"
                            >
                              Today
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={user.role === 'VIEWER'}
                              onClick={() => updateRecord(r.id, { dateOfRefileReappeal: '' })}
                              className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 shrink-0 transition-colors cursor-pointer"
                              title="Clear refile date"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* STATUS COLUMN */}
                      <td className="py-2.5 px-3 min-w-[160px] bg-slate-50/40">
                        <select
                          value={r.monitoringStatus || (isRTH ? 'RTH' : 'DENIED')}
                          disabled={user.role === 'VIEWER'}
                          onChange={e => {
                            const newStatus = e.target.value as MonitoringClaimStatus;
                            updateRecord(r.id, { monitoringStatus: newStatus });
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-brand-blue/20 ${
                            r.monitoringStatus === 'WITH CHEQUE'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : r.monitoringStatus === 'IN PROCESS'
                              ? 'bg-blue-50 text-blue-900 border-blue-300'
                              : r.monitoringStatus === 'RTH'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-rose-50 text-rose-900 border-rose-300'
                          }`}
                        >
                          <option value="IN PROCESS">IN PROCESS</option>
                          <option value="RTH">RTH</option>
                          <option value="DENIED">DENIED</option>
                          <option value="WITH CHEQUE">WITH CHEQUE</option>
                        </select>
                      </td>

                      {/* Transmitter */}
                      <td className="py-3 px-3">
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

                      {/* Remarks */}
                      <td className="py-2.5 px-3 min-w-[180px]">
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
                          title={r.remarks ? `Remarks: ${r.remarks}` : 'Type remarks and click outside to save'}
                        />
                      </td>

                      {/* Admin Delete */}
                      {user.role === 'ADMIN' && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteRecord(r.id, r.patientName || r.reference, r.noticeType)}
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

        {/* Footer Summary Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-semibold">
            <span>Total Shown:</span>
            <span className="font-black text-slate-900">{records.length} claim(s)</span>
            <span className="text-slate-400">·</span>
            <span>Sum of Claims:</span>
            <span className="font-black text-slate-900">₱{formatCurrency(totalClaimAmountCurrent)}</span>
          </div>

          <div className="text-slate-400 text-[11px] font-medium">
            CPH-B PhilHealth Monitoring Suite
          </div>
        </div>
      </div>
    </div>
  );
}
