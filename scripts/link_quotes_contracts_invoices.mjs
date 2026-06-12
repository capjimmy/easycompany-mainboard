import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// 정규화 함수: 거래처명, 프로젝트명에서 공백/특수문자 제거 후 소문자
function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\\:;]/g, '')
    .replace(/주식회사|유한회사|사단법인|재단법인/g, '');
}

// 1. 모든 데이터 로드 (페이징)
async function fetchAll(table, columns) {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

console.log('=== 데이터 로드 ===');
const quotes = await fetchAll('quotes', 'id, company_id, quote_number, recipient_company, service_name, title, total_amount, grand_total, quote_date');
const contracts = await fetchAll('contracts', 'id, company_id, contract_number, client_company, service_name, total_amount, contract_amount, contract_date, linked_quote_id, source_file_path, notes');
const invoices = await fetchAll('tax_invoices', 'id, company_id, buyer_name, item_description, total_amount, supply_amount, issue_date, contract_id');
console.log(`견적: ${quotes.length}, 계약: ${contracts.length}, 세금계산서: ${invoices.length}`);

// 2. quote → contract 매칭 (회사 + 거래처 + 서비스명 또는 metadata)
console.log('\n=== 견적 ↔ 계약 매칭 ===');
// quote 인덱스: company_id::client_norm::service_norm
const quoteIdx = new Map();
for (const q of quotes) {
  const k1 = `${q.company_id}::${norm(q.recipient_company)}::${norm(q.service_name || q.title)}`;
  if (!quoteIdx.has(k1)) quoteIdx.set(k1, []);
  quoteIdx.get(k1).push(q);
  // 보조 인덱스: 거래처만
  const k2 = `${q.company_id}::${norm(q.recipient_company)}`;
  if (!quoteIdx.has(k2)) quoteIdx.set(k2, []);
  quoteIdx.get(k2).push(q);
}

let qcMatched = 0;
const qcUpdates = [];
for (const c of contracts) {
  if (c.linked_quote_id) continue; // 이미 연결됨
  const k1 = `${c.company_id}::${norm(c.client_company)}::${norm(c.service_name)}`;
  let candidates = quoteIdx.get(k1);
  if (!candidates || candidates.length === 0) {
    // 거래처만으로 시도, 가장 가까운 날짜
    const k2 = `${c.company_id}::${norm(c.client_company)}`;
    candidates = quoteIdx.get(k2);
  }
  if (!candidates || candidates.length === 0) continue;

  // 견적일이 계약일보다 이른 것 중 가장 가까운 것
  let best = null;
  let bestDiff = Infinity;
  for (const q of candidates) {
    if (!c.contract_date || !q.quote_date) continue;
    const cd = new Date(c.contract_date).getTime();
    const qd = new Date(q.quote_date).getTime();
    if (qd > cd) continue; // 견적은 계약보다 먼저
    const diff = cd - qd;
    if (diff < bestDiff) { bestDiff = diff; best = q; }
  }
  // 날짜 매칭 실패 시 첫 번째
  if (!best && candidates[0]) best = candidates[0];

  if (best) {
    qcUpdates.push({ id: c.id, linked_quote_id: best.id });
    qcMatched++;
  }
}
console.log(`매칭: ${qcMatched}건`);

// 일괄 업데이트
console.log('적용 중...');
let qcOk = 0;
for (const u of qcUpdates) {
  const { error } = await sb.from('contracts').update({ linked_quote_id: u.linked_quote_id }).eq('id', u.id);
  if (!error) qcOk++;
  if (qcOk % 100 === 0) process.stdout.write(`${qcOk} `);
}
console.log(`\n✅ ${qcOk}건 연결`);

// quotes에도 역방향 linked_contract_id 설정
console.log('\n견적 → 계약 역방향 연결...');
let qBackOk = 0;
for (const u of qcUpdates) {
  const { error } = await sb.from('quotes').update({ linked_contract_id: u.id }).eq('id', u.linked_quote_id);
  if (!error) qBackOk++;
  if (qBackOk % 100 === 0) process.stdout.write(`${qBackOk} `);
}
console.log(`\n✅ ${qBackOk}건`);

// 3. 세금계산서 → 계약 매칭 (회사 + 거래처 + 적요)
console.log('\n=== 세금계산서 ↔ 계약 매칭 ===');
// contract 인덱스: company_id::client_norm::service_norm
const contractIdx = new Map();
for (const c of contracts) {
  const k1 = `${c.company_id}::${norm(c.client_company)}::${norm(c.service_name)}`;
  if (!contractIdx.has(k1)) contractIdx.set(k1, []);
  contractIdx.get(k1).push(c);
  const k2 = `${c.company_id}::${norm(c.client_company)}`;
  if (!contractIdx.has(k2)) contractIdx.set(k2, []);
  contractIdx.get(k2).push(c);
}

let tiMatched = 0;
const tiUpdates = [];
for (const inv of invoices) {
  if (inv.contract_id) continue;
  const k1 = `${inv.company_id}::${norm(inv.buyer_name)}::${norm(inv.item_description)}`;
  let candidates = contractIdx.get(k1);
  if (!candidates || candidates.length === 0) {
    const k2 = `${inv.company_id}::${norm(inv.buyer_name)}`;
    candidates = contractIdx.get(k2);
  }
  if (!candidates || candidates.length === 0) continue;

  // 적요와 service_name이 가장 비슷한 것 또는 가장 가까운 날짜
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    let score = 0;
    // 서비스명 부분 일치 보너스
    const cName = norm(c.service_name);
    const iDesc = norm(inv.item_description);
    if (cName && iDesc) {
      if (cName === iDesc) score += 100;
      else if (cName.includes(iDesc) || iDesc.includes(cName)) score += 50;
      else {
        // 공통 부분 길이
        const minLen = Math.min(cName.length, iDesc.length);
        let common = 0;
        for (let i = 0; i < minLen; i++) {
          if (cName[i] === iDesc[i]) common++;
          else break;
        }
        score += common;
      }
    }
    // 날짜 근접성 (계약일이 발행일보다 이르거나 같아야 함)
    if (c.contract_date && inv.issue_date) {
      const cd = new Date(c.contract_date).getTime();
      const id = new Date(inv.issue_date).getTime();
      if (cd <= id) {
        const days = (id - cd) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - days / 30); // 최대 30점, 30일마다 1점 감소
      } else {
        score -= 20; // 계약이 발행일 이후면 페널티
      }
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }

  if (best && bestScore > 0) {
    tiUpdates.push({ id: inv.id, contract_id: best.id });
    tiMatched++;
  }
}
console.log(`매칭: ${tiMatched}건`);

