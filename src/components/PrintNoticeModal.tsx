'use client';
import React from 'react';
import { X, Printer } from 'lucide-react';
import { BaseRecord } from '@/lib/types';
import { HOSPITAL_NAME, SECTION_NAME } from '@/lib/assets';
import { formatCurrency } from '@/lib/calculations';

interface PrintNoticeModalProps {
  records: BaseRecord[];
  onClose: () => void;
}

export default function PrintNoticeModal({ records, onClose }: PrintNoticeModalProps) {
  function handlePrint() {
    window.print();
  }

  const totalAmount = records.reduce((sum, r) => sum + (r.claimAmount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print-container-overlay">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden print-container-card">
        {/* Modal Head (Hidden during print) */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-base font-black text-slate-900">Print Transmittal Slip & Checklist</h3>
            <p className="text-xs text-slate-500 font-medium">{records.length} claim(s) selected for printing</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-navy text-white text-xs font-bold shadow-md shadow-brand-blue/20 flex items-center gap-2 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              Print Document
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible">
          {/* Header (Dual Official Seals) */}
          <div className="flex items-center justify-between gap-4 pb-5 print:pb-3 border-b-2 border-slate-900">
            <img
              src="/cebu_seal.png"
              alt="Province of Cebu Seal"
              className="w-20 h-20 print:w-14 print:h-14 object-contain shrink-0"
            />
            <div className="text-center flex-1">
              <p className="text-[11px] print:text-[10px] uppercase font-bold text-slate-500 tracking-widest">Republic of the Philippines · Province of Cebu</p>
              <h2 className="text-xl print:text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">{HOSPITAL_NAME}</h2>
              <p className="text-xs print:text-[11px] font-bold text-slate-700">{SECTION_NAME}</p>
              <h3 className="text-sm print:text-xs font-black text-brand-blue print:text-slate-900 mt-1 print:mt-0.5 uppercase tracking-wider">
                PHILHEALTH NOTICE TRANSMITTAL & COMPLIANCE REPORT
              </h3>
              <p className="text-[10px] print:text-[9px] text-slate-400 print:text-slate-600 mt-0.5 font-semibold">
                Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <img
              src="/cph_logo.png"
              alt="CPH Balamban Hospital Seal"
              className="w-20 h-20 print:w-14 print:h-14 object-contain shrink-0"
            />
          </div>

          {/* Table */}
          <div className="mt-6 print:mt-3">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black bg-slate-50 print:bg-transparent">
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5 w-10">No.</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5">Series Number</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5 whitespace-nowrap">Date Claim Received</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5">Patient Name</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5">Cat</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5 whitespace-nowrap">Confinement</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5 text-right">Claim Amount</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5">Deficiency</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5 whitespace-nowrap">Deadline</th>
                  <th className="py-2.5 px-3 print:py-1 print:px-1.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {records.map((r, i) => (
                  <tr key={r.id || i} className="align-top print:break-inside-avoid break-inside-avoid">
                    <td className="py-2 px-3 print:py-1 print:px-1.5 font-bold text-slate-500">{i + 1}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 font-black text-slate-900 whitespace-nowrap">{r.reference}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 text-slate-700 whitespace-nowrap">{r.claimReceivedDate || '—'}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 font-bold text-slate-800">{r.patientName}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 font-semibold text-slate-600">{r.memberCategory}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 whitespace-nowrap text-slate-700">
                      {r.admittedDate} – {r.dischargedDate}
                    </td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₱{formatCurrency(r.claimAmount)}
                    </td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 text-[11px] print:text-[10px] text-slate-700 leading-snug">{r.deficiency}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 font-black text-slate-900 whitespace-nowrap">{r.expiryDate}</td>
                    <td className="py-2 px-3 print:py-1 print:px-1.5 text-[11px] print:text-[10px] text-slate-700 italic">{r.remarks || '—'}</td>
                  </tr>
                ))}
                {/* Total Summary Row (Inside tbody so it NEVER repeats across page breaks) */}
                <tr className="border-t-2 border-slate-900 font-black text-xs bg-slate-50/80 print:bg-transparent print:break-inside-avoid break-inside-avoid">
                  <td colSpan={6} className="py-2 px-2.5 uppercase text-right print:py-1 print:px-1.5">
                    Total Amount ({records.length} claim{records.length > 1 ? 's' : ''}):
                  </td>
                  <td className="py-2 px-2.5 text-right text-sm font-black print:py-1 print:px-1.5">₱{formatCurrency(totalAmount)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures (Prevent splitting across pages) */}
          <div className="grid grid-cols-2 gap-12 mt-6 pt-6 border-t border-slate-300 text-xs print:mt-3 print:pt-3 print:break-inside-avoid break-inside-avoid">
            <div>
              <p className="font-bold text-slate-700 mb-8 print:mb-4">Prepared / Transmitted By:</p>
              <div className="border-b border-slate-900 w-56" />
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">PhilHealth Billing Staff / Transmitter</p>
            </div>
            <div>
              <p className="font-bold text-slate-700 mb-8 print:mb-4">Noted / Received By:</p>
              <div className="border-b border-slate-900 w-56" />
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">PhilHealth Section Head / Liaison</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
