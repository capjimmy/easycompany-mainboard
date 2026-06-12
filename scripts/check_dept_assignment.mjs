import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, company_id, department_id, contract_number');
const { data: cos } = await sb.from('companies').select('id, name');
const { data: deps } = await sb.from('departments').select('id, name, company_id');
const cmap = new Map(cos.map(c => [c.id, c.name]));
const dmap = new Map(deps.map(d => [d.id, { name: d.name, company_id: d.company_id }]));

console.log('=== 회사별 부서 배정 현황 ===');
for (const c of cos) {
  const myContracts = contracts.filter(x => x.company_id === c.id);
  if (myContracts.length === 0) continue;
  console.log(`\n[${c.name}] 총 ${myContracts.length}건`);
  const byDept = {};
  myContracts.forEach(x => {
    const dn = x.department_id ? (dmap.get(x.department_id)?.name || '(잘못된부서)') : '(미배정)';
    byDept[dn] = (byDept[dn] || 0) + 1;
  });
  Object.entries(byDept).sort((a,b)=>b[1]-a[1]).forEach(([n,cnt]) => console.log(`  ${n}: ${cnt}건`));
}

// 부서가 다른 회사 부서를 참조하는 경우
console.log('\n=== 부서-회사 불일치 확인 ===');
let mismatch = 0;
for (const c of contracts) {
  if (!c.department_id) continue;
  const d = dmap.get(c.department_id);
  if (d && d.company_id !== c.company_id) {
    mismatch++;
  }
}
console.log(`불일치: ${mismatch}건`);
