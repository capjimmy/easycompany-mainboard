import xlsx from 'xlsx';

const files = [
  '자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx',
  '자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx',
];

for (const f of files) {
  console.log(`\n========== ${f.split('/').pop()} ==========`);
  const wb = xlsx.readFile(f);
  for (const sn of wb.SheetNames) {
    console.log(`\n--- 시트: ${sn} ---`);
    const ws = wb.Sheets[sn];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log(`행수: ${rows.length}`);
    // 헤더 행 (보통 1번 행)
    if (rows[1]) {
      console.log('헤더:', JSON.stringify(rows[1]));
    }
    // 첫 데이터 행 (전체 컬럼 보기)
    if (rows[2]) {
      console.log('샘플 데이터:', JSON.stringify(rows[2]));
    }
  }
}
