import fs from 'fs';

console.log('Checking available summary files...');
const files = [
  '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026\\SUMMARY_RTH_DENIED 2026.xlsx',
  '\\\\192.168.12.80\\phic\\NIGEL\\RTH-DENIED NOTICE\\2026\\Copy of SUMMARY_RTH_DENIED 2026.xlsx'
];

for (const f of files) {
  if (fs.existsSync(f)) {
    const stats = fs.statSync(f);
    console.log(`Found: ${f} (${stats.size} bytes)`);
  }
}
