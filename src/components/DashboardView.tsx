'use client';
import React, { useState } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Ban,
  Building2,
  Activity,
  ArrowUpDown,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { DashboardMetrics, AppUser } from '@/lib/types';
import { HOSPITAL_NAME } from '@/lib/assets';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  user: AppUser;
  onNavigateModule: (module: string, status?: string) => void;
}

export default function DashboardView({ metrics, user, onNavigateModule }: DashboardViewProps) {
  const [sortKey, setSortKey] = useState<string>('daysLeft');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [showBanner, setShowBanner] = useState<boolean>(true);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  let filteredRows = metrics.urgentRows;
  if (moduleFilter !== 'ALL') {
    filteredRows = filteredRows.filter(r => r.module === moduleFilter);
  }

  const sortedUrgentRows = [...filteredRows].sort((a: any, b: any) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === 'daysLeft') {
      av = a.daysLeft ?? 99999;
      bv = b.daysLeft ?? 99999;
    }
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * (sortDir === 'asc' ? 1 : -1);
    }
    return String(av).localeCompare(String(bv)) * (sortDir === 'asc' ? 1 : -1);
  });

  return (
    <div className="space-y-6">
      {/* Dynamic Welcome Hero with Hide/Show toggle */}
      {showBanner ? (
        <section className="relative overflow-hidden rounded-3xl theme-hero text-white p-6 sm:p-8 shadow-xl shadow-blue-950/15 border border-white/10 transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-sky-200 text-[10px] font-black tracking-wider uppercase backdrop-blur-md border border-white/15 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-300" />
                  {HOSPITAL_NAME} · Live Monitor
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Good day, <span className="text-sky-300">{user.fullName}!</span>
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed mt-2 max-w-2xl font-medium">
                Your live priority list is ready. Review urgent RTH compliance, Denied motions, 60-day Inpatient, and
                Hemodialysis transmission deadlines.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                title="Hide Banner"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Hide Banner
              </button>
            </div>
          </div>

          {/* Decorative Circles */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-sky-400/10 pointer-events-none blur-2xl" />
          <div className="absolute right-32 -bottom-16 w-80 h-80 rounded-full bg-emerald-400/10 pointer-events-none blur-3xl" />
        </section>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowBanner(true)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:bg-slate-50 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-brand-blue" />
            Show Welcome Banner
          </button>
        </div>
      )}

      {/* Metric Cards Grid (Full Widescreen Responsive) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* RTH Pending */}
        <button
          onClick={() => onNavigateModule('RTH', 'PENDING')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">RTH Pending</span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-brand-blue flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 mb-1 tracking-tight">
            {metrics.rthPending.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">Awaiting compliance / refile</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-blue scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </button>

        {/* RTH Urgent */}
        <button
          onClick={() => onNavigateModule('RTH', 'CRITICAL')}
          className="bg-white p-5 rounded-3xl border border-red-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden bg-gradient-to-b from-white to-red-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-red-600 uppercase tracking-wider">RTH Urgent</span>
            <div className="w-9 h-9 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-red-600 mt-3 mb-1 tracking-tight">
            {metrics.rthUrgent.toLocaleString()}
          </div>
          <p className="text-[11px] text-red-400 font-semibold">Expired or ≤ 7 days</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </button>

        {/* Denied Pending */}
        <button
          onClick={() => onNavigateModule('DENIED', 'PENDING')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Denied Pending</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 mb-1 tracking-tight">
            {metrics.deniedPending.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">Awaiting MR transmission</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </button>

        {/* Inpatient Pending */}
        <button
          onClick={() => onNavigateModule('INPATIENT', 'PENDING')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Inpatient Pending</span>
            <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-all shadow-sm">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 mb-1 tracking-tight">
            {metrics.inpatientPending.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">60-day cutoff discharge</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </button>

        {/* HD Pending */}
        <button
          onClick={() => onNavigateModule('HD', 'PENDING')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">HD Pending</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 mb-1 tracking-tight">
            {metrics.hdPending.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">60-day cutoff encounter</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </button>
      </section>

      {/* Priority Deadline Queue (Widescreen Table) */}
      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Priority Deadline Queue
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {metrics.totalUrgent} actionable expired, critical, or warning claim(s)
            </p>
          </div>

          {/* Module Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {['ALL', 'RTH', 'DENIED', 'INPATIENT', 'HD'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setModuleFilter(m)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  moduleFilter === m
                    ? 'bg-navy text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Urgent Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="py-3 px-4">
                  <button onClick={() => toggleSort('module')} className="flex items-center gap-1">
                    Module / Reference
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button onClick={() => toggleSort('patient')} className="flex items-center gap-1">
                    Patient / Category
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button onClick={() => toggleSort('baseDate')} className="flex items-center gap-1">
                    Source Date
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button onClick={() => toggleSort('expiryDate')} className="flex items-center gap-1">
                    Compliance Expiry
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button onClick={() => toggleSort('daysLeft')} className="flex items-center gap-1">
                    Countdown
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {sortedUrgentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    🎉 No urgent or critical deadlines found in this category.
                  </td>
                </tr>
              ) : (
                sortedUrgentRows.map((r: any, idx: number) => {
                  const days = r.daysLeft;
                  const isExpired = r.status === 'EXPIRED';
                  const isCritical = r.status === 'CRITICAL';
                  const isWarning = r.status === 'WARNING';

                  return (
                    <tr
                      key={r.id || `${r.module}-${r.reference}-${idx}`}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-black">
                        <span
                          className={`inline-block mr-2 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            r.module === 'RTH'
                              ? 'bg-blue-100 text-brand-blue'
                              : r.module === 'DENIED'
                              ? 'bg-amber-100 text-amber-800'
                              : r.module === 'INPATIENT'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {r.module}
                        </span>
                        <span className="text-slate-900">{r.reference}</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {r.patient || '—'}
                        {r.memberCategory && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {r.memberCategory}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">{r.baseDate || '—'}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{r.expiryDate || '—'}</td>

                      <td className="py-3 px-4 font-black">
                        {days !== null && days !== undefined ? (
                          <span
                            className={
                              days < 0
                                ? 'text-red-600 font-black'
                                : days <= 7
                                ? 'text-red-500 font-black'
                                : 'text-amber-600 font-black'
                            }
                          >
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days} day(s) left`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isExpired
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : isCritical
                              ? 'bg-red-100 text-red-700'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onNavigateModule(r.module)}
                          className="inline-flex items-center gap-1 text-xs font-black text-brand-blue hover:text-navy group/btn cursor-pointer"
                        >
                          Open
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
