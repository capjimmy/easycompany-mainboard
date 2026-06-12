import xlsx from 'xlsx';
import fs from 'fs';

const dir = 'c:/Users/parkm/easy_company/mainboard/자료 26-04-27';
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.xlsx')) files.push(p);
  }
}
walk(dir);

for (const f of files) {
  console.log(`\n=========== ${f.split('/').slice(-2).join('/')} ===========`);
  try {
    const wb = xlsx.readFile(f);
    console.log('시트:', wb.SheetNames);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log('행수:', rows.length);
    rows.slice(0, 6).forEach((r, i) => {
      const compact = r.filter(c => c !== null).slice(0, 12);
      if (compact.length > 0) console.log(`  ${i}: ${JSON.stringify(compact).slice(0, 250)}`);
    });
  } catch(e) { console.log('  err:', e.message); }
}
