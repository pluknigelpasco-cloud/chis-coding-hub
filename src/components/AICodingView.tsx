'use client';
import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';
import { AICodingResult, AICodingCandidate } from '@/lib/types';

function ConfidencePill({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-emerald-100 text-emerald-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${styles[confidence] || 'bg-slate-100 text-slate-600'}`}>
      {confidence}
    </span>
  );
}

function formatMoney(val: number) {
  if (!val) return '—';
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CandidateCard({ candidate, index }: { candidate: AICodingCandidate; index: number }) {
  return (
    <div className={`rounded-xl p-4 border ${
      index === 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="font-mono font-black text-base text-slate-800 mr-2">{candidate.code}</span>
          <ConfidencePill confidence={candidate.confidence} />
        </div>
        {index === 0 && <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Best Match</span>}
      </div>
      <p className="text-sm text-slate-600 mb-3 leading-snug">{candidate.description}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white rounded-lg border border-slate-100 p-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Case Rate</p>
          <p className="text-sm font-black text-slate-800">{formatMoney(candidate.caseRate)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 p-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Hospital</p>
          <p className="text-sm font-black text-slate-700">{formatMoney(candidate.hospitalFee)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 p-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Prof. Fee</p>
          <p className="text-sm font-black text-slate-700">{formatMoney(candidate.professionalFee)}</p>
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
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6" />
          <h2 className="text-2xl font-black tracking-tight">AI Coding Assistant</h2>
        </div>
        <p className="text-violet-200 text-sm">
          Paste or type the doctor's final diagnosis statement. The AI suggests ICD-10 codes and PhilHealth case rates from your CHIS database.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
            Final Diagnosis (one per line)
          </label>
          <textarea
            value={diagnosisText}
            onChange={e => setDiagnosisText(e.target.value)}
            rows={5}
            placeholder={'1. Type 2 Diabetes Mellitus\n2. Hypertensive Heart Disease\n3. Community Acquired Pneumonia, Moderate Risk'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-y font-mono"
          />
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Facility Type</label>
            <select
              value={facilityType}
              onChange={e => setFacilityType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="level1">Level 1 (RHU / Infirmary)</option>
              <option value="level2">Level 2 (District / Provincial)</option>
              <option value="level3">Level 3 (Regional / Specialty)</option>
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !diagnosisText.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyzing...' : 'Analyze Diagnoses'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      {result && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{result.disclaimer}</span>
        </div>
      )}

      {/* Combinations */}
      {result && result.combinations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-black text-slate-800 text-base mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            Causal Relationships Detected
          </h3>
          <div className="space-y-3">
            {result.combinations.map((c, i) => (
              <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                <p className="font-bold text-slate-700 mb-1">"{c.originalStatement}"</p>
                <p className="text-amber-700 mb-2"><b>Connector:</b> {c.relation} — {c.sequencingNote}</p>
                <p className="text-slate-500 text-xs">{c.claimRule}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && result.results.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{r.diagnosisType}</p>
              <h3 className="font-black text-slate-800 text-base leading-snug">{r.diagnosis}</h3>
            </div>
            <div>
              {r.status === 'CANDIDATES_FOUND' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {r.status === 'NO_RELIABLE_MATCH' && <AlertTriangle className="w-5 h-5 text-red-400" />}
              {r.status === 'NEEDS_CLARIFICATION' && <HelpCircle className="w-5 h-5 text-amber-400" />}
            </div>
          </div>

          {r.message && (
            <p className="text-sm text-slate-500 italic">{r.message}</p>
          )}

          {r.candidates.length > 0 && (
            <div className="space-y-2">
              {r.candidates.map((c, ci) => (
                <CandidateCard key={ci} candidate={c} index={ci} />
              ))}
            </div>
          )}

          {r.codingQuestions && r.codingQuestions.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Clarifying Questions</p>
              <ul className="space-y-1">
                {r.codingQuestions.map((q, qi) => (
                  <li key={qi} className="text-sm text-slate-600 flex items-start gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
