import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function fetchAll(t) {
  const all=[]; let f=0;
  while(true){const{data}=await sb.from(t).select('*').range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000;}
  return all;
}

const clients = await fetchAll('client_companies');
const existingContacts = await fetchAll('client_contacts');
const contactByClient = new Map();
existingContacts.forEach(c => {
  const k = c.client_company_id;
  if (!contactByClient.has(k)) contactByClient.set(k, []);
  contactByClient.get(k).push(c);
});

console.log(`거래처 ${clients.length}개, 기존 contacts ${existingContacts.length}개`);

// notes에서 담당자 추출
// 패턴: "담당자: 박선영 차장 010-5120-8531" 또는 여러줄
function parseContactsFromNotes(notes) {
  if (!notes) return [];
  const lines = String(notes).split(/[\n|]/).map(l => l.trim()).filter(l => l.startsWith('담당자'));
  const result = [];
  for (const line of lines) {
    // "담당자: 박선영 차장 010-5120-8531" 또는 "담당자: 권선자 이사 02-6925-1671 010-3376-7290"
    const text = line.replace(/^담당자[:\s]*/, '').trim();
    if (!text) continue;
    // 전화번호 찾기 (여러개 가능)
    const phoneMatches = [...text.matchAll(/(\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4})/g)];
    const phones = phoneMatches.map(m => m[1].replace(/\s/g, ''));
    let nameAndPosition = text;
    if (phoneMatches.length > 0) {
      nameAndPosition = text.slice(0, phoneMatches[0].index).trim();
    }
    // "박선영 차장" -> name: 박선영, position: 차장
    const parts = nameAndPosition.split(/\s+/);
    let name = parts[0] || '';
    let position = parts.slice(1).join(' ') || '';
    if (!name) continue;
    result.push({
      name,
      position,
      mobile: phones.find(p => p.startsWith('010')) || null,
      phone: phones.find(p => !p.startsWith('010')) || null,
    });
  }
  return result;
}

let inserted = 0;
let cleanedNotes = 0;
const newContacts = [];
const noteUpdates = [];

for (const client of clients) {
  if (!client.notes || !client.notes.includes('담당자')) continue;
  const contacts = parseContactsFromNotes(client.notes);
  if (contacts.length === 0) continue;

  const existing = contactByClient.get(client.id) || [];
  for (const c of contacts) {
    // 중복 체크 (이름 + 휴대전화)
    const dup = existing.find(e => e.name === c.name && (e.mobile === c.mobile || (!e.mobile && !c.mobile)));
    if (dup) continue;
    newContacts.push({
      id: crypto.randomUUID(),
      client_company_id: client.id,
      name: c.name,
      position: c.position || null,
      mobile: c.mobile,
      phone: c.phone,
      email: null,
      is_primary: existing.length === 0 && newContacts.filter(x => x.client_company_id === client.id).length === 0,
      created_at: new Date().toISOString(),
    });
  }

  // notes에서 담당자 라인 제거
  const cleanLines = String(client.notes).split(/[\n|]/).filter(l => !l.trim().startsWith('담당자'));
  const cleanNotes = cleanLines.join('\n').trim() || null;
  if (cleanNotes !== client.notes) {
    noteUpdates.push({ id: client.id, notes: cleanNotes });
  }
}

console.log(`\n신규 contacts ${newContacts.length}개 등록 예정`);
console.log(`notes 정리 ${noteUpdates.length}개 거래처`);

// insert
const CHUNK = 100;
for (let i = 0; i < newContacts.length; i += CHUNK) {
  const batch = newContacts.slice(i, i + CHUNK);
  const { error } = await sb.from('client_contacts').insert(batch);
  if (error) {
    console.log(`❌ batch ${i}: ${error.message}`);
    for (const c of batch) {
      const { error: e2 } = await sb.from('client_contacts').insert(c);
      if (!e2) inserted++;
    }
  } else inserted += batch.length;
  process.stdout.write(`${inserted} `);
}
console.log(`\n✅ ${inserted}개 contact 등록`);

// notes 정리
let updated = 0;
for (const u of noteUpdates) {
  const { error } = await sb.from('client_companies').update({ notes: u.notes, updated_at: new Date().toISOString() }).eq('id', u.id);
  if (!error) updated++;
}
console.log(`✅ ${updated}개 거래처 notes 정리 완료`);

// 통계
const finalContacts = await fetchAll('client_contacts');
console.log(`\n최종 contacts: ${finalContacts.length}개`);
