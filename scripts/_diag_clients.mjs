import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function fetchAll(t, c='*', f=q=>q) {
  const all=[]; let from=0;
  while(true){
    let q=sb.from(t).select(c).order('id').range(from,from+999);
    q=f(q);
    const {data,error}=await q;
    if(error)throw error;
    if(!data?.length)break;
    all.push(...data);
    if(data.length<1000)break;
    from+=1000;
  }
  return all;
}

const { data: companies } = await sb.from('companies').select('id, name');
const nameOf = new Map(companies.map(c=>[c.id,c.name]));

const clients = await fetchAll('client_companies');
console.log('client_companies 총:', clients.length);

const byType = new Map();
for (const c of clients) byType.set(c.client_type || '(null)', (byType.get(c.client_type || '(null)')||0)+1);
console.log('\nclient_type별:', [...byType]);

const byCo = new Map();
for (const c of clients) {
  const k = `${nameOf.get(c.company_id) || c.company_id?.slice(-4) || 'null'} :: ${c.client_type || '(null)'}`;
  byCo.set(k, (byCo.get(k)||0)+1);
}
console.log('\n회사 × 타입:');
for (const [k,v] of [...byCo].sort()) console.log(`  ${k}: ${v}건`);

// 필드 채워진 비율
const fields = ['name','business_number','ceo_name','address','phone','email','industry'];
console.log('\n필드 채워진 비율:');
for (const f of fields) {
  const n = clients.filter(c => c[f]).length;
  console.log(`  ${f}: ${n}/${clients.length} (${(n*100/clients.length).toFixed(0)}%)`);
}

// contacts
const contacts = await fetchAll('client_contacts');
console.log(`\nclient_contacts 총: ${contacts.length}건`);
const cBy = new Map();
for (const c of contacts) cBy.set(c.client_company_id, (cBy.get(c.client_company_id)||0)+1);
console.log(`담당자 보유 거래처: ${cBy.size}/${clients.length}`);
const multi = [...cBy.values()].filter(v => v >= 2).length;
console.log(`담당자 2명 이상: ${multi}건`);

// 샘플 거래처
console.log('\n샘플 거래처 (KERI 클라이언트):');
const keriClients = clients.filter(c => c.company_id === 'a0000000-0000-0000-0000-000000000002' && c.client_type !== 'vendor').slice(0,3);
for (const c of keriClients) {
  const cs = contacts.filter(ct => ct.client_company_id === c.id);
  console.log(`  - ${c.name} (사업자: ${c.business_number || 'X'}, 대표: ${c.ceo_name || 'X'}, 담당자 ${cs.length}명)`);
}
