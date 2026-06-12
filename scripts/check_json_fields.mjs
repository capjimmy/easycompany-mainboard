import fs from 'fs';
const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));
const contracts = JSON.parse(fs.readFileSync('contracts.json', 'utf-8'));

console.log('=== quotes JSON 필드 통계 ===');
console.log(`project_name 있음: ${quotes.filter(q => q.project_name).length} / ${quotes.length}`);
console.log(`notes 있음: ${quotes.filter(q => q.notes).length}`);
console.log(`items 있음(>0개): ${quotes.filter(q => q.items?.length > 0).length}`);

console.log('\n=== contracts JSON 필드 통계 ===');
console.log(`project_name 있음: ${contracts.filter(c => c.project_name).length} / ${contracts.length}`);
console.log(`notes 있음: ${contracts.filter(c => c.notes).length}`);
console.log(`items 있음(>0개): ${contracts.filter(c => c.items?.length > 0).length}`);

console.log('\n=== quotes 첫 3개 (project_name 있는 것) ===');
quotes.filter(q => q.project_name).slice(0, 3).forEach((q, i) => {
  console.log(`\n[${i}]`);
  console.log(`  project_name: ${q.project_name}`);
  console.log(`  client_name: ${q.client_name}`);
  console.log(`  source_file: ${q.source_file?.slice(-80)}`);
});

console.log('\n=== contracts 100억 초과 샘플 (이상치) ===');
contracts.filter(c => c.total_amount > 10000000000).slice(0, 5).forEach(c => {
  console.log(`\n  client: ${c.client_name}`);
  console.log(`  project: ${c.project_name}`);
  console.log(`  total: ${c.total_amount?.toLocaleString()}`);
  console.log(`  source: ${c.source_file?.slice(-100)}`);
});
