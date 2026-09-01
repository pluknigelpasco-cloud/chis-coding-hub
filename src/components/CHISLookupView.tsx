'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Star, StarOff, Clock, Trash2, X, Calendar, ExternalLink,
  Activity, CheckCircle2, ShieldCheck, Layers, LayoutGrid, Table as TableIcon,
  Sparkles, ArrowRight, Building2, User, Check, XCircle, Tag
} from 'lucide-react';
import { CHISRecord, Favorite } from '@/lib/types';

type TabKey = 'SEARCH' | 'FAVORITES' | 'HISTORY';

interface CRSRecordDetail {
  source: string;
  code: string;
  description: string;
  effectivity: string;
  isCurrent: boolean;
  firstCaseRate: { applicable: boolean; hospitalFee: number; professionalFee: number; caseRate: number };
  secondCaseRate: { applicable: boolean; hospitalFee: number; professionalFee: number; caseRate: number };
  facilities: {
    level1: boolean;
    level2: boolean;
    level3: boolean;
    asc: boolean;
    pcf: boolean;
    mcp: boolean;
    fsdc: boolean;
    others: boolean;
  };
}

function formatMoney(val: number): string {
  if (!val) return '—';
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider shadow-xs ${
      type === 'ICD'
        ? 'bg-blue-100 text-blue-800 border border-blue-200'
        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    }`}>
      {type}
    </span>
  );
}

// Card View component for responsive mobile & modern grid
function ResultCard({
  record,
  isFav,
  onToggleFav,
  onOpenCRS,
}: {
  record: CHISRecord;
  isFav: boolean;
  onToggleFav: (r: CHISRecord) => void;
  onOpenCRS: (code: string) => void;
}) {
  // Check if 2nd case rate applies (for surgical RVS like 11000, 47600, or standard dual case rates)
  const isRVS = record.type === 'RVS';
  const isNonSecondPackage = /^(NSD01|MCP01|NCP01|99460)/i.test(record.code);
  const secondApplicable = isRVS ? !isNonSecondPackage : true;
  const secondRate = secondApplicable ? record.case_rate : 0;
  const secondHCI = secondApplicable ? record.hospital_fee : 0;
  const secondPF = secondApplicable ? record.professional_fee : 0;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between group">
      <div>
        {/* Card Header: Type, Code, Effectivity, Favorite */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={record.type} />
            <span className="font-mono font-black text-xl text-slate-950 tracking-tight">{record.code}</span>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{record.effectivity_date || 'PhilHealth ACR / CRS'}</span>
            </div>
          </div>
          <button
            onClick={() => onToggleFav(record)}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 rounded-xl transition-all ${
              isFav
                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
          >
            {isFav ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
          </button>
        </div>

        {/* Description */}
        <p className="text-sm sm:text-base font-bold text-slate-800 leading-snug mb-4">
          {record.description}
        </p>
      </div>

      <div className="space-y-2.5">
        {/* 1ST CASE RATE SECTION */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border-2 border-emerald-300/90 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">1st Case Rate (Primary)</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
              100% Rate
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight leading-none mb-2">
            {formatMoney(record.case_rate)}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200/80">
            <div className="bg-white/80 rounded-lg p-1.5 border border-emerald-200/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Hospital (HCI)</span>
              <span className="font-black text-slate-900 text-sm">{formatMoney(record.hospital_fee)}</span>
            </div>
            <div className="bg-white/80 rounded-lg p-1.5 border border-emerald-200/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Doctor (PF)</span>
              <span className="font-black text-slate-900 text-sm">{formatMoney(record.professional_fee)}</span>
            </div>
          </div>
        </div>

        {/* 2ND CASE RATE SECTION */}
        <div className={`rounded-xl p-3 border-2 transition-all ${
          secondApplicable
            ? 'bg-blue-50/70 border-blue-200'
            : 'bg-slate-50/80 border-slate-200 opacity-70'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${secondApplicable ? 'bg-blue-500' : 'bg-slate-400'}`} />
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">2nd Case Rate (Secondary)</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              secondApplicable
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {secondApplicable ? '✓ Applicable' : '✕ Not Applicable'}
            </span>
          </div>

          {secondApplicable ? (
            <div>
              <p className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight leading-none mb-2">
                {formatMoney(secondRate)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-blue-200/60">
                <div className="bg-white/80 rounded-lg p-1.5 border border-blue-200/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">2nd HCI</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">{formatMoney(secondHCI)}</span>
                </div>
                <div className="bg-white/80 rounded-lg p-1.5 border border-blue-200/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">2nd PF</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">{formatMoney(secondPF)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-500 italic py-1">
              Not eligible as a secondary claim code under PhilHealth Single Period of Confinement rules.
            </p>
          )}
        </div>

        {/* Facility Accreditation Badges */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Facilities:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">Level 1</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">Level 2</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">Level 3</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">ASC</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenCRS(record.code)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>CRS Timeline</span>
            </button>
            <a
              href="https://www.philhealth.gov.ph/services/acr/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 font-bold"
            >
              <span>Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Table Row for Desktop Table View
function ResultTableRow({
  record,
  isFav,
  onToggleFav,
  onOpenCRS,
}: {
  record: CHISRecord;
  isFav: boolean;
  onToggleFav: (r: CHISRecord) => void;
  onOpenCRS: (code: string) => void;
}) {
  const isRVS = record.type === 'RVS';
  const isNonSecondPackage = /^(NSD01|MCP01|NCP01|99460)/i.test(record.code);
  const secondApplicable = isRVS ? !isNonSecondPackage : true;

  return (
    <tr className="hover:bg-slate-50/80 group transition-colors">
      <td className="px-4 py-3.5 align-top w-48">
        <div className="flex items-center gap-2">
          <TypeBadge type={record.type} />
          <span className="font-mono font-black text-lg text-slate-950">{record.code}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-fit">
          <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{record.effectivity_date || 'PhilHealth ACR / CRS'}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-700 leading-snug align-top">
        <p className="font-bold text-slate-800 mb-1.5 text-sm sm:text-base">{record.description}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenCRS(record.code)}
            className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Live CRS Timeline</span>
          </button>
          <a
            href="https://www.philhealth.gov.ph/services/acr/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 font-bold"
          >
            <span>PhilHealth Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </td>
      {/* 1st Case Rate */}
      <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
        <span className="inline-block px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-black text-base border-2 border-emerald-300">
          {formatMoney(record.case_rate)}
        </span>
        <div className="text-[10px] text-slate-500 font-bold mt-1">
          HCI: {formatMoney(record.hospital_fee)} | PF: {formatMoney(record.professional_fee)}
        </div>
      </td>
      {/* 2nd Case Rate */}
      <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
        {secondApplicable ? (
          <div>
            <span className="inline-block px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900 font-black text-base border-2 border-blue-200">
              {formatMoney(record.case_rate)}
            </span>
            <div className="text-[10px] text-blue-700 font-bold mt-1">
              ✓ Allowed as 2nd Rate
            </div>
          </div>
        ) : (
          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-xs">
            Not Applicable
          </span>
        )}
      </td>
      <td className="px-4 py-3.5 text-center align-top w-12">
        <button
          onClick={() => onToggleFav(record)}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          className={`p-1.5 rounded-xl transition-all ${
            isFav
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300'
              : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isFav ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
        </button>
      </td>
    </tr>
  );
}

export default function CHISLookupView() {
  const [tab, setTab] = useState<TabKey>('SEARCH');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CHISRecord[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [favCodes, setFavCodes] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CRS Modal state
  const [crsModalCode, setCrsModalCode] = useState<string | null>(null);
  const [crsLoading, setCrsLoading] = useState(false);
  const [crsRecords, setCrsRecords] = useState<CRSRecordDetail[]>([]);

  const loadFavorites = useCallback(async () => {
    const res = await fetch('/api/chis/favorites');
    const data = await res.json();
    if (data.favorites) {
      setFavorites(data.favorites);
      setFavCodes(new Set(data.favorites.map((f: Favorite) => f.code)));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/chis/history');
    const data = await res.json();
    if (data.history) setHistory(data.history);
  }, []);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  useEffect(() => {
    if (tab === 'FAVORITES') loadFavorites();
    if (tab === 'HISTORY') loadHistory();
  }, [tab, loadFavorites, loadHistory]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/chis/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  }

  async function openLiveCRS(code: string) {
    setCrsModalCode(code);
    setCrsLoading(true);
    setCrsRecords([]);
    try {
      const res = await fetch(`/api/chis/crs?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.records) {
        setCrsRecords(data.records);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCrsLoading(false);
    }
  }

  async function toggleFav(record: CHISRecord) {
    if (favCodes.has(record.code)) {
      await fetch(`/api/chis/favorites?code=${encodeURIComponent(record.code)}`, { method: 'DELETE' });
      setFavCodes(prev => { const s = new Set(prev); s.delete(record.code); return s; });
    } else {
      await fetch('/api/chis/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      setFavCodes(prev => new Set(prev).add(record.code));
    }
    loadFavorites();
  }

  async function clearHistory() {
    await fetch('/api/chis/history', { method: 'DELETE' });
    setHistory([]);
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'SEARCH', label: 'Search', icon: <Search className="w-4 h-4" /> },
    { key: 'FAVORITES', label: `Favorites (${favCodes.size})`, icon: <Star className="w-4 h-4" /> },
    { key: 'HISTORY', label: 'History', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider backdrop-blur-xs">
              ICD-10 & RVS Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">CHIS Coding Search & CRS Sync</h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-0.5">Primary & Secondary Case Rates, HCI/PF Fees, and Facility Applicability.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://crs.philhealth.gov.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 backdrop-blur-xs shadow-xs"
          >
            <span>Live PhilHealth CRS</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Navigation Tabs & View Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-3 sm:px-4">
          <div className="flex">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-black transition-all border-b-2 ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Toggle Card vs Table View */}
          {tab !== 'HISTORY' && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl my-2">
              <button
                onClick={() => setViewMode('CARD')}
                title="Card Grid View"
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'CARD' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                title="Compact Table View"
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'TABLE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Table</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Tab Content */}
        {tab === 'SEARCH' && (
          <div>
            {/* Search Input */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  placeholder="Search code (e.g. 11000, NSD01, N39.0), diagnosis, or procedure..."
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium shadow-xs"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Area */}
            <div className="p-3 sm:p-5">
              {searching && (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Searching database...
                </div>
              )}

              {!searching && query && results.length === 0 && (
                <div className="p-10 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="font-semibold text-slate-700 mb-3">No local records found for <b>"{query}"</b>.</p>
                  <button
                    onClick={() => openLiveCRS(query)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm hover:bg-indigo-700 transition-all"
                  >
                    <Activity className="w-4 h-4" />
                    Search Directly in Live PhilHealth CRS
                  </button>
                </div>
              )}

              {!searching && !query && (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-25 text-slate-600" />
                  <p className="font-bold text-slate-600">Enter a code, diagnosis, or procedure</p>
                  <p className="text-xs text-slate-400 mt-1">Over 8,900+ validated ICD-10 and RVS case rates ready</p>
                </div>
              )}

              {/* Card Grid View */}
              {results.length > 0 && viewMode === 'CARD' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {results.map(r => (
                    <ResultCard
                      key={`${r.type}-${r.code}`}
                      record={r}
                      isFav={favCodes.has(r.code)}
                      onToggleFav={toggleFav}
                      onOpenCRS={openLiveCRS}
                    />
                  ))}
                </div>
              )}

              {/* Desktop Table View */}
              {results.length > 0 && viewMode === 'TABLE' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Code & Effectivity</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">1st Case Rate</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">2nd Case Rate</th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map(r => (
                        <ResultTableRow
                          key={`${r.type}-${r.code}`}
                          record={r}
                          isFav={favCodes.has(r.code)}
                          onToggleFav={toggleFav}
                          onOpenCRS={openLiveCRS}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Favorites Tab Content */}
        {tab === 'FAVORITES' && (
          <div className="p-3 sm:p-5">
            {favorites.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
                <p className="font-bold text-slate-600">No favorite codes saved yet</p>
                <p className="text-xs text-slate-400 mt-1">Star frequently used ICD-10 or RVS codes from search results for instant 1-click access.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {favorites.map(f => (
                  <ResultCard
                    key={f.id}
                    record={{
                      code: f.code,
                      description: f.description,
                      case_rate: f.case_rate,
                      hospital_fee: f.hospital_fee,
                      professional_fee: f.professional_fee,
                      type: f.type,
                      effectivity_date: f.effectivity_date,
                    }}
                    isFav={true}
                    onToggleFav={r => toggleFav(r)}
                    onOpenCRS={openLiveCRS}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab Content */}
        {tab === 'HISTORY' && (
          <div>
            {history.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 flex justify-end bg-slate-50/50">
                <button onClick={clearHistory} className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear search history
                </button>
              </div>
            )}
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-500" />
                No recent searches.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map(h => (
                  <li key={h.id} className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span
                        className="text-sm text-slate-800 font-semibold cursor-pointer hover:text-blue-600 truncate"
                        onClick={() => { setTab('SEARCH'); setQuery(h.keyword); doSearch(h.keyword); }}
                      >
                        {h.keyword}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{new Date(h.created_at).toLocaleString('en-PH')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Live PhilHealth CRS Timeline Modal */}
      {crsModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">Live PhilHealth CRS Inspector</span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight">Code: {crsModalCode}</h3>
              </div>
              <button
                onClick={() => setCrsModalCode(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {crsLoading && (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-sm text-slate-700">Connecting to https://crs.philhealth.gov.ph/ ...</p>
                  <p className="text-xs text-slate-400 mt-1">Fetching official circular timeline & facility applicability</p>
                </div>
              )}

              {!crsLoading && crsRecords.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700">No live CRS records returned by PhilHealth server.</p>
                  <p className="text-xs text-slate-400 mt-1">Please verify via the official web portal if this is an unlisted or legacy code.</p>
                </div>
              )}

              {!crsLoading && crsRecords.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    r.isCurrent
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">Effectivity:</span>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        r.isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {r.effectivity}
                      </span>
                      {r.isCurrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                          Current Active Rate
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-800 mb-3.5 leading-snug">{r.description}</p>

                  {/* Primary Case Rate */}
                  {r.firstCaseRate.applicable && (
                    <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-3.5 border-2 border-slate-200 mb-3 text-center">
                      <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                        <p className="text-[11px] font-black text-emerald-900 uppercase">1st Case Rate</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-800">{formatMoney(r.firstCaseRate.caseRate)}</p>
                      </div>
                      <div className="rounded-lg p-2.5 border border-slate-200 bg-slate-50">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">HCI (Hospital)</p>
                        <p className="text-sm sm:text-base font-black text-slate-900">{formatMoney(r.firstCaseRate.hospitalFee)}</p>
                      </div>
                      <div className="rounded-lg p-2.5 border border-slate-200 bg-slate-50">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">PF (Doctor)</p>
                        <p className="text-sm sm:text-base font-black text-slate-900">{formatMoney(r.firstCaseRate.professionalFee)}</p>
                      </div>
                    </div>
                  )}

                  {/* Secondary Case Rate */}
                  {r.secondCaseRate.applicable && (
                    <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-2.5 border border-slate-200 mb-3 text-xs text-center">
                      <div className="bg-slate-100 rounded-lg p-2">
                        <p className="text-[10px] font-black text-slate-700 uppercase">2nd Case Rate</p>
                        <p className="text-sm sm:text-base font-black text-slate-900">{formatMoney(r.secondCaseRate.caseRate)}</p>
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">2nd HCI Fee</p>
                        <p className="font-black text-slate-800">{formatMoney(r.secondCaseRate.hospitalFee)}</p>
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">2nd Prof Fee</p>
                        <p className="font-black text-slate-800">{formatMoney(r.secondCaseRate.professionalFee)}</p>
                      </div>
                    </div>
                  )}

                  {/* Facility Applicability */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Applicable Healthcare Facilities</p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {r.facilities.level1 && <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">Level 1</span>}
                      {r.facilities.level2 && <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">Level 2</span>}
                      {r.facilities.level3 && <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">Level 3</span>}
                      {r.facilities.asc && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">ASC</span>}
                      {r.facilities.pcf && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">PCF</span>}
                      {r.facilities.mcp && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">MCP / MAT</span>}
                      {r.facilities.fsdc && <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">FSDC</span>}
                      {r.facilities.others && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">Other HCIs</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Verified directly from official PhilHealth CRS endpoint
              </span>
              <button
                onClick={() => setCrsModalCode(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
