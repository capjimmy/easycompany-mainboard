// AI-powered cleanup of quotes/contracts client_company + service_name
// using source_file_path via OpenAI gpt-4o-mini, batched by folder.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const startTime = Date.now();

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

const { data: keySetting } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const apiKey = keySetting?.value;
if (!apiKey) { console.error('no openai key'); process.exit(1); }
const openai = new OpenAI({ apiKey });
console.log('OpenAI ready');

// ---- helpers ----
async function fetchAll(table, columns) {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const BAD_CLIENT_TOKENS = [
  '시설공사', '정보통신', '전기공사', '신축공사', '토목공사', '건축공사',
  '기계설비', '소방시설', '통신공사', '조경공사', '철거공사', '리모델링',
  '증축공사', '개축공사', '보수공사', '보강공사',
];
const BAD_CONTAINS = ['사업자', '상호', '공급가액', '수급', '계약자', '대표이사', '참조'];

function isBadClient(name) {
  if (!name || !name.trim()) return true;
  const n = name.trim();
  if (n.length < 2) return true;
  if (n.length > 40) return true;
  if (BAD_CLIENT_TOKENS.includes(n)) return true;
  for (const t of BAD_CONTAINS) if (n.includes(t)) return true;
  // mostly not-a-company looking (no 주/공사/건설/법인/LH/공사 / 주식회사...)
  return false;
}

function extractFolder(path) {
  if (!path) return '';
  // Normalize slashes
  const p = path.replace(/\\/g, '/');
  const idx = p.lastIndexOf('/');
  return idx > 0 ? p.substring(0, idx) : p;
}

// pick a meaningful "project folder" — the segment right after 연도 or sub-path
function projectKey(path) {
  if (!path) return '';
  const p = path.replace(/\\/g, '/');
  // take everything except last 2 segments (file + immediate subfolder), to group siblings under same project
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 3) return parts.join('/');
  return parts.slice(0, Math.max(3, parts.length - 2)).join('/');
}

// ---- load data ----
console.log('\n== Load ==');
const contracts = await fetchAll('contracts', 'id, client_company, service_name, source_file_path, notes, total_amount');
const quotes = await fetchAll('quotes', 'id, recipient_company, service_name, title, source_file_path, notes, total_amount, grand_total');
console.log(`contracts=${contracts.length} quotes=${quotes.length}`);

// extract source_file_path for quotes from column or notes
function getPath(row, kind) {
  if (row.source_file_path && row.source_file_path.trim()) return row.source_file_path;
  const notes = row.notes || '';
  const m = notes.match(/(?:출처|source)[:\s]*([^\n|]+)/i);
  if (m) return m[1].trim();
  if (notes.includes('diskstation') || notes.includes('\\\\') || notes.includes('//')) return notes;
  return '';
}

function pickBad(rows, kind) {
  return rows.filter(r => {
    const path = getPath(r, kind);
    if (!path) return false;
    const clientField = kind === 'quote' ? r.recipient_company : r.client_company;
    const serviceBad = !r.service_name || !r.service_name.trim();
    const clientBad = isBadClient(clientField);
    const amountBad = (r.total_amount || 0) > 10_000_000_000; // > 10B KRW likely wrong
    return clientBad || serviceBad || amountBad;
  });
}

const badContracts = pickBad(contracts, 'contract');
const badQuotes = pickBad(quotes, 'quote');
console.log(`bad contracts=${badContracts.length} bad quotes=${badQuotes.length}`);

// ---- group by project folder ----
function groupByProject(rows, kind) {
  const groups = new Map();
  for (const r of rows) {
    const path = getPath(r, kind);
    const key = projectKey(path);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, rows: [], paths: new Set() });
    const g = groups.get(key);
    g.rows.push(r);
    g.paths.add(path);
  }
  return [...groups.values()];
}

let llmCalls = 0;
const LLM_LIMIT = 2000;
let approxInputTokens = 0, approxOutputTokens = 0;

