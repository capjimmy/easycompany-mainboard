/**
 * 정부 용역 견적서 양식 자동 생성기
 *
 * 회사 표준 양식(resources/templates/quote_govt_template.xlsx)에 견적 데이터를 채워 출력.
 * - 양식 틀·이미지·레이아웃은 그대로 보존 (exceljs 라운드트립)
 * - 인건비/경비 "내용"은 항목 수만큼 행이 변동
 * - 핵심: 산출내역서의 수식을 "값"으로 flatten 후 행 조정 (공유수식 충돌 회피),
 *   모든 금액은 코드에서 계산해 값으로 기입
 * - 인쇄: 항목 수와 무관하게 한 페이지에 자동 맞춤(fitToPage)
 */

import * as path from 'path';
import * as fs from 'fs';
const ExcelJS = require('exceljs');

export interface QuoteGovtLaborItem {
  grade: string;       // 등급 (책임연구원 등)
  qty: number;         // 참여인원
  days: number;        // 투입일수
  unit: number;        // 인건비단가/일
  rate?: number;       // 본용역참여율 (표시용)
}
export interface QuoteGovtExpenseItem {
  name: string;        // 비목
  amount: number;
}
export interface QuoteGovtData {
  client: string;          // 의뢰처/수신
  site: string;            // 현장명
  service: string;         // 용역명
  scope?: string;          // 용역범위
  period?: string;         // 용역기간
  staff: string[];         // 담당자 1·2·3 (우리 연구진)
  docNo?: number;          // 공문번호
  date?: Date;             // 날짜
  labor: QuoteGovtLaborItem[];
  expenses: QuoteGovtExpenseItem[];
}

function won(n: number): string {
  return Number(Math.round(n || 0)).toLocaleString('ko-KR');
}
function koMoney(n: number): string {
  n = Math.round(n || 0);
  if (!n) return '영';
  const u = ['', '만', '억', '조'];
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const s = ['', '십', '백', '천'];
  let r = '', ui = 0, x = n;
  while (x > 0) {
    let c = x % 10000, cs = '', t = c;
    for (let i = 0; i < 4 && t > 0; i++) { const g = t % 10; if (g > 0) cs = d[g] + s[i] + cs; t = Math.floor(t / 10); }
    if (c > 0) r = cs + u[ui] + r;
    x = Math.floor(x / 10000); ui++;
  }
  return r;
}

/** 산출내역서 전 셀의 수식을 캐시값으로 평탄화 (공유수식 충돌 방지) */
function flattenSheet(ws: any): void {
  ws.eachRow({ includeEmpty: true }, (row: any) => {
    row.eachCell({ includeEmpty: true }, (cell: any) => {
      const v = cell.value;
      if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
        cell.value = v.result !== undefined ? v.result : null;
      }
    });
  });
}

