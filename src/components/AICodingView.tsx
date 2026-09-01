'use client';
import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, HelpCircle, Loader2, Building2, User, FileText, ArrowRight } from 'lucide-react';
import { AICodingResult, AICodingCandidate } from '@/lib/types';

function ConfidencePill({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-emerald-100 text-emerald-800 border border-emerald-300/80',
    MEDIUM: 'bg-amber-100 text-amber-800 border border-amber-300/80',
    LOW: 'bg-red-100 text-red-800 border border-red-300/80',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${styles[confidence] || 'bg-slate-100 text-slate-700'}`}>
      {confidence} MATCH
    </span>
  );
}

function formatMoney(val: number) {
  if (!val) return '—';
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CandidateCard({ candidate, index }: { candidate: AICodingCandidate; index: number }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border-2 transition-all ${
      index === 0
        ? 'border-indigo-300 bg-gradient-to-br from-indigo-50/90 to-blue-50/60 shadow-sm ring-2 ring-indigo-500/20'
        : 'border-slate-200 bg-white hover:bg-slate-50/50'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-xl sm:text-2xl text-slate-950">{candidate.code}</span>
          <ConfidencePill confidence={candidate.confidence} />
        </div>
        {index === 0 && (
          <span className="text-[11px] font-black text-indigo-800 bg-indigo-100 border border-indigo-200 px-3 py-0.5 rounded-full uppercase tracking-wider">
            ★ Top Recommendation
          </span>
        )}
      </div>

      <p className="text-sm sm:text-base font-bold text-slate-800 mb-3.5 leading-snug">{candidate.description}</p>

      {candidate.note && (
        <div className="mb-3 text-xs bg-white/90 border border-slate-200 rounded-xl p-2.5 text-slate-700 font-semibold">
          💡 <span className="font-black text-slate-900">Coding Rule:</span> {candidate.note}
        </div>
      )}

      {/* Case Rate Prominent Display */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border-2 border-emerald-300/80 p-3 mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">Total Case Rate</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight leading-none mt-0.5">
            {formatMoney(candidate.caseRate)}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
          PhilHealth
        </span>
      </div>

      {/* HCI & Prof Fee Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-left">
        <div className="bg-white rounded-xl border border-slate-200 p-2.5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <Building2 className="w-3 h-3 text-slate-400" /> Hospital Fee (HCI)
          </p>
          <p className="text-base sm:text-lg font-black text-slate-900 leading-none">
            {formatMoney(candidate.hospitalFee)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-2.5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <User className="w-3 h-3 text-slate-400" /> Doctor (Prof Fee)
          </p>
          <p className="text-base sm:text-lg font-black text-slate-900 leading-none">
            {formatMoney(candidate.professionalFee)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AICodingView() {
  const [diagnosisText, setDiagnosisText] = useState('');
  const [facilityType, setFacilityType] = useState('level2');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AICodingResult | null>(null);
  const [error, setError] = useState('');

  const quickSamples = [
    'Urinary Tract Infection',
    'Essential Hypertension',
    'Community Acquired Pneumonia, Moderate Risk',
    'Type 2 Diabetes Mellitus with Renal Complications secondary to Hypertension',
    'Acute Appendicitis',
  ];

  async function handleAnalyze() {
    if (!diagnosisText.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/chis/ai-coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosisText, facilityType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 rounded-2xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-xs">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">AI Coding Assistant</h2>
        </div>
        <p className="text-violet-100 text-xs sm:text-sm">
          Paste or type the doctor's final diagnosis statement. The AI identifies principal & secondary conditions and suggests ICD-10 codes with PhilHealth case rates.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Final Diagnosis (One per line)
            </label>
          </div>
          <textarea
            value={diagnosisText}
            onChange={e => setDiagnosisText(e.target.value)}
            rows={4}
            placeholder={'1. Urinary Tract Infection\n2. Hypertensive Heart Disease\n3. Community Acquired Pneumonia, Moderate Risk'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-y font-mono font-medium shadow-xs"
          />
        </div>

        {/* Quick Sample Diagnosis Chips */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Sample Prompts:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickSamples.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDiagnosisText(s)}
                className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-violet-100 hover:text-violet-800 text-slate-700 rounded-lg transition-colors border border-slate-200/60"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Facility:</label>
            <select
              value={facilityType}
              onChange={e => setFacilityType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="level1">Level 1 (RHU / Infirmary)</option>
              <option value="level2">Level 2 (District / Provincial)</option>
              <option value="level3">Level 3 (Regional / Specialty)</option>
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !diagnosisText.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyzing Diagnoses...' : 'Analyze Diagnoses'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            {error}
          </div>
        )}
      </div>

      {/* Official Disclaimer */}
      {result && (
        <div className="flex items-start gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>{result.disclaimer}</span>
        </div>
      )}

      {/* Causal Combinations Detected */}
      {result && result.combinations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-5">
          <h3 className="font-black text-slate-800 text-sm sm:text-base mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            Causal / Combination Relationships Detected
          </h3>
          <div className="space-y-3">
            {result.combinations.map((c, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs leading-relaxed">
                <p className="font-black text-slate-800 text-sm mb-1">"{c.originalStatement}"</p>
                <p className="text-amber-800 font-semibold mb-1.5"><b>Connector:</b> {c.relation} — {c.sequencingNote}</p>
                <p className="text-slate-500">{c.claimRule}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic Candidate Results */}
      {result && result.results.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3.5 pb-3 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{r.diagnosisType}</p>
              <h3 className="font-black text-slate-900 text-base sm:text-lg leading-snug">{r.diagnosis}</h3>
            </div>
            <div>
              {r.status === 'CANDIDATES_FOUND' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {r.status === 'NO_RELIABLE_MATCH' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
              {r.status === 'NEEDS_CLARIFICATION' && <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />}
            </div>
          </div>

          {r.message && (
            <p className="text-xs font-semibold text-slate-500 italic p-3 bg-slate-50 rounded-xl">{r.message}</p>
          )}

          {r.candidates.length > 0 && (
            <div className="space-y-3">
              {r.candidates.map((c, ci) => (
                <CandidateCard key={ci} candidate={c} index={ci} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
