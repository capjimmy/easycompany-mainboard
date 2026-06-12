import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// API 키 로드
const { data: keySetting } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const apiKey = keySetting?.value;
if (!apiKey) {
  console.error('OpenAI API 키가 settings 테이블에 없습니다.');
  process.exit(1);
}
const openai = new OpenAI({ apiKey });
console.log('✅ OpenAI 클라이언트 초기화');

// 페이징 fetch
async function fetchAll(table, columns, filter = null) {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\\:;]/g, '')
    .replace(/주식회사|유한회사|사단법인|재단법인/g, '');
}

// === 1. 데이터 로드 ===
console.log('\n=== 데이터 로드 ===');
const quotes = await fetchAll('quotes', 'id, company_id, quote_number, recipient_company, service_name, title, total_amount, grand_total, quote_date, linked_contract_id');
const contracts = await fetchAll('contracts', 'id, company_id, contract_number, client_company, service_name, total_amount, contract_amount, contract_date, linked_quote_id, source_file_path, notes');
const invoices = await fetchAll('tax_invoices', 'id, company_id, buyer_name, item_description, total_amount, supply_amount, issue_date, contract_id');
const clients = await fetchAll('client_companies', 'id, company_id, name, business_number, email, ceo_name');
console.log(`견적: ${quotes.length}, 계약: ${contracts.length}, 세금계산서: ${invoices.length}, 거래처: ${clients.length}`);

// 회사별 인덱싱
function groupByCompany(arr) {
  const map = new Map();
  for (const x of arr) {
    if (!map.has(x.company_id)) map.set(x.company_id, []);
    map.get(x.company_id).push(x);
  }
  return map;
}
const contractsByCompany = groupByCompany(contracts);
const quotesByCompany = groupByCompany(quotes);

// === LLM 매칭 헬퍼 ===
async function llmPickBest(targetText, candidates, kind) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const candidateList = candidates.slice(0, 30).map((c, i) => `${i+1}. ${c.summary}`).join('\n');
  const prompt = `${kind} 매칭 작업입니다. 아래 대상과 가장 일치하는 후보 1개를 골라주세요.

[대상]
${targetText}

[후보 ${candidates.length}개]
${candidateList}

가장 일치하는 후보의 번호만 답하세요. 매칭되는 후보가 없으면 0을 답하세요.
답변 형식: 숫자만 (예: 3 또는 0)`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 데이터 매칭 전문가입니다. 지시한 대로 숫자만 답하세요.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    const txt = res.choices[0]?.message?.content?.trim() || '0';
    const num = parseInt(txt.match(/\d+/)?.[0] || '0');
    if (num > 0 && num <= candidates.length) return candidates[num - 1];
    return null;
  } catch (err) {
    console.log(`  LLM 에러: ${err.message}`);
    return null;
  }
}

// === 2. 거래처 통합 (사업자번호 기준 + 이름 유사) ===
console.log('\n=== 거래처 중복 통합 ===');
// 사업자번호로 묶기
const bizGroups = new Map(); // company_id::biz → [client]
const noBizClients = []; // 사업자번호 없는 거래처
for (const c of clients) {
  if (c.business_number) {
    const k = `${c.company_id}::${c.business_number}`;
    if (!bizGroups.has(k)) bizGroups.set(k, []);
    bizGroups.get(k).push(c);
  } else {
    noBizClients.push(c);
  }
}

// 사업자번호 같은 그룹: 첫 번째를 keeper, 나머지를 merge
let mergedCount = 0;
for (const [key, group] of bizGroups) {
  if (group.length < 2) continue;
  const [keeper, ...dupes] = group;
  for (const dupe of dupes) {
    // tax_invoices, quotes, contracts에서 참조 변경
    await sb.from('tax_invoices').update({ client_company_id: keeper.id }).eq('client_company_id', dupe.id);
    // 거래처 자체 삭제
    await sb.from('client_companies').delete().eq('id', dupe.id);
    mergedCount++;
  }
}
console.log(`사업자번호 기준 ${mergedCount}개 통합`);

