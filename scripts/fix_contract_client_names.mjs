/**
 * contracts.client_company 텍스트를 client_companies.name과 정렬
 * - 정규화 매칭 우선
 * - substring 매칭 (다중 후보면 가장 짧은 정식 명칭 채택)
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

function normalize(name) {
  if (!name) return '';
  return String(name)
    .replace(/\(주\)|㈜|\(주식회사\)|주식회사|\(사\)|㈳|사단법인|\(재\)|㈋|재단법인|\(유\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[.,()\[\]<>~!@#$%^&*+=:;'"·\-]/g, '')
    .toLowerCase();
}

async function fetchAll(t, c) {
  const arr = [];
  let f = 0;
  while (true) {
    const { data } = await sb.from(t).select(c).range(f, f + 999);
    if (!data?.length) break;
    arr.push(...data);
    if (data.length < 1000) break;
    f += 1000;
  }
  return arr;
}

const cc = await fetchAll('client_companies', 'id, company_id, name');
const contracts = await fetchAll('contracts', 'id, company_id, client_company');

const ccByCoNorm = new Map();
for (const c of cc) {
  const k = `${c.company_id}::${normalize(c.name)}`;
  if (!ccByCoNorm.has(k)) ccByCoNorm.set(k, []);
  ccByCoNorm.get(k).push(c);
}
const exactKey = new Set(cc.map((c) => `${c.company_id}::${c.name}`));

// rename map: oldName → newName (per company_id)
const renameMap = new Map(); // `${company_id}::${oldName}` → newName

const unmatched = contracts.filter((c) => c.client_company && !exactKey.has(`${c.company_id}::${c.client_company}`));
for (const ct of unmatched) {
  const k = `${ct.company_id}::${ct.client_company}`;
  if (renameMap.has(k)) continue;

  const norm = normalize(ct.client_company);
  let target = null;

  if (ccByCoNorm.has(`${ct.company_id}::${norm}`)) {
    target = ccByCoNorm.get(`${ct.company_id}::${norm}`)[0];
  } else {
    const candidates = cc.filter((c) => {
      if (c.company_id !== ct.company_id) return false;
      const cn = normalize(c.name);
      return cn && (cn.includes(norm) || norm.includes(cn));
    });
    if (candidates.length) {
      candidates.sort((a, b) => a.name.length - b.name.length);
      target = candidates[0];
    }
  }
  if (target && target.name !== ct.client_company) {
    renameMap.set(k, target.name);
  }
}

console.log(`rename 적용 대상: ${renameMap.size}개 (회사×이름 조합)`);

let updated = 0;
let groupCount = 0;
for (const [key, newName] of renameMap) {
  const [companyId, oldName] = key.split('::', 2);
  const { error, count } = await sb
    .from('contracts')
    .update({ client_company: newName }, { count: 'exact' })
    .eq('company_id', companyId)
    .eq('client_company', oldName);
  if (error) {
    console.error(`  ❌ "${oldName}" → "${newName}": ${error.message}`);
    continue;
  }
  groupCount++;
  updated += count || 0;
  if (groupCount <= 20) console.log(`  ✓ "${oldName}" → "${newName}" (${count}건)`);
}
console.log(`...총 ${groupCount}개 그룹, ${updated}건 contracts.client_company 업데이트`);

// 최종 매칭 검증
const newContracts = await fetchAll('contracts', 'id, company_id, client_company');
const newKey = new Set(cc.map((c) => `${c.company_id}::${c.name}`));
const stillUnmatched = newContracts.filter((c) => c.client_company && !newKey.has(`${c.company_id}::${c.client_company}`));
console.log(`\n최종 미매칭 contracts: ${stillUnmatched.length}건`);
if (stillUnmatched.length) {
  console.log('샘플:', stillUnmatched.slice(0, 10).map((c) => c.client_company));
}
