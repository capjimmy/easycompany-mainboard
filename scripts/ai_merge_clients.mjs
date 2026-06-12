/**
 * AI 기반 거래처 중복 병합
 *
 * 1) 후보쌍 생성: 정규화 동일 + 사업자번호 동일 + substring 유사
 * 2) GPT-4o-mini로 "merge" / "keep_separate" 분류 (배치 30쌍씩)
 * 3) merge 판정 → winner(정보 많은 쪽) 채택, loser의 FK를 winner로 이동, loser 삭제
 *    - tax_invoices.client_company_id
 *    - client_contacts.client_company_id
 *    - contracts.client_company (name 문자열)
 *    - winner의 비어있는 컬럼은 loser에서 채움 (biz/ceo/address/phone/email/industry)
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
if (!keyData?.value) {
  console.error('OpenAI key 없음');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: keyData.value });

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
    .toLowerCase();
}

console.log('=== 1. 거래처 로딩 ===');
const clients = await fetchAll('client_companies');
console.log(`거래처: ${clients.length}건`);

// 후보쌍 생성
const byCo = new Map();
for (const c of clients) {
  if (!byCo.has(c.company_id)) byCo.set(c.company_id, []);
  byCo.get(c.company_id).push({ ...c, _norm: normalize(c.name) });
}

const pairs = [];
const pairKey = new Set();
function addPair(a, b, reason) {
  if (a.id === b.id) return;
  const k = [a.id, b.id].sort().join('::');
  if (pairKey.has(k)) return;
  pairKey.add(k);
  pairs.push({ a, b, reason });
}

for (const [, group] of byCo) {
  // 정규화 동일
  const byNorm = new Map();
  for (const c of group) {
    if (!c._norm) continue;
    if (!byNorm.has(c._norm)) byNorm.set(c._norm, []);
    byNorm.get(c._norm).push(c);
  }
  for (const arr of byNorm.values()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        addPair(arr[i], arr[j], 'norm-equal');
  }

  // 사업자번호 동일
  const byBiz = new Map();
  for (const c of group) {
    if (!c.business_number) continue;
    const k = String(c.business_number).replace(/\D/g, '');
    if (k.length < 7) continue;
    if (!byBiz.has(k)) byBiz.set(k, []);
    byBiz.get(k).push(c);
  }
  for (const arr of byBiz.values()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        addPair(arr[i], arr[j], 'biz-equal');
  }

  // substring 유사
  const sorted = [...group].sort((a, b) => a._norm.length - b._norm.length);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (a._norm.length < 4) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b._norm.length < 4) continue;
      if (a._norm === b._norm) continue;
      if (b._norm.includes(a._norm) && b._norm.length - a._norm.length <= 5) {
        addPair(a, b, 'substring');
      }
    }
  }
}

console.log(`\n=== 2. 후보쌍: ${pairs.length}쌍 ===`);
const reasonCnt = new Map();
for (const p of pairs) reasonCnt.set(p.reason, (reasonCnt.get(p.reason) || 0) + 1);
console.log('  사유별:', [...reasonCnt]);

// norm-equal과 biz-equal은 명백 → 자동 merge (LLM 호출 없이)
const autoMerge = pairs.filter((p) => p.reason !== 'substring');
const aiPairs = pairs.filter((p) => p.reason === 'substring');
console.log(`  자동 merge (norm/biz 동일): ${autoMerge.length}쌍`);
console.log(`  AI 판정 필요 (substring): ${aiPairs.length}쌍`);

// AI 분류
console.log('\n=== 3. AI 분류 ===');
const aiDecisions = new Map(); // pairKey → 'merge' | 'keep'
const BATCH = 30;
let llmCalls = 0;

for (let i = 0; i < aiPairs.length; i += BATCH) {
  const batch = aiPairs.slice(i, i + BATCH);
  const list = batch.map((p, idx) => `${idx + 1}. "${p.a.name}" ⟷ "${p.b.name}"`).join('\n');

  const sys = `한국 건설/건축 업계 거래처명 비교 전문가. 두 거래처명이 같은 회사인지 판단.
- 같은 회사: (주)/㈜/주식회사 표기 차이, "사무소"/"건축사사무소" 추가, 띄어쓰기 차이만 있음
- 다른 회사: 컨소시엄("A,B" "A+B"), 부서/사업부 표기((교육)/(친환경)/(인증)), 지분 표기((30%)), 프로젝트 코드(A-4BL), 외 추가 단어로 사업영역 변경
응답: JSON 배열만. 각 쌍을 0(merge=같음)/1(keep=다름)으로.
예시: [0,1,0,1,0,...]`;

  const user = `다음 ${batch.length}쌍의 거래처명을 분류:\n${list}`;

  let resp;
  try {
    resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    llmCalls++;
  } catch (e) {
    console.error(`batch ${i / BATCH + 1} error:`, e.message);
    continue;
  }

  let arr;
  try {
    const obj = JSON.parse(resp.choices[0].message.content);
    arr = Array.isArray(obj) ? obj : (obj.results || obj.decisions || obj.classifications || Object.values(obj)[0]);
  } catch (e) {
    console.error('JSON parse fail:', resp.choices[0].message.content.slice(0, 200));
    continue;
  }
  if (!Array.isArray(arr)) {
    console.error('not array:', JSON.stringify(arr).slice(0, 200));
    continue;
  }

  for (let k = 0; k < batch.length; k++) {
    const decision = Number(arr[k]) === 0 ? 'merge' : 'keep';
    const key = [batch[k].a.id, batch[k].b.id].sort().join('::');
    aiDecisions.set(key, decision);
  }
  console.log(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(aiPairs.length / BATCH)}: ${batch.length}쌍 처리`);
}
console.log(`  LLM 호출: ${llmCalls}회`);

// 병합 대상 결정
const toMergePairs = [...autoMerge];
for (const p of aiPairs) {
  const k = [p.a.id, p.b.id].sort().join('::');
  if (aiDecisions.get(k) === 'merge') toMergePairs.push(p);
}
console.log(`\n=== 4. 병합 대상: ${toMergePairs.length}쌍 ===`);

// merge 판정 결과 일부 출력
const mergeAi = aiPairs.filter((p) => aiDecisions.get([p.a.id, p.b.id].sort().join('::')) === 'merge');
const keepAi = aiPairs.filter((p) => aiDecisions.get([p.a.id, p.b.id].sort().join('::')) === 'keep');
console.log(`  AI 판정: merge ${mergeAi.length}, keep ${keepAi.length}`);
console.log('\nAI merge 샘플:');
mergeAi.slice(0, 10).forEach((p) => console.log(`  ✓ "${p.a.name}" ← "${p.b.name}"`));
console.log('\nAI keep 샘플:');
keepAi.slice(0, 10).forEach((p) => console.log(`  ✗ "${p.a.name}" ⟷ "${p.b.name}"`));

// 5. 실제 병합
console.log('\n=== 5. 실제 병합 실행 ===');

// Union-Find로 transitive merge 그룹화
const parent = new Map();
function find(x) {
  if (!parent.has(x)) parent.set(x, x);
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));
    x = parent.get(x);
  }
  return x;
}
function union(a, b) {
  const ra = find(a), rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
}
for (const p of toMergePairs) union(p.a.id, p.b.id);

const groupMap = new Map();
for (const id of new Set(toMergePairs.flatMap((p) => [p.a.id, p.b.id]))) {
  const r = find(id);
  if (!groupMap.has(r)) groupMap.set(r, []);
  groupMap.get(r).push(id);
}
console.log(`  병합 그룹: ${groupMap.size}개`);

const clientById = new Map(clients.map((c) => [c.id, c]));

// score: 정보 풍부도 (winner 선정)
function score(c) {
  let s = 0;
  if (c.business_number) s += 10;
  if (c.ceo_name) s += 5;
  if (c.address) s += 3;
  if (c.phone) s += 2;
  if (c.email) s += 2;
  if (c.industry) s += 1;
  // 짧고 깔끔한 이름 가산
  if (c.name && c.name.length < 15) s += 1;
  // (주)/주식회사 들어간게 더 정식 명칭
  if (c.name && /\(주\)|주식회사|㈜/.test(c.name)) s += 2;
  return s;
}

let mergedCount = 0;
let tiUpdated = 0;
let contactsUpdated = 0;
let contractsRenamed = 0;

for (const [, ids] of groupMap) {
  const members = ids.map((id) => clientById.get(id)).filter(Boolean);
  if (members.length < 2) continue;
  members.sort((a, b) => score(b) - score(a));
  const winner = members[0];
  const losers = members.slice(1);

  // winner 보강
  const patch = {};
  for (const f of ['business_number', 'ceo_name', 'address', 'phone', 'email', 'industry']) {
    if (!winner[f]) {
      const fromLoser = losers.find((l) => l[f]);
      if (fromLoser) patch[f] = fromLoser[f];
    }
  }
  if (Object.keys(patch).length) {
    await sb.from('client_companies').update(patch).eq('id', winner.id);
  }

  for (const loser of losers) {
    // tax_invoices FK 이동
    const { count: tiC } = await sb
      .from('tax_invoices').update({ client_company_id: winner.id })
      .eq('client_company_id', loser.id).select('id', { count: 'exact', head: true });
    tiUpdated += tiC || 0;

    // client_contacts FK 이동
    const { count: ccC } = await sb
      .from('client_contacts').update({ client_company_id: winner.id })
      .eq('client_company_id', loser.id).select('id', { count: 'exact', head: true });
    contactsUpdated += ccC || 0;

    // contracts.client_company 문자열 rename
    if (loser.name !== winner.name) {
      const { count: cC } = await sb
        .from('contracts').update({ client_company: winner.name })
        .eq('client_company', loser.name).eq('company_id', loser.company_id)
        .select('id', { count: 'exact', head: true });
      contractsRenamed += cC || 0;
    }

    // loser 삭제
    const { error } = await sb.from('client_companies').delete().eq('id', loser.id);
    if (error) {
      console.error(`  delete fail ${loser.name}: ${error.message}`);
    } else {
      mergedCount++;
    }
  }
  console.log(`  ✓ "${winner.name}" ← [${losers.map((l) => l.name).join(', ')}]`);
}

console.log(`\n=== 결과 ===`);
console.log(`  merged: ${mergedCount}건 (loser 삭제)`);
console.log(`  tax_invoices FK 이동: ${tiUpdated}건`);
console.log(`  client_contacts FK 이동: ${contactsUpdated}건`);
console.log(`  contracts.client_company rename: ${contractsRenamed}건`);

const { count: finalC } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`  최종 거래처: ${finalC}건 (시작 ${clients.length} → ${finalC}, 감소 ${clients.length - finalC})`);
