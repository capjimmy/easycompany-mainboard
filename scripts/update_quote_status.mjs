import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: keyData.value });

async function fetchAll(t, c) {
  const all = []; let f = 0;
  while (true) { const { data } = await sb.from(t).select(c).order('id').range(f, f + 999); if (!data || !data.length) break; all.push(...data); if (data.length < 1000) break; f += 1000; }
  return all;
}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\\:;]/g, '')
    .replace(/주식회사|유한회사|사단법인|재단법인|건축사사무소|종합건축사사무소|엔지니어링/g, '');
}

const quotes = await fetchAll('quotes', 'id, company_id, status, linked_contract_id, recipient_company, service_name, title, grand_total, quote_date');
const contracts = await fetchAll('contracts', 'id, company_id, client_company, service_name, total_amount, contract_date');
console.log(`견적 ${quotes.length}, 계약 ${contracts.length}`);

// 1단계: 이미 linked_contract_id가 있는 견적 → accepted
const alreadyLinked = quotes.filter(q => q.linked_contract_id);
console.log(`\n=== 1단계: 이미 연결된 ${alreadyLinked.length}건 → accepted ===`);
let step1 = 0;
for (const q of alreadyLinked) {
  const { error } = await sb.from('quotes').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', q.id);
  if (!error) step1++;
}
console.log(`✅ ${step1}건 accepted`);

// 2단계: 미연결 견적을 계약과 AI 매칭
const unlinked = quotes.filter(q => !q.linked_contract_id);
console.log(`\n=== 2단계: 미연결 ${unlinked.length}건 AI 매칭 ===`);

// 계약 인덱스 (정규화 거래처별)
const cIdx = new Map();
for (const c of contracts) {
  if (!c.client_company) continue;
  const key = `${c.company_id}::${norm(c.client_company)}`;
  if (!cIdx.has(key)) cIdx.set(key, []);
  cIdx.get(key).push(c);
}

async function llmPick(quote, candidates) {
  const list = candidates.slice(0, 10).map((c, i) =>
    `${i+1}. ${c.service_name || '?'} | ${(c.total_amount||0).toLocaleString()}원 | ${c.contract_date || '?'}`
  ).join('\n');
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '데이터 매칭. 견적→계약. 적요/용역명 의미 일치만. 숫자만 답.' },
        { role: 'user', content: `[견적] ${quote.recipient_company} - ${quote.service_name||quote.title||'?'} - ${(quote.grand_total||0).toLocaleString()}원 - ${quote.quote_date}\n\n[같은 거래처 계약]\n${list}\n\n일치하면 번호, 불확실하면 0. 숫자만.` },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const n = parseInt(r.choices[0]?.message?.content?.trim()?.match(/\d+/)?.[0] || '0');
    if (n > 0 && n <= candidates.length) return candidates[n - 1];
    return null;
  } catch { return null; }
}

let matched = 0, skipped = 0;
for (let i = 0; i < unlinked.length; i++) {
  const q = unlinked[i];
  const qn = norm(q.recipient_company);
  if (!qn || qn.length < 2) { skipped++; continue; }

  // 정확 일치
  let candidates = cIdx.get(`${q.company_id}::${qn}`) || [];

  // 부분 일치
  if (candidates.length === 0) {
    for (const [key, list] of cIdx) {
      if (!key.startsWith(`${q.company_id}::`)) continue;
      const ck = key.split('::')[1];
      if (ck.length >= 2 && (ck.includes(qn) || qn.includes(ck))) {
        candidates.push(...list);
      }
    }
  }

  if (candidates.length === 0) { skipped++; continue; }

  let bestContract = null;
  if (candidates.length === 1) {
    bestContract = candidates[0];
  } else if (candidates.length <= 20) {
    bestContract = await llmPick(q, candidates);
  } else {
    skipped++; continue;
  }

  if (bestContract) {
    await sb.from('quotes').update({
      status: 'accepted',
      linked_contract_id: bestContract.id,
      updated_at: new Date().toISOString(),
    }).eq('id', q.id);
    // 역방향
    await sb.from('contracts').update({ linked_quote_id: q.id }).eq('id', bestContract.id);
    matched++;
  } else {
    skipped++;
  }

  if ((matched + skipped) % 100 === 0) process.stdout.write(`${matched+skipped}/${unlinked.length}(✓${matched}) `);
}
console.log(`\n✅ 추가 매칭 ${matched}건, 스킵 ${skipped}건`);

// 3단계: 최종 상태 확인
const final = await fetchAll('quotes', 'status');
const finalStatus = {};
final.forEach(q => finalStatus[q.status || 'null'] = (finalStatus[q.status || 'null'] || 0) + 1);
console.log('\n=== 최종 상태 ===', finalStatus);