// === 3. 세금계산서 ↔ 계약 AI 매칭 ===
console.log('\n=== 세금계산서 ↔ 계약 AI 매칭 ===');
const unmatchedInvoices = invoices.filter(i => !i.contract_id);
console.log(`미연결 세금계산서: ${unmatchedInvoices.length}건`);

let tiOk = 0, tiSkip = 0, tiErr = 0;
const tiUpdates = [];

for (let idx = 0; idx < unmatchedInvoices.length; idx++) {
  const inv = unmatchedInvoices[idx];
  const candidates = contractsByCompany.get(inv.company_id) || [];

  // 1차 필터: 거래처명 부분 일치 또는 적요 부분 일치 또는 금액 ±20% + 날짜 ±90일
  const buyerNorm = norm(inv.buyer_name);
  const descNorm = norm(inv.item_description);
  const filtered = candidates.filter(c => {
    const cClient = norm(c.client_company);
    const cService = norm(c.service_name);
    // 거래처명 매칭 (부분 일치)
    const clientMatch = (buyerNorm && cClient && (buyerNorm.includes(cClient) || cClient.includes(buyerNorm)));
    // 적요 매칭
    const serviceMatch = (descNorm && cService && (descNorm.includes(cService.slice(0,8)) || cService.includes(descNorm.slice(0,8))));
    // 금액 매칭
    let amountMatch = false;
    if (inv.total_amount > 0 && c.total_amount > 0) {
      const ratio = Math.min(inv.total_amount, c.total_amount) / Math.max(inv.total_amount, c.total_amount);
      amountMatch = ratio > 0.8;
    }
    // 날짜 매칭 (계약일 ≤ 발행일)
    let dateMatch = false;
    if (c.contract_date && inv.issue_date) {
      const cd = new Date(c.contract_date).getTime();
      const id = new Date(inv.issue_date).getTime();
      const days = (id - cd) / 86400000;
      dateMatch = days >= -30 && days <= 365;
    }
    return clientMatch || serviceMatch || (amountMatch && dateMatch);
  });

  if (filtered.length === 0) { tiSkip++; continue; }

  // 단일 후보면 바로 매칭
  if (filtered.length === 1) {
    tiUpdates.push({ id: inv.id, contract_id: filtered[0].id });
    tiOk++;
    if ((tiOk + tiSkip) % 50 === 0) process.stdout.write(`${tiOk+tiSkip}/${unmatchedInvoices.length} `);
    continue;
  }

  // 다중 후보 → LLM
  const targetText = `거래처: ${inv.buyer_name}\n적요: ${inv.item_description || '(없음)'}\n금액: ${inv.total_amount?.toLocaleString()}원\n발행일: ${inv.issue_date}`;
  const candidateObjs = filtered.slice(0, 20).map(c => ({
    ...c,
    summary: `거래처: ${c.client_company} | 서비스: ${c.service_name || '(없음)'} | 금액: ${(c.total_amount || c.contract_amount || 0).toLocaleString()}원 | 계약일: ${c.contract_date || '(없음)'}`,
  }));
  const best = await llmPickBest(targetText, candidateObjs, '세금계산서-계약');
  if (best) {
    tiUpdates.push({ id: inv.id, contract_id: best.id });
    tiOk++;
  } else {
    tiSkip++;
  }
  if ((tiOk + tiSkip + tiErr) % 25 === 0) process.stdout.write(`${tiOk+tiSkip+tiErr}/${unmatchedInvoices.length}(✓${tiOk}) `);
}
console.log(`\n  AI 매칭 ${tiOk}건, 스킵 ${tiSkip}건`);

// 적용
let tiApplied = 0;
for (const u of tiUpdates) {
  const { error } = await sb.from('tax_invoices').update({ contract_id: u.contract_id }).eq('id', u.id);
  if (!error) tiApplied++;
}
console.log(`  ✅ ${tiApplied}건 DB 적용`);

// === 4. 계약 ↔ 견적 AI 매칭 ===
console.log('\n=== 계약 ↔ 견적 AI 매칭 ===');
const unmatchedContracts = contracts.filter(c => !c.linked_quote_id);
console.log(`미연결 계약: ${unmatchedContracts.length}건`);

let cqOk = 0, cqSkip = 0;
const cqUpdates = [];

