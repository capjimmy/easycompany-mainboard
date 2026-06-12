import xlsx from 'xlsx';
const wb = xlsx.readFile('견적서 빈 양식.xlsx');
console.log('시트:', wb.SheetNames);
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=== ${sn} (${rows.length}행) ===`);
  rows.slice(0, 15).forEach((r, i) => {
    const compact = r.filter(c => c !== null).slice(0, 8);
    if (compact.length > 0) console.log(`  ${i}: ${JSON.stringify(compact).slice(0, 200)}`);
  });
}
// 이미지 확인
console.log('\n=== 이미지 ===');
const images = wb.Sheets[wb.SheetNames[0]]['!images'] || [];
console.log('!images:', images.length);
// Drawing 확인
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const keys = Object.keys(ws).filter(k => k.startsWith('!'));
  console.log(`${sn} 메타:`, keys);
}
