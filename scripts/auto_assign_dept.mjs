import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const { data: cos } = await sb.from('companies').select('id, name');
const { data: deps } = await sb.from('departments').select('id, name, company_id');
const cByName = new Map(cos.map(c => [c.name, c.id]));

// 회사별 부서 lookup
function findDept(companyId, deptName) {
  return deps.find(d => d.company_id === companyId && d.name === deptName)?.id;
}

const easyId = cByName.get('이지컨설턴트');
const kerId = cByName.get('건설환경연구소');

// 부서 ID
const easyDepts = {
  green_cert: findDept(easyId, '친환경인증사업본부'),
  edu: findDept(easyId, '교육환경본부'),
  arch: findDept(easyId, '건축계획본부'),
  arch_old: findDept(easyId, '건축계획부'),
  strategy: findDept(easyId, '전략기획본부'),
  mgmt: findDept(easyId, '경영지원본부'),
};
console.log('이지컨설턴트 부서 ID:', easyDepts);

// 미배정 계약 가져오기
const contracts = await fetchAll('contracts', 'id, company_id, contract_number, service_name, notes, source_file_path');
const unassigned = contracts.filter(c => !c.department_id || c.department_id === null);
const easyUnassigned = unassigned.filter(c => c.company_id === easyId);
console.log(`이지컨설턴트 미배정: ${easyUnassigned.length}`);

let assigned = 0;
for (const c of easyUnassigned) {
  const text = `${c.service_name || ''} ${c.notes || ''} ${c.source_file_path || ''}`.toLowerCase();

  let deptId = null;
  // 친환경/본인증/녹색/에너지효율 → 친환경인증사업본부
  if (/친환경|녹색|에너지효율|zeb|본인증|장수명/.test(text)) {
    deptId = easyDepts.green_cert;
  }
  // 제네시스/교육환경/학교/유치원 → 교육환경본부
  else if (/제네시스|교육환경|학교|유치원|초등|중학|고등/.test(text)) {
    deptId = easyDepts.edu;
  }
  // 공동주택/아파트 설계 → 건축계획본부
  else if (/공동주택|아파트|설계|건축/.test(text)) {
    deptId = easyDepts.arch;
  }

  if (deptId) {
    await sb.from('contracts').update({ department_id: deptId }).eq('id', c.id);
    assigned++;
  }
}
console.log(`✅ 이지컨설턴트 부서 자동 배정: ${assigned}건`);

// 건설환경연구소는 학술사업부 기본
const kerDept = findDept(kerId, '학술사업부');
if (kerDept) {
  const kerUnassigned = unassigned.filter(c => c.company_id === kerId);
  let kerAssigned = 0;
  for (const c of kerUnassigned) {
    await sb.from('contracts').update({ department_id: kerDept }).eq('id', c.id);
    kerAssigned++;
  }
  console.log(`✅ 건설환경연구소 → 학술사업부: ${kerAssigned}건`);
}

// 최종 통계
console.log('\n=== 최종 부서 배정 현황 ===');
const after = await fetchAll('contracts', 'company_id, department_id');
for (const c of cos) {
  const my = after.filter(x => x.company_id === c.id);
  if (my.length === 0) continue;
  const assigned = my.filter(x => x.department_id).length;
  console.log(`  ${c.name}: ${assigned}/${my.length} (${Math.round(assigned/my.length*100)}%)`);
}
