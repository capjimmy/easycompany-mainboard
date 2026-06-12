import fs from 'fs';
const p = JSON.parse(fs.readFileSync('c:/Users/parkm/easy_company/정제된데이터/projects_trusted_only.json', 'utf-8'));
console.log('총:', p.length);

// contract_date 분포
const bad = p.filter(x => x.contract_date && !/^\d{4}-\d{2}-\d{2}$/.test(x.contract_date));
console.log(`\n잘못된 날짜 형식: ${bad.length}건`);
bad.slice(0,10).forEach(x => console.log(`  "${x.contract_date}" | ${x.client_name} | ${x.project_name?.slice(0,30)}`));

const nullDate = p.filter(x => !x.contract_date);
console.log(`\nnull 날짜: ${nullDate.length}건`);

// source_year 분포
const byYear = {};
p.forEach(x => { const y = x.contract_date?.slice(0,4) || 'NULL'; byYear[y] = (byYear[y]||0)+1; });
console.log('\n연도별:', byYear);
