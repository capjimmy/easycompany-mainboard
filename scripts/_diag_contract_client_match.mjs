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

// contracts의 미매칭 거래처명 → client_companies 정규화 매칭 시도
const ccByCoNorm = new Map();
for (const c of cc) {
  const k = `${c.company_id}::${normalize(c.name)}`;
  if (!ccByCoNorm.has(k)) ccByCoNorm.set(k, []);
  ccByCoNorm.get(k).push(c);
}
const ccByCoExact = new Set(cc.map((c) => `${c.company_id}::${c.name}`));

const unmatched = contracts.filter((c) => c.client_company && !ccByCoExact.has(`${c.company_id}::${c.client_company}`));
console.log(`미매칭 contracts: ${unmatched.length}건`);

const stats = { normMatch: 0, substringMatch: 0, noMatch: 0 };
const fixable = [];
const noMatch = [];

for (const ct of unmatched) {
  const norm = normalize(ct.client_company);
  if (!norm) continue;
  const k = `${ct.company_id}::${norm}`;
  if (ccByCoNorm.has(k)) {
    stats.normMatch++;
    fixable.push({ contract: ct, target: ccByCoNorm.get(k)[0] });
    continue;
  }
  // substring match
  const candidates = cc.filter((c) => {
    if (c.company_id !== ct.company_id) return false;
    const cn = normalize(c.name);
    if (!cn) return false;
    return cn.includes(norm) || norm.includes(cn);
  });
  if (candidates.length === 1) {
    stats.substringMatch++;
    fixable.push({ contract: ct, target: candidates[0] });
  } else if (candidates.length > 1) {
    // 가장 짧은 이름으로 (단축형 우선)
    candidates.sort((a, b) => a.name.length - b.name.length);
    stats.substringMatch++;
    fixable.push({ contract: ct, target: candidates[0], multi: candidates.length });
  } else {
    stats.noMatch++;
    noMatch.push(ct);
  }
}

console.log('통계:', stats);
console.log(`수정 가능: ${fixable.length}건`);
console.log('샘플 fixable (norm match):');
fixable.filter(f => !f.multi).slice(0, 5).forEach(f =>
  console.log(`  "${f.contract.client_company}" → "${f.target.name}"`)
);
console.log('샘플 fixable (multi candidates):');
fixable.filter(f => f.multi).slice(0, 5).forEach(f =>
  console.log(`  "${f.contract.client_company}" → "${f.target.name}" (후보 ${f.multi}개)`)
);
console.log('\n매칭 안 됨 샘플:');
noMatch.slice(0, 10).forEach(c => console.log(`  "${c.client_company}"`));