/** 번들된 양식 경로 (dist/templates 우선, dev fallback) */
function resolveTemplatePath(): string {
  const candidates = [
    path.join(__dirname, '..', 'templates', 'quote_govt_template.xlsx'),            // 패키지: dist/templates
    path.join(__dirname, '..', '..', '..', 'resources', 'templates', 'quote_govt_template.xlsx'), // dev
    path.join(__dirname, '..', '..', 'resources', 'templates', 'quote_govt_template.xlsx'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('견적서 양식 파일(quote_govt_template.xlsx)을 찾을 수 없습니다.');
}

export async function generateQuoteGovtDocument(data: QuoteGovtData, outputPath: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolveTemplatePath());
  const gm = wb.getWorksheet('공문');
  const sn = wb.getWorksheet('산출내역서');
  if (!gm || !sn) throw new Error('양식 시트(공문/산출내역서)를 찾을 수 없습니다.');

  // 1) 공문 입력칸 (수식들이 참조 → 열 때 자동 재계산: 템플릿에 fullCalcOnLoad=1 있음)
  gm.getCell('M17').value = data.client;
  gm.getCell('M19').value = data.site;
  gm.getCell('M20').value = data.service;
  gm.getCell('M21').value = data.staff[0] || '';
  gm.getCell('M22').value = data.staff[1] || '';
  gm.getCell('M23').value = data.staff[2] || '';
  gm.getCell('M24').value = data.docNo || 1;
  gm.getCell('M25').value = data.date || new Date();

  // 2) 산출내역서: 평탄화 후 값으로 재구성
  flattenSheet(sn);

  // 금액 계산
  let laborSum = 0;
  const lab = data.labor.map((it) => {
    const amt = Math.round((it.qty || 0) * (it.days || 0) * (it.unit || 0));
    laborSum += amt;
    return { ...it, amt };
  });
  const expSum = Math.round((data.expenses || []).reduce((s, e) => s + (e.amount || 0), 0));
  const gen5 = Math.floor((laborSum + expSum) * 0.05);             // 일반관리비 5%
  const profit = Math.round((gen5 + expSum + laborSum) * 0.10) - 100000; // 이윤 10% - 10만
  const total = Math.floor((laborSum + expSum + gen5 + profit) / 100000) * 100000; // 용역비 (10만단위 절사)

  // 상단
  sn.getCell('E4').value = data.client;
  sn.getCell('E5').value = `[${data.site}] 에 대한 ${data.service} 용역`;
  if (data.scope) sn.getCell('E6').value = data.scope;
  if (data.period) sn.getCell('E7').value = data.period;
  sn.getCell('E8').value = `    일금 ${koMoney(total)}원정 (₩ ${won(total)})  (VAT 별도)`;

  // 3) 인건비 변동행 (템플릿 4행: 13~16, 소계 17)
  const base = 13, N = lab.length, model = 14;
  if (N > 4) sn.spliceRows(17, 0, ...Array.from({ length: N - 4 }, () => []));
  else if (N < 4) sn.spliceRows(base + N, 4 - N);
  for (let i = 0; i < N; i++) {
    const r = base + i, it = lab[i];
    ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((c) => {
      try { sn.getCell(c + r).style = JSON.parse(JSON.stringify(sn.getCell(c + model).style)); } catch { /* */ }
    });
    sn.getCell('C' + r).value = it.grade;
    sn.getCell('E' + r).value = it.qty;
    sn.getCell('F' + r).value = it.days;
    sn.getCell('G' + r).value = it.unit;
    sn.getCell('N' + r).value = it.rate || '';
    sn.getCell('H' + r).value = `${it.qty} × ${it.days} × ${won(it.unit)} = `;
    sn.getCell('I' + r).value = it.amt;
    try { sn.unMergeCells('C' + r + ':D' + r); sn.mergeCells('C' + r + ':D' + r); } catch { /* */ }
    try { sn.unMergeCells('I' + r + ':J' + r); sn.mergeCells('I' + r + ':J' + r); } catch { /* */ }
  }
  const sub = base + N;
  sn.getCell('C' + sub).value = '소계';
  sn.getCell('I' + sub).value = laborSum;
  try { sn.unMergeCells('B13:B17'); } catch { /* */ }
  try { sn.mergeCells('B' + base + ':B' + sub); } catch { /* */ }
  sn.getCell('B' + base).value = '인 건 비';

  // 4) 경비: 표준 비목 행(원래 19~28, 라벨매칭)에 금액 기입. 행이동분 off 반영.
  const off = N - 4;
  const expenseRows: Record<string, number> = {
    '여비': 19, '책임연구원': 20, '연구원': 21, '연구보조원': 22,
    '유인물': 23, '전산': 24, '시약': 25, '회의': 26, '임차': 27, '교통': 28,
  };
  // 기존 예시 금액 초기화
  for (let r = 19; r <= 28; r++) { try { sn.getCell('I' + (r + off)).value = null; } catch { /* */ } }
  for (const e of (data.expenses || [])) {
    const key = Object.keys(expenseRows).find((k) => (e.name || '').includes(k));
    if (key) sn.getCell('I' + (expenseRows[key] + off)).value = Math.round(e.amount || 0);
  }

  // 5) 합계 (평탄화된 셀, off 이동)
  const setI = (origRow: number, v: number) => { sn.getCell('I' + (origRow + off)).value = v; };
  setI(29, expSum); setI(30, laborSum); setI(31, expSum); setI(32, gen5); setI(33, profit); setI(34, total);

  // 6) 인쇄: 한 페이지 자동 맞춤 + 인쇄영역을 용역비행까지
  const lastRow = 34 + off;
  sn.pageSetup.printArea = `B1:J${lastRow}`;
  sn.pageSetup.fitToPage = true;
  sn.pageSetup.fitToWidth = 1;
  sn.pageSetup.fitToHeight = 1;

  await wb.xlsx.writeFile(outputPath);
}
