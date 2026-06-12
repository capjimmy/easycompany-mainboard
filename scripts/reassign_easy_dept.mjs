import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const { data: easy } = await sb.from('companies').select('id').eq('name', '이지컨설턴트').single();
const { data: deps } = await sb.from('departments').select('id, name').eq('company_id', easy.id);
const dn = (n) => deps.find(d => d.name === n)?.id;

const greenCert = dn('친환경인증본부');
const edu = dn('교육환경본부');
const arch = dn('건축계획본부');
console.log('부서 ID:', { greenCert, edu, arch });

const contracts = await fetchAll('contracts', 'id, company_id, department_id, service_name, notes, source_file_path');
const target = contracts.filter(c => c.company_id === easy.id);
console.log(`이지컨설턴트 계약: ${target.length}건`);

let counts = { greenCert: 0, edu: 0, arch: 0, none: 0 };
for (const c of target) {
  const text = `${c.service_name || ''} ${c.notes || ''} ${c.source_file_path || ''}`.toLowerCase();
  let deptId = null;
  // 친환경/본인증/녹색 우선
  if (/친환경|녹색|에너지효율|zeb|본인증|장수명|결로|에너지|esg|친환경인증/i.test(text)) {
    deptId = greenCert;
    counts.greenCert++;
  } else if (/제네시스|교육환경|학교|유치원|초등|중학|고등|교육|에듀|edu/i.test(text)) {
    deptId = edu;
    counts.edu++;
  } else if (/공동주택|아파트|설계|공모|건축사사무소|민간참여|발주처|타워|주거|판상형/i.test(text)) {
    deptId = arch;
    counts.arch++;
  } else {
    counts.none++;
  }
  if (deptId && deptId !== c.department_id) {
    await sb.from('contracts').update({ department_id: deptId }).eq('id', c.id);
  }
}
console.log('분류:', counts);

// 최종
const after = await fetchAll('contracts', 'company_id, department_id');
const easyAfter = after.filter(x => x.company_id === easy.id);
const assigned = easyAfter.filter(x => x.department_id).length;
console.log(`\n이지컨설턴트 배정: ${assigned}/${easyAfter.length} (${Math.round(assigned/easyAfter.length*100)}%)`);

const byDept = {};
easyAfter.forEach(x => {
  const dnName = deps.find(d => d.id === x.department_id)?.name || '미배정';
  byDept[dnName] = (byDept[dnName] || 0) + 1;
});
console.log('부서별:', byDept);
