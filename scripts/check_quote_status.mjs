import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const quotes = await fetchAll('quotes', 'id, status, linked_contract_id, recipient_company, service_name');
const contracts = await fetchAll('contracts', 'id, client_company, service_name, contract_date');

// 상태 분포
const byStatus = {};
quotes.forEach(q => byStatus[q.status || 'null'] = (byStatus[q.status || 'null'] || 0) + 1);
console.log('견적 상태 분포:', byStatus);

// 이미 linked_contract_id가 있는 것
const linked = quotes.filter(q => q.linked_contract_id).length;
console.log(`\nlinked_contract_id 있음: ${linked}건`);
console.log(`linked인데 status=draft: ${quotes.filter(q => q.linked_contract_id && q.status === 'draft').length}건`);

console.log(`\n총 견적: ${quotes.length}, 총 계약: ${contracts.length}`);