async function askProject(groupKey, paths) {
  if (llmCalls >= LLM_LIMIT) return null;
  llmCalls++;
  const pathList = [...paths].slice(0, 20).map((p, i) => `${i + 1}. ${p}`).join('\n');
  const prompt = `아래는 같은 프로젝트 폴더에 속하는 파일 경로들입니다. 경로를 분석해서 이 프로젝트의 진짜 발주처(client)와 과업명(service)을 한국어로 추출해주세요.

[파일 경로들]
${pathList}

힌트:
- 경로에 "LH" 또는 "한국토지주택공사"가 있으면 client="한국토지주택공사 (LH)"
- "(주)○○건설", "○○종합건설" 등 회사명이 경로에 있으면 그것이 client
- 과업명(service)은 프로젝트명 + 업무종류(분양가상한, ESC/물가변동, 계약내역 등)로 간결하게
- client를 알 수 없으면 "" 반환

JSON만 반환: {"client":"...","service":"..."}`;

  approxInputTokens += prompt.length / 3;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 한국 건설 프로젝트 파일 경로 분석 전문가입니다. 반드시 JSON 한 줄만 출력하세요.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const txt = res.choices[0]?.message?.content?.trim() || '{}';
    approxOutputTokens += txt.length / 3;
    const parsed = JSON.parse(txt);
    return { client: (parsed.client || '').trim(), service: (parsed.service || '').trim() };
  } catch (err) {
    console.log(`LLM err: ${err.message}`);
    return null;
  }
}

async function processKind(kind, rows, table, clientField) {
  console.log(`\n== ${kind} (${rows.length} bad) ==`);
  const groups = groupByProject(rows, kind);
  console.log(`${groups.length} project groups`);

  let updated = 0, skipped = 0;
  let gi = 0;
  for (const g of groups) {
    gi++;
    if (llmCalls >= LLM_LIMIT) { console.log('LLM limit reached'); break; }
    const result = await askProject(g.key, g.paths);
    if (!result || (!result.client && !result.service)) { skipped += g.rows.length; continue; }

    for (const r of g.rows) {
      const patch = {};
      const curClient = r[clientField];
      if (result.client && isBadClient(curClient)) patch[clientField] = result.client;
      if (result.service && (!r.service_name || !r.service_name.trim())) patch.service_name = result.service;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await sb.from(table).update(patch).eq('id', r.id);
      if (!error) updated++;
    }

    if (gi % 10 === 0) {
      process.stdout.write(`  [${gi}/${groups.length}] llm=${llmCalls} upd=${updated}\n`);
    }
  }
  console.log(`${kind}: updated=${updated} skipped=${skipped} llm_calls=${llmCalls}`);
  return updated;
}

// ---- run ----
const cUpd = await processKind('contracts', badContracts, 'contracts', 'client_company');
const qUpd = await processKind('quotes', badQuotes, 'quotes', 'recipient_company');

// ---- verification ----
console.log('\n== Verification ==');
const { count: cTotal } = await sb.from('contracts').select('*', { count: 'exact', head: true });
const { count: cSvc } = await sb.from('contracts').select('*', { count: 'exact', head: true }).not('service_name', 'is', null);
const { count: qTotal } = await sb.from('quotes').select('*', { count: 'exact', head: true });
const { count: qSvc } = await sb.from('quotes').select('*', { count: 'exact', head: true }).not('service_name', 'is', null);
console.log(`contracts: ${cTotal} total, ${cSvc} with service_name`);
console.log(`quotes:    ${qTotal} total, ${qSvc} with service_name`);

// count contracts/quotes with "valid" client (not in bad list)
const allC = await fetchAll('contracts', 'id,client_company');
const goodC = allC.filter(c => !isBadClient(c.client_company)).length;
const allQ = await fetchAll('quotes', 'id,recipient_company');
const goodQ = allQ.filter(q => !isBadClient(q.recipient_company)).length;
console.log(`contracts: ${goodC}/${cTotal} valid client_company`);
console.log(`quotes:    ${goodQ}/${qTotal} valid recipient_company`);

// top 10 clients
const freq = new Map();
for (const c of allC) {
  const k = c.client_company || '(null)';
  freq.set(k, (freq.get(k) || 0) + 1);
}
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\nTop 10 contract clients:');
for (const [name, n] of top) console.log(`  ${n.toString().padStart(4)}  ${name}`);

const secs = ((Date.now() - startTime) / 1000).toFixed(1);
// gpt-4o-mini: ~$0.15/M input, ~$0.60/M output
const cost = (approxInputTokens / 1e6) * 0.15 + (approxOutputTokens / 1e6) * 0.60;
console.log(`\nDone in ${secs}s. LLM calls=${llmCalls}. ~$${cost.toFixed(4)} (rough).`);
