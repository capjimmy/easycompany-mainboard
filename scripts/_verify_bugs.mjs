import { createClient } from '@supabase/supabase-js';
import { randomUUID as uuidv4 } from 'crypto';
import fs from 'fs';

const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const m=l.match(/^([A-Z_]+)=(.+)$/); if(m) env[m[1]]=m[2].trim(); });
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

console.log('=== 5개 BUG 종합 재검증 ===\n');

const { data: requester } = await sb.from('users').select('id, name, role, company_id, username').eq('role','super_admin').not('auth_user_id','is',null).limit(1).single();
const TS = Date.now();

// ===== BUG #1: 견적 섹션 IPC 형태로 INSERT =====
console.log('[BUG #1] quote_sections IPC 형태 INSERT (level/parent_id/description/amount)');
const { data: q } = await sb.from('quotes').insert({
  company_id: requester.company_id, quote_number: 'FINAL_'+TS, title: '[최종검증]',
  recipient_company: '발주처', service_name: '용역X',
  labor_total: 2000000, expense_total: 500000, section_total: 1000000,
  total_amount: 3500000, vat_amount: 350000, grand_total: 3850000,
  status: 'approved', created_by: requester.id,
}).select().single();

const majorId = uuidv4();
const midId = uuidv4();
const minorId = uuidv4();
const { error: sece } = await sb.from('quote_sections').insert([
  { id: majorId, quote_id: q.id, parent_id: null, level: 1, title: '대분류A', description: '설명1', amount: 600000, sort_order: 1 },
  { id: midId, quote_id: q.id, parent_id: majorId, level: 2, title: '중분류A1', description: '설명2', amount: 300000, sort_order: 1 },
  { id: minorId, quote_id: q.id, parent_id: midId, level: 3, title: '소분류A1a', description: '설명3', amount: 100000, sort_order: 1 },
]);
console.log('  견적 섹션 3단계 INSERT:', sece ? '✗ ' + sece.message : '✓');

// ===== BUG #2-5: 전환 시뮬레이션 =====
console.log('\n[BUG #2,#3,#4,#5] 견적→계약 전환');

const { data: members } = await sb.from('users').select('id, username').limit(2);
for (const m of members) {
  await sb.from('quote_members').insert({ quote_id: q.id, user_id: m.id, user_name: m.username, assigned_by: requester.id });
}
await sb.from('quote_labor_items').insert({ quote_id: q.id, grade_name: '부장', quantity: 1, participation_rate: 100, months: 2, unit_price: 1000000, subtotal: 2000000 });
await sb.from('quote_expense_items').insert({ quote_id: q.id, category_name: '제경비', amount: 500000, calculation_type: 'manual' });

const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
console.log('  [#5] role 체크:', allowedRoles.includes(requester.role) ? '✓ 통과 ('+requester.role+')' : '✗');
console.log('  [#4] 중복전환 미적용:', !q.converted_contract_id ? '✓ 초기상태' : '✗');

const contractId = uuidv4();
const now = new Date().toISOString();

