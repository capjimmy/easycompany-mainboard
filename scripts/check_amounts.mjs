import fs from 'fs';
const projects = JSON.parse(fs.readFileSync('c:/Users/parkm/easy_company/정제된데이터/projects_trusted_only.json', 'utf-8'));
// 계약금액 vs total_paid 비교
const overPaid = projects.filter(p => p.total_paid > p.contract_amount * 1.1 && p.contract_amount > 0);
console.log(`JSON에서 total_paid > contract_amount*1.1: ${overPaid.length}건`);
overPaid.slice(0, 5).forEach(p => {
  console.log(`  ${p.client_name}: 계약=${p.contract_amount?.toLocaleString()}, 수금=${p.total_paid?.toLocaleString()}, 발행=${p.total_invoiced?.toLocaleString()}`);
});

// 계약금액 = 공급가액(부가세 미포함), total_paid = 부가세 포함 수금일 수 있음
const exactMatch = projects.filter(p => p.total_paid > 0 && Math.abs(p.total_paid - p.contract_amount * 1.1) < 100);
console.log(`\ntotal_paid ≈ contract_amount * 1.1: ${exactMatch.length}건 (VAT 포함 금액)`);
