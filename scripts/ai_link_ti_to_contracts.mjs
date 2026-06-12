// 세금계산서 → 계약 AI 매칭 (수금률용, 정확도 높은 것만)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: keyData.value });

async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}
  return all;
}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\\:;]/g, '').replace(/주식회사|유한회사|사단법인|재단법인/g, '');
}

const tis = await fetchAll('tax_invoices', 'id, company_id, contract_id, buyer_name, item_description, total_amount, supply_amount, status, issue_date');
const contracts = await fetchAll('contracts', 'id, company_id, contract_number, client_company, service_name, total_amount, contract_amount, contract_date');
console.log(`tax_invoices ${tis.length}, contracts ${contracts.length}`);

// 미연결 + 회사별 인덱스
const unlinked = tis.filter(t => !t.contract_id);
console.log(`미연결 세금계산서: ${unlinked.length}`);

const contractsByCompany = new Map();
for (const c of contracts) {
  const k = c.company_id;
  if (!contractsByCompany.has(k)) contractsByCompany.set(k, []);
  contractsByCompany.get(k).push(c);
}

async function llmMatch(invoice, candidates) {
  const list = candidates.slice(0, 15).map((c, i) =>
    `${i+1}. ${c.client_company || '?'} | ${c.service_name || '?'} | ${(c.total_amount||c.contract_amount||0).toLocaleString()}원 | ${c.contract_date || '?'}`
  ).join('\n');
  const prompt = `세금계산서가 어떤 계약에 해당하는지 정확히 매칭해야 합니다. 고도의 정확도가 필요합니다.

[세금계산서]
거래처: ${invoice.buyer_name}
적요: ${invoice.item_description || '?'}
금액: ${invoice.total_amount?.toLocaleString()}원
발행일: ${invoice.issue_date}

[계약 후보]
${list}

가장 정확하게 일치하는 계약 번호 1개만 답하세요. 거래처명과 적요/서비스명이 모두 명확히 일치할 때만 매칭하세요. 불확실하면 0을 답하세요.
답변 형식: 숫자만 (예: 3 또는 0)`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '데이터 매칭 전문가. 정확도가 가장 중요. 숫자만 답하세요.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const txt = res.choices[0]?.message?.content?.trim() || '0';
    const num = parseInt(txt.match(/\d+/)?.[0] || '0');
    if (num > 0 && num <= candidates.length) return candidates[num - 1];
    return null;
  } catch (e) { return null; }
}

let matched = 0;
let skipped = 0;
const matches = [];
for (let i = 0; i < unlinked.length; i++) {
  const inv = unlinked[i];
  const candidates = contractsByCompany.get(inv.company_id) || [];

  // 1차 필터 완화: 거래처명 또는 적요 매칭
  const buyerN = norm(inv.buyer_name);
  const descN = norm(inv.item_description);
  const filtered = candidates.filter(c => {
    const cClient = norm(c.client_company);
    const cService = norm(c.service_name);
    // 거래처명 부분 매칭 (3글자 이상 공통)
    let clientMatch = false;
    if (cClient && buyerN) {
      const minLen = Math.min(cClient.length, buyerN.length);
      if (minLen >= 3) {
        clientMatch = buyerN.substring(0, Math.min(buyerN.length, 4)) === cClient.substring(0, Math.min(cClient.length, 4))
          || buyerN.includes(cClient.slice(0,4)) || cClient.includes(buyerN.slice(0,4));
      }
    }
    // 적요 매칭 (5글자 이상 공통)
    let serviceMatch = false;
    if (descN && cService && descN.length >= 5 && cService.length >= 5) {
      serviceMatch = descN.includes(cService.slice(0,6)) || cService.includes(descN.slice(0,6));
    }
    return clientMatch || serviceMatch;
  });

  if (filtered.length === 0) { skipped++; continue; }
  if (filtered.length === 1) {
    matches.push({ id: inv.id, contract_id: filtered[0].id });
    matched++;
    if ((matched+skipped) % 50 === 0) process.stdout.write(`${matched+skipped}/${unlinked.length}(✓${matched}) `);
    continue;
  }

  // LLM
  const best = await llmMatch(inv, filtered);
  if (best) {
    matches.push({ id: inv.id, contract_id: best.id });
    matched++;
  } else skipped++;
  if ((matched+skipped) % 25 === 0) process.stdout.write(`${matched+skipped}/${unlinked.length}(✓${matched}) `);
}
console.log(`\n매칭 ${matched}, 스킵 ${skipped}`);

// 적용
let applied = 0;
for (const m of matches) {
  const { error } = await sb.from('tax_invoices').update({ contract_id: m.contract_id }).eq('id', m.id);
  if (!error) applied++;
}
console.log(`✅ ${applied}건 contract_id 업데이트`);

// 다시 received_amount 동기화
console.log('\n=== received_amount 재동기화 ===');
const ti2 = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status');
const recvByContract = new Map();
for (const t of ti2) {
  if (t.status !== 'paid' || !t.contract_id) continue;
  recvByContract.set(t.contract_id, (recvByContract.get(t.contract_id) || 0) + (t.total_amount || 0));
}
console.log(`수금 정보 있는 계약: ${recvByContract.size}`);

const c2 = await fetchAll('contracts', 'id, total_amount');
const cmap = new Map(c2.map(x => [x.id, x]));
let updated = 0;
for (const [cid, recv] of recvByContract) {
  const c = cmap.get(cid);
  if (!c) continue;
  const total = c.total_amount || 0;
  const remaining = Math.max(0, total - recv);
  const rate = total > 0 ? Math.min(100, (recv / total) * 100) : 0;
  const { error } = await sb.from('contracts').update({
    received_amount: recv,
    remaining_amount: remaining,
    progress_billing_rate: rate,
    updated_at: new Date().toISOString(),
  }).eq('id', cid);
  if (!error) updated++;
}
console.log(`✅ ${updated}건 contract 수금 정보 업데이트`);
