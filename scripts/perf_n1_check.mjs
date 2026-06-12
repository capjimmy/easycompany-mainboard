// 빠른 N+1 체크 벤치: 직접 supabase 호출로 옛/새 패턴의 시간 비교
// (실제 IPC handler를 부르려면 electron이 필요하므로 동등 로직을 모사)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllPaged(table, applyFilter) {
  const all = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select('*').range(from, from + 999);
    if (applyFilter) q = applyFilter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function timeIt(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const t1 = Date.now();
  console.log(`${label}: ${t1 - t0}ms (rows=${Array.isArray(result) ? result.length : 'n/a'})`);
  return { ms: t1 - t0, result };
}

console.log('\n=== 1) contract events: OLD vs NEW ===');
let events = (await sb.from('contract_events').select('*')).data || [];
console.log(`events count: ${events.length}`);
// 이벤트가 없으면 합성: 처음 30개 contract_id를 events 로 사용해 join 비용 모사
if (events.length === 0) {
  const { data: synth } = await sb.from('contracts').select('id').limit(50);
  events = (synth || []).map((s) => ({ contract_id: s.id, event_date: '2026-01-01' }));
  console.log(`synthesized ${events.length} events for benchmarking`);
}

const eventSample = events.slice(0, Math.min(events.length, 50)); // 50건 샘플

const oldEv = await timeIt('OLD: per-event getContractById (N+1)', async () => {
  const out = [];
  for (const e of eventSample) {
    const { data } = await sb.from('contracts').select('*').eq('id', e.contract_id).single();
    out.push({ ...e, contract: data });
  }
  return out;
});

const newEv = await timeIt('NEW: getContracts then Map lookup', async () => {
  const allContracts = await fetchAllPaged('contracts');
  const cmap = new Map(allContracts.map((c) => [c.id, c]));
  return eventSample.map((e) => ({ ...e, contract: cmap.get(e.contract_id) }));
});
const evSpeedup = oldEv.ms / Math.max(newEv.ms, 1);
console.log(`>> events speedup: ${evSpeedup.toFixed(1)}x (sampled ${eventSample.length} events)`);

console.log('\n=== 2) users: OLD per-user fetches vs NEW batched ===');
const users = await fetchAllPaged('users');
console.log(`users count: ${users.length}`);

const oldUsers = await timeIt('OLD: 3*N parallel per-user', async () => {
  const a = await Promise.all(users.map((u) => sb.from('menu_permissions').select('*').eq('user_id', u.id).then((r) => r.data || [])));
  const b = await Promise.all(users.map((u) => sb.from('user_companies').select('*').eq('user_id', u.id).then((r) => r.data || [])));
  const c = await Promise.all(users.map((u) => sb.from('user_departments').select('*').eq('user_id', u.id).then((r) => r.data || [])));
  return [...a.flat(), ...b.flat(), ...c.flat()];
});

const newUsers = await timeIt('NEW: 3 single queries fetchAllPaged', async () => {
  const [a, b, c] = await Promise.all([
    fetchAllPaged('menu_permissions'),
    fetchAllPaged('user_companies'),
    fetchAllPaged('user_departments'),
  ]);
  return [...a, ...b, ...c];
});
const usSpeedup = oldUsers.ms / Math.max(newUsers.ms, 1);
console.log(`>> users speedup: ${usSpeedup.toFixed(1)}x`);

console.log('\n=== 3) quotes: OLD getQuotes->JS filter vs NEW getQuotesByCompanyId ===');
const { data: companies } = await sb.from('companies').select('id, name');
// 가장 견적/계약이 많은 회사를 선택
const { data: cAgg } = await sb.from('contracts').select('company_id');
const counts = new Map();
for (const c of cAgg || []) counts.set(c.company_id, (counts.get(c.company_id) || 0) + 1);
let bestId = null, bestN = -1;
for (const [k, v] of counts) if (v > bestN) { bestN = v; bestId = k; }
const targetCompanyId = bestId || companies?.[0]?.id;
const targetCompany = (companies || []).find((c) => c.id === targetCompanyId);
console.log(`target company: ${targetCompany?.name} (${targetCompanyId}, ${bestN} contracts)`);

const oldQ = await timeIt('OLD: getQuotes (all) then JS filter', async () => {
  const all = await fetchAllPaged('quotes');
  return all.filter((q) => q.company_id === targetCompanyId);
});

const newQ = await timeIt('NEW: getQuotesByCompanyId (DB filter)', async () => {
  return await fetchAllPaged('quotes', (q) => q.eq('company_id', targetCompanyId));
});
const qSpeedup = oldQ.ms / Math.max(newQ.ms, 1);
console.log(`>> quotes speedup: ${qSpeedup.toFixed(1)}x`);

console.log('\n=== 4) clients getAll: OLD getContracts vs NEW getContractsByCompanyId ===');
const oldC = await timeIt('OLD: getContracts (all)', async () => fetchAllPaged('contracts'));
const newC = await timeIt('NEW: getContractsByCompanyId', async () => fetchAllPaged('contracts', (q) => q.eq('company_id', targetCompanyId)));
const cSpeedup = oldC.ms / Math.max(newC.ms, 1);
console.log(`>> clients contract-load speedup: ${cSpeedup.toFixed(1)}x`);

console.log('\n=== Summary ===');
console.log(`Task 1 (contract events join): ~${evSpeedup.toFixed(1)}x faster`);
console.log(`Task 4 (users getAll N+1):     ~${usSpeedup.toFixed(1)}x faster`);
console.log(`Task 3 (quotes getAll):        ~${qSpeedup.toFixed(1)}x faster`);
console.log(`Task 2 (clients getAll):       ~${cSpeedup.toFixed(1)}x faster (per company)`);
