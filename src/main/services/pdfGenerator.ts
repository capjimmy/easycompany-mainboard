import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

interface QuotePdfData {
  quote_number: string;
  recipient_company: string;
  recipient_contact?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_department?: string;
  recipient_address?: string;
  service_name: string;
  title?: string;
  quote_date: string;
  valid_until?: string;
  project_period_months?: number;
  labor_items: Array<{
    grade_name: string;
    quantity: number;
    participation_rate: number;
    months: number;
    unit_price: number;
    subtotal: number;
  }>;
  expense_items: Array<{
    category_name: string;
    amount: number;
    note?: string;
  }>;
  labor_total: number;
  expense_total: number;
  total_amount: number;
  vat_amount: number;
  grand_total: number;
  notes?: string;
  company_name: string;
  company_representative?: string;
  company_business_number?: string;
  company_address?: string;
  company_phone?: string;
}

interface ContractPdfData {
  contract_number: string;
  client_company: string;
  client_business_number?: string;
  client_contact_name?: string;
  client_contact_phone?: string;
  client_contact_email?: string;
  service_name: string;
  contract_type: string;
  service_category?: string;
  description?: string;
  contract_date?: string;
  contract_start_date: string;
  contract_end_date?: string;
  contract_amount: number;
  vat_amount: number;
  total_amount: number;
  manager_name?: string;
  notes?: string;
  company_name: string;
  company_representative?: string;
  company_business_number?: string;
  company_address?: string;
  company_phone?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: '용역계약',
  research: '연구용역',
  consulting: '컨설팅',
  maintenance: '유지보수',
  other: '기타',
};

// 한글 금액 변환 (일, 십, 백, 천, 만, 억 등)
function numberToKorean(num: number): string {
  if (num === 0) return '영';
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const smallUnits = ['', '십', '백', '천'];
  let result = '';
  let unitIndex = 0;
  while (num > 0) {
    const chunk = num % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let tempChunk = chunk;
      for (let i = 0; i < 4 && tempChunk > 0; i++) {
        const d = tempChunk % 10;
        if (d > 0) {
          chunkStr = (d === 1 && i > 0 ? '' : digits[d]) + smallUnits[i] + chunkStr;
        }
        tempChunk = Math.floor(tempChunk / 10);
      }
      result = chunkStr + units[unitIndex] + result;
    }
    num = Math.floor(num / 10000);
    unitIndex++;
  }
  return result;
}

function loadLogoBase64(): string {
  const candidates = [
    path.join(__dirname, 'logo.png'),                         // packaged (dist/main/logo.png)
    path.join(__dirname, '..', 'logo.png'),                   // packaged (dist/logo.png)
    path.join(__dirname, '..', '..', 'build', 'image2.png'),  // dev
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch { /* skip */ }
  }
  return '';
}