let tiOk = 0;
for (const u of tiUpdates) {
  const { error } = await sb.from('tax_invoices').update({ contract_id: u.contract_id }).eq('id', u.id);
  if (!error) tiOk++;
  if (tiOk % 100 === 0) process.stdout.write(`${tiOk} `);
}
console.log(`\n✅ ${tiOk}건 연결`);

// 4. 통계
console.log('\n=== 연결 통계 ===');
const { data: linkedC } = await sb.from('contracts').select('id', { count: 'exact', head: true }).not('linked_quote_id', 'is', null);
const { data: linkedQ } = await sb.from('quotes').select('id', { count: 'exact', head: true }).not('linked_contract_id', 'is', null);
const { data: linkedTi } = await sb.from('tax_invoices').select('id', { count: 'exact', head: true }).not('contract_id', 'is', null);
const { count: cTotal } = await sb.from('contracts').select('*', { count: 'exact', head: true });
const { count: qTotal } = await sb.from('quotes').select('*', { count: 'exact', head: true });
const { count: tiTotal } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
console.log(`계약 → 견적 연결: ${qcOk} / ${cTotal}건`);
console.log(`견적 → 계약 연결: ${qBackOk} / ${qTotal}건`);
console.log(`세금계산서 → 계약 연결: ${tiOk} / ${tiTotal}건`);
