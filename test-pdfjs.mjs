import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

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

async function testAll() {
  const dir = '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026\\JULY 2026';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files in network share.`);

  for (const f of files) {
    const fullPath = `${dir}\\${f}`;
    const buf = fs.readFileSync(fullPath);
    try {
      const text = await extractTextFromPdf(buf);
      console.log(`\n✅ SUCCESS reading ${f}: ${text.length} chars`);
      const isRth = text.includes('RTH NOTICE');
      const isDenied = text.includes('DENIED NOTICE');
      console.log(`   Type: ${isRth ? 'RTH' : isDenied ? 'DENIED' : 'UNKNOWN'}`);
      console.log(`   Sample snippet: ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
    } catch (err) {
      console.error(`❌ FAILED reading ${f}:`, err.message);
    }
  }
}

testAll();