function generateQuoteHtml(data: QuotePdfData): string {
  const logoBase64 = loadLogoBase64();

  // 견적일자 포맷
  const quoteDate = data.quote_date ? new Date(data.quote_date) : new Date();
  const dateStr = `${quoteDate.getFullYear()}.${String(quoteDate.getMonth() + 1).padStart(2, '0')}.${String(quoteDate.getDate()).padStart(2, '0')}.`;
  const yearMonth = `${String(quoteDate.getFullYear()).slice(2)}${String(quoteDate.getMonth() + 1).padStart(2, '0')}`;

  // 공문번호 (견적번호에서 숫자 추출, 없으면 0000)
  const docNumMatch = data.quote_number?.match(/(\d+)$/);
  const docNum = docNumMatch ? docNumMatch[1].padStart(4, '0') : '0000';

  // 금액 텍스트
  const totalAmountKorean = numberToKorean(data.total_amount || 0);

  // 인건비 행
  const laborRows = data.labor_items.map((item) => `
    <tr>
      <td class="cell-center">${escapeHtml(item.grade_name)}</td>
      <td class="cell-center">${item.quantity}</td>
      <td class="cell-center">${item.months}</td>
      <td class="cell-center">${formatNumber(item.unit_price)}</td>
      <td class="cell-left">${item.quantity} &times; ${item.months} &times; ${formatNumber(item.unit_price)} = </td>
      <td class="cell-right">${formatNumber(item.subtotal)}</td>
    </tr>
  `).join('');

  // 경비 행
  const expenseRows = data.expense_items.map((item) => `
    <tr>
      <td class="cell-left" colspan="2">&nbsp;&nbsp;${escapeHtml(item.category_name)}</td>
      <td class="cell-center" colspan="2"></td>
      <td class="cell-left">${escapeHtml(item.note) || ''}</td>
      <td class="cell-right">${formatNumber(item.amount)}</td>
    </tr>
  `).join('');

  // 일반관리비, 이윤 계산 (엑셀 양식 기준: 일반관리비 5%, 이윤 10%)
  const subBeforeOverhead = (data.labor_total || 0) + (data.expense_total || 0);
  const overheadRate = 0.05;
  const profitRate = 0.10;
  const overhead = Math.floor(subBeforeOverhead * overheadRate);
  const profit = Math.floor((subBeforeOverhead + overhead) * profitRate);
  // 실제 총액은 DB값 사용 (수동 조정 가능하므로)
  const calculatedServiceFee = data.total_amount || (subBeforeOverhead + overhead + profit);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 20mm 18mm 15mm 18mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 12px; color: #000; line-height: 1.6; }

    /* === 페이지 1: 공문 === */
    .page { page-break-after: always; position: relative; }
    .page:last-child { page-break-after: auto; }

    .cover-date { text-align: right; font-size: 12px; margin-bottom: 40px; color: #333; }
    .cover-recipient { font-size: 14px; margin-bottom: 6px; }
    .cover-recipient .label { display: inline-block; width: 90px; letter-spacing: 8px; }
    .cover-subject .label { display: inline-block; width: 90px; letter-spacing: 8px; }
    .cover-subject { font-size: 14px; margin-bottom: 30px; font-weight: bold; }
    .cover-body { font-size: 13px; line-height: 2; margin-bottom: 20px; text-indent: 1em; }
    .cover-body p { margin-bottom: 12px; }
    .cover-attachment { font-size: 12px; margin-top: 30px; }
    .cover-attachment .label { display: inline-block; width: 90px; letter-spacing: 8px; }
    .cover-footer { position: absolute; bottom: 0; left: 0; right: 0; }
    .cover-footer-manager { font-size: 12px; margin-bottom: 8px; }
    .cover-footer-doc { font-size: 11px; margin-bottom: 6px; }
    .cover-footer-address { font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 6px; text-align: center; }

    .cover-company-block { text-align: center; margin: 60px 0 40px; }
    .cover-company-name { font-size: 24px; font-weight: bold; letter-spacing: 6px; }
    .cover-company-rep { font-size: 14px; margin-top: 8px; }

    /* === 페이지 2: 산출내역서 === */
    .breakdown-title { text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 4px; margin-bottom: 20px; }
    .breakdown-info { margin-bottom: 16px; font-size: 12px; }
    .breakdown-info .row { margin-bottom: 3px; }
    .breakdown-info .bk-label { font-weight: bold; display: inline-block; width: 90px; }

    .bk-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
    .bk-table th, .bk-table td { border: 1px solid #333; padding: 5px 8px; }
    .bk-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .cell-left { text-align: left; }
    .section-label { background: #fafafa; font-weight: bold; }
    .subtotal-row td { font-weight: bold; background: #f5f5f5; }
    .grand-total-row td { font-weight: bold; background: #e8f4fd; font-size: 12px; }

    /* === 페이지 3: 산출근거 === */
    .basis-title { text-align: center; font-size: 16px; font-weight: bold; letter-spacing: 4px; margin-bottom: 20px; }
    .basis-section { font-size: 12px; font-weight: bold; margin: 12px 0 8px; }
    .basis-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
    .basis-table th, .basis-table td { border: 1px solid #333; padding: 4px 6px; }
    .basis-table th { background: #f0f0f0; text-align: center; }
  </style>
</head>
<body>

  <!-- 페이지 1: 공문 -->
  <div class="page" style="min-height: 900px;">
    ${logoBase64 ? `<div style="text-align: right; margin-bottom: 10px;"><img src="${logoBase64}" style="height: 90px;" /></div>` : ''}
    <div class="cover-date">${dateStr}</div>

    <div class="cover-recipient">
      <div><span class="label">수   신</span>: ${escapeHtml(data.recipient_company)}</div>
      <div><span class="label">참   조</span>: ${escapeHtml(data.recipient_contact) || ''}</div>
      <div class="cover-subject"><span class="label">제   목</span>: ${escapeHtml(data.service_name)} 용역 견적서 제출</div>
    </div>

    <div class="cover-body">
      <p>1. 귀 공사의 발전을 기원합니다.</p>
      <p>2. 귀 공사에서 당 연구원에 요청하신 &lsquo;${escapeHtml(data.title || data.service_name)}&rsquo;에 대한 ${escapeHtml(data.service_name)} 용역 견적서를 첨부와 같이 제출합니다.</p>
    </div>

    <div class="cover-attachment">
      <div><span class="label">첨   부</span>: 1. 용역비 산출내역서</div>
      <div style="margin-left: 98px;">2. 용역비 비목별 단가 산출근거&nbsp;&nbsp;&nbsp;끝.</div>
    </div>

    <div class="cover-company-block">
      <div class="cover-company-name">${escapeHtml(data.company_name)}</div>
      ${data.company_representative ? `<div class="cover-company-rep">대표 ${escapeHtml(data.company_representative)}</div>` : ''}
    </div>

    <div class="cover-footer">
      <div class="cover-footer-manager">담당자&nbsp;&nbsp;&nbsp;${escapeHtml(data.recipient_contact) || ''}</div>
      <div class="cover-footer-doc">시행&nbsp;&nbsp;&nbsp;건경연-${yearMonth}-${docNum}호&nbsp;&nbsp;(${dateStr})</div>
      <div class="cover-footer-address">
        ${escapeHtml(data.company_address) || '(우 16954) 경기도 용인시 기흥구 흥덕1로 13, 타워동 1201호(영덕동, 흥덕IT밸리)'}
        <br>
        전화 ${escapeHtml(data.company_phone) || '1833-9665'} / www.iceri.or.kr
      </div>
    </div>
  </div>

  <!-- 페이지 2: 용역비 산출내역서 -->
  <div class="page">
    <div class="breakdown-title">용역비 산출내역서</div>

    <div class="breakdown-info">
      <div class="row"><span class="bk-label">* 의뢰처</span>: ${escapeHtml(data.recipient_company)}</div>
      <div class="row"><span class="bk-label">* 용역명</span>: [${escapeHtml(data.title || data.service_name)}] 에 대한 ${escapeHtml(data.service_name)} 용역</div>
      ${data.project_period_months ? `<div class="row"><span class="bk-label">* 용역기간</span>: ${data.project_period_months}개월</div>` : ''}
      <div class="row"><span class="bk-label">* 용역금액</span>: 일금 ${totalAmountKorean}원정 (\\${formatNumber(data.total_amount || 0)}) (VAT별도)</div>
    </div>

    <table class="bk-table">
      <thead>
        <tr>
          <th style="width:18%">구분</th>
          <th style="width:12%">본용역<br>투입인력</th>
          <th style="width:10%">참여인원</th>
          <th style="width:10%">투입일수</th>
          <th style="width:18%">인건비단가/일<br>본용역참여율<br>기준단가</th>
          <th style="width:14%">산출기준</th>
          <th style="width:18%">금액</th>
        </tr>
      </thead>
      <tbody>
        <!-- 인건비 섹션 -->
        ${data.labor_items.length > 0 ? data.labor_items.map((item, i) => `
        <tr>
          <td class="${i === 0 ? 'section-label' : ''}">${i === 0 ? '인 건 비' : ''}</td>
          <td class="cell-center">${escapeHtml(item.grade_name)}</td>
          <td class="cell-center">${item.quantity}</td>
          <td class="cell-center">${item.months}</td>
          <td class="cell-right">${formatNumber(item.unit_price)}</td>
          <td class="cell-left" style="font-size:10px">${item.quantity} &times; ${item.months} &times; ${formatNumber(item.unit_price)} =</td>
          <td class="cell-right">${formatNumber(item.subtotal)}</td>
        </tr>
        `).join('') : ''}
        <tr class="subtotal-row">
          <td class="cell-center" colspan="2">소계</td>
          <td class="cell-center" colspan="4"></td>
          <td class="cell-right">${formatNumber(data.labor_total || 0)}</td>
        </tr>

        <!-- 경비 섹션 -->
        ${data.expense_items.length > 0 ? data.expense_items.map((item, i) => `
        <tr>
          <td class="${i === 0 ? 'section-label' : ''}">${i === 0 ? '경    비' : ''}</td>
          <td class="cell-left" colspan="2">&nbsp;${escapeHtml(item.category_name)}</td>
          <td class="cell-center" colspan="2">${escapeHtml(item.note) || ''}</td>
          <td></td>
          <td class="cell-right">${formatNumber(item.amount)}</td>
        </tr>
        `).join('') : ''}
        <tr class="subtotal-row">
          <td class="cell-center" colspan="2">소계</td>
          <td class="cell-center" colspan="4"></td>
          <td class="cell-right">${formatNumber(data.expense_total || 0)}</td>
        </tr>

        <!-- 합계 영역 -->
        <tr>
          <td colspan="6">인    건    비</td>
          <td class="cell-right">${formatNumber(data.labor_total || 0)}</td>
        </tr>
        <tr>
          <td colspan="6">경          비</td>
          <td class="cell-right">${formatNumber(data.expense_total || 0)}</td>
        </tr>
        <tr>
          <td colspan="5">일 반 관 리 비</td>
          <td style="font-size:10px">(인건비+경비) &times; 5%</td>
          <td class="cell-right">${formatNumber(overhead)}</td>
        </tr>
        <tr>
          <td colspan="5">이          윤</td>
          <td style="font-size:10px">(인건비+경비+일반관리비) &times; 10%</td>
          <td class="cell-right">${formatNumber(profit)}</td>
        </tr>
        <tr class="grand-total-row">
          <td colspan="5">용    역    비</td>
          <td style="font-size:10px">(인건비+경비+일반관리비+이윤)</td>
          <td class="cell-right">${formatNumber(calculatedServiceFee)}</td>
        </tr>
      </tbody>
    </table>

    ${data.vat_amount ? `
    <div style="text-align:right; margin-top: 10px; font-size: 12px;">
      <div>공급가액: ${formatNumber(data.total_amount || 0)}원</div>
      <div>부가가치세 (VAT): ${formatNumber(data.vat_amount)}원</div>
      <div style="font-size:14px; font-weight:bold; margin-top:4px;">총액 (VAT 포함): ${formatNumber(data.grand_total || 0)}원</div>
    </div>
    ` : ''}

    ${data.notes ? `<div style="margin-top:15px; padding:8px; background:#fafafa; border:1px solid #eee; font-size:11px;"><strong>비고:</strong> ${escapeHtml(data.notes)}</div>` : ''}
  </div>

  <!-- 페이지 3: 용역비 비목별 단가 산출근거 -->
  <div class="page">
    <div class="basis-title">용역비 비목별 단가 산출근거</div>

    <div class="basis-section">1. 인건비</div>
    <div style="font-size:11px; margin-bottom:8px;">&nbsp;&nbsp;1) 학술용역인건비 기준단가</div>

    <table class="basis-table">
      <thead>
        <tr>
          <th style="width:14%">구분</th>
          <th style="width:10%">참여율</th>
          <th style="width:14%">기본급</th>
          <th style="width:14%">상여금</th>
          <th style="width:14%">퇴직충당금</th>
          <th style="width:16%">계</th>
          <th style="width:14%">인건비/일</th>
        </tr>
      </thead>
      <tbody>
        ${data.labor_items.map((item) => {
          const participationPct = Math.round(item.participation_rate * 100);
          // 역산: unit_price(인건비/일) = 계 / 22 (월 근무일수)
          // 계 = 기본급 + 상여금 + 퇴직충당금
          // 상여금 = 기본급 * 400/12 (월), 퇴직충당금 = (기본급+상여금) * 1/12 (월)
          const dailyPay = item.unit_price;
          const monthlyTotal = dailyPay * 22;  // 월 22일 기준
          // 기본급 : x, 상여금 : x * 4/12, 퇴직충당금 : (x + x*4/12) / 12
          // 계 = x + x*4/12 + (x + x*4/12)/12 = x*(1 + 1/3) * (1 + 1/12) = x * (4/3) * (13/12) = x * 52/36
          const basePay = Math.round(monthlyTotal * 36 / 52);
          const bonus = Math.round(basePay * 4 / 12);
          const retirement = Math.round((basePay + bonus) / 12);
          const total = basePay + bonus + retirement;
          return `
        <tr>
          <td class="cell-center">${escapeHtml(item.grade_name)}</td>
          <td class="cell-center">${participationPct}%</td>
          <td class="cell-right">${formatNumber(basePay)}</td>
          <td class="cell-right">${formatNumber(bonus)}</td>
          <td class="cell-right">${formatNumber(retirement)}</td>
          <td class="cell-right">${formatNumber(total)}</td>
          <td class="cell-right">${formatNumber(dailyPay)}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div style="font-size:10px; line-height:1.8; margin-bottom:16px; padding-left:8px;">
      <div>① 기본급 : 학술연구용역 연구비 단가 (26년 학술연구용역 인건비 기준단가 반영)</div>
      <div>② 상여금 : 기본급에 년 400% 지급 (월 환산)</div>
      <div>③ 퇴직충당금 : 기본급 및 상여금의 합계액에 년 100% 충당 (월 환산)</div>
    </div>

    ${data.expense_items.length > 0 ? `
    <div class="basis-section">2. 경비</div>
    <table class="basis-table">
      <thead>
        <tr>
          <th style="width:30%">항목</th>
          <th style="width:30%">금액</th>
          <th style="width:40%">비고</th>
        </tr>
      </thead>
      <tbody>
        ${data.expense_items.map((item) => `
        <tr>
          <td class="cell-left">${escapeHtml(item.category_name)}</td>
          <td class="cell-right">${formatNumber(item.amount)}</td>
          <td class="cell-left">${escapeHtml(item.note) || ''}</td>
        </tr>
        `).join('')}
        <tr class="subtotal-row">
          <td class="cell-center" style="font-weight:bold;">소계</td>
          <td class="cell-right" style="font-weight:bold;">${formatNumber(data.expense_total || 0)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    <div class="basis-section">${data.expense_items.length > 0 ? '3' : '2'}. 일반관리비 (5%)</div>
    <div style="font-size:11px; margin-bottom:8px; padding-left:16px;">
      (인건비 + 경비) &times; 5% = ${formatNumber(subBeforeOverhead)} &times; 5% = ${formatNumber(overhead)}원
    </div>

    <div class="basis-section">${data.expense_items.length > 0 ? '4' : '3'}. 이윤 (10%)</div>
    <div style="font-size:11px; margin-bottom:8px; padding-left:16px;">
      (인건비 + 경비 + 일반관리비) &times; 10% = ${formatNumber(subBeforeOverhead + overhead)} &times; 10% = ${formatNumber(profit)}원
    </div>
  </div>

</body>
</html>`;
}

function generateContractHtml(data: ContractPdfData): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15mm 15mm 15mm 15mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; color: #333; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #333; padding-bottom: 15px; }
    .header h1 { font-size: 28px; letter-spacing: 8px; margin-bottom: 5px; }
    .header .doc-number { font-size: 12px; color: #666; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .info-table td { padding: 6px 10px; border: 1px solid #ccc; font-size: 11px; }
    .info-table .label { background: #f5f5f5; font-weight: bold; width: 110px; text-align: center; }
    .section-title { font-size: 13px; font-weight: bold; margin: 15px 0 8px; padding-left: 8px; border-left: 3px solid #1890ff; }
    .total-box { text-align: right; margin: 15px 0; padding: 12px; background: #f0f7ff; border: 1px solid #1890ff; border-radius: 4px; }
    .total-box .grand-total { font-size: 18px; color: #1890ff; font-weight: bold; }
    .company-info { margin-top: 30px; text-align: right; }
    .company-info .company-name { font-size: 16px; font-weight: bold; }
    .notes { margin-top: 15px; padding: 10px; background: #fafafa; border: 1px solid #eee; border-radius: 4px; font-size: 10px; }
    .parties { display: flex; justify-content: space-between; margin-top: 40px; }
    .party { width: 45%; }
    .party h3 { font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .party p { font-size: 11px; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>계 약 서</h1>
    <div class="doc-number">${escapeHtml(data.contract_number)}</div>
  </div>

  <div class="section-title">계약 정보</div>
  <table class="info-table">
    <tr>
      <td class="label">용역명</td>
      <td colspan="3">${escapeHtml(data.service_name)}</td>
    </tr>
    <tr>
      <td class="label">계약유형</td>
      <td>${escapeHtml(CONTRACT_TYPE_LABELS[data.contract_type] || data.contract_type)}</td>
      <td class="label">계약체결일</td>
      <td>${formatDate(data.contract_date)}</td>
    </tr>
    <tr>
      <td class="label">계약시작일</td>
      <td>${formatDate(data.contract_start_date)}</td>
      <td class="label">계약종료일</td>
      <td>${formatDate(data.contract_end_date)}</td>
    </tr>
    ${data.description ? `<tr><td class="label">계약설명</td><td colspan="3">${escapeHtml(data.description)}</td></tr>` : ''}
    ${data.manager_name ? `<tr><td class="label">담당자</td><td colspan="3">${escapeHtml(data.manager_name)}</td></tr>` : ''}
  </table>

  <div class="section-title">금액 정보</div>
  <table class="info-table">
    <tr>
      <td class="label">계약금액</td>
      <td>${formatNumber(data.contract_amount)}원</td>
      <td class="label">VAT (10%)</td>
      <td>${formatNumber(data.vat_amount)}원</td>
    </tr>
  </table>
  <div class="total-box">
    <div class="grand-total">총액 (VAT 포함): ${formatNumber(data.total_amount)}원</div>
  </div>

  ${data.notes ? `<div class="notes"><strong>비고:</strong> ${escapeHtml(data.notes)}</div>` : ''}

  <div class="parties">
    <div class="party">
      <h3>발주기관 (갑)</h3>
      <p><strong>${escapeHtml(data.client_company)}</strong></p>
      ${data.client_business_number ? `<p>사업자번호: ${escapeHtml(data.client_business_number)}</p>` : ''}
      ${data.client_contact_name ? `<p>담당자: ${escapeHtml(data.client_contact_name)}</p>` : ''}
      ${data.client_contact_phone ? `<p>연락처: ${escapeHtml(data.client_contact_phone)}</p>` : ''}
    </div>
    <div class="party">
      <h3>수급기관 (을)</h3>
      <p><strong>${escapeHtml(data.company_name)}</strong></p>
      ${data.company_representative ? `<p>대표: ${escapeHtml(data.company_representative)}</p>` : ''}
      ${data.company_business_number ? `<p>사업자번호: ${escapeHtml(data.company_business_number)}</p>` : ''}
      ${data.company_address ? `<p>${escapeHtml(data.company_address)}</p>` : ''}
      ${data.company_phone ? `<p>TEL: ${escapeHtml(data.company_phone)}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

export function generateHtml(type: 'quote' | 'contract', data: any): string {
  return type === 'quote' ? generateQuoteHtml(data) : generateContractHtml(data);
}

export async function generatePdf(type: 'quote' | 'contract', data: any): Promise<{ success: boolean; filePath?: string; error?: string }> {
  let win: BrowserWindow | null = null;

  try {
    const html = type === 'quote' ? generateQuoteHtml(data) : generateContractHtml(data);

    win = new BrowserWindow({
      width: 794,
      height: 1123,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Wait for rendering
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    } as any);

    // Save to temp directory
    const tempDir = path.join(app.getPath('temp'), 'easy-company-pdf');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const docNumber = type === 'quote' ? data.quote_number : data.contract_number;
    const fileName = `${type === 'quote' ? '견적서' : '계약서'}_${docNumber}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err.message || 'PDF 생성에 실패했습니다.' };
  } finally {
    if (win) {
      win.destroy();
    }
  }
}
