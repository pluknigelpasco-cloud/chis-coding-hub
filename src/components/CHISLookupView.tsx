'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Star, StarOff, Clock, Trash2, X } from 'lucide-react';
import { CHISRecord, Favorite } from '@/lib/types';

type TabKey = 'SEARCH' | 'FAVORITES' | 'HISTORY';

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
}: {
  record: CHISRecord;
  isFav: boolean;
  onToggleFav: (r: CHISRecord) => void;
}) {
  return (
    <tr className="hover:bg-slate-50 group">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <TypeBadge type={record.type} />
          <span className="font-mono font-black text-sm text-slate-800">{record.code}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 leading-snug">{record.description}</td>
      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">{formatMoney(record.case_rate)}</td>
      <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap">{formatMoney(record.hospital_fee)}</td>
      <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap">{formatMoney(record.professional_fee)}</td>
      <td className="px-4 py-3 text-center">
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
    debounceRef.current = setTimeout(() => doSearch(val), 350);
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
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight mb-1">CHIS Coding Search</h2>
        <p className="text-blue-100 text-sm">Search ICD-10 codes, RVS procedures, PhilHealth case rates, and professional fees.</p>
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
                  placeholder="Search ICD-10, RVS, diagnosis, or procedure..."
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  Searching...
                </div>
              )}
              {!searching && query && results.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-sm">No results found for <b>"{query}"</b>.</div>
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
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider w-32">Type / Code</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Case Rate</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Hospital Fee</th>
                      <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Prof. Fee</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.map(r => (
                      <ResultRow key={`${r.type}-${r.code}`} record={r} isFav={favCodes.has(r.code)} onToggleFav={toggleFav} />
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
                    <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider w-32">Type / Code</th>
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
                      record={{ code: f.code, description: f.description, case_rate: f.case_rate, hospital_fee: f.hospital_fee, professional_fee: f.professional_fee, type: f.type }}
                      isFav={true}
                      onToggleFav={r => toggleFav(r)}
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
    </div>
  );
}
