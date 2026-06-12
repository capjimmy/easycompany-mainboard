/**
 * 거래처 중복/유사명 진단
 *
 * - 정규화 후 동일 (㈜/㈜()/공백/. 제거)
 * - 사업자번호 동일
 * - 어느 한쪽이 다른 쪽의 substring (5자 이상)
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

async function fetchAll(t, c = '*', f = (q) => q) {
  const all = [];
  let from = 0;
  while (true) {
    let q = sb.from(t).select(c).order('id').range(from, from + 999);
    q = f(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function normalize(name) {
  if (!name) return '';
  return String(name)
    .replace(/\(주\)|㈜|\(주식회사\)|주식회사|\(사\)|㈳|사단법인|\(재\)|㈋|재단법인|\(유\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[.,()\[\]<>~!@#$%^&*+=:;'"·\-]/g, '')
    .replace(/(주)$/g, '')
    .toLowerCase();
}

const clients = await fetchAll('client_companies');
console.log(`총 ${clients.length}건`);

// 1) 정규화 동일 그룹
const normMap = new Map();
for (const c of clients) {
  const n = normalize(c.name);
  if (!n) continue;
  const k = `${c.company_id}::${n}`;
  if (!normMap.has(k)) normMap.set(k, []);
  normMap.get(k).push(c);
}

const normDupes = [...normMap.values()].filter((g) => g.length > 1);
console.log(`\n[정규화 동일] 그룹 ${normDupes.length}개, 총 행 ${normDupes.reduce((s, g) => s + g.length, 0)}`);
for (const g of normDupes.slice(0, 15)) {
  console.log(`  ${g.map((c) => c.name).join(' | ')}`);
}
if (normDupes.length > 15) console.log(`  ... +${normDupes.length - 15}`);

// 2) 사업자번호 동일 그룹 (서로 다른 이름)
const bizMap = new Map();
for (const c of clients) {
  if (!c.business_number) continue;
  const k = `${c.company_id}::${c.business_number.replace(/\D/g, '')}`;
  if (!bizMap.has(k)) bizMap.set(k, []);
  bizMap.get(k).push(c);
}
const bizDupes = [...bizMap.values()].filter((g) => g.length > 1);
console.log(`\n[사업자번호 동일] 그룹 ${bizDupes.length}개`);
for (const g of bizDupes.slice(0, 15)) {
  console.log(`  ${g[0].business_number}: ${g.map((c) => c.name).join(' | ')}`);
}

// 3) substring 유사 (정규화 후 한쪽이 다른쪽 포함, 차이 3자 이내)
const candidates = [];
const byCo = new Map();
for (const c of clients) {
  if (!byCo.has(c.company_id)) byCo.set(c.company_id, []);
  byCo.get(c.company_id).push({ ...c, _norm: normalize(c.name) });
}

let pairCnt = 0;
for (const [, group] of byCo) {
  // sort by norm length so we can look at pairs
  group.sort((a, b) => a._norm.length - b._norm.length);
  const n = group.length;
  for (let i = 0; i < n; i++) {
    const a = group[i];
    if (a._norm.length < 4) continue;
    for (let j = i + 1; j < n; j++) {
      const b = group[j];
      if (b._norm.length < 4) continue;
      if (a._norm === b._norm) continue;
      // already in normDupes — skip
      // substring check
      if (b._norm.includes(a._norm) && b._norm.length - a._norm.length <= 4) {
        candidates.push([a, b]);
        pairCnt++;
        if (pairCnt > 200) break;
      }
    }
    if (pairCnt > 200) break;
  }
  if (pairCnt > 200) break;
}
console.log(`\n[substring 유사] 후보쌍 ${candidates.length}개`);
for (const [a, b] of candidates.slice(0, 30)) {
  console.log(`  "${a.name}" ⟷ "${b.name}"`);
}
if (candidates.length > 30) console.log(`  ... +${candidates.length - 30}`);
