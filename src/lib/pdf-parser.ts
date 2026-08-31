import { NoticePdfMeta, NoticePdfRow } from './types';
import { formatDate } from './calculations';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import 'pdfjs-dist/legacy/build/pdf.worker.js';

function cleanText(str?: string | null, maxLen = 1000): string {
  return String(str || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function parseAmount(val?: string | number | null): number {
  const num = Number(String(val || '').replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function normalizePdfDate(val?: string | null): string {
  if (!val) return '';
  const d = new Date(String(val).replace(/(\w{3})\s+(\d{1,2})\s+(\d{4})/, '$1 $2, $3'));
  if (isNaN(d.getTime())) return String(val).trim();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
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

function parseRowsFromNoticeSection(section: string, meta: NoticePdfMeta): NoticePdfRow[] {
  const startRegex = /(?:^|\s)(\d{1,3})\s*(\d{13})\s*(NS|PS|I|S)\s+/gmi;
  const starts: { index: number; no: number; series: string; mem: string }[] = [];
  let m;
  while ((m = startRegex.exec(section)) !== null) {
    starts.push({ index: m.index, no: Number(m[1]), series: m[2], mem: m[3].toUpperCase() });
  }

  const rows: NoticePdfRow[] = [];
  starts.forEach((s, i) => {
    let segment = section.slice(s.index, starts[i + 1] ? starts[i + 1].index : section.length);
    const totalAt = segment.search(/\bTOTAL\s*:/i);
    if (totalAt >= 0) segment = segment.slice(0, totalAt);

    const normalized = segment.replace(/\s+/g, ' ').trim();
    const prefix = normalized.match(/^(\d{1,3})\s*(\d{13})\s*(NS|PS|I|S)\s+/i);
    if (!prefix) return;

    const remainder = normalized.slice(prefix[0].length);
    const dates: { value: string; index: number; end: number }[] = [];
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
      noticeRowNo: s.no,
      seriesNumber: s.series,
      memberCategory: s.mem,
      patientName: patient,
      admitted: admitted.value,
      discharged: discharged.value,
      claimAmount,
      totalCharges,
      deficiency: cleanText(deficiency || middle, 4000),
      claimReceived: received.value,
      controlNumber: meta.controlNumber,
      noticeDate: meta.noticeDate,
      deadline: meta.deadline,
      page: meta.page,
    });
  });

  return rows;
}

export async function parseNoticePdfBuffer(
  buffer: Buffer,
  requestedType: 'RTH' | 'DENIED'
): Promise<{ notices: NoticePdfMeta[]; rows: NoticePdfRow[]; warnings: string[] }> {
  const rawText = await extractTextFromPdfBuffer(buffer);
  const text = String(rawText || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const marker = requestedType === 'RTH' ? 'RTH NOTICE' : 'DENIED NOTICE';

  if (text.toUpperCase().indexOf(marker) === -1) {
    throw new Error(`The uploaded PDF does not appear to be an official PhilHealth ${marker}.`);
  }

  const regex = new RegExp(marker, 'gi');
  const starts: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    starts.push(match.index);
  }

  const notices: NoticePdfMeta[] = [];
  const rows: NoticePdfRow[] = [];
  const warnings: string[] = [];

  starts.forEach((start, pageIndex) => {
    const section = text.slice(start, starts[pageIndex + 1] || text.length);

    const countMatch =
      requestedType === 'RTH'
        ? section.match(/RTH\s*Count\s*:\s*(\d+)/i)
        : section.match(/Denied\s*Claims\s*Count\s*:\s*(\d+)/i);

    const controlMatch =
      requestedType === 'RTH'
        ? section.match(/RTH\s*Control\s*No\.?\s*:\s*([A-Z0-9-]+)/i)
        : section.match(/Denied\s*Claims\s*Control\s*No\.?\s*:\s*([A-Z0-9-]+)/i);

    const noticeDateMatch =
      section.match(/Date\s*(?:Released|Received)\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i);

    const deadlineMatch =
      requestedType === 'RTH'
        ? section.match(/For\s*compliance\s*until\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i)
        : section.match(/(?:Deadline|Motion to Reconsideration)[\s\S]{0,80}?until\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i);

    const meta: NoticePdfMeta = {
      page: pageIndex + 1,
      expectedCount: countMatch ? Number(countMatch[1]) : null,
      controlNumber: controlMatch ? controlMatch[1].trim() : '',
      noticeDate: noticeDateMatch ? normalizePdfDate(noticeDateMatch[1]) : '',
      deadline: deadlineMatch ? normalizePdfDate(deadlineMatch[1]) : '',
    };

    const pageRows = parseRowsFromNoticeSection(section, meta);
    if (meta.expectedCount !== null && meta.expectedCount !== pageRows.length) {
      warnings.push(`Page ${pageIndex + 1}: expected ${meta.expectedCount}, parsed ${pageRows.length}`);
    }

    notices.push(meta);
    rows.push(...pageRows);
  });

  if (!rows.length) {
    throw new Error('No claim rows were recognized in the uploaded PDF. Please verify the document format.');
  }

  return { notices, rows, warnings };
}
