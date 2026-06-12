import xlsx from 'xlsx';

// 파일 1: 친환경 수주 현황 (가장 정보 풍부)
console.log('========== 친환경 수주 ==========');
const wb1 = xlsx.readFile('자료 26-04-27/이지컨설턴트 자료/# 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx');
console.log('시트 수:', wb1.SheetNames.length);
console.log('샘플 시트 (24(공모)):');
const ws1 = wb1.Sheets['24(공모)'];
const r1 = xlsx.utils.sheet_to_json(ws1, { header: 1, defval: null });
console.log(`  행수: ${r1.length}`);
r1.slice(0, 8).forEach((r, i) => {
  const c = r.filter(x => x !== null).slice(0, 15);
  if (c.length > 0) console.log(`  ${i}: ${JSON.stringify(c).slice(0, 250)}`);
});

// 파일 2: 용역진행률 (계약현황 시트)
console.log('\n========== 용역진행률 / 계약현황 ==========');
const wb2 = xlsx.readFile('자료 26-04-27/이지컨설턴트 자료/# 251016 (주)이지 용역진행률_발행·수금 260305 15시까지 업데이트.xlsx');
const ws2 = wb2.Sheets['계약현황'];
const r2 = xlsx.utils.sheet_to_json(ws2, { header: 1, defval: null });
console.log(`행수: ${r2.length}`);
r2.slice(0, 6).forEach((r, i) => {
  const c = r.filter(x => x !== null).slice(0, 15);
  if (c.length > 0) console.log(`  ${i}: ${JSON.stringify(c).slice(0, 250)}`);
});

// 파일 3: 인증수수료 지급
console.log('\n========== 인증수수료 (외주) ==========');
const wb3 = xlsx.readFile('자료 26-04-27/이지컨설턴트 자료/(주)이지-인증수수료 지급현황.xlsx');
console.log('시트:', wb3.SheetNames);
const ws3 = wb3.Sheets['2024년'];
const r3 = xlsx.utils.sheet_to_json(ws3, { header: 1, defval: null });
console.log(`행수: ${r3.length}`);
r3.slice(0, 8).forEach((r, i) => {
  const c = r.filter(x => x !== null).slice(0, 12);
  if (c.length > 0) console.log(`  ${i}: ${JSON.stringify(c).slice(0, 250)}`);
});
