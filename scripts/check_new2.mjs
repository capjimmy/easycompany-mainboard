import fs from 'fs';
const c = JSON.parse(fs.readFileSync('release/contracts.json', 'utf-8'));
console.log('총:', c.length);
console.log('첫 레코드 키:', Object.keys(c[0] || {}));
const today = '2026-04-09';
const future = c.filter(x => x.contract_date && x.contract_date > today);
console.log(`\n미래 날짜: ${future.length}건`);
console.log(`contract_date 있음: ${c.filter(x=>x.contract_date).length}/${c.length}`);
console.log(`start_date 있음: ${c.filter(x=>x.start_date).length}`);
console.log(`end_date 있음: ${c.filter(x=>x.end_date).length}`);
console.log(`project_name 있음: ${c.filter(x=>x.project_name).length}`);
console.log(`client_name 있음: ${c.filter(x=>x.client_name).length}`);
console.log(`total_amount 있음: ${c.filter(x=>x.total_amount).length}`);

const byCo = {};
c.forEach(x => byCo[x.company || 'NULL'] = (byCo[x.company || 'NULL'] || 0) + 1);
console.log('\n회사별:', byCo);

console.log('\n첫 3건:');
c.slice(0,3).forEach((r,i) => console.log(`\n[${i}]`, JSON.stringify(r, null, 2).slice(0, 400)));
