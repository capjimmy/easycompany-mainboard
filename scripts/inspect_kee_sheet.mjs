import xlsx from 'xlsx';
const file = '세금계산서/건설경제연구원/2024년/(사)건설경제연구원_2024년계약 및 입금현황.xlsx';
const wb = xlsx.readFile(file);
console.log('시트:', wb.SheetNames);
for (const sn of ['법인매출계산서', '(사단)계약현황']) {
  if (!wb.Sheets[sn]) continue;
  console.log(`\n=== ${sn} ===`);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
  console.log('행수:', rows.length);
  rows.slice(0, 8).forEach((r, i) => console.log(`  ${i}: ${JSON.stringify(r).slice(0, 280)}`));
}

console.log('\n\n=== 건설환경연구소 세금계산서 시트 ===');
const file2 = '세금계산서/건설환경연구소/2025년/건설환경연구소_2025년계약 및 입금현황.xlsx';
const wb2 = xlsx.readFile(file2);
console.log('시트:', wb2.SheetNames);
for (const sn of ['세금계산서', '계약현황']) {
  if (!wb2.Sheets[sn]) continue;
  console.log(`\n--- ${sn} ---`);
  const rows = xlsx.utils.sheet_to_json(wb2.Sheets[sn], { header: 1, defval: null });
  console.log('행수:', rows.length);
  rows.slice(0, 8).forEach((r, i) => console.log(`  ${i}: ${JSON.stringify(r).slice(0, 280)}`));
}
