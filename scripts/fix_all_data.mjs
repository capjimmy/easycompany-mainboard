import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[\s\(\)\[\]\{\}㈜（）「」『』""''.,\-_/\:;]/g, '').replace(/주식회사|유한회사|사단법인|재단법인|건축사사무소|종합건축사사무소|엔지니어링/g, '');
}

// 1. 잘못된 계약 날짜 정정
console.log('=== 1. 잘못된 계약 날짜 정정 ===');
const badDates = await fetchAll('contracts', 'id, contract_date');
const toFix = badDates.filter(c => c.contract_date && !/^\d{4}-\d{2}-\d{2}$/.test(c.contract_date));
for (const c of toFix) {
  await sb.from('contracts').update({ contract_date: null }).eq('id', c.id);
  console.log(`  "${c.contract_date}" → null`);
}

// 2. 세금계산서 → 계약 매칭 (거래처+적요 기준, LLM 없이)
console.log('\n=== 2. 세금계산서 → 계약 매칭 ===');
const ti = await fetchAll('tax_invoices', 'id, company_id, buyer_name, item_description, total_amount, issue_date');
const contracts = await fetchAll('contracts', 'id, company_id, client_company, service_name, total_amount');

const cIdx = new Map();
for (const c of contracts) {
  if (!c.client_company) continue;
  const key = `${c.company_id}::${norm(c.client_company)}`;
  if (!cIdx.has(key)) cIdx.set(key, []);
  cIdx.get(key).push(c);
}

let matched = 0;
for (const t of ti) {
  if (t.contract_id) continue;
  const tn = norm(t.buyer_name);
  if (!tn) continue;

  // 정확 매칭
  let candidates = cIdx.get(`${t.company_id}::${tn}`) || [];
  // 부분 매칭
  if (candidates.length === 0) {
    for (const [key, list] of cIdx) {
      if (!key.startsWith(`${t.company_id}::`)) continue;
      const cn = key.split('::')[1];
      if (cn.length >= 3 && (cn.includes(tn) || tn.includes(cn))) {
        candidates.push(...list);
      }
    }
  }
  if (candidates.length === 0) continue;

  // 적요 매칭으로 최적 후보 선택
  const descN = norm(t.item_description);
  let best = candidates[0];
  let bestScore = 0;
  for (const c of candidates) {
    const sn = norm(c.service_name);
    if (descN && sn) {
      const minLen = Math.min(descN.length, sn.length, 10);
      let score = 0;
      for (let i = 0; i < minLen; i++) { if (descN[i] === sn[i]) score++; else break; }
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }

  await sb.from('tax_invoices').update({ contract_id: best.id }).eq('id', t.id);
  matched++;
}
console.log(`매칭: ${matched}건 / ${ti.length}건`);

// 3. 세금계산서 합계행 제거
console.log('\n=== 3. 합계행 제거 ===');
const { error: delErr } = await sb.from('tax_invoices').delete().ilike('item_description', '%총매출%');
console.log('총매출 행 삭제:', delErr ? '❌' : '✅');
const { error: delErr2 } = await sb.from('tax_invoices').delete().ilike('item_description', '%총건%');
console.log('총건 행 삭제:', delErr2 ? '❌' : '✅');

// 4. 최종 통계
console.log('\n=== 최종 ===');
const { count: tiCount } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
const tiLinked = await fetchAll('tax_invoices', 'contract_id');
console.log(`세금계산서: ${tiCount}건, 계약 연결: ${tiLinked.filter(t=>t.contract_id).length}건`);
