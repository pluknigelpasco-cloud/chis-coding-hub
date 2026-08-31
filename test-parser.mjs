import fs from 'fs';
import pdf from 'pdf-parse';

async function testPdf(filePath, type) {
  console.log(`\n================ Testing: ${filePath} (${type}) ================`);
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  console.log(`Total Pages: ${data.numpages}`);
  console.log('--- Raw Text Sample (First 1500 chars) ---');
  console.log(data.text.slice(0, 1500));
}

async function run() {
  const baseDir = '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026\\JULY 2026';
  try {
    await testPdf(`${baseDir}\\RTH.pdf`, 'RTH');
    await testPdf(`${baseDir}\\DENIED.pdf`, 'DENIED');
    await testPdf(`${baseDir}\\P_640901_1783307663_8 (1).pdf`, 'RTH');
    await testPdf(`${baseDir}\\D_640901_1784170081_7.pdf`, 'DENIED');
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
