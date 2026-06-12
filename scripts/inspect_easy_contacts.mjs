import xlsx from 'xlsx';
const file = '세금계산서/이지컨설턴트/2024년/(주)이지컨설턴트_2024년 매출계산서발행 및 입금현황.xlsx';
const wb = xlsx.readFile(file);
const ws = wb.Sheets['EASY 세금계산서'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
console.log('헤더 행 1:', JSON.stringify(rows[1]).slice(0, 400));
console.log('헤더 행 2:', JSON.stringify(rows[2]).slice(0, 400));
console.log('\n샘플 데이터 행 3-6:');
for (let i = 3; i <= 8; i++) {
  console.log(`행 ${i}:`, JSON.stringify(rows[i]).slice(0, 500));
}
