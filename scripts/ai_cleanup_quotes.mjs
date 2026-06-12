// quotes 전용 AI 클렌징
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: keyData.value });

async function fetchAll(table, columns) {
  const all = []; let from = 0;
  while (true) {
    const { data } = await sb.from(table).select(columns).range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const quotes = await fetchAll('quotes', 'id, recipient_company, service_name, title, source_file_path, notes, grand_total');
console.log(`총 ${quotes.length}건`);

// 프로젝트 폴더로 그룹핑 (마지막 폴더의 부모 폴더 기준)
function getProjectFolder(path) {
  if (!path) return null;
  const parts = path.replace(/\\\\/g, '/').replace(/\\/g, '/').split('/').filter(Boolean);
  // 파일명 제외 + 가장 의미있는 폴더(보통 -3 또는 -4 위치)
  if (parts.length < 3) return parts.join('/');
  return parts.slice(0, -1).join('/');
}

const groups = new Map();
for (const q of quotes) {
  if (!q.source_file_path) continue;
  const folder = getProjectFolder(q.source_file_path);
  if (!folder) continue;
  if (!groups.has(folder)) groups.set(folder, []);
  groups.get(folder).push(q);
}
console.log(`프로젝트 그룹: ${groups.size}개`);

// LLM 호출
async function llmExtract(folder, sample) {
  const prompt = `아래는 견적서 파일의 폴더 경로와 파일명입니다. 이 견적서의 거래처(client)와 용역명(service)을 추출해주세요.

폴더: ${folder}
파일들:
${sample.slice(0, 5).map(s => '- ' + s).join('\n')}

JSON 형식으로만 답하세요:
{"client": "정확한 거래처 회사명", "service": "용역명"}

규칙:
- 폴더 경로에서 회사명을 찾으면 (주)/㈜/주식회사 표기를 정확히 유지
- LH는 "한국토지주택공사 (LH)"로 통일
- 학교/관공서는 정식 이름 사용
- 용역명은 프로젝트의 핵심을 한 줄로 요약
- 추출 불가하면 null`;
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 한국 건설업 데이터 정제 전문가입니다. JSON으로만 답하세요.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const txt = res.choices[0]?.message?.content || '{}';
    return JSON.parse(txt);
  } catch (e) {
    return { client: null, service: null };
  }
}

let processed = 0;
let updated = 0;
const groupArr = [...groups.entries()];
console.log('\n=== LLM 처리 ===');
for (let i = 0; i < groupArr.length; i++) {
  const [folder, items] = groupArr[i];
  const sample = items.map(it => it.source_file_path.split(/[\\/]/).pop());
  const result = await llmExtract(folder, sample);
  if (result.client || result.service) {
    // 모든 그룹 멤버에 적용
    for (const it of items) {
      const updates = {};
      // recipient_company가 잘못된 일반명사면 덮어쓰기
      const badNames = ['시설공사','정보통신','전기공사','신축공사','상호','지급조건에따름공급가액','공동주택','임대주택','공공주택','소방공사','전기통신','기타공사','리모델링공사','전기공사방화관리','대표이사참조','친환경인증'];
      if (result.client && (badNames.includes(it.recipient_company) || !it.recipient_company || it.recipient_company.length < 4)) {
        updates.recipient_company = result.client;
      }
      if (result.service && !it.service_name) updates.service_name = result.service;
      if (result.service && !it.title) updates.title = result.service;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error } = await sb.from('quotes').update(updates).eq('id', it.id);
        if (!error) updated++;
      }
    }
  }
  processed++;
  if (processed % 10 === 0) {
    process.stdout.write(`  [${processed}/${groupArr.length}] upd=${updated}\n`);
  }
}
console.log(`\n✅ ${updated}건 업데이트`);

// 최종 통계
const after = await fetchAll('quotes', 'service_name, title, recipient_company');
const withSvc = after.filter(q => q.service_name).length;
const withTitle = after.filter(q => q.title).length;
console.log(`\nservice_name 있음: ${withSvc} / ${after.length}`);
console.log(`title 있음: ${withTitle} / ${after.length}`);
