import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

console.log('=== 현재 상태 점검 ===\n');

// 세금계산서
const tis = await fetchAll('tax_invoices', 'id, contract_id, buyer_name, company_id');
const tiUnlinked = tis.filter(t => !t.contract_id);
console.log(`tax_invoices 총: ${tis.length} / 미연결: ${tiUnlinked.length}`);

// 계약
const contracts = await fetchAll('contracts', 'id, company_id, department_id, client_company, total_amount, received_amount');
console.log(`contracts 총: ${contracts.length}`);

// 회사
const { data: companies } = await sb.from('companies').select('id, name');
console.log(`companies:`, companies);

// 이지컨설턴트 미배정
const easy = companies.find(c => c.name === '이지컨설턴트');
if (easy) {
  const easyContracts = contracts.filter(c => c.company_id === easy.id);
  const easyUnassigned = easyContracts.filter(c => !c.department_id);
  console.log(`이지컨설턴트 계약: ${easyContracts.length} / 미배정: ${easyUnassigned.length}`);
}

// 거래처
const clients = await fetchAll('client_companies', 'id, company_id, name, business_number');
console.log(`client_companies 총: ${clients.length}`);

// 과다 수금
const overPaid = contracts.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
console.log(`과다 수금 (110%+): ${overPaid.length}`);

// payment_receipts
const prs = await fetchAll('payment_receipts', 'id, contract_id, amount');
console.log(`payment_receipts 총: ${prs.length}`);
