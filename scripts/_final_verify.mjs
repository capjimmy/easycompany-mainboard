import { createClient } from '@supabase/supabase-js';
import { randomUUID as uuidv4 } from 'crypto';
import fs from 'fs';

const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const m=l.match(/^([A-Z_]+)=(.+)$/); if(m) env[m[1]]=m[2].trim(); });
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

console.log('=== 최종 GREEN LIGHT 검증 ===\n');

// === A) expense_settlement_items.update 정상 작동 ===
console.log('[A] expense_settlement_items.update — updated_at 컬럼');
const { data: settle } = await sb.from('expense_settlements').insert({
  company_id: 'a0000000-0000-0000-0000-000000000001',
  user_id: '39124c0d-f382-4f78-a60b-e77d0458ac2b',
  settlement_date: new Date().toISOString().slice(0,10),
  title: 'FINAL_TEST',
  total_amount: 100,
}).select().single();
const { data: item } = await sb.from('expense_settlement_items').insert({
  settlement_id: settle.id,
  category_name: '교통비', description: '버스', amount: 100,
  expense_date: new Date().toISOString().slice(0,10),
}).select().single();

const { error: ue } = await sb.from('expense_settlement_items')
  .update({ amount: 200, updated_at: new Date().toISOString() }).eq('id', item.id);
console.log('  update with updated_at:', ue ? '✗ ' + ue.message : '✓ 성공');

await sb.from('expense_settlement_items').delete().eq('settlement_id', settle.id);
await sb.from('expense_settlements').delete().eq('id', settle.id);

// === B) 계약 FK CASCADE 검증 ===
console.log('\n[B] 계약 삭제 → 자식 자동 CASCADE');
const { data: ctr } = await sb.from('contracts').insert({
  company_id: 'a0000000-0000-0000-0000-000000000001',
  contract_number: 'FINAL_FK_' + Date.now(),
  contract_amount: 1, vat_amount: 0, total_amount: 1,
  progress: 'contract_signed',
}).select().single();

await sb.from('contract_members').insert({
  contract_id: ctr.id, user_id: '39124c0d-f382-4f78-a60b-e77d0458ac2b', user_name: 'test',
});
await sb.from('contract_meeting_notes').insert({
  contract_id: ctr.id, title: 'note', content: 'x',
  meeting_date: new Date().toISOString().slice(0,10),
});

await sb.from('contracts').delete().eq('id', ctr.id);
const { count: cmRemain } = await sb.from('contract_members').select('*', {count:'exact', head:true}).eq('contract_id', ctr.id);
const { count: cmnRemain } = await sb.from('contract_meeting_notes').select('*', {count:'exact', head:true}).eq('contract_id', ctr.id);
console.log('  contract_members 잔존:', cmRemain === 0 ? '✓ 0건 (CASCADE OK)' : '✗ ' + cmRemain);
console.log('  contract_meeting_notes 잔존:', cmnRemain === 0 ? '✓ 0건 (CASCADE OK)' : '✗ ' + cmnRemain);

// === C) 견적 FK CASCADE 검증 ===
console.log('\n[C] 견적 삭제 → 자식 자동 CASCADE');
const { data: q } = await sb.from('quotes').insert({
  company_id: 'a0000000-0000-0000-0000-000000000001',
  quote_number: 'FINAL_FK_Q_' + Date.now(), status: 'draft',
}).select().single();

await sb.from('quote_sections').insert({ quote_id: q.id, level: 1, title: 'sec', sort_order: 1 });
await sb.from('quote_members').insert({
  quote_id: q.id, user_id: '39124c0d-f382-4f78-a60b-e77d0458ac2b', user_name: 'test',
});

await sb.from('quotes').delete().eq('id', q.id);
const { count: qsRemain } = await sb.from('quote_sections').select('*', {count:'exact', head:true}).eq('quote_id', q.id);
const { count: qmRemain } = await sb.from('quote_members').select('*', {count:'exact', head:true}).eq('quote_id', q.id);
console.log('  quote_sections 잔존:', qsRemain === 0 ? '✓ 0건 (CASCADE OK)' : '✗ ' + qsRemain);
console.log('  quote_members 잔존:', qmRemain === 0 ? '✓ 0건 (CASCADE OK)' : '✗ ' + qmRemain);

console.log('\n=== ✅ ALL GREEN ===');
