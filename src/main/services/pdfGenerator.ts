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

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: '용역계약',
  research: '연구용역',
  consulting: '컨설팅',
  maintenance: '유지보수',
  other: '기타',
};

function generateQuoteHtml(data: QuotePdfData): string {
  const laborRows = data.labor_items.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${item.grade_name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${(item.participation_rate * 100).toFixed(0)}%</td>
      <td style="text-align:center">${item.months}</td>
      <td style="text-align:right">${formatNumber(item.unit_price)}</td>
      <td style="text-align:right">${formatNumber(item.subtotal)}</td>
    </tr>
  `).join('');

  const expenseRows = data.expense_items.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${item.category_name}</td>
      <td style="text-align:right" colspan="4">${formatNumber(item.amount)}</td>
      <td>${item.note || ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15mm 15mm 15mm 15mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; color: #333; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #333; padding-bottom: 15px; }
    .header h1 { font-size: 28px; letter-spacing: 8px; margin-bottom: 5px; }
    .header .doc-number { font-size: 12px; color: #666; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .info-table td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; }
    .info-table .label { background: #f5f5f5; font-weight: bold; width: 100px; text-align: center; }
    .section-title { font-size: 13px; font-weight: bold; margin: 15px 0 8px; padding-left: 8px; border-left: 3px solid #1890ff; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .data-table th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; font-size: 10px; text-align: center; }
    .data-table td { border: 1px solid #ccc; padding: 5px 8px; font-size: 10px; }
    .summary-row td { font-weight: bold; background: #fafafa; }
    .total-box { text-align: right; margin: 15px 0; padding: 12px; background: #f0f7ff; border: 1px solid #1890ff; border-radius: 4px; }
    .total-box .grand-total { font-size: 18px; color: #1890ff; font-weight: bold; }
    .company-info { margin-top: 30px; text-align: right; }
    .company-info .company-name { font-size: 16px; font-weight: bold; }
    .notes { margin-top: 15px; padding: 10px; background: #fafafa; border: 1px solid #eee; border-radius: 4px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>견 적 서</h1>
    <div class="doc-number">${data.quote_number}</div>
  </div>

  <table class="info-table">
    <tr>
      <td class="label">수신처</td>
      <td>${data.recipient_company}</td>
      <td class="label">견적일자</td>
      <td>${formatDate(data.quote_date)}</td>
    </tr>
    <tr>
      <td class="label">담당자</td>
      <td>${data.recipient_contact || '-'}</td>
      <td class="label">유효기간</td>
      <td>${formatDate(data.valid_until)}</td>
    </tr>
    <tr>
      <td class="label">연락처</td>
      <td>${data.recipient_phone || '-'}</td>
      <td class="label">이메일</td>
      <td>${data.recipient_email || '-'}</td>
    </tr>
    <tr>
      <td class="label">용역명</td>
      <td colspan="3">${data.service_name}</td>
    </tr>
    ${data.title ? `<tr><td class="label">제목</td><td colspan="3">${data.title}</td></tr>` : ''}
    ${data.project_period_months ? `<tr><td class="label">예상기간</td><td colspan="3">${data.project_period_months}개월</td></tr>` : ''}
  </table>

  <div class="section-title">인건비</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th>등급</th>
        <th style="width:50px">인원</th>
        <th style="width:60px">참여율</th>
        <th style="width:50px">개월</th>
        <th style="width:90px">월 단가</th>
        <th style="width:100px">소계</th>
      </tr>
    </thead>
    <tbody>
      ${laborRows}
      <tr class="summary-row">
        <td colspan="6" style="text-align:center">인건비 합계</td>
        <td style="text-align:right">${formatNumber(data.labor_total)}원</td>
      </tr>
    </tbody>
  </table>

  ${data.expense_items.length > 0 ? `
  <div class="section-title">경비</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th>항목</th>
        <th colspan="4" style="width:150px">금액</th>
        <th>비고</th>
      </tr>
    </thead>
    <tbody>
      ${expenseRows}
      <tr class="summary-row">
        <td colspan="2" style="text-align:center">경비 합계</td>
        <td colspan="4" style="text-align:right">${formatNumber(data.expense_total)}원</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  ` : ''}

  <div class="total-box">
    <div>합계 (VAT 별도): ${formatNumber(data.total_amount)}원</div>
    <div>VAT (10%): ${formatNumber(data.vat_amount)}원</div>
    <div class="grand-total">총액 (VAT 포함): ${formatNumber(data.grand_total)}원</div>
  </div>

  ${data.notes ? `<div class="notes"><strong>비고:</strong> ${data.notes}</div>` : ''}

  <div class="company-info">
    <div class="company-name">${data.company_name}</div>
    ${data.company_representative ? `<div>대표: ${data.company_representative}</div>` : ''}
    ${data.company_business_number ? `<div>사업자번호: ${data.company_business_number}</div>` : ''}
    ${data.company_address ? `<div>${data.company_address}</div>` : ''}
    ${data.company_phone ? `<div>TEL: ${data.company_phone}</div>` : ''}
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
    <div class="doc-number">${data.contract_number}</div>
  </div>

  <div class="section-title">계약 정보</div>
  <table class="info-table">
    <tr>
      <td class="label">용역명</td>
      <td colspan="3">${data.service_name}</td>
    </tr>
    <tr>
      <td class="label">계약유형</td>
      <td>${CONTRACT_TYPE_LABELS[data.contract_type] || data.contract_type}</td>
      <td class="label">계약체결일</td>
      <td>${formatDate(data.contract_date)}</td>
    </tr>
    <tr>
      <td class="label">계약시작일</td>
      <td>${formatDate(data.contract_start_date)}</td>
      <td class="label">계약종료일</td>
      <td>${formatDate(data.contract_end_date)}</td>
    </tr>
    ${data.description ? `<tr><td class="label">계약설명</td><td colspan="3">${data.description}</td></tr>` : ''}
    ${data.manager_name ? `<tr><td class="label">담당자</td><td colspan="3">${data.manager_name}</td></tr>` : ''}
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

  ${data.notes ? `<div class="notes"><strong>비고:</strong> ${data.notes}</div>` : ''}

  <div class="parties">
    <div class="party">
      <h3>발주기관 (갑)</h3>
      <p><strong>${data.client_company}</strong></p>
      ${data.client_business_number ? `<p>사업자번호: ${data.client_business_number}</p>` : ''}
      ${data.client_contact_name ? `<p>담당자: ${data.client_contact_name}</p>` : ''}
      ${data.client_contact_phone ? `<p>연락처: ${data.client_contact_phone}</p>` : ''}
    </div>
    <div class="party">
      <h3>수급기관 (을)</h3>
      <p><strong>${data.company_name}</strong></p>
      ${data.company_representative ? `<p>대표: ${data.company_representative}</p>` : ''}
      ${data.company_business_number ? `<p>사업자번호: ${data.company_business_number}</p>` : ''}
      ${data.company_address ? `<p>${data.company_address}</p>` : ''}
      ${data.company_phone ? `<p>TEL: ${data.company_phone}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
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
