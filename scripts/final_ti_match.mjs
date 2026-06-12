// 최종 매칭: 거래처명 정확 일치 또는 부분 일치만으로 매칭 (적요 체크 안 함)
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
    .replace(/주식회사|유한회사|사단법인|재단법인/g, '');
}

const tis = await fetchAll('tax_invoices', 'id, company_id, contract_id, buyer_name, item_description, total_amount, status, issue_date');
const contracts = await fetchAll('contracts', 'id, company_id, client_company, service_name, total_amount, contract_date');
console.log(`tax_invoices ${tis.length}, contracts ${contracts.length}`);

const unlinked = tis.filter(t => !t.contract_id);
console.log(`미연결: ${unlinked.length}`);

// 회사 + 거래처(정규화) → 계약 후보 인덱스
const idx = new Map();
for (const c of contracts) {
  const key = `${c.company_id}::${norm(c.client_company)}`;
  if (!idx.has(key)) idx.set(key, []);
  idx.get(key).push(c);
}

async function llmPick(invoice, candidates) {
  const list = candidates.slice(0, 12).map((c, i) =>
    `${i+1}. ${c.service_name || '?'} | ${(c.total_amount||0).toLocaleString()}원 | ${c.contract_date || '?'}`
  ).join('\n');
  const prompt = `[세금계산서] ${invoice.buyer_name} - ${invoice.item_description || '?'} - ${invoice.total_amount?.toLocaleString()}원 - ${invoice.issue_date}

[계약 후보 - 같은 거래처]
${list}

세금계산서의 적요(품목)와 가장 의미가 일치하는 계약 번호를 답하세요. 분할 납입이라 금액은 다를 수 있습니다. 의미 매칭만 따지세요. 불확실하면 0.
숫자만 답.`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '데이터 매칭. 적요/용역명 의미 일치 여부 판단. 숫자만.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const t = r.choices[0]?.message?.content?.trim() || '0';
    const n = parseInt(t.match(/\d+/)?.[0] || '0');
    if (n > 0 && n <= candidates.length) return candidates[n-1];
    return null;
  } catch (e) { return null; }
}

let matched = 0, skipped = 0;
const matches = [];

for (let i = 0; i < unlinked.length; i++) {
  const inv = unlinked[i];
  const buyerN = norm(inv.buyer_name);
  if (!buyerN) { skipped++; continue; }

  const key = `${inv.company_id}::${buyerN}`;
  let candidates = idx.get(key) || [];

  // 정확 일치 없으면 부분 일치 (4글자 prefix)
  if (candidates.length === 0 && buyerN.length >= 4) {
    const prefix = buyerN.substring(0, 4);
    candidates = contracts.filter(c =>
      c.company_id === inv.company_id && norm(c.client_company).startsWith(prefix)
    );
  }

  if (candidates.length === 0) { skipped++; continue; }

  if (candidates.length === 1) {
    matches.push({ id: inv.id, contract_id: candidates[0].id });
    matched++;
  } else {
    const best = await llmPick(inv, candidates);
    if (best) { matches.push({ id: inv.id, contract_id: best.id }); matched++; }
    else skipped++;
  }
  if ((matched + skipped) % 50 === 0) process.stdout.write(`${matched+skipped}/${unlinked.length}(✓${matched}) `);
}

console.log(`\n매칭 ${matched}, 스킵 ${skipped}`);

let applied = 0;
for (const m of matches) {
  const { error } = await sb.from('tax_invoices').update({ contract_id: m.contract_id }).eq('id', m.id);
  if (!error) applied++;
}
console.log(`✅ ${applied}건 적용`);

// 수금 재계산
const ti2 = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status');
const recvBy = new Map();
for (const t of ti2) {
  if (t.status !== 'paid' || !t.contract_id) continue;
  recvBy.set(t.contract_id, (recvBy.get(t.contract_id) || 0) + (t.total_amount || 0));
}

const c2 = await fetchAll('contracts', 'id, total_amount');
const cmap = new Map(c2.map(x => [x.id, x]));
let upd = 0;
for (const [cid, recv] of recvBy) {
  const c = cmap.get(cid);
  if (!c) continue;
  const total = c.total_amount || 0;
  const rate = total > 0 ? Math.min(100, (recv / total) * 100) : 0;
  const { error } = await sb.from('contracts').update({
    received_amount: recv,
    remaining_amount: Math.max(0, total - recv),
    progress_billing_rate: rate,
    updated_at: new Date().toISOString(),
  }).eq('id', cid);
  if (!error) upd++;
}
console.log(`\n✅ ${upd}개 계약 수금 업데이트`);
console.log(`수금 있는 계약: ${recvBy.size}개`);
const totalRecv = [...recvBy.values()].reduce((s,v)=>s+v,0);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
