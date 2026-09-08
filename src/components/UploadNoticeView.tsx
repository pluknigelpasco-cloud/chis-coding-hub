"use client";
import React, { useState, useRef } from "react";
import {
  UploadCloud, CheckCircle2, AlertCircle, FileText,
  ArrowRight, X, Plus, Loader2
} from "lucide-react";
import { NoticePdfPreviewResult, NoticePdfRow } from "@/lib/types";
import { useToast } from "./Toast";
import { formatCurrency } from "@/lib/calculations";

interface FileResult {
  file: File;
  result: NoticePdfPreviewResult;
}

export default function UploadNoticeView({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [noticeType, setNoticeType] = useState<"RTH" | "DENIED">("RTH");
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Per-row selection: key = `fileIndex-rowIndex`
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Merge all rows with file tracking
  const allRows: Array<NoticePdfRow & { fileIdx: number; rowIdx: number; filename: string }> =
    fileResults.flatMap((fr, fi) =>
      fr.result.rows.map((r, ri) => ({ ...r, fileIdx: fi, rowIdx: ri, filename: fr.file.name }))
    );

  const totalDuplicates = fileResults.reduce((s, fr) => s + (fr.result.duplicateCount || 0), 0);
  const selectedRows = allRows.filter(r => selectedKeys.has(`${r.fileIdx}-${r.rowIdx}`));

  async function processFile(file: File): Promise<void> {
    setProcessingFiles(prev => [...prev, file.name]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("noticeType", noticeType);

      const res = await fetch("/api/notices/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to parse PDF.");

      setFileResults(prev => {
        // Check if file already added (by name)
        if (prev.some(fr => fr.file.name === file.name)) return prev;
        const updated = [...prev, { file, result: data }];

        // Auto-select non-duplicates
        const newKeys = new Set(selectedKeys);
        const fileIdx = updated.length - 1;
        data.rows.forEach((r: NoticePdfRow, ri: number) => {
          if (!r.duplicate) newKeys.add(`${fileIdx}-${ri}`);
        });
        setSelectedKeys(newKeys);

        return updated;
      });

      toast(`✓ ${file.name}: ${data.rows.length} row(s) parsed`);
    } catch (err: any) {
      toast(`${file.name}: ${err?.message || "Error parsing PDF"}`, true);
    } finally {
      setProcessingFiles(prev => prev.filter(n => n !== file.name));
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !files.length) return;
    const pdfs = Array.from(files).filter(
      f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      toast("Please select PDF files only.", true);
      return;
    }
    // Process all files in parallel
    await Promise.all(pdfs.map(f => processFile(f)));
  }

  function removeFile(fileIdx: number) {
    setFileResults(prev => {
      const updated = prev.filter((_, i) => i !== fileIdx);
      // Re-build selected keys for remaining files
      const newKeys = new Set<string>();
      updated.forEach((fr, newFi) => {
        fr.result.rows.forEach((r, ri) => {
          // Map old indices to new
          const oldFi = fileIdx <= newFi ? newFi + 1 : newFi;
          if (selectedKeys.has(`${oldFi}-${ri}`)) {
            newKeys.add(`${newFi}-${ri}`);
          }
        });
      });
      setSelectedKeys(newKeys);
      return updated;
    });
  }

  function toggleRow(fileIdx: number, rowIdx: number) {
    const key = `${fileIdx}-${rowIdx}`;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const all = new Set<string>();
      allRows.forEach(r => all.add(`${r.fileIdx}-${r.rowIdx}`));
      setSelectedKeys(all);
    } else {
      setSelectedKeys(new Set());
    }
  }

  function handleReset() {
    setFileResults([]);
    setSelectedKeys(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleConfirmImport() {
    if (!selectedRows.length) {
      toast("Please select at least one row to import.", true);
      return;
    }

    setImporting(true);
    let totalImported = 0;
    let errors: string[] = [];

    try {
      // Group by file (each file may have different control numbers)
      const byFile = new Map<number, typeof selectedRows>();
      selectedRows.forEach(r => {
        if (!byFile.has(r.fileIdx)) byFile.set(r.fileIdx, []);
        byFile.get(r.fileIdx)!.push(r);
      });

      for (const [fileIdx, rows] of byFile.entries()) {
        const fr = fileResults[fileIdx];
        if (!fr) continue;

        const controlNums = fr.result.notices
          .map(n => n.controlNumber)
          .filter(Boolean)
          .join(", ");

        try {
          const res = await fetch("/api/notices/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: fr.result.type,
              filename: fr.file.name,
              rows,
              controlNumbers: controlNums,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error);
          totalImported += data.imported || rows.length;
        } catch (err: any) {
          errors.push(`${fr.file.name}: ${err?.message}`);
        }
      }

      if (errors.length) {
        toast(`Imported ${totalImported} records. Errors: ${errors.join("; ")}`, true);
      } else {
        toast(`✅ Successfully imported ${totalImported} record(s) from ${byFile.size} file(s)!`);
      }

      handleReset();
      onSuccess();
    } catch (err: any) {
      toast(err?.message || "Import error", true);
    } finally {
      setImporting(false);
    }
  }

  const hasFiles = fileResults.length > 0;
  const isProcessing = processingFiles.length > 0;

  return (
    <div className="space-y-6">
      {/* Upload Zone + Type Selector */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Upload Card */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          <div>
            <h3 className="text-lg font-black text-slate-900">Import PhilHealth PDF Notice(s)</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select <strong>multiple PDFs</strong> at once — all will be parsed and merged into one preview.
            </p>
          </div>

          {/* Notice Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setNoticeType("RTH")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                noticeType === "RTH"
                  ? "border-brand-blue bg-blue-50/60 ring-2 ring-brand-blue/10 shadow-sm"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="block font-black text-sm text-slate-900">↩ RTH Notice</span>
              <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                Claims for compliance &amp; refiling countdown.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setNoticeType("DENIED")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                noticeType === "DENIED"
                  ? "border-brand-blue bg-blue-50/60 ring-2 ring-brand-blue/10 shadow-sm"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="block font-black text-sm text-slate-900">⊘ Denied Notice</span>
              <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                Motion for reconsideration transmission tracker.
              </span>
            </button>
          </div>

          {/* Drag and Drop Zone */}
          <div className="relative border-2 border-dashed border-slate-300 hover:border-brand-blue rounded-3xl p-8 text-center bg-slate-50/60 hover:bg-blue-50/30 transition-all group">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={isProcessing}
              onChange={e => handleFilesSelected(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="w-14 h-14 rounded-2xl bg-white shadow-md text-brand-blue flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              {isProcessing ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <UploadCloud className="w-7 h-7" />
              )}
            </div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">
              {isProcessing
                ? `Processing ${processingFiles.length} file(s)…`
                : hasFiles
                ? "Drop more PDFs here to add"
                : "Choose PDFs or drag & drop here"}
            </h4>
            <p className="text-xs text-slate-400">
              Multiple PDFs supported · Up to 15MB each
            </p>
            {processingFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                {processingFiles.map(name => (
                  <div key={name} className="flex items-center justify-center gap-2 text-xs text-blue-600 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loaded Files List */}
          {hasFiles && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Loaded PDFs ({fileResults.length})
              </p>
              {fileResults.map((fr, fi) => (
                <div
                  key={fi}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{fr.file.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {fr.result.rows.length} row(s) · {fr.result.type} ·
                      {fr.result.duplicateCount > 0 && (
                        <span className="text-amber-600 font-bold"> {fr.result.duplicateCount} duplicate(s)</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(fi)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info / Summary Card */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          <h3 className="text-base font-black text-slate-900">Upload Summary</h3>

          {hasFiles ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
                  <p className="text-slate-500 font-semibold">Files Loaded</p>
                  <p className="text-2xl font-black text-brand-blue">{fileResults.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-slate-500 font-semibold">Total Rows</p>
                  <p className="text-2xl font-black text-emerald-700">{allRows.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-500 font-semibold">Selected</p>
                  <p className="text-2xl font-black text-slate-800">{selectedRows.length}</p>
                </div>
                {totalDuplicates > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-slate-500 font-semibold">Duplicates</p>
                    <p className="text-2xl font-black text-amber-700">{totalDuplicates}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || selectedRows.length === 0}
                className="w-full py-3 rounded-2xl bg-brand-blue hover:bg-navy text-white text-sm font-black shadow-md shadow-brand-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Import {selectedRows.length} Selected Record(s)</>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Clear All &amp; Start Over
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">1</div>
                <div>
                  <h5 className="font-bold text-slate-800">Select Multiple PDFs</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Hold <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">Ctrl</kbd> or{" "}
                    <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">Shift</kbd> when
                    selecting to pick multiple files at once.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">2</div>
                <div>
                  <h5 className="font-bold text-slate-800">Review Merged Preview</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    All PDFs will be parsed and combined into one table. Duplicates are auto-deselected.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-brand-blue font-black flex items-center justify-center shrink-0">3</div>
                <div>
                  <h5 className="font-bold text-slate-800">One-Click Import All</h5>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Confirm and import all selected rows from all files simultaneously.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merged Preview Table */}
      {hasFiles && allRows.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Combined Preview — {allRows.length} Total Row(s)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {fileResults.length} file(s) merged · {selectedRows.length} selected for import
              </p>
            </div>
            {totalDuplicates > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {totalDuplicates} duplicate(s) skipped
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[600px]">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 z-10">
                <tr>
                  <th className="py-3 px-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedKeys.size === allRows.length && allRows.length > 0}
                      onChange={e => toggleSelectAll(e.target.checked)}
                      className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                    />
                  </th>
                  <th className="py-3 px-4">File</th>
                  <th className="py-3 px-4">Series Number</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Cat</th>
                  <th className="py-3 px-4">Confinement</th>
                  <th className="py-3 px-4 text-right">Claim Amount</th>
                  <th className="py-3 px-4">Deficiency</th>
                  <th className="py-3 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {allRows.map((r, idx) => {
                  const key = `${r.fileIdx}-${r.rowIdx}`;
                  const isSelected = selectedKeys.has(key);
                  return (
                    <tr
                      key={idx}
                      onClick={() => toggleRow(r.fileIdx, r.rowIdx)}
                      className={`cursor-pointer transition-colors ${
                        r.duplicate
                          ? "bg-amber-50/50 opacity-70"
                          : isSelected
                          ? "bg-blue-50/40"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(r.fileIdx, r.rowIdx)}
                          className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] max-w-[120px] truncate" title={r.filename}>
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{r.filename}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {r.seriesNumber}
                        {r.duplicate && (
                          <span className="block text-[9px] font-black text-amber-700 uppercase">Duplicate</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.patientName}</td>
                      <td className="py-3 px-4 font-bold text-slate-600">{r.memberCategory}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {r.admitted} – {r.discharged}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₱{formatCurrency(r.claimAmount)}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-slate-600" title={r.deficiency}>
                        {r.deficiency}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                        {r.deadline || "—"}
                      </td>
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
