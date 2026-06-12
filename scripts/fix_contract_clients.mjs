// 잘못된 거래처명을 source_file_path 분석해서 정정
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: keyData.value });

async function fetchAll(t, c) {
  const all = []; let f = 0;
  while (true) { const { data } = await sb.from(t).select(c).order('id').range(f, f + 999); if (!data || !data.length) break; all.push(...data); if (data.length < 1000) break; f += 1000; }
  return all;
}

const badPatterns = ['시설공사','정보통신','전기공사','신축공사','전기통신','기타공사','공동주택','임대주택','공공주택','소방공사','리모델링공사','상호','지급조건에따름공급가액','대표이사참조','친환경인증','수급','소방시설공사','초고속정보통신','공공임대주택','분청신축공사','주소'];
const isBad = (n) => !n || n.length < 4 || badPatterns.some(p => n.includes(p)) || n.includes('사업자');

const contracts = await fetchAll('contracts', 'id, client_company, service_name, source_file_path, total_amount, contract_date');
const bad = contracts.filter(c => isBad(c.client_company));
console.log(`처리 대상: ${bad.length}건`);

function getProjectKey(path) {
  if (!path) return null;
  const parts = path.replace(/\\\\/g, '/').replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length < 3) return parts.join('/');
  return parts.slice(0, -2).join('/');
}

const groups = new Map();
for (const c of bad) {
  const key = getProjectKey(c.source_file_path);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
console.log(`그룹: ${groups.size}개`);

async function llm(folder, samples) {
  const prompt = `다음 계약 파일 경로/파일명에서 실제 거래처명을 추출하세요.

폴더: ${folder}
파일들:
${samples.slice(0, 5).map(s => '- ' + s).join('\n')}

JSON으로만 답변:
{"client": "정확한 거래처 회사명"}

규칙:
- (주)/㈜/주식회사 표기 정확히 유지
- LH는 "한국토지주택공사 (LH)"
- 학교/관공서는 정식 이름
- 추출 불가하면 client를 null`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '한국 건설업 데이터 정제 전문가. JSON만 답.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 100,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    return JSON.parse(r.choices[0]?.message?.content || '{}');
  } catch (e) { return {}; }
}

let updated = 0;
let skipped = 0;
const groupArr = [...groups.entries()];
for (let i = 0; i < groupArr.length; i++) {
  const [folder, items] = groupArr[i];
  const samples = items.map(it => it.source_file_path.split(/[\\/]/).pop());
  const result = await llm(folder, samples);
  if (result.client && result.client.length >= 3) {
    for (const it of items) {
      const { error } = await sb.from('contracts').update({
        client_company: result.client,
        updated_at: new Date().toISOString(),
      }).eq('id', it.id);
      if (!error) updated++;
    }
  } else {
    skipped += items.length;
  }
  if ((i + 1) % 10 === 0) process.stdout.write(`[${i+1}/${groupArr.length}] upd=${updated}\n`);
}
console.log(`\n✅ ${updated}건 업데이트, ${skipped}건 스킵`);

const after = await fetchAll('contracts', 'client_company');
const stillBad = after.filter(c => isBad(c.client_company)).length;
console.log(`\n남은 잘못된 거래처: ${stillBad}건`);
