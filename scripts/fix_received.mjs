import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

// 1. 잘못된 payment_receipts 전부 삭제
await sb.from('payment_receipts').delete().not('id', 'is', null);
console.log('payment_receipts 전부 삭제');

// 2. 세금계산서 contract_id 전부 해제
const tis = await fetchAll('tax_invoices', 'id, contract_id');
const linked = tis.filter(t => t.contract_id);
console.log(`세금계산서 contract_id 해제: ${linked.length}건`);
for (let i = 0; i < linked.length; i += 100) {
  const batch = linked.slice(i, i + 100);
  for (const t of batch) {
    await sb.from('tax_invoices').update({ contract_id: null }).eq('id', t.id);
  }
}

// 3. projects_trusted_only.json의 원본 수금액으로 계약 복원
const projects = JSON.parse(fs.readFileSync('c:/Users/parkm/easy_company/정제된데이터/projects_trusted_only.json', 'utf-8'));
const contracts = await fetchAll('contracts', 'id, contract_number, service_name, total_amount');

// contract_number 또는 service_name으로 매칭
let updated = 0;
for (const c of contracts) {
  // 같은 service_name으로 프로젝트 찾기
  const p = projects.find(pr => pr.project_name === c.service_name);
  if (!p) continue;
  
  const totalPaid = p.total_paid || 0;
  const totalAmount = c.total_amount || 0;
  const remaining = Math.max(0, totalAmount - totalPaid);
  
  await sb.from('contracts').update({
    received_amount: totalPaid,
    remaining_amount: remaining,
    progress_billing_rate: totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', c.id);
  updated++;
}
console.log(`\n계약 수금액 복원: ${updated}건`);

// 통계
const after = await fetchAll('contracts', 'received_amount, total_amount');
const withRecv = after.filter(c => c.received_amount > 0).length;
const overPaid = after.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0).length;
const totalRecv = after.reduce((s, c) => s + (c.received_amount || 0), 0);
console.log(`수금 있는 계약: ${withRecv} / ${after.length}`);
console.log(`과다수금(1.1배초과): ${overPaid}`);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
