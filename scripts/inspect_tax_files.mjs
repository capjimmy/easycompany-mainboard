import xlsx from 'xlsx';
import fs from 'fs';

// 회사별 메인 파일들만
const mainFiles = [
  '세금계산서/건설경제연구원/2024년/(사)건설경제연구원_2024년계약 및 입금현황.xlsx',
  '세금계산서/건설경제연구원/2025년/(사)건설경제연구원_2025년계약 및 입금현황.xlsx',
  '세금계산서/건설경제연구원/2026년/(사)건설경제연구원_2026년계약 및 입금현황.xlsx',
  '세금계산서/건설환경연구소/2025년/건설환경연구소_2025년계약 및 입금현황.xlsx',
  '세금계산서/건설환경연구소/2026년/건설환경연구소_2026년계약 및 입금현황.xlsx',
  '세금계산서/이지컨설턴트/2024년/(주)이지컨설턴트_2024년 매출계산서발행 및 입금현황.xlsx',
  '세금계산서/이지컨설턴트/2025년/(주)이지컨설턴트_2025년 매출계산서발행 및 입금현황.xlsx',
];

for (const file of mainFiles) {
  if (!fs.existsSync(file)) { console.log(`❌ 없음: ${file}`); continue; }
  console.log(`\n=== ${file.split('/').pop()} ===`);
  const wb = xlsx.readFile(file);
  console.log('  시트:', wb.SheetNames.slice(0, 5));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log('  행수:', rows.length);
  console.log('  첫 6행:');
  rows.slice(0, 6).forEach((r, i) => {
    const compact = r.filter(c => c !== null).slice(0, 12);
    console.log(`    ${i}: ${JSON.stringify(compact).slice(0, 200)}`);
  });
}
