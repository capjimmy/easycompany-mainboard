import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}
const c = await fetchAll('contracts', 'client_company');
const taeyoung = c.filter(x => x.client_company && x.client_company.includes('태영'));
console.log('태영 관련:', taeyoung.length);
taeyoung.slice(0,5).forEach(x => console.log(' -', x.client_company));

const haean = c.filter(x => x.client_company && x.client_company.includes('해안'));
console.log('\n해안 관련:', haean.length);
haean.slice(0,5).forEach(x => console.log(' -', x.client_company));
