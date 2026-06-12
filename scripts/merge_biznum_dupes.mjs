// Task 5: 사업자번호 기준 중복 병합
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

function normBiz(s) {
  if (!s) return '';
  return String(s).replace(/[^0-9]/g, '');
}

const clients = await fetchAll('client_companies', 'id, company_id, name, business_number, ceo_name, email, phone, address, notes, fax, website, industry, client_type');
console.log(`총 거래처: ${clients.length}`);

// 사업자번호 그룹핑 (회사별)
const groups = new Map();
for (const c of clients) {
  const biz = normBiz(c.business_number);
  if (!biz || biz.length < 8) continue;
  const key = `${c.company_id}::${biz}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
const totalDupRows = dups.reduce((s, [,v]) => s + v.length, 0);
console.log(`사업자번호 중복 그룹: ${dups.length}개 / 총 ${totalDupRows}행`);

const refTables = [
  { table: 'tax_invoices', col: 'client_company_id' },
  { table: 'contracts', col: 'client_company_id' },
  { table: 'client_contacts', col: 'client_company_id' },
];

let merged = 0;
for (const [key, group] of dups) {
  // keeper: 정보 풍부한 것 우선, 그 다음 짧은 이름 (정식 명칭 보호)
  group.sort((a, b) => {
    const aScore = (a.email ? 50 : 0) + (a.ceo_name ? 30 : 0) + (a.phone ? 20 : 0) + (a.address ? 10 : 0) + (a.notes ? 5 : 0);
    const bScore = (b.email ? 50 : 0) + (b.ceo_name ? 30 : 0) + (b.phone ? 20 : 0) + (b.address ? 10 : 0) + (b.notes ? 5 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return (a.name || '').length - (b.name || '').length;
  });
  const keeper = group[0];
  const dupes = group.slice(1);
  console.log(`  병합: ${dupes.map(d=>d.name).join(' / ')} → ${keeper.name} (${keeper.business_number})`);

  // keeper 정보 보강
  const updates = {};
  for (const d of dupes) {
    if (!keeper.ceo_name && d.ceo_name) updates.ceo_name = d.ceo_name;
    if (!keeper.email && d.email) updates.email = d.email;
    if (!keeper.phone && d.phone) updates.phone = d.phone;
    if (!keeper.address && d.address) updates.address = d.address;
    if (!keeper.fax && d.fax) updates.fax = d.fax;
    if (!keeper.website && d.website) updates.website = d.website;
    if (!keeper.industry && d.industry) updates.industry = d.industry;
  }
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await sb.from('client_companies').update(updates).eq('id', keeper.id);
  }

  for (const d of dupes) {
    for (const ref of refTables) {
      await sb.from(ref.table).update({ [ref.col]: keeper.id }).eq(ref.col, d.id);
    }
    await sb.from('client_companies').delete().eq('id', d.id);
    merged++;
  }
}
console.log(`\n✅ ${merged}개 사업자번호 중복 병합`);

const { count } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`남은 거래처: ${count}`);
