import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

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

const clients = await fetchAll('client_companies', 'id, company_id, name, business_number, ceo_name, email, phone, address, notes');
console.log(`총 거래처: ${clients.length}`);

// 그룹핑
const groups = new Map();
for (const c of clients) {
  const key = `${c.company_id}::${norm(c.name)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}

const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
console.log(`중복 그룹: ${dups.length}`);

// 참조 테이블들
const refTables = [
  { table: 'tax_invoices', col: 'client_company_id' },
  { table: 'contracts', col: 'client_company_id' },
  { table: 'client_contacts', col: 'client_company_id' },
];

let merged = 0;
for (const [, group] of dups) {
  // keeper: 사업자번호 있는 것 우선, 아니면 가장 정보 풍부한 것
  group.sort((a, b) => {
    const aScore = (a.business_number ? 10 : 0) + (a.email ? 5 : 0) + (a.ceo_name ? 3 : 0) + (a.phone ? 2 : 0) + (a.address ? 1 : 0);
    const bScore = (b.business_number ? 10 : 0) + (b.email ? 5 : 0) + (b.ceo_name ? 3 : 0) + (b.phone ? 2 : 0) + (b.address ? 1 : 0);
    return bScore - aScore;
  });
  const keeper = group[0];
  const dupes = group.slice(1);

  // keeper 정보 보강
  const updates = {};
  for (const d of dupes) {
    if (!keeper.business_number && d.business_number) updates.business_number = d.business_number;
    if (!keeper.ceo_name && d.ceo_name) updates.ceo_name = d.ceo_name;
    if (!keeper.email && d.email) updates.email = d.email;
    if (!keeper.phone && d.phone) updates.phone = d.phone;
    if (!keeper.address && d.address) updates.address = d.address;
  }
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await sb.from('client_companies').update(updates).eq('id', keeper.id);
  }

  // 중복 → keeper로 참조 이전 + 삭제
  for (const d of dupes) {
    for (const ref of refTables) {
      await sb.from(ref.table).update({ [ref.col]: keeper.id }).eq(ref.col, d.id);
    }
    await sb.from('client_companies').delete().eq('id', d.id);
    merged++;
  }
}

console.log(`\n✅ ${merged}개 중복 거래처 병합`);
const { count } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`남은 거래처: ${count}`);
