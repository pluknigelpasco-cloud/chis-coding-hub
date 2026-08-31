import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

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

function normalizePdfDate(val) {
  if (!val) return '';
  const d = new Date(String(val).replace(/(\w{3})\s+(\d{1,2})\s+(\d{4})/, '$1 $2, $3'));
  if (isNaN(d.getTime())) return String(val).trim();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
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

function parseNoticeText(rawText, requestedType) {
  let text = String(rawText || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const marker = requestedType === 'RTH' ? 'RTH NOTICE' : 'DENIED NOTICE';
  if (text.toUpperCase().indexOf(marker) === -1) {
    throw new Error(`The uploaded PDF does not contain '${marker}'.`);
  }

  const regex = new RegExp(marker, 'gi');
  const starts = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    starts.push(match.index);
  }

  const notices = [];
  const rows = [];
  const warnings = [];

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

    const meta = {
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

  return { notices, rows, warnings };
}

function parseRowsFromNoticeSection(section, meta) {
  // Matches row prefix: e.g. "1 2603201201710 NS " or "12603201201710NS "
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
    
    // In PhilHealth notices, the deficiency is between discharged and claim received,
    // and amounts (claim amount, total charges) appear near received or in deficiency.
    const amountMatches = remainder.match(/([\d,]+\.\d{2})/g) || [];
    let claimAmount = 0;
    let totalCharges = 0;
    if (amountMatches.length >= 2) {
      claimAmount = parseAmount(amountMatches[0]);
      totalCharges = parseAmount(amountMatches[1]);
    }

    // Clean deficiency text
    let deficiency = middle.replace(/([\d,]+\.\d{2})/g, '').trim();

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

async function verifyAll() {
  const dir = '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026\\JULY 2026';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

  for (const f of files) {
    const isRth = f.startsWith('P_') || f.startsWith('RTH');
    const type = isRth ? 'RTH' : 'DENIED';
    const buf = fs.readFileSync(`${dir}\\${f}`);
    const text = await extractTextFromPdf(buf);
    const res = parseNoticeText(text, type);
    console.log(`\n📄 ${f} (${type}): Parsed ${res.rows.length} rows, ${res.notices.length} notices.`);
    if (res.rows.length > 0) {
      console.log(`   Sample claim 1: Series=${res.rows[0].seriesNumber}, Patient="${res.rows[0].patientName}", Amount=₱${res.rows[0].claimAmount}, Charges=₱${res.rows[0].totalCharges}`);
    }
  }
}

verifyAll();
