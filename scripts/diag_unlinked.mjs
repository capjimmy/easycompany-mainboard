import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const tis = await fetchAll('tax_invoices', 'id, company_id, contract_id, buyer_name, item_description');
const contracts = await fetchAll('contracts', 'id, company_id, client_company');
const unlinked = tis.filter(t => !t.contract_id);

// 거래처명 TOP 분포
const buyers = {};
unlinked.forEach(t => buyers[t.buyer_name || '(empty)'] = (buyers[t.buyer_name || '(empty)'] || 0) + 1);
console.log('미연결 세금계산서 거래처 TOP 20:');
Object.entries(buyers).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([n,c]) => console.log(`  ${c}: ${n}`));

// contracts에 동일 거래처 있는지 확인
console.log('\n--- 매칭 검증 ---');
const sample = Object.entries(buyers).sort((a,b)=>b[1]-a[1]).slice(0,5);
for (const [name, _] of sample) {
  const found = contracts.filter(c => c.client_company && c.client_company.includes(name.slice(0,4)));
  console.log(`\n"${name}" → contracts에서 ${found.length}건 발견`);
  found.slice(0,3).forEach(c => console.log(`  - ${c.client_company}`));
}
