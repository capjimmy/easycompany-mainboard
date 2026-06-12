import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const clients = await fetchAll('client_companies', 'id, company_id, name, business_number, ceo_name, email');
console.log(`총 거래처: ${clients.length}`);

// 정규화 함수
function norm(s) {
  if (!s) return '';
  return String(s).trim()
    .replace(/㈜/g, '(주)')
    .replace(/㈔/g, '(사)')
    .replace(/주식회사\s*/g, '(주)')
    .replace(/유한회사\s*/g, '(유)')
    .replace(/사단법인\s*/g, '(사)')
    .replace(/\s+/g, '')
    .toLowerCase();
}

// 1. 같은 회사 내 정규화 이름 동일 → 중복
const groups = new Map();
for (const c of clients) {
  const key = `${c.company_id}::${norm(c.name)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
console.log(`\n=== 정규화 이름 중복: ${dups.length}그룹 ===`);
dups.forEach(([k, v]) => {
  console.log(`\n  [${v.length}건] ${v.map(c=>c.name).join(' / ')}`);
  console.log(`    사업자: ${[...new Set(v.map(c=>c.business_number).filter(Boolean))].join(', ') || '없음'}`);
});

// 2. 같은 회사 내 사업자번호 동일 → 중복
const bizGroups = new Map();
for (const c of clients) {
  if (!c.business_number) continue;
  const key = `${c.company_id}::${c.business_number}`;
  if (!bizGroups.has(key)) bizGroups.set(key, []);
  bizGroups.get(key).push(c);
}
const bizDups = [...bizGroups.entries()].filter(([,v]) => v.length > 1);
console.log(`\n=== 사업자번호 중복: ${bizDups.length}그룹 ===`);
bizDups.forEach(([k, v]) => {
  console.log(`  [${v.length}건] ${v.map(c=>c.name).join(' / ')} (${v[0].business_number})`);
});

console.log(`\n총 중복 그룹: ${dups.length + bizDups.length}`);
