import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const projects = JSON.parse(fs.readFileSync('c:/Users/parkm/easy_company/정제된데이터/projects_trusted_only.json', 'utf-8'));
const contracts = await fetchAll('contracts', 'id, service_name, contract_amount, total_amount, received_amount');

// contract_amount = 공급가액, total_amount은 VAT 포함으로 재계산해야 함
// projects에서 total_invoiced(세금계산서 합계)가 실제 총액
let updated = 0;
for (const c of contracts) {
  const p = projects.find(pr => pr.project_name === c.service_name);
  if (!p) continue;

  // 정제 데이터의 금액 구조:
  // contract_amount = 공급가액 (세전)
  // total_invoiced = 세금계산서 발행 총액 (세후, 실제 청구액)
  // total_paid = 실제 입금액 (세후)
  // unpaid = 미수금

  const contractAmount = p.contract_amount || 0; // 공급가액
  const totalInvoiced = p.total_invoiced || 0; // 발행 총액
  const totalPaid = p.total_paid || 0;
  const unpaid = p.unpaid || 0;

  // DB에 저장할 값:
  // contract_amount = 공급가액 (세전)
  // vat_amount = 공급가액 * 0.1
  // total_amount = 공급가액 + VAT = 총 계약금액 (세후)
  // 하지만 실제로는 total_invoiced가 더 정확한 총액
  const totalAmount = totalInvoiced > contractAmount ? totalInvoiced : Math.round(contractAmount * 1.1);

  await sb.from('contracts').update({
    contract_amount: contractAmount,
    total_amount: totalAmount,
    received_amount: totalPaid,
    remaining_amount: Math.max(0, totalAmount - totalPaid),
    progress_billing_rate: totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', c.id);
  updated++;
}
console.log(`업데이트: ${updated}건`);

// 검증
const after = await fetchAll('contracts', 'received_amount, total_amount');
const overPaid = after.filter(c => c.received_amount > c.total_amount * 1.05 && c.total_amount > 0).length;
const withRecv = after.filter(c => c.received_amount > 0).length;
console.log(`수금 있는 계약: ${withRecv} / ${after.length}`);
console.log(`과다수금(1.05배초과): ${overPaid}`);
