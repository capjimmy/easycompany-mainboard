import fs from 'fs';
const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));
const contracts = JSON.parse(fs.readFileSync('contracts.json', 'utf-8'));

console.log('=== quotes.json ===');
console.log('총 건수:', quotes.length);
console.log('회사별:');
const qByCompany = {};
quotes.forEach(q => qByCompany[q.company || '(미분류)'] = (qByCompany[q.company || '(미분류)'] || 0) + 1);
Object.entries(qByCompany).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
console.log('첫 레코드 키:', Object.keys(quotes[0] || {}));
console.log('첫 레코드 샘플:');
console.log(JSON.stringify(quotes[0], null, 2).slice(0, 800));

console.log('\n=== contracts.json ===');
console.log('총 건수:', contracts.length);
const cByCompany = {};
contracts.forEach(c => cByCompany[c.company || '(미분류)'] = (cByCompany[c.company || '(미분류)'] || 0) + 1);
Object.entries(cByCompany).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
console.log('첫 레코드 키:', Object.keys(contracts[0] || {}));
console.log('첫 레코드 샘플:');
console.log(JSON.stringify(contracts[0], null, 2).slice(0, 800));

// 검증
console.log('\n=== 검증 ===');
const qNoCompany = quotes.filter(q => !q.company).length;
const cNoCompany = contracts.filter(c => !c.company).length;
const qNoClient = quotes.filter(q => !q.client_name).length;
const cNoClient = contracts.filter(c => !c.client_name).length;
const qNoAmount = quotes.filter(q => !q.total_amount).length;
const cNoAmount = contracts.filter(c => !c.total_amount).length;
const qNoDate = quotes.filter(q => !q.quote_date).length;
const cNoDate = contracts.filter(c => !c.contract_date).length;
console.log(`quotes 회사 누락: ${qNoCompany}`);
console.log(`contracts 회사 누락: ${cNoCompany}`);
console.log(`quotes client_name 누락: ${qNoClient}`);
console.log(`contracts client_name 누락: ${cNoClient}`);
console.log(`quotes total_amount 누락: ${qNoAmount}`);
console.log(`contracts total_amount 누락: ${cNoAmount}`);
console.log(`quotes quote_date 누락: ${qNoDate}`);
console.log(`contracts contract_date 누락: ${cNoDate}`);

// 부서 통계
const qDepts = new Set(quotes.map(q => q.department_name).filter(Boolean));
const cDepts = new Set(contracts.map(c => c.department_name).filter(Boolean));
console.log(`\nquotes 부서 unique: ${qDepts.size} - ${[...qDepts].slice(0,10).join(', ')}`);
console.log(`contracts 부서 unique: ${cDepts.size} - ${[...cDepts].slice(0,10).join(', ')}`);

// 거래처 통계
const qClients = new Set(quotes.map(q => q.client_name).filter(Boolean));
const cClients = new Set(contracts.map(c => c.client_name).filter(Boolean));
console.log(`\nquotes 거래처 unique: ${qClients.size}`);
console.log(`contracts 거래처 unique: ${cClients.size}`);

// 금액 합계
const qTotal = quotes.reduce((s, q) => s + (q.total_amount || 0), 0);
const cTotal = contracts.reduce((s, c) => s + (c.total_amount || 0), 0);
console.log(`\nquotes 총금액: ${qTotal.toLocaleString()}원`);
console.log(`contracts 총금액: ${cTotal.toLocaleString()}원`);
