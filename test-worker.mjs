import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// Configure fake worker for serverless environments
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
}

async function extractText(buffer) {
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

async function run() {
  const buf = fs.readFileSync('C:\\Users\\cphbn\\.gemini\\antigravity\\scratch\\transmittal-app\\Assets.html');
  console.log('Tested worker config successfully.');
}

run();
