'use client';
import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { NoticePdfPreviewResult, NoticePdfRow } from '@/lib/types';
import { useToast } from './Toast';
import { formatCurrency } from '@/lib/calculations';

export default function UploadNoticeView({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [noticeType, setNoticeType] = useState<'RTH' | 'DENIED'>('RTH');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<NoticePdfPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  async function handlePreview(selectedFile: File, type = noticeType) {
    setFile(selectedFile);
    setLoading(true);
    setPreview(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('noticeType', type);

    try {
      const res = await fetch('/api/notices/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to parse PDF.');

      setPreview(data);
      const initialSelected = new Set<number>();
      data.rows.forEach((r: NoticePdfRow, i: number) => {
        if (!r.duplicate) initialSelected.add(i);
      });
      setSelectedIndices(initialSelected);
      toast(`Successfully parsed ${data.rows.length} rows from ${selectedFile.name}`);
    } catch (err: any) {
      toast(err?.message || 'Error uploading PDF', true);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked && preview) {
      const all = new Set<number>();
      preview.rows.forEach((_, i) => all.add(i));
      setSelectedIndices(all);
    } else {
      setSelectedIndices(new Set());
    }
  }

  function toggleRow(index: number) {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndices(next);
  }

  async function handleConfirmImport() {
    if (!preview) return;
    const selectedRows = preview.rows.filter((_, i) => selectedIndices.has(i));
    if (!selectedRows.length) {
      toast('Please select at least one row to import.', true);
      return;
    }

    setImporting(true);
    try {
      const controlNums = preview.notices
        .map(n => n.controlNumber)
        .filter(Boolean)
        .join(', ');

      const res = await fetch('/api/notices/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: preview.type,
          filename: preview.filename,
          rows: selectedRows,
          controlNumbers: controlNums,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to import notice claims.');

      toast(data.message || 'Records imported successfully.');
      setPreview(null);
      setFile(null);
      onSuccess();
    } catch (err: any) {
      toast(err?.message || 'Error saving claims', true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {!preview ? (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Upload Card (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Import Official PhilHealth PDF</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Upload official PhilHealth RTH Notice or Denied Notice documents.
              </p>
            </div>

            {/* Notice Type Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNoticeType('RTH')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  noticeType === 'RTH'
                    ? 'border-brand-blue bg-blue-50/60 ring-2 ring-brand-blue/10 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-black text-sm text-slate-900">↩ RTH Notice</span>
                <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                  Claims for compliance & refiling countdown.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNoticeType('DENIED')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  noticeType === 'DENIED'
                    ? 'border-brand-blue bg-blue-50/60 ring-2 ring-brand-blue/10 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-black text-sm text-slate-900">⊘ Denied Notice</span>
                <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                  Motion for reconsideration transmission tracker.
                </span>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div className="relative border-2 border-dashed border-slate-300 hover:border-brand-blue rounded-3xl p-8 sm:p-12 text-center bg-slate-50/60 hover:bg-blue-50/30 transition-all group">
              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={loading}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handlePreview(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />

              <div className="w-16 h-16 rounded-2xl bg-white shadow-md text-brand-blue flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {loading ? 'Analyzing PhilHealth Notice PDF…' : 'Choose a PhilHealth PDF or drag & drop here'}
              </h4>
              <p className="text-xs text-slate-400">PDF notices up to 15MB are supported</p>
            </div>
          </div>

          {/* Instructions Card (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="text-base font-black text-slate-900">How Notice Import Works</h3>

            <div className="space-y-4 text-xs">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Direct Document Reading</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    The PDF parser reads control numbers, release dates, and compliance deadlines across all pages.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Duplicate Protection</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Matches against 13-digit series numbers and existing compliance dates to prevent duplicate entries.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Instant Database Commit</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Preview all extracted rows, pick claims, and commit directly to Supabase with full audit logs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Notice Preview Screen */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-brand-blue text-white text-[10px] font-black tracking-wider uppercase">
                  {preview.type} Notice Preview
                </span>
                <span className="text-xs font-bold text-slate-600">{preview.filename}</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Extracted {preview.rows.length} Claim Records
              </h3>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Upload Different PDF
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || selectedIndices.size === 0}
                className="px-5 py-2 rounded-xl bg-brand-blue hover:bg-navy text-white text-xs font-bold shadow-md shadow-brand-blue/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {importing ? 'Importing…' : `Confirm & Import (${selectedIndices.size})`}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Meta Summaries */}
          <div className="flex flex-wrap gap-2 text-xs">
            {preview.notices.map((n, i) => (
              <span key={i} className="px-3 py-1.5 rounded-xl bg-blue-50 text-slate-800 font-bold border border-blue-100">
                Page {n.page}: Control No. <b>{n.controlNumber || '—'}</b> · Released <b>{n.noticeDate || '—'}</b> ·
                Deadline <b>{n.deadline || '—'}</b>
              </span>
            ))}
            {preview.duplicateCount > 0 && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {preview.duplicateCount} duplicate(s) unselected by default
              </span>
            )}
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 z-10">
                <tr>
                  <th className="py-3 px-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIndices.size === preview.rows.length && preview.rows.length > 0}
                      onChange={e => toggleSelectAll(e.target.checked)}
                      className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                    />
                  </th>
                  <th className="py-3 px-4">Series Number</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Cat</th>
                  <th className="py-3 px-4">Confinement Dates</th>
                  <th className="py-3 px-4 text-right">Claim Amount</th>
                  <th className="py-3 px-4">Deficiency / Remarks</th>
                  <th className="py-3 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {preview.rows.map((r, i) => {
                  const isSelected = selectedIndices.has(i);
                  return (
                    <tr
                      key={i}
                      onClick={() => toggleRow(i)}
                      className={`cursor-pointer transition-colors ${
                        r.duplicate ? 'bg-amber-50/40' : isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(i)}
                          className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {r.seriesNumber}
                        {r.duplicate && (
                          <span className="block text-[9px] font-black text-amber-700 uppercase">Duplicate Cycle</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.patientName}</td>
                      <td className="py-3 px-4 text-slate-600 font-bold">{r.memberCategory}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.admitted} – {r.discharged}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₱{formatCurrency(r.claimAmount)}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={r.deficiency}>
                        {r.deficiency}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.deadline || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
