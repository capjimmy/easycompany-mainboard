import xlsx from 'xlsx';

const FILES = [
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx',
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx',
];

for (const f of FILES) {
  const wb = xlsx.readFile(f);
  console.log('\n=========', f.split('/').pop(), '=========');
  console.log('sheets:', wb.SheetNames);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    console.log(`\n  --- [${name}] rows=${rows.length} ---`);
    if (rows[0]) console.log('  row0 (title):', JSON.stringify(rows[0]).slice(0, 400));
    if (rows[1]) console.log('  row1 (header):', JSON.stringify(rows[1]).slice(0, 600));
    if (rows[2]) console.log('  row2 (data1):', JSON.stringify(rows[2]).slice(0, 600));
    if (rows[3]) console.log('  row3 (data2):', JSON.stringify(rows[3]).slice(0, 400));
    console.log(`  cols=${rows[1]?.length || 0}`);
  }
}
