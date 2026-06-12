import fs from 'fs';
const dir = 'c:/Users/parkm/easy_company/정제된데이터';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf-8'));
  const arr = Array.isArray(data) ? data : (data.data || data.records || [data]);
  console.log(`\n=== ${f} (${arr.length}건) ===`);
  console.log('키:', Object.keys(arr[0] || {}));
  console.log('첫 레코드:', JSON.stringify(arr[0], null, 2).slice(0, 500));
}
