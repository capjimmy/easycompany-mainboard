/** Inspect KERI Excel structure */
import xlsx from 'xlsx';

const FILES = [
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx',
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx',
];

for (const f of FILES) {
  console.log('\n========================================');
  console.log('FILE:', f);
  console.log('========================================');
  const wb = xlsx.readFile(f);
  console.log('Sheets:', wb.SheetNames);
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    console.log(`\n--- Sheet: ${sn} (${rows.length} rows) ---`);
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      console.log(`Row ${i}:`, JSON.stringify(rows[i]));
    }
  }
}
