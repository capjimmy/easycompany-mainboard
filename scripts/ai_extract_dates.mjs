// source_file_path에서 날짜 추출 (파일명/폴더명에서 YYMMDD, YYYYMMDD, YYYY-MM-DD 등)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: keyData.value });

async function fetchAll(t, c, filter) {
  const all=[]; let f=0;
  while(true) {
    let q = sb.from(t).select(c).range(f, f+999);
    if (filter) q = filter(q);
    const {data}=await q;
    if(!data||!data.length)break;
    all.push(...data);
    if(data.length<1000)break;
    f+=1000;
  }
  return all;
}

// 1차: 정규식으로 추출 (250122, 2025-01-22, 20250122 등)
function regexDate(path) {
  if (!path) return null;
  const candidates = [];
  // YYYY-MM-DD or YYYY.MM.DD or YYYY_MM_DD
  let m;
  const re1 = /(20\d{2})[-._]?(\d{2})[-._]?(\d{2})/g;
  while ((m = re1.exec(path)) !== null) {
    const y = parseInt(m[1]);
    const mo = parseInt(m[2]);
    const d = parseInt(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2026) {
      candidates.push(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  }
  // YYMMDD (예: 250122)
  const re2 = /(?<!\d)(2[0-6])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g;
  while ((m = re2.exec(path)) !== null) {
    candidates.push(`20${m[1]}-${m[2]}-${m[3]}`);
  }
  if (candidates.length === 0) return null;
  // 가장 늦은 날짜 (보통 최신본)
  return candidates.sort().reverse()[0];
}

// 2차: AI 추출 (정규식 실패 시)
async function aiDate(path, kind) {
  const prompt = `다음 ${kind} 파일 경로에서 ${kind === '계약서' ? '계약일' : '견적일'}을 추출해주세요.
경로: ${path}

규칙:
- YYYY-MM-DD 형식으로만 답변
- 추출 불가능하면 "null"
- 폴더명에 연도(2024년, 2025년)만 있으면 그 해 1월 1일로
- 파일명의 6자리/8자리 숫자는 날짜로 해석 (250122 → 2025-01-22)`;
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '한국어 파일경로 분석. 날짜만 답하세요.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 30,
      temperature: 0,
    });
    const txt = res.choices[0]?.message?.content?.trim() || '';
    const m = txt.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

// === contracts ===
console.log('=== contracts 날짜 추출 ===');
const contracts = await fetchAll('contracts', 'id, contract_date, source_file_path, notes', q => q.is('contract_date', null));
console.log(`날짜 누락 ${contracts.length}건`);

let cRegex = 0, cAi = 0, cFail = 0;
for (let i = 0; i < contracts.length; i++) {
  const c = contracts[i];
  let path = c.source_file_path;
  if (!path && c.notes) {
    const m = c.notes.match(/출처[:\s]*([^\n|]+)/);
    if (m) path = m[1].trim();
  }
  if (!path) { cFail++; continue; }

  let date = regexDate(path);
  let method = 'regex';
  if (!date) {
    date = await aiDate(path, '계약서');
    method = 'ai';
  }
  if (date) {
    await sb.from('contracts').update({ contract_date: date, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (method === 'regex') cRegex++; else cAi++;
  } else cFail++;

  if ((i+1) % 30 === 0) process.stdout.write(`  ${i+1}/${contracts.length} (R${cRegex}/AI${cAi}/F${cFail})\n`);
}
console.log(`\n✅ 정규식 ${cRegex}, AI ${cAi}, 실패 ${cFail}`);

// === quotes ===
console.log('\n=== quotes 날짜 추출 ===');
const quotes = await fetchAll('quotes', 'id, quote_date, source_file_path, notes', q => q.is('quote_date', null));
console.log(`날짜 누락 ${quotes.length}건`);

let qRegex = 0, qAi = 0, qFail = 0;
for (let i = 0; i < quotes.length; i++) {
  const q = quotes[i];
  let path = q.source_file_path;
  if (!path && q.notes) {
    const m = q.notes.match(/출처[:\s]*([^\n|]+)/);
    if (m) path = m[1].trim();
  }
  if (!path) { qFail++; continue; }

  let date = regexDate(path);
  let method = 'regex';
  if (!date) {
    date = await aiDate(path, '견적서');
    method = 'ai';
  }
  if (date) {
    await sb.from('quotes').update({ quote_date: date, updated_at: new Date().toISOString() }).eq('id', q.id);
    if (method === 'regex') qRegex++; else qAi++;
  } else qFail++;

  if ((i+1) % 30 === 0) process.stdout.write(`  ${i+1}/${quotes.length} (R${qRegex}/AI${qAi}/F${qFail})\n`);
}
console.log(`\n✅ 정규식 ${qRegex}, AI ${qAi}, 실패 ${qFail}`);

// 통계
const { data: ca } = await sb.from('contracts').select('contract_date');
const { data: qa } = await sb.from('quotes').select('quote_date');
console.log(`\n=== 최종 ===`);
console.log(`contracts contract_date: ${ca.filter(x=>x.contract_date).length}/${ca.length}`);
console.log(`quotes quote_date: ${qa.filter(x=>x.quote_date).length}/${qa.length}`);
