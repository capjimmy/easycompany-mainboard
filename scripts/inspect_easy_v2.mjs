// Detailed inspection of all easy data files
import xlsx from 'xlsx';

const DIR = 'C:/Users/parkm/easy_company/mainboard/자료 26-04-27/이지컨설턴트 자료/';

function showSheet(wb, name, maxRows = 8) {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`  [없음] ${name}`); return; }
  const r = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n--- 시트: ${name} (${r.length}행) ---`);
  r.slice(0, maxRows).forEach((row, i) => {
    if (!row) return;
    const c = row.map(x => x === null ? '∅' : String(x).slice(0, 30));
    console.log(`  ${i}: [${c.length}] ${JSON.stringify(c).slice(0, 350)}`);
  });
}

console.log('========== 1) 용역진행률 ==========');
const wb1 = xlsx.readFile(DIR + '# 251016 (주)이지 용역진행률_발행·수금 260305 15시까지 업데이트.xlsx');
console.log('시트:', wb1.SheetNames);
for (const s of wb1.SheetNames) showSheet(wb1, s, 6);

console.log('\n\n========== 2) 친환경 수주 ==========');
const wb2 = xlsx.readFile(DIR + '# 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx');
console.log('시트:', wb2.SheetNames);
// Show 2 examples
showSheet(wb2, wb2.SheetNames[0], 8);
if (wb2.SheetNames.find(s => s.startsWith('건환'))) {
  showSheet(wb2, wb2.SheetNames.find(s => s.startsWith('건환')), 8);
}

console.log('\n\n========== 3) 인증수수료 ==========');
const wb3 = xlsx.readFile(DIR + '(주)이지-인증수수료 지급현황.xlsx');
console.log('시트:', wb3.SheetNames);
showSheet(wb3, wb3.SheetNames[0], 8);
showSheet(wb3, wb3.SheetNames[wb3.SheetNames.length - 1], 8);

console.log('\n\n========== 4) 계약서 목록 2025 ==========');
const wb4 = xlsx.readFile(DIR + '계약서 목록 2025.xlsx');
console.log('시트:', wb4.SheetNames);
for (const s of wb4.SheetNames) showSheet(wb4, s, 8);

console.log('\n\n========== 5) 계약서 목록 2026 ==========');
const wb5 = xlsx.readFile(DIR + '계약서 목록 2026.xlsx');
console.log('시트:', wb5.SheetNames);
for (const s of wb5.SheetNames) showSheet(wb5, s, 8);
