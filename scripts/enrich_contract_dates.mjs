import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const json = JSON.parse(fs.readFileSync('release/contracts.json', 'utf-8'));
console.log(`JSON contracts: ${json.length}건`);

// DB의 contracts 모두 로드
async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true) { const {data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000; }
  return all;
}

const dbContracts = await fetchAll('contracts', 'id, contract_number, contract_date, contract_start_date, contract_end_date, source_file_path');
console.log(`DB contracts: ${dbContracts.length}건`);

// JSON과 DB를 매칭 (contract_number 또는 source_file로)
const jsonByNumber = new Map();
const jsonBySource = new Map();
for (const j of json) {
  if (j.contract_number) jsonByNumber.set(j.contract_number, j);
  if (j.source_file) jsonBySource.set(j.source_file, j);
}

let updated = 0;
let skipped = 0;
for (const dbC of dbContracts) {
  // 매칭 시도
  let j = jsonByNumber.get(dbC.contract_number);
  if (!j && dbC.source_file_path) j = jsonBySource.get(dbC.source_file_path);
  if (!j) { skipped++; continue; }

  const updates = {};
  // 날짜만 보강 (DB에 없을 때만)
  if (!dbC.contract_date && j.contract_date) updates.contract_date = j.contract_date;
  if (!dbC.contract_start_date && j.start_date) updates.contract_start_date = j.start_date;
  if (!dbC.contract_end_date && j.end_date) updates.contract_end_date = j.end_date;

  if (Object.keys(updates).length === 0) continue;
  updates.updated_at = new Date().toISOString();
  const { error } = await sb.from('contracts').update(updates).eq('id', dbC.id);
  if (!error) updated++;
  if (updated % 50 === 0) process.stdout.write(`${updated} `);
}

console.log(`\n✅ ${updated}건 날짜 보강, ${skipped}건 매칭 실패`);

// 통계
const after = await fetchAll('contracts', 'contract_date, contract_start_date, contract_end_date');
console.log(`\n=== 최종 ===`);
console.log(`contract_date: ${after.filter(x=>x.contract_date).length}/${after.length}`);
console.log(`contract_start_date: ${after.filter(x=>x.contract_start_date).length}/${after.length}`);
console.log(`contract_end_date: ${after.filter(x=>x.contract_end_date).length}/${after.length}`);
