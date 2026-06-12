import xlsx from 'xlsx';
const wb = xlsx.readFile('자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx');
const ws = wb.Sheets['프로젝트정보'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

console.log('=== 학술 파일 회사별 분포 ===');
const byComp = {};
for (let i = 2; i < rows.length; i++) {
  const comp = rows[i][1];
  if (comp) byComp[comp] = (byComp[comp] || 0) + 1;
}
console.log(byComp);

console.log('\n=== 건설환경연구소로 표기된 행 샘플 ===');
let cnt = 0;
for (let i = 2; i < rows.length && cnt < 5; i++) {
  if (rows[i][1] === '건설환경연구소') {
    console.log(`행 ${i}:`, JSON.stringify(rows[i].slice(0, 8)));
    cnt++;
  }
}

console.log('\n=== 건설경제연구원으로 표기된 행 샘플 ===');
cnt = 0;
for (let i = 2; i < rows.length && cnt < 3; i++) {
  if (rows[i][1] === '건설경제연구원' || rows[i][1] === '(사)건설경제연구원') {
    console.log(`행 ${i}:`, JSON.stringify(rows[i].slice(0, 8)));
    cnt++;
  }
}
