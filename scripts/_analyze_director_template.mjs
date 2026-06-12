// 양식 파일의 모든 시트별 셀 구조 분석 → 데이터를 쓸 위치 매핑 도출용
import ExcelJS from 'exceljs';

for (const co of ['CERI', 'EASY']) {
  console.log(`\n========== ${co} ==========`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`templates/director_report_${co}.xlsx`);
  for (const sheet of wb.worksheets) {
    console.log(`\n--- [${sheet.name}] (${sheet.rowCount}x${sheet.columnCount}) ---`);
    const limit = sheet.name === '1월' ? 50 : 5;
    for (let r = 1; r <= Math.min(sheet.rowCount, limit); r++) {
      const row = sheet.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value;
        if (v !== null && v !== undefined && v !== '') {
          const colLetter = String.fromCharCode(64 + col);
          cells.push(`${colLetter}${r}=${typeof v === 'object' ? (v.richText ? v.richText.map(t => t.text).join('') : JSON.stringify(v)) : v}`);
        }
      });
      if (cells.length) console.log(`  ${cells.join(' | ')}`);
    }
  }
}
