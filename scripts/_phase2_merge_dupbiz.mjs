import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function pageAll(table, cols) {
  const all = []; let f = 0;
  while (true) {
    const { data } = await sb.from(table).select(cols).order('id').range(f, f + 999);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; f += 1000;
  }
  return all;
}

console.log('━━━ Phase 2: 사업자번호 중복 거래처 병합 ━━━\n');

const clients = await pageAll('client_companies', '*');

// 사업자번호별 그룹화 (회사 무관 — 같은 사업자번호면 같은 회사)
const bizMap = new Map();
for (const c of clients) {
  if (!c.business_number) continue;
  const k = c.business_number.replace(/\D/g, '');
  if (k.length < 10) continue;
  if (!bizMap.has(k)) bizMap.set(k, []);
  bizMap.get(k).push(c);
}

const dups = [...bizMap.entries()].filter(([k, v]) => v.length > 1);
console.log('사업자번호 중복 그룹: ' + dups.length + '쌍\n');

// winner 선정: 정보 풍부한 것
function score(c) {
  let s = 0;
  if (c.ceo_name) s += 5;
  if (c.address) s += 3;
  if (c.phone) s += 2;
  if (c.email) s += 2;
  if (c.industry) s += 1;
  // 짧고 깔끔한 이름 가산
  if (c.name && c.name.length < 20) s += 1;
  // (주)/주식회사/㈜ 들어간 게 더 정식 명칭
  if (c.name && /\(주\)|주식회사|㈜/.test(c.name)) s += 2;
  return s;
}

let merged = 0;
let ccMoved = 0, tiMoved = 0, ctrUpdated = 0;

for (const [biz, group] of dups) {
  if (group.length < 2) continue;
  // 같은 회사(company_id)별로 처리 (다른 회사 사업자번호 같으면 별개로 유지)
  const byCo = new Map();
  for (const c of group) {
    const k = c.company_id;
    if (!byCo.has(k)) byCo.set(k, []);
    byCo.get(k).push(c);
  }
  for (const [coId, members] of byCo) {
    if (members.length < 2) continue;
    members.sort((a, b) => score(b) - score(a));
    const winner = members[0];
    const losers = members.slice(1);

    // winner 보강 (빈 필드 채움)
    const patch = {};
    for (const f of ['ceo_name', 'address', 'phone', 'email', 'industry']) {
      if (!winner[f]) {
        const fromLoser = losers.find(l => l[f]);
        if (fromLoser) patch[f] = fromLoser[f];
      }
    }
    if (Object.keys(patch).length) {
      await sb.from('client_companies').update(patch).eq('id', winner.id);
    }

    // FK/텍스트 이동
    for (const loser of losers) {
      // client_contacts FK
      const { count: ccC } = await sb.from('client_contacts')
        .update({ client_company_id: winner.id }, { count: 'exact' })
        .eq('client_company_id', loser.id);
      ccMoved += ccC || 0;
      // tax_invoices FK
      const { count: tiC } = await sb.from('tax_invoices')
        .update({ client_company_id: winner.id }, { count: 'exact' })
        .eq('client_company_id', loser.id);
      tiMoved += tiC || 0;
      // contracts.client_company 텍스트 → winner.name
      if (loser.name !== winner.name) {
        const { count: ctC } = await sb.from('contracts')
          .update({ client_company: winner.name }, { count: 'exact' })
          .eq('client_company', loser.name)
          .eq('company_id', coId);
        ctrUpdated += ctC || 0;
      }
      // loser 삭제
      await sb.from('client_companies').delete().eq('id', loser.id);
      merged++;
      console.log(`  ✓ "${winner.name}" ← "${loser.name}" (biz: ${biz})`);
    }
  }
}

console.log('\n결과:');
console.log('  merged (loser 삭제): ' + merged);
console.log('  client_contacts FK 이동: ' + ccMoved);
console.log('  tax_invoices FK 이동: ' + tiMoved);
console.log('  contracts.client_company 텍스트 갱신: ' + ctrUpdated);

const { count: finalC } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log('\n📊 최종 거래처: ' + finalC + '건');
