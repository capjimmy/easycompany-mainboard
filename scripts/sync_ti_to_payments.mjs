/**
 * 세금계산서(paid) -> payment_receipts 일괄 동기화 스크립트
 * - status=paid AND contract_id가 있는 세금계산서에 대해
 * - 이미 동일 contract_id + 유사 금액의 payment_receipt가 있으면 스킵
 * - 없으면 payment_receipt 생성
 *
 * 실행: node scripts/sync_ti_to_payments.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

async function fetchAll(table, columns) {
  const all = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from(table).select(columns).order('id').range(from, from + 999);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// 1. 모든 paid 세금계산서 가져오기
const taxInvoices = await fetchAll(
  'tax_invoices',
  'id, contract_id, company_id, billing_id, invoice_number, total_amount, status, issue_date, item_description, notes'
);
const paidWithContract = taxInvoices.filter(t => t.status === 'paid' && t.contract_id);
console.log(`전체 세금계산서: ${taxInvoices.length}`);
console.log(`paid + contract 연결: ${paidWithContract.length}`);

// 2. 기존 payment_receipts 가져오기
const existingReceipts = await fetchAll(
  'payment_receipts',
  'id, contract_id, amount, payment_date, notes'
);
console.log(`기존 payment_receipts: ${existingReceipts.length}`);

// contract_id별로 기존 receipts 그룹핑
const receiptsByContract = new Map();
for (const r of existingReceipts) {
  if (!r.contract_id) continue;
  if (!receiptsByContract.has(r.contract_id)) {
    receiptsByContract.set(r.contract_id, []);
  }
  receiptsByContract.get(r.contract_id).push(r);
}

// 3. 중복 체크 후 생성
let created = 0;
let skipped = 0;
const toInsert = [];

for (const ti of paidWithContract) {
  const existing = receiptsByContract.get(ti.contract_id) || [];

  // 중복 판단: tax_invoice_id 매칭 또는 금액 일치
  const isDuplicate = existing.some(r => {
    if (r.tax_invoice_id === ti.id) return true;
    if (r.notes?.includes(ti.invoice_number)) return true;
    const amountMatch = Math.abs((r.amount || 0) - (ti.total_amount || 0)) < 1;
    return amountMatch;
  });

  if (isDuplicate) {
    skipped++;
    continue;
  }

  // notes에서 입금일 추출 (예: "입금은행: 기업, 입금일: 2024-02-08")
  let paymentDate = ti.issue_date || new Date().toISOString().split('T')[0];
  if (ti.notes) {
    const m = ti.notes.match(/입금일[:\s]*(\d{4}-\d{2}-\d{2})/);
    if (m) paymentDate = m[1];
  }

  const receipt = {
    id: randomUUID(),
    company_id: ti.company_id,
    billing_id: ti.billing_id || null,
    contract_id: ti.contract_id,
    receipt_number: `TI-${ti.invoice_number || ti.id.slice(0, 8)}`,
    amount: ti.total_amount || 0,
    payment_date: paymentDate,
    payment_method: 'bank_transfer',
    depositor_name: ti.item_description || '',
    notes: `세금계산서 ${ti.invoice_number || ''} - ${ti.item_description || ''}`.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  toInsert.push(receipt);
}

console.log(`\n생성 예정: ${toInsert.length}, 중복 스킵: ${skipped}`);

// 배치 삽입 (50개씩)
for (let i = 0; i < toInsert.length; i += 50) {
  const batch = toInsert.slice(i, i + 50);
  const { error } = await sb.from('payment_receipts').insert(batch);
  if (error) {
    console.error(`배치 ${i}-${i + batch.length} 삽입 오류:`, error.message);
    // tax_invoice_id 컬럼이 없을 수 있음 - 해당 필드 제거 후 재시도
    if (error.message?.includes('tax_invoice_id')) {
      console.log('tax_invoice_id 컬럼이 없어 해당 필드 제거 후 재시도합니다...');
      const batchNoTiId = batch.map(({ tax_invoice_id, ...rest }) => rest);
      const { error: retryErr } = await sb.from('payment_receipts').insert(batchNoTiId);
      if (retryErr) {
        console.error(`재시도 실패:`, retryErr.message);
      } else {
        created += batch.length;
      }
    }
  } else {
    created += batch.length;
  }
  if (created > 0 && created % 100 === 0) process.stdout.write(`${created} `);
}

console.log(`\n완료: ${created}건 생성`);