for (let idx = 0; idx < unmatchedContracts.length; idx++) {
  const c = unmatchedContracts[idx];
  const candidates = quotesByCompany.get(c.company_id) || [];

  const cClientNorm = norm(c.client_company);
  const cServiceNorm = norm(c.service_name);
  const filtered = candidates.filter(q => {
    const qClient = norm(q.recipient_company);
    const qService = norm(q.service_name || q.title);
    const clientMatch = cClientNorm && qClient && (cClientNorm.includes(qClient) || qClient.includes(cClientNorm));
    const serviceMatch = cServiceNorm && qService && (cServiceNorm.includes(qService.slice(0,8)) || qService.includes(cServiceNorm.slice(0,8)));
    let amountMatch = false;
    if (c.total_amount > 0 && q.grand_total > 0) {
      const ratio = Math.min(c.total_amount, q.grand_total) / Math.max(c.total_amount, q.grand_total);
      amountMatch = ratio > 0.8;
    }
    let dateMatch = false;
    if (c.contract_date && q.quote_date) {
      const cd = new Date(c.contract_date).getTime();
      const qd = new Date(q.quote_date).getTime();
      const days = (cd - qd) / 86400000;
      dateMatch = days >= -7 && days <= 365; // 견적이 계약보다 먼저
    }
    return (clientMatch && (serviceMatch || amountMatch || dateMatch));
  });

  if (filtered.length === 0) { cqSkip++; continue; }
  if (filtered.length === 1) {
    cqUpdates.push({ id: c.id, linked_quote_id: filtered[0].id });
    cqOk++;
    if ((cqOk+cqSkip) % 50 === 0) process.stdout.write(`${cqOk+cqSkip}/${unmatchedContracts.length} `);
    continue;
  }

  const targetText = `거래처: ${c.client_company}\n서비스: ${c.service_name || '(없음)'}\n금액: ${(c.total_amount||0).toLocaleString()}원\n계약일: ${c.contract_date}`;
  const candidateObjs = filtered.slice(0, 15).map(q => ({
    ...q,
    summary: `거래처: ${q.recipient_company} | 서비스: ${q.service_name || q.title || '(없음)'} | 금액: ${(q.grand_total || q.total_amount || 0).toLocaleString()}원 | 견적일: ${q.quote_date || '(없음)'}`,
  }));
  const best = await llmPickBest(targetText, candidateObjs, '계약-견적');
  if (best) {
    cqUpdates.push({ id: c.id, linked_quote_id: best.id });
    cqOk++;
  } else {
    cqSkip++;
  }
  if ((cqOk+cqSkip) % 25 === 0) process.stdout.write(`${cqOk+cqSkip}/${unmatchedContracts.length}(✓${cqOk}) `);
}
console.log(`\n  AI 매칭 ${cqOk}건, 스킵 ${cqSkip}건`);

// 적용
let cqApplied = 0;
for (const u of cqUpdates) {
  const { error } = await sb.from('contracts').update({ linked_quote_id: u.linked_quote_id }).eq('id', u.id);
  if (!error) {
    cqApplied++;
    // 역방향
    await sb.from('quotes').update({ linked_contract_id: u.id }).eq('id', u.linked_quote_id);
  }
}
console.log(`  ✅ ${cqApplied}건 DB 적용 (양방향)`);

// === 5. 최종 통계 ===
console.log('\n=== 최종 통계 ===');
const { count: cTotal } = await sb.from('contracts').select('*', { count: 'exact', head: true });
const { count: cLinkQ } = await sb.from('contracts').select('*', { count: 'exact', head: true }).not('linked_quote_id', 'is', null);
const { count: tiTotal } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
const { count: tiLinkC } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);
const { count: clTotal } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`거래처: ${clTotal}개 (${mergedCount}개 통합됨)`);
console.log(`계약 → 견적 연결: ${cLinkQ} / ${cTotal} (${(cLinkQ/cTotal*100).toFixed(1)}%)`);
console.log(`세금계산서 → 계약 연결: ${tiLinkC} / ${tiTotal} (${(tiLinkC/tiTotal*100).toFixed(1)}%)`);
