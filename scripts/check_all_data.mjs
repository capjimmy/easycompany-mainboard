import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const tables = ['contracts','contract_subtasks','payment_conditions','client_companies','client_contacts','outsourcings','tax_invoices','payment_receipts'];
console.log('=== 전체 테이블 현황 ===');
for (const t of tables) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count}건`);
}

const { data: cos } = await sb.from('companies').select('id, name');
console.log('\n=== 회사별 계약 ===');
for (const c of cos) {
  const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  if (count > 0) console.log(`  ${c.name}: ${count}건`);
}
