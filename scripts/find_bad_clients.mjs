import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, client_company, service_name, source_file_path, total_amount');
// 일반명사 패턴
const badPatterns = ['시설공사','정보통신','전기공사','신축공사','전기통신','기타공사','공동주택','임대주택','공공주택','소방공사','리모델링공사','상호','지급조건에따름공급가액','대표이사참조','친환경인증','수급'];
const isBad = (n) => !n || n.length < 4 || badPatterns.some(p => n.includes(p)) || n.includes('사업자');

const bad = contracts.filter(c => isBad(c.client_company));
console.log(`잘못된 거래처명 계약: ${bad.length}건`);

// 거래처명별 카운트
const byName = {};
bad.forEach(c => byName[c.client_company || '(empty)'] = (byName[c.client_company || '(empty)'] || 0) + 1);
Object.entries(byName).sort((a,b)=>b[1]-a[1]).forEach(([n,c]) => console.log(`  ${c}: ${n}`));
