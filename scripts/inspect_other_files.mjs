import xlsx from 'xlsx';

const files = [
  '건설환경연구소_근로자명부.xlsx',
  '어반브릿지파트너스_현직원명부.xlsx',
  '이지건축사사무소_근로자명부.xlsx',
  '(주)이지컨설턴트_근로자명부 2026.xlsx',
];

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const wb = xlsx.readFile(file);
  console.log('  시트:', wb.SheetNames.slice(0, 5));
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(firstSheet, { header: 1, defval: null });
  console.log(`  첫시트 행수: ${rows.length}`);
  rows.slice(0, 4).forEach((r, i) => console.log(`    ${i}: ${JSON.stringify(r).slice(0, 250)}`));
}
