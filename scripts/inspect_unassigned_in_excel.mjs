import xlsx from 'xlsx';

const FILES = [
  '(주)이지컨설턴트_근로자명부 2026.xlsx',
  '건설환경연구소_근로자명부.xlsx',
  '이지건축사사무소_근로자명부.xlsx',
  '어반브릿지파트너스_현직원명부.xlsx',
];

const targetNames = ['유환태','라현옥','윤남돈','최문석','이강준','정경원','김규완','이충환','정의정','신준호','윤창기','이정','박종호','서호수','이호원','유민형','장태훈','서규희','임철희','김헌중','한인규','이충신','이상기','배진웅'];

for (const f of FILES) {
  console.log(`\n=== ${f} ===`);
  try {
    const wb = xlsx.readFile(f);
    const sheetName = wb.SheetNames.find(n => n.includes('리스트') || n.includes('직원')) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    // 헤더 찾기
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i];
      if (r && r.some(c => typeof c === 'string' && c.includes('성명'))) {
        console.log(`헤더 행 ${i}:`, JSON.stringify(r.slice(0, 30)));
        break;
      }
    }
    // 대상자 찾기
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      if (r && targetNames.includes(r[1])) {
        console.log(`  ${r[1]}: 근무지=${r[7]}, 직책=${r[8]}, 종사업무=${r[9]}, 특기=${r[27]}`);
      }
    }
  } catch (e) { console.log('  err:', e.message); }
}
