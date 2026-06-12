import xlsx from 'xlsx';
import fs from 'fs';

const files = fs.readdirSync('.').filter(f => f.endsWith('.xlsx') && (f.includes('근로') || f.includes('명부')));
console.log('파일 목록:', files);

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const wb = xlsx.readFile(file);
  console.log('  시트:', wb.SheetNames);
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const json = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log(`  [${sn}] 행수: ${json.length}`);
    if (json.length > 0) {
      console.log('  헤더 후보 (첫 5행):');
      json.slice(0, 5).forEach((row, i) => {
        console.log(`    ${i}: ${JSON.stringify(row).slice(0, 200)}`);
      });
    }
  }
}
