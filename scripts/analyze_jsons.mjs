import fs from 'fs';
const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));
const contracts = JSON.parse(fs.readFileSync('contracts.json', 'utf-8'));

// 부서 매핑 (대표님 확인)
const DEPT_MAP = { 'CON': '건설사업부', 'RES': '학술사업부' };

console.log('=== 부서별 분포 ===');
const deptStats = {};
[...quotes, ...contracts].forEach(r => {
  const k = `${r.company}::${r.department_name || '(미지정)'}`;
  deptStats[k] = (deptStats[k] || 0) + 1;
});
Object.entries(deptStats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

// 금액 이상치 검증
console.log('\n=== quotes 금액 이상치 ===');
const qAbnormal = quotes.filter(q => {
  if (!q.supply_amount || !q.vat || !q.total_amount) return false;
  const expectedVat = q.supply_amount * 0.1;
  return Math.abs(q.vat - expectedVat) > expectedVat * 0.5; // VAT가 공급가액의 5~15% 범위 벗어남
});
console.log(`  VAT 이상치: ${qAbnormal.length}건`);
console.log('  샘플 5건:');
qAbnormal.slice(0, 5).forEach(q => {
  console.log(`    공급가${q.supply_amount?.toLocaleString()} / VAT${q.vat?.toLocaleString()} / 합계${q.total_amount?.toLocaleString()}`);
});

// total_amount > 1억이상 (정상범위 추정)
const qHuge = quotes.filter(q => q.total_amount > 100000000);
const cHuge = contracts.filter(c => c.total_amount > 100000000);
console.log(`\nquotes 1억 초과: ${qHuge.length}건`);
console.log(`contracts 1억 초과: ${cHuge.length}건`);

// 총금액 분포
const qOver10b = quotes.filter(q => q.total_amount > 10_000_000_000).length;
const cOver10b = contracts.filter(c => c.total_amount > 10_000_000_000).length;
console.log(`\nquotes 100억 초과 (이상치 의심): ${qOver10b}건`);
console.log(`contracts 100억 초과 (이상치 의심): ${cOver10b}건`);
console.log('contracts 100억 초과 샘플:');
contracts.filter(c => c.total_amount > 10_000_000_000).slice(0, 5).forEach(c => {
  console.log(`  ${c.client_name} - ${c.total_amount?.toLocaleString()} - ${c.source_file?.slice(-60)}`);
});

// 양호한 레코드 (3개 필드 모두 있음) 카운트
const qClean = quotes.filter(q => q.client_name && q.total_amount && q.quote_date && q.total_amount < 10_000_000_000);
const cClean = contracts.filter(c => c.client_name && c.total_amount && c.contract_date && c.total_amount < 10_000_000_000);
console.log(`\n=== 양호한 레코드 (필수 3개 + 100억 이하) ===`);
console.log(`quotes: ${qClean.length} / ${quotes.length} (${(qClean.length/quotes.length*100).toFixed(1)}%)`);
console.log(`contracts: ${cClean.length} / ${contracts.length} (${(cClean.length/contracts.length*100).toFixed(1)}%)`);

// 회사별 양호 데이터
console.log('\n양호 데이터 회사별:');
const qByCo = {}, cByCo = {};
qClean.forEach(q => qByCo[q.company] = (qByCo[q.company] || 0) + 1);
cClean.forEach(c => cByCo[c.company] = (cByCo[c.company] || 0) + 1);
['건설경제연구원', '이지컨설턴트'].forEach(co => {
  console.log(`  ${co}: 견적 ${qByCo[co]||0}건, 계약 ${cByCo[co]||0}건`);
});

// 양호 데이터 합계
const qCleanSum = qClean.reduce((s, q) => s + q.total_amount, 0);
const cCleanSum = cClean.reduce((s, c) => s + c.total_amount, 0);
console.log(`\n양호 데이터 합계:`);
console.log(`  quotes: ${qCleanSum.toLocaleString()}원`);
console.log(`  contracts: ${cCleanSum.toLocaleString()}원`);

// 부서 매핑 적용 후 부서별
console.log('\n=== 부서 매핑 적용 후 ===');
const mapped = {};
[...qClean, ...cClean].forEach(r => {
  const dept = DEPT_MAP[r.department_name] || r.department_name || '(미지정)';
  const k = `${r.company}::${dept}`;
  mapped[k] = (mapped[k] || 0) + 1;
});
Object.entries(mapped).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
