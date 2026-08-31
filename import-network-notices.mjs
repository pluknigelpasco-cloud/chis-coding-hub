import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const supabaseUrl = 'https://jtcaacarwzggscnmftfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Y2FhY2Fyd3pnZ3Njbm1mdGZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc5NjU4MSwiZXhwIjoyMTAzMzcyNTgxfQ.YWgspRmFhGM6ghsRgp3dSzpEdW92xv5-QTdFPcM7uKE';

const supabase = createClient(supabaseUrl, supabaseKey);

function cleanText(str, maxLen = 1000) {
  return String(str || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function parseAmount(val) {
  const num = Number(String(val || '').replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function formatDateIso(val) {
  if (!val) return null;
  const d = new Date(String(val).replace(/(\w{3})\s+(\d{1,2})\s+(\d{4})/, '$1 $2, $3'));
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }
  const m1 = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[1]}-${m1[2]}`;
  return null;
}

async function extractTextFromPdf(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => ('str' in item ? item.str : ''));
    fullText += strings.join(' ') + '\n';
  }

  return fullText;
}

function parseNoticeSectionRows(section, meta) {
  const startRegex = /(?:^|\s)(\d{1,3})\s*(\d{13})\s*(NS|PS|I|S)\s+/gmi;
  const starts = [];
  let m;
  while ((m = startRegex.exec(section)) !== null) {
    starts.push({ index: m.index, no: Number(m[1]), series: m[2], mem: m[3].toUpperCase() });
  }

  const rows = [];
  starts.forEach((s, i) => {
    let segment = section.slice(s.index, starts[i + 1] ? starts[i + 1].index : section.length);
    const totalAt = segment.search(/\bTOTAL\s*:/i);
    if (totalAt >= 0) segment = segment.slice(0, totalAt);

    const normalized = segment.replace(/\s+/g, ' ').trim();
    const prefix = normalized.match(/^(\d{1,3})\s*(\d{13})\s*(NS|PS|I|S)\s+/i);
    if (!prefix) return;

    const remainder = normalized.slice(prefix[0].length);
    const dates = [];
    const dateRe = /\b\d{2}\/\d{2}\/\d{4}\b/g;
    let dm;
    while ((dm = dateRe.exec(remainder)) !== null) {
      dates.push({ value: dm[0], index: dm.index, end: dateRe.lastIndex });
    }

    if (dates.length < 3) return;
    const admitted = dates[0];
    const discharged = dates[1];
    const received = dates[dates.length - 1];

    const patient = cleanText(remainder.slice(0, admitted.index), 180);
    const middle = remainder.slice(discharged.end, received.index).trim();

    const amountMatches = remainder.match(/([\d,]+\.\d{2})/g) || [];
    let claimAmount = 0;
    let totalCharges = 0;
    if (amountMatches.length >= 2) {
      claimAmount = parseAmount(amountMatches[0]);
      totalCharges = parseAmount(amountMatches[1]);
    }

    const deficiency = middle.replace(/([\d,]+\.\d{2})/g, '').trim();

    rows.push({
      notice_row_no: s.no,
      series_number: s.series,
      member_category: s.mem,
      patient_name: patient,
      admitted_date: formatDateIso(admitted.value),
      discharged_date: formatDateIso(discharged.value),
      claim_amount: claimAmount,
      total_charges: totalCharges,
      deficiency: cleanText(deficiency || middle, 4000),
      claim_received_date: formatDateIso(received.value),
      control_number: meta.controlNumber,
      notice_date: formatDateIso(meta.noticeDate),
      expiry_date: formatDateIso(meta.deadline),
      remarks: `Historical Import | ${meta.controlNumber || 'Notice'}`,
      retrieved: false,
    });
  });

  return rows;
}

function parseNoticeText(rawText, requestedType) {
  let text = String(rawText || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const marker = requestedType === 'RTH' ? 'RTH NOTICE' : 'DENIED NOTICE';
  if (text.toUpperCase().indexOf(marker) === -1) return { rows: [] };

  const regex = new RegExp(marker, 'gi');
  const starts = [];
  let match;
  while ((match = regex.exec(text)) !== null) starts.push(match.index);

  const rows = [];
  starts.forEach((start, pageIndex) => {
    const section = text.slice(start, starts[pageIndex + 1] || text.length);

    const controlMatch =
      requestedType === 'RTH'
        ? section.match(/RTH\s*Control\s*No\.?\s*:\s*([A-Z0-9-]+)/i)
        : section.match(/Denied\s*Claims\s*Control\s*No\.?\s*:\s*([A-Z0-9-]+)/i);

    const noticeDateMatch = section.match(
      /Date\s*(?:Released|Received)\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i
    );

    const deadlineMatch =
      requestedType === 'RTH'
        ? section.match(/For\s*compliance\s*until\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i)
        : section.match(/(?:Deadline|Motion to Reconsideration)[\s\S]{0,80}?until\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i);

    const meta = {
      controlNumber: controlMatch ? controlMatch[1].trim() : '',
      noticeDate: noticeDateMatch ? noticeDateMatch[1] : '',
      deadline: deadlineMatch ? deadlineMatch[1] : '',
    };

    const pageRows = parseNoticeSectionRows(section, meta);
    rows.push(...pageRows);
  });

  return { rows };
}

async function importAllNotices() {
  const rootDir = '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026';
  const monthDirs = fs.readdirSync(rootDir).filter(d => fs.statSync(path.join(rootDir, d)).isDirectory());

  console.log(`Found month folders: ${monthDirs.join(', ')}`);

  let totalRthImported = 0;
  let totalDeniedImported = 0;

  for (const month of monthDirs) {
    const monthPath = path.join(rootDir, month);
    const files = fs.readdirSync(monthPath).filter(f => f.toLowerCase().endsWith('.pdf'));

    console.log(`\n📂 Scanning ${month} (${files.length} PDFs)...`);

    for (const f of files) {
      const fullPath = path.join(monthPath, f);
      try {
        const buf = fs.readFileSync(fullPath);
        const text = await extractTextFromPdf(buf);

        const isRth = text.includes('RTH NOTICE');
        const isDenied = text.includes('DENIED NOTICE');

        if (isRth) {
          const { rows } = parseNoticeText(text, 'RTH');
          if (rows.length) {
            const payload = rows.map(r => ({ ...r, refiled: false }));
            const { error } = await supabase.from('rth_notices').upsert(payload, {
              onConflict: 'series_number,expiry_date',
            });
            if (error) console.error(`   ❌ Error upserting RTH ${f}:`, error.message);
            else {
              totalRthImported += rows.length;
              console.log(`   ✓ RTH ${f}: ${rows.length} rows saved.`);
            }
          }
        }

        if (isDenied) {
          const { rows } = parseNoticeText(text, 'DENIED');
          if (rows.length) {
            const { error } = await supabase.from('denied_notices').upsert(rows, {
              onConflict: 'series_number,expiry_date',
            });
            if (error) console.error(`   ❌ Error upserting Denied ${f}:`, error.message);
            else {
              totalDeniedImported += rows.length;
              console.log(`   ✓ DENIED ${f}: ${rows.length} rows saved.`);
            }
          }
        }
      } catch (err) {
        console.error(`   ❌ Error processing ${f}:`, err.message);
      }
    }
  }

  console.log(`\n=======================================================`);
  console.log(`🎉 BATCH IMPORT COMPLETE:`);
  console.log(`   RTH Claims Saved: ${totalRthImported}`);
  console.log(`   Denied Claims Saved: ${totalDeniedImported}`);
  console.log(`=======================================================`);
}

importAllNotices();
