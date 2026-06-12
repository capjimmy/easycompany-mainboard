// 분할 납입 고려: 세금계산서 1개 ≠ 계약 1개 일대일 매칭이 아님
// 같은 거래처+같은 적요(또는 유사) → 같은 계약으로 묶기, 합계가 계약금액과 비슷한지 검증
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
const contracts = await fetchAll('contracts', 'id, company_id, contract_number, client_company, service_name, total_amount, contract_amount, contract_date, received_amount');
console.log(`tax_invoices ${tis.length}, contracts ${contracts.length}`);

const unlinked = tis.filter(t => !t.contract_id);
console.log(`미연결 세금계산서: ${unlinked.length}`);

const contractsByCompany = new Map();
for (const c of contracts) {
  const k = c.company_id;
  if (!contractsByCompany.has(k)) contractsByCompany.set(k, []);
  contractsByCompany.get(k).push(c);
}

// 1차: 거래처+적요로 후보 묶기. 적요 prefix 일치 + 거래처명 prefix 일치
async function llmMatch(invoice, candidates) {
  const list = candidates.slice(0, 10).map((c, i) =>
    `${i+1}. 거래처:${c.client_company || '?'} | 용역:${c.service_name || '?'} | 계약금액:${(c.total_amount||0).toLocaleString()}원 | 계약일:${c.contract_date || '?'}`
  ).join('\n');
  const prompt = `세금계산서가 어떤 계약의 (분할)납부분인지 매칭하세요.
중요: 세금계산서 금액과 계약금액이 다를 수 있습니다 (분할 납입).
거래처명과 용역/적요의 의미가 일치하면 매칭하세요. 금액은 참고만.

[세금계산서]
거래처: ${invoice.buyer_name}
적요: ${invoice.item_description || '?'}
세금계산서 금액: ${invoice.total_amount?.toLocaleString()}원
발행일: ${invoice.issue_date}

[계약 후보]
${list}

거래처명과 용역명이 모두 명확히 일치하는 계약 1개의 번호를 답하세요. 불확실하면 0.
숫자만 답변 (예: 3 또는 0)`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '데이터 매칭 전문가. 거래처+용역명 정확 일치 우선. 금액은 분할납부 가능. 숫자만 답.' },
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

let matched = 0, skipped = 0;
const matches = [];

for (let i = 0; i < unlinked.length; i++) {
  const inv = unlinked[i];
  const candidates = contractsByCompany.get(inv.company_id) || [];

  const buyerN = norm(inv.buyer_name);
  const descN = norm(inv.item_description);

  // 거래처명 일치 (4글자 이상 공통) AND (적요 부분 일치 OR 후보가 적으면 LLM)
  const filtered = candidates.filter(c => {
    const cClient = norm(c.client_company);
    if (!cClient || !buyerN) return false;
    // 거래처명 4글자 prefix 일치 또는 한쪽이 다른쪽에 포함
    const clientMatch = (buyerN.length >= 4 && cClient.length >= 4) &&
      (buyerN.substring(0, 4) === cClient.substring(0, 4) ||
       buyerN.includes(cClient) || cClient.includes(buyerN));
    return clientMatch;
  });

  if (filtered.length === 0) { skipped++; continue; }

  // 단일 후보면 적요 한번 검증
  if (filtered.length === 1) {
    const cService = norm(filtered[0].service_name);
    if (descN && cService && (descN.includes(cService.slice(0,6)) || cService.includes(descN.slice(0,6)))) {
      matches.push({ id: inv.id, contract_id: filtered[0].id });
      matched++;
    } else {
      // 적요 불일치면 LLM으로 한 번 더
      const best = await llmMatch(inv, filtered);
      if (best) { matches.push({ id: inv.id, contract_id: best.id }); matched++; }
      else skipped++;
    }
    if ((matched+skipped) % 50 === 0) process.stdout.write(`${matched+skipped}/${unlinked.length}(✓${matched}) `);
    continue;
  }

  // 다중 후보 → LLM
  const best = await llmMatch(inv, filtered);
  if (best) { matches.push({ id: inv.id, contract_id: best.id }); matched++; }
  else skipped++;
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

// 분할 납입 합계로 received_amount 재계산
console.log('\n=== 분할 납입 합계 → 수금 ===');
const ti2 = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status');
const recvByContract = new Map();
for (const t of ti2) {
  if (t.status !== 'paid' || !t.contract_id) continue;
  recvByContract.set(t.contract_id, (recvByContract.get(t.contract_id) || 0) + (t.total_amount || 0));
}

const c2 = await fetchAll('contracts', 'id, total_amount');
const cmap = new Map(c2.map(x => [x.id, x]));
let updated = 0;
let overPaid = 0;
for (const [cid, recv] of recvByContract) {
  const c = cmap.get(cid);
  if (!c) continue;
  const total = c.total_amount || 0;
  // 분할 납입 합계가 계약금액 초과 시 경고만
  if (total > 0 && recv > total * 1.1) {
    overPaid++;
  }
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
console.log(`✅ ${updated}건 contract 수금 업데이트`);
console.log(`⚠️ 수금이 계약금액보다 큰 것: ${overPaid}건 (분할 매칭 오류 가능)`);

const after = await fetchAll('contracts', 'received_amount, total_amount, progress_billing_rate');
const withReceived = after.filter(c => c.received_amount > 0).length;
const totalReceived = after.reduce((s, c) => s + (c.received_amount || 0), 0);
console.log(`\n수금 있는 계약: ${withReceived} / ${after.length}`);
console.log(`총 수금액: ${totalReceived.toLocaleString()}원`);
