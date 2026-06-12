import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

console.log('=== 최종 상태 ===\n');

// 세금계산서
const tis = await fetchAll('tax_invoices', 'id, contract_id, status');
const tiLinked = tis.filter(t => t.contract_id).length;
const tiPaid = tis.filter(t => t.status === 'paid').length;
const tiPaidLinked = tis.filter(t => t.status === 'paid' && t.contract_id).length;
console.log(`tax_invoices: ${tis.length}`);
console.log(`  contract_id 매칭: ${tiLinked} (${(tiLinked/tis.length*100).toFixed(1)}%)`);
console.log(`  paid: ${tiPaid}`);
console.log(`  paid+linked: ${tiPaidLinked}`);

// 계약
const contracts = await fetchAll('contracts', 'id, company_id, department_id, total_amount, received_amount');
console.log(`\ncontracts: ${contracts.length}`);

// 회사별 부서 배정
const { data: companies } = await sb.from('companies').select('id, name');
const easy = companies.find(c => c.name === '이지컨설턴트');
const gunchul = companies.find(c => c.name === '건설경제연구원');
const easyContracts = contracts.filter(c => c.company_id === easy?.id);
const gunchulContracts = contracts.filter(c => c.company_id === gunchul?.id);
console.log(`이지컨설턴트: ${easyContracts.length} / 부서배정: ${easyContracts.filter(c=>c.department_id).length} (${(easyContracts.filter(c=>c.department_id).length/easyContracts.length*100).toFixed(1)}%)`);
console.log(`건설경제연구원: ${gunchulContracts.length} / 부서배정: ${gunchulContracts.filter(c=>c.department_id).length} (${(gunchulContracts.filter(c=>c.department_id).length/gunchulContracts.length*100).toFixed(1)}%)`);

// 거래처
const { count } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`\nclient_companies: ${count}`);

// 수금
const totalAmt = contracts.reduce((s,c) => s+(Number(c.total_amount)||0), 0);
const totalRecv = contracts.reduce((s,c) => s+(Number(c.received_amount)||0), 0);
const withRecv = contracts.filter(c => Number(c.received_amount) > 0).length;
const overP = contracts.filter(c => c.total_amount > 0 && c.received_amount > c.total_amount * 1.1).length;
console.log(`\n총 계약액: ${totalAmt.toLocaleString()}원`);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원 (${(totalRecv/totalAmt*100).toFixed(1)}%)`);
console.log(`수금있는 계약: ${withRecv}/${contracts.length}`);
console.log(`과다수금(110%+): ${overP}`);

// 부서별
const easyDeps = await sb.from('departments').select('id, name').eq('company_id', easy?.id);
const dmap = new Map(easyDeps.data.map(d => [d.id, d.name]));
const byDept = {};
easyContracts.forEach(c => {
  const n = dmap.get(c.department_id) || '미배정';
  byDept[n] = (byDept[n]||0)+1;
});
console.log('\n이지컨설턴트 부서별:', byDept);
