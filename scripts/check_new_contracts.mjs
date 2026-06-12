import fs from 'fs';
const c = JSON.parse(fs.readFileSync('release/contracts.json', 'utf-8'));
console.log('총:', c.length);
console.log('첫 레코드 키:', Object.keys(c[0] || {}));
console.log('\n첫 3건:');
c.slice(0, 3).forEach((r, i) => console.log(`\n[${i}]`, JSON.stringify(r, null, 2).slice(0, 500)));

// 통계
console.log('\n=== 통계 ===');
console.log(`contract_date: ${c.filter(x=>x.contract_date).length}/${c.length}`);
console.log(`start_date: ${c.filter(x=>x.start_date).length}`);
console.log(`end_date: ${c.filter(x=>x.end_date).length}`);
console.log(`client_name: ${c.filter(x=>x.client_name).length}`);
console.log(`project_name: ${c.filter(x=>x.project_name).length}`);
console.log(`total_amount: ${c.filter(x=>x.total_amount).length}`);
console.log(`payment_conditions 있음: ${c.filter(x=>x.payment_conditions?.length>0).length}`);
console.log(`items 있음: ${c.filter(x=>x.items?.length>0).length}`);

// 회사별
const byCo = {};
c.forEach(x => byCo[x.company || 'NULL'] = (byCo[x.company || 'NULL'] || 0) + 1);
console.log('회사별:', byCo);
