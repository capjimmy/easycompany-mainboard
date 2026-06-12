// Inspect 친환경 수주 sheet structure for one example
import xlsx from 'xlsx';
const wb = xlsx.readFile('자료 26-04-27/이지컨설턴트 자료/# 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx');

console.log('All sheets:', wb.SheetNames);

// Inspect a fewer/simpler one
for (const name of ['25(공모)', '25(본인증)', '건환', '건환(본인증)', '24(공모)', '제네시스']) {
  const ws = wb.Sheets[name];
  if (!ws) continue;
  const r = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=== ${name} (${r.length}행, 컬럼수: ${r[0]?.length || 0}) ===`);
  // Show header rows (0-6) and a few data rows (7-15)
  for (let i = 0; i < Math.min(15, r.length); i++) {
    if (!r[i]) continue;
    const c = r[i].map(x => x === null ? '' : String(x).slice(0, 25));
    const has = c.some(x => x);
    if (!has) continue;
    console.log(`  ${i}: ${JSON.stringify(c)}`);
  }
}