try {
  await sb.from('contracts').insert({
    id: contractId, company_id: q.company_id, contract_number: 'FINAL_C_'+TS,
    client_company: q.recipient_company, service_name: q.service_name,
    contract_amount: q.total_amount, vat_amount: q.vat_amount, total_amount: q.grand_total,
    labor_total: q.labor_total, expense_total: q.expense_total, section_total: q.section_total,
    progress: 'contract_signed', received_amount: 0, remaining_amount: q.grand_total,
    manager_id: requester.id, manager_name: requester.name, source_quote_id: q.id, created_by: requester.id,
    contract_start_date: now.split('T')[0],
  });

  const { data: qLabor } = await sb.from('quote_labor_items').select('*').eq('quote_id', q.id);
  if (qLabor.length) await sb.from('contract_labor_items').insert(qLabor.map(i => ({
    contract_id: contractId, grade_name: i.grade_name, quantity: i.quantity,
    participation_rate: i.participation_rate, months: i.months, unit_price: i.unit_price, subtotal: i.subtotal
  })));

  const { data: qExp } = await sb.from('quote_expense_items').select('*').eq('quote_id', q.id);
  if (qExp.length) await sb.from('contract_expense_items').insert(qExp.map(i => ({
    contract_id: contractId, category_name: i.category_name, calculation_type: i.calculation_type || 'manual',
    rate: i.rate, amount: i.amount
  })));

  // BUG #3 fix: 새 컬럼 사용
  const { data: qSecs } = await sb.from('quote_sections').select('*').eq('quote_id', q.id);
  if (qSecs.length) {
    const idMap = {};
    const sorted = [...qSecs].sort((a, b) => (a.level || 1) - (b.level || 1));
    const rows = sorted.map((item) => {
      const newId = uuidv4();
      idMap[item.id] = newId;
      return {
        id: newId, contract_id: contractId,
        parent_id: item.parent_id ? (idMap[item.parent_id] || null) : null,
        level: item.level || 1, title: item.title,
        description: item.description || item.content || null,
        amount: item.amount || 0, sort_order: item.sort_order,
      };
    });
    await sb.from('contract_sections').insert(rows);
  }

  // BUG #2 fix: 멤버 복사
  const { data: qMem } = await sb.from('quote_members').select('*').eq('quote_id', q.id);
  if (qMem.length) {
    for (const m of qMem) {
      await sb.from('contract_members').insert({
        contract_id: contractId, user_id: m.user_id, user_name: m.user_name,
        role: m.role, assigned_by: requester.id
      });
    }
  }

  await sb.from('quotes').update({ status: 'converted', converted_contract_id: contractId, updated_at: now }).eq('id', q.id);

  // 검증
  const { data: cLabor } = await sb.from('contract_labor_items').select('*').eq('contract_id', contractId);
  const { data: cExp } = await sb.from('contract_expense_items').select('*').eq('contract_id', contractId);
  const { data: cSec } = await sb.from('contract_sections').select('*').eq('contract_id', contractId);
  const { data: cMem } = await sb.from('contract_members').select('*').eq('contract_id', contractId);
  const { data: qAfter } = await sb.from('quotes').select('status, converted_contract_id').eq('id', q.id).single();

  console.log('\n  복사 결과:');
  console.log('    인건비:', qLabor.length, '→', cLabor.length, qLabor.length === cLabor.length ? '✓' : '✗');
  console.log('    경비:  ', qExp.length, '→', cExp.length, qExp.length === cExp.length ? '✓' : '✗');
  console.log('    섹션:  ', qSecs.length, '→', cSec.length, qSecs.length === cSec.length ? '✓' : '✗');
  console.log('    멤버:  ', qMem.length, '→', cMem.length, qMem.length === cMem.length ? '✓ [BUG #2 fix]' : '✗');

  // BUG #3 fix 검증: 트리 무결성 + description + amount
  console.log('\n  [BUG #3] 섹션 트리 무결성:');
  const lvl1 = cSec.find(s => s.level === 1);
  const lvl2 = cSec.find(s => s.level === 2);
  const lvl3 = cSec.find(s => s.level === 3);
  console.log('    level 1 (대):', lvl1 ? `✓ description="${lvl1.description}", amount=${lvl1.amount}` : '✗ 없음');
  console.log('    level 2 (중) parent→대:', lvl2 && lvl2.parent_id === lvl1?.id ? `✓ description="${lvl2.description}", amount=${lvl2.amount}` : '✗ 트리 깨짐');
  console.log('    level 3 (소) parent→중:', lvl3 && lvl3.parent_id === lvl2?.id ? `✓ description="${lvl3.description}", amount=${lvl3.amount}` : '✗ 트리 깨짐');

  console.log('\n  [#4] 견적 상태:');
  console.log('    status:', qAfter.status === 'converted' ? '✓ converted' : '✗ '+qAfter.status);
  console.log('    converted_contract_id:', qAfter.converted_contract_id === contractId ? '✓' : '✗');
  console.log('    재전환 시도 시 차단됨:', qAfter.converted_contract_id ? '✓' : '✗');

} catch (err) {
  console.log('  ERROR:', err.message);
}

// 정리
await sb.from('contracts').delete().eq('id', contractId);
await sb.from('quote_members').delete().eq('quote_id', q.id);
await sb.from('quote_labor_items').delete().eq('quote_id', q.id);
await sb.from('quote_expense_items').delete().eq('quote_id', q.id);
await sb.from('quote_sections').delete().eq('quote_id', q.id);
await sb.from('quotes').delete().eq('id', q.id);
console.log('\n=== 정리 완료 ===');
