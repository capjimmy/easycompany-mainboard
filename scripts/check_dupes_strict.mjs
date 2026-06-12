import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

// 더 강력한 정규화 - 모든 형태 제거
function normStrict(s) {
  if (!s) return '';
  return String(s).trim()
    .replace(/㈜/g, '')
    .replace(/㈔/g, '')
    .replace(/\(주\)/g, '')
    .replace(/\(유\)/g, '')
    .replace(/\(사\)/g, '')
    .replace(/\(재\)/g, '')
    .replace(/주식회사/g, '')
    .replace(/유한회사/g, '')
    .replace(/사단법인/g, '')
    .replace(/재단법인/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const clients = await fetchAll('client_companies', 'id, company_id, name, business_number');
console.log(`총 거래처: ${clients.length}`);

const groups = new Map();
for (const c of clients) {
  const n = normStrict(c.name);
  if (!n) continue;
  const key = `${c.company_id}::${n}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
const totalDupRows = dups.reduce((s, [,v]) => s + v.length, 0);
console.log(`엄격 정규화 중복 그룹: ${dups.length}개 / 총 ${totalDupRows}행`);
dups.slice(0, 15).forEach(([k,v]) => {
  console.log(`  [${v.length}] ${v.map(c=>c.name).join(' / ')}`);
});

// 사업자번호도 한 번 더
const bizGroups = new Map();
for (const c of clients) {
  const biz = (c.business_number || '').replace(/[^0-9]/g, '');
  if (!biz || biz.length < 8) continue;
  const key = `${c.company_id}::${biz}`;
  if (!bizGroups.has(key)) bizGroups.set(key, []);
  bizGroups.get(key).push(c);
}
const bizDups = [...bizGroups.entries()].filter(([,v]) => v.length > 1);
console.log(`\n사업자번호 중복: ${bizDups.length}개`);
bizDups.slice(0, 10).forEach(([k,v]) => {
  console.log(`  [${v.length}] ${v.map(c=>c.name).join(' / ')} (${v[0].business_number})`);
});
