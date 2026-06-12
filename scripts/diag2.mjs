import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\:;]/g, '')
    .replace(/주식회사|유한회사|사단법인|재단법인|건축사사무소|종합건축사사무소|엔지니어링/g, '');
}

const tis = await fetchAll('tax_invoices', 'buyer_name, contract_id, company_id');
const contracts = await fetchAll('contracts', 'client_company, company_id');

// 미연결 세금계산서의 거래처 정규화 후 contracts에 있는지 매칭률
const cIdx = new Set();
contracts.forEach(c => { if (c.client_company) cIdx.add(`${c.company_id}::${norm(c.client_company)}`); });

const unlinked = tis.filter(t => !t.contract_id);
let exact = 0, partial = 0, none = 0;
const noneSamples = [];
for (const t of unlinked) {
  const k = `${t.company_id}::${norm(t.buyer_name)}`;
  if (cIdx.has(k)) { exact++; continue; }
  // 부분 일치
  const tn = norm(t.buyer_name);
  let found = false;
  for (const ck of cIdx) {
    if (!ck.startsWith(`${t.company_id}::`)) continue;
    const cn = ck.split('::')[1];
    if (cn.length >= 3 && tn.length >= 3 && (cn.includes(tn) || tn.includes(cn))) {
      found = true; break;
    }
  }
  if (found) partial++;
  else {
    none++;
    if (noneSamples.length < 10) noneSamples.push(t.buyer_name);
  }
}
console.log(`미연결 ${unlinked.length}: 정확일치 ${exact}, 부분일치 ${partial}, 매칭없음 ${none}`);
console.log('\n매칭 안되는 거래처 샘플:');
noneSamples.forEach(n => console.log(' -', n));
