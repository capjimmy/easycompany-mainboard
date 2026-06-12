import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const prs = await fetchAll('payment_receipts', 'id, contract_id, billing_id, receivable_id, amount, status, depositor_name, payment_date');
console.log(`payment_receipts 총: ${prs.length}`);
const withCid = prs.filter(p => p.contract_id).length;
const withBill = prs.filter(p => p.billing_id).length;
const withRecv = prs.filter(p => p.receivable_id).length;
console.log(`  contract_id: ${withCid}`);
console.log(`  billing_id: ${withBill}`);
console.log(`  receivable_id: ${withRecv}`);

// 샘플
console.log('\n샘플 5건:');
prs.slice(0,5).forEach(p => console.log(`  contract=${p.contract_id?.slice(0,8)} amount=${p.amount} depositor=${p.depositor_name}`));

// status별
const byStatus = {};
prs.forEach(p => byStatus[p.status || 'null'] = (byStatus[p.status||'null']||0)+1);
console.log('\nstatus:', byStatus);

// 총 수금
const totalAmt = prs.reduce((s,p) => s + (Number(p.amount)||0), 0);
console.log(`\n총 수금 amount: ${totalAmt.toLocaleString()}원`);

// tax_invoices.contract_id 상태 (paid)
const tis = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status');
const paidLinked = tis.filter(t => t.contract_id && t.status === 'paid');
const totalPaid = paidLinked.reduce((s,t) => s + (Number(t.total_amount)||0), 0);
console.log(`\ntax_invoices paid+linked: ${paidLinked.length} → ${totalPaid.toLocaleString()}원`);

// status별
const tiByStatus = {};
tis.forEach(t => tiByStatus[t.status||'null'] = (tiByStatus[t.status||'null']||0)+1);
console.log('TI status:', tiByStatus);
