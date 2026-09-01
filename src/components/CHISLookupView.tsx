'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Star, StarOff, Clock, Trash2, X, Calendar, ExternalLink, Activity, CheckCircle2, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
      type === 'ICD'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-emerald-100 text-emerald-700'
    }`}>
      {type}
    </span>
  );
}

function ResultRow({
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
  return (
    <tr className="hover:bg-slate-50 group">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <TypeBadge type={record.type} />
          <span className="font-mono font-black text-sm text-slate-800">{record.code}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
          <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{record.effectivity_date || 'PhilHealth ACR / CRS'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 leading-snug align-top">
        <p className="font-medium text-slate-800 mb-1.5">{record.description}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenCRS(record.code)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
          >
            <Activity className="w-3 h-3 text-indigo-500" />
            <span>Live CRS Timeline</span>
          </button>
          <a
            href="https://www.philhealth.gov.ph/services/acr/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 font-medium"
          >
            <span>PhilHealth Portal</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm font-black text-slate-900 whitespace-nowrap align-top">{formatMoney(record.case_rate)}</td>
      <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap align-top">{formatMoney(record.hospital_fee)}</td>
      <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap align-top">{formatMoney(record.professional_fee)}</td>
      <td className="px-4 py-3 text-center align-top">
        <button
          onClick={() => onToggleFav(record)}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          className={`p-1.5 rounded-xl transition-all ${
            isFav
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isFav ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
        </button>
      </td>
    </tr>
  );
}

export default function CHISLookupView() {
  const [tab, setTab] = useState<TabKey>('SEARCH');
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
    debounceRef.current = setTimeout(() => doSearch(val), 300);
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-1">CHIS Coding Search & CRS Sync</h2>
          <p className="text-blue-100 text-sm">Search ICD-10 codes, RVS procedures, PhilHealth case rates, and live CRS timelines.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://crs.philhealth.gov.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all border border-white/30 w-fit backdrop-blur-sm"
          >
            <span>Live PhilHealth CRS Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Tab */}
        {tab === 'SEARCH' && (
          <div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  placeholder="Search ICD-10, RVS (e.g. 99460), diagnosis, or procedure..."
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              {searching && (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Searching database...
                </div>
              )}
              {!searching && query && results.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <p className="mb-3">No local results found for <b>"{query}"</b>.</p>
                  <button
                    onClick={() => openLiveCRS(query)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Query Live PhilHealth CRS Directly
                  </button>
                </div>
              )}
              {!searching && !query && (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Type a code, diagnosis, or procedure above.
                </div>
              )}
              {results.length > 0 && (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider w-48">Type / Code & Status</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Case Rate</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Hospital Fee</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Prof. Fee</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.map(r => (
                      <ResultRow
                        key={`${r.type}-${r.code}`}
                        record={r}
                        isFav={favCodes.has(r.code)}
                        onToggleFav={toggleFav}
                        onOpenCRS={openLiveCRS}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Favorites Tab */}
        {tab === 'FAVORITES' && (
          <div className="overflow-x-auto">
            {favorites.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No favorites yet. Star a code from search results.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider w-48">Type / Code & Status</th>
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Case Rate</th>
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Hospital Fee</th>
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Prof. Fee</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {favorites.map(f => (
                    <ResultRow
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
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === 'HISTORY' && (
          <div>
            {history.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 flex justify-end">
                <button onClick={clearHistory} className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear history
                </button>
              </div>
            )}
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No recent searches.
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {history.map(h => (
                  <li key={h.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                      <span
                        className="text-sm text-slate-700 font-medium cursor-pointer hover:text-blue-600 truncate"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-300">Live PhilHealth CRS Inspector</span>
                </div>
                <h3 className="text-lg font-black tracking-tight">Code: {crsModalCode}</h3>
              </div>
              <button
                onClick={() => setCrsModalCode(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {crsLoading && (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-sm text-slate-600">Connecting to https://crs.philhealth.gov.ph/ ...</p>
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
                  className={`rounded-xl border p-4 transition-all ${
                    r.isCurrent
                      ? 'border-emerald-200 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">Effectivity:</span>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        r.isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {r.effectivity}
                      </span>
                      {r.isCurrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Current Active Rate
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-800 mb-3">{r.description}</p>

                  {/* Primary Case Rate */}
                  {r.firstCaseRate.applicable && (
                    <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-3 border border-slate-200 mb-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">1st Case Rate</p>
                        <p className="text-base font-black text-emerald-700">{formatMoney(r.firstCaseRate.caseRate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">HCI Fee (Hospital)</p>
                        <p className="text-sm font-bold text-slate-700">{formatMoney(r.firstCaseRate.hospitalFee)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Prof Fee (Doctor)</p>
                        <p className="text-sm font-bold text-slate-700">{formatMoney(r.firstCaseRate.professionalFee)}</p>
                      </div>
                    </div>
                  )}

                  {/* Secondary Case Rate */}
                  {r.secondCaseRate.applicable && (
                    <div className="grid grid-cols-3 gap-2 bg-white/70 rounded-xl p-2.5 border border-slate-200 mb-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">2nd Case Rate</p>
                        <p className="font-bold text-slate-800">{formatMoney(r.secondCaseRate.caseRate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">2nd HCI Fee</p>
                        <p className="font-medium text-slate-600">{formatMoney(r.secondCaseRate.hospitalFee)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">2nd Prof Fee</p>
                        <p className="font-medium text-slate-600">{formatMoney(r.secondCaseRate.professionalFee)}</p>
                      </div>
                    </div>
                  )}

                  {/* Facility Applicability */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Applicable Healthcare Facilities</p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {r.facilities.level1 && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Level 1</span>}
                      {r.facilities.level2 && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Level 2</span>}
                      {r.facilities.level3 && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Level 3</span>}
                      {r.facilities.asc && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">ASC</span>}
                      {r.facilities.pcf && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">PCF</span>}
                      {r.facilities.mcp && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">MCP / MAT</span>}
                      {r.facilities.fsdc && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">FSDC</span>}
                      {r.facilities.others && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">Other HCIs</span>}
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
