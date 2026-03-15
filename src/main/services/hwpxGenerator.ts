/**
 * HWPX 문서 생성기 - 양식 템플릿 기반
 *
 * 실제 한컴오피스에서 만든 양식 HWPX 파일을 읽어서
 * 플레이스홀더 텍스트만 계약 데이터로 치환하여 저장
 */

import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { db } from '../database';

// ===== 타입 정의 =====

export type DocumentType = 'contract' | 'commencement' | 'task_plan' | 'completion' | 'invoice' | 'settlement';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: '계약서',
  commencement: '착수계',
  task_plan: '과업수행계획서',
  completion: '준공계',
  invoice: '청구서(대금청구서)',
  settlement: '정산 세부내역',
};

export interface ContractData {
  contract_number?: string;
  client_company?: string;
  client_business_number?: string;
  client_contact_name?: string;
  client_contact_phone?: string;
  service_name?: string;
  description?: string;
  contract_type?: string;
  contract_date?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  contract_amount?: number;
  vat_amount?: number;
  total_amount?: number;
  outsource_company?: string;
  outsource_amount?: number;
  progress_rate?: number;
  manager_name?: string;
  notes?: string;
  received_amount?: number;
  remaining_amount?: number;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_ceo?: string;
}

// ===== ZIP 읽기/쓰기 =====

interface ZipEntry {
  name: string;
  data: Buffer;
  method: number;
}

function readZip(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < zipBuffer.length - 4) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);

    const name = zipBuffer.slice(offset + 30, offset + 30 + nameLen).toString('utf-8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressedData = zipBuffer.slice(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) {
      data = compressedData;
    } else if (method === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      data = compressedData;
    }

    entries.push({ name, data, method });
    offset = dataStart + compressedSize;
  }

  return entries;
}

function writeZip(entries: Array<{ name: string; data: Buffer; store?: boolean }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf-8');
    const uncompressedData = entry.data;
    let compressedData: Buffer;
    let method: number;

    if (entry.store) {
      compressedData = uncompressedData;
      method = 0;
    } else {
      compressedData = zlib.deflateRawSync(uncompressedData);
      method = 8;
    }

    const crc = crc32(uncompressedData);

    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(uncompressedData.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuffer.copy(localHeader, 30);

    const centralEntry = Buffer.alloc(46 + nameBuffer.length);
    centralEntry.writeUInt32LE(0x02014b50, 0);
    centralEntry.writeUInt16LE(20, 4);
    centralEntry.writeUInt16LE(20, 6);
    centralEntry.writeUInt16LE(0, 8);
    centralEntry.writeUInt16LE(method, 10);
    centralEntry.writeUInt16LE(0, 12);
    centralEntry.writeUInt16LE(0, 14);
    centralEntry.writeUInt32LE(crc, 16);
    centralEntry.writeUInt32LE(compressedData.length, 20);
    centralEntry.writeUInt32LE(uncompressedData.length, 24);
    centralEntry.writeUInt16LE(nameBuffer.length, 28);
    centralEntry.writeUInt16LE(0, 30);
    centralEntry.writeUInt16LE(0, 32);
    centralEntry.writeUInt16LE(0, 34);
    centralEntry.writeUInt16LE(0, 36);
    centralEntry.writeUInt32LE(0, 38);
    centralEntry.writeUInt32LE(offset, 42);
    nameBuffer.copy(centralEntry, 46);

    localHeaders.push(localHeader, compressedData);
    centralEntries.push(centralEntry);
    offset += localHeader.length + compressedData.length;
  }

  const centralDirSize = centralEntries.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralEntries, eocd]);
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const crc32Table: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table.push(c >>> 0);
  }
  return table;
})();

// ===== 유틸리티 =====

function escXml(s: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatMoney(amount: number | undefined | null): string {
  if (!amount) return '0';
  return amount.toLocaleString('ko-KR');
}

function formatDateDot(dateStr: string | undefined | null): string {
  if (!dateStr) return '0000. 00. 00.';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}. ${m}. ${day}.`;
}

function formatDateKr(dateStr: string | undefined | null): string {
  if (!dateStr) return '0000년   00월   00일';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년   ${String(d.getMonth() + 1).padStart(2, '0')}월   ${String(d.getDate()).padStart(2, '0')}일`;
}

function numberToKorean(amount: number): string {
  if (!amount) return '영';
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const subUnits = ['', '십', '백', '천'];

  let result = '';
  let unitIndex = 0;
  let remaining = amount;

  while (remaining > 0) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) {
          chunkStr = digits[d] + subUnits[i] + chunkStr;
        }
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIndex] + result;
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex++;
  }

  return result;
}

// ===== 템플릿 경로 =====

export function getTemplatesDir(): string {
  // dist/main/index.js 기준 → dist/templates/
  const distDir = path.join(__dirname, '..', 'templates');
  if (fs.existsSync(distDir)) return distDir;

  // 개발 모드: resources/templates/
  const devDir = path.join(__dirname, '..', '..', '..', 'resources', 'templates');
  if (fs.existsSync(devDir)) return devDir;

  const altDir = path.join(__dirname, '..', '..', 'resources', 'templates');
  if (fs.existsSync(altDir)) return altDir;

  return distDir;
}

const TEMPLATE_MAP: Partial<Record<DocumentType, string>> = {
  contract: 'contract.hwpx',
  commencement: 'commencement.hwpx',
  completion: 'completion.hwpx',
  invoice: 'invoice.hwpx',
};

// ===== 문서별 텍스트 치환 =====

function replaceContractPlaceholders(xml: string, data: ContractData): string {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);
  const vatExcl = data.contract_amount || 0;
  const companyName = data.company_name || '(주)이지컨설턴트';
  const companyAddr = data.company_address || '';

  let result = xml;

  // 용역명
  result = result.replace(/@@용역/g, escXml(data.service_name || ''));

  // 계약금액 숫자 (￦30,000,000)
  result = result.replace(/￦30,000,000\)/g, `￦${formatMoney(totalAmt)})`);
  result = result.replace(/￦00,000,000/g, `￦${formatMoney(vatExcl)}`);

  // 계약금액 한글
  result = result.replace(/금삼천만원정/g, `금${numberToKorean(totalAmt)}원정`);

  // 준공금 금액
  result = result.replace(/금 @@만원 정/g, `금${numberToKorean(vatExcl)}원정`);
  result = result.replace(/금 @@만원/g, `금${numberToKorean(totalAmt)}원`);

  // 계약기간
  const periodStr = `${formatDateDot(data.contract_start_date)} ~ ${formatDateDot(data.contract_end_date)}`;
  result = result.replace(/0000\. 00\. 00\. ~ 0000\. 00\. 00\.\(용역 종료 시까지\)/g, periodStr);

  // 문서 작성일
  result = result.replace(/0000년   00월   00일/g, formatDateKr(data.contract_date));

  // 乙 측 정보
  result = result.replace(/㈜@@@/g, escXml(companyName));
  result = result.replace(/@@@@@@/g, escXml(companyAddr));
  result = result.replace(/㈜@@/g, escXml(companyName));

  // 은행정보
  result = result.replace(/>@@@-@@@</g, '>-<');
  result = result.replace(/>@@@</g, '>-<');

  return result;
}

function replaceCommencementPlaceholders(xml: string, data: ContractData): string {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);

  let result = xml;

  result = result.replace(/@@용역/g, escXml(data.service_name || ''));
  result = result.replace(/￦30,000,000\)/g, `￦${formatMoney(totalAmt)})`);
  result = result.replace(/금삼천만원정/g, `금${numberToKorean(totalAmt)}원정`);

  // 날짜: 계약일, 착공일, 준공일 순서
  const dates = [
    formatDateDot(data.contract_date),
    formatDateDot(data.contract_start_date),
    formatDateDot(data.contract_end_date),
  ];
  let dateIdx = 0;
  result = result.replace(/0000\. 00\. 00\./g, () => {
    const d = dates[dateIdx % dates.length];
    dateIdx++;
    return d;
  });

  result = result.replace(/0000년   00월   00일/g, formatDateKr(data.contract_start_date));

  return result;
}

function replaceCompletionPlaceholders(xml: string, data: ContractData): string {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);

  let result = xml;

  result = result.replace(/@@용역/g, escXml(data.service_name || ''));
  result = result.replace(/￦30,000,000\)/g, `￦${formatMoney(totalAmt)})`);
  result = result.replace(/금삼천만원정/g, `금${numberToKorean(totalAmt)}원정`);

  // 날짜: 계약일, 착공일, 준공일, 실준공일 순서
  const dates = [
    formatDateDot(data.contract_date),
    formatDateDot(data.contract_start_date),
    formatDateDot(data.contract_end_date),
    formatDateDot(data.contract_end_date),
  ];
  let dateIdx = 0;
  result = result.replace(/0000\. 00\. 00\./g, () => {
    const d = dates[dateIdx % dates.length];
    dateIdx++;
    return d;
  });

  result = result.replace(/0000년   00월   00일/g, formatDateKr(data.contract_end_date));

  return result;
}

function replaceInvoicePlaceholders(xml: string, data: ContractData): string {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);
  const receivedAmt = data.received_amount || 0;
  const claimAmt = totalAmt - receivedAmt;
  const remainAmt = 0;

  let result = xml;

  result = result.replace(/@@용역/g, escXml(data.service_name || ''));

  // 금액 4개 순서: 계약금액, 기성금액, 금회청구금액, 잔액
  const amounts = [totalAmt, receivedAmt, claimAmt, remainAmt];
  const amountsKr = amounts.map(a => numberToKorean(a));

  let amtIdx = 0;
  result = result.replace(/금 @@만원\(/g, () => {
    const kr = amountsKr[amtIdx % amountsKr.length];
    amtIdx++;
    return `금${kr}원(`;
  });

  let numIdx = 0;
  result = result.replace(/￦00,000,000\)/g, () => {
    const num = formatMoney(amounts[numIdx % amounts.length]);
    numIdx++;
    return `￦${num})`;
  });

  result = result.replace(/0000년   00월   00일/g, formatDateKr(new Date().toISOString()));

  return result;
}

function getReplacer(docType: DocumentType): ((xml: string, data: ContractData) => string) | null {
  switch (docType) {
    case 'contract': return replaceContractPlaceholders;
    case 'commencement': return replaceCommencementPlaceholders;
    case 'completion': return replaceCompletionPlaceholders;
    case 'invoice': return replaceInvoicePlaceholders;
    default: return null;
  }
}

// ===== 메인 생성 함수 =====

export async function generateHwpxDocument(
  docType: DocumentType,
  data: ContractData,
  outputPath: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // 1) DB에서 사용자가 등록한 양식 확인 (우선)
    let templatePath: string | null = null;
    try {
      const userTemplate = await db.getHwpxTemplateByDocType(docType);
      if (userTemplate && userTemplate.file_path && fs.existsSync(userTemplate.file_path)) {
        templatePath = userTemplate.file_path;
      }
    } catch (e) {
      // DB 미초기화 등 예외 무시, 기본 양식 사용
    }

    // 2) 기본 내장 양식 폴백
    if (!templatePath) {
      const templateFile = TEMPLATE_MAP[docType];
      if (!templateFile) {
        return { success: false, error: `${DOCUMENT_TYPE_LABELS[docType]} 양식 템플릿이 없습니다.` };
      }
      const templatesDir = getTemplatesDir();
      templatePath = path.join(templatesDir, templateFile);
    }

    if (!fs.existsSync(templatePath)) {
      return { success: false, error: `양식 파일을 찾을 수 없습니다: ${templatePath}` };
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const entries = readZip(templateBuffer);

    if (entries.length === 0) {
      return { success: false, error: '양식 파일을 읽을 수 없습니다.' };
    }

    const replacer = getReplacer(docType);
    const outputEntries: Array<{ name: string; data: Buffer; store?: boolean }> = [];

    for (const entry of entries) {
      if (entry.name === 'Contents/section0.xml' && replacer) {
        let xml = entry.data.toString('utf-8');
        // linesegarray 제거 - 텍스트 치환 후 캐시된 레이아웃이 안 맞아서 글자 겹침 방지
        // 한컴오피스가 열 때 자동으로 재계산함
        xml = xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
        const modifiedXml = replacer(xml, data);
        outputEntries.push({
          name: entry.name,
          data: Buffer.from(modifiedXml, 'utf-8'),
          store: false,
        });
      } else if (entry.name === 'mimetype') {
        outputEntries.push({ name: entry.name, data: entry.data, store: true });
      } else {
        outputEntries.push({
          name: entry.name,
          data: entry.data,
          store: entry.method === 0,
        });
      }
    }

    // mimetype을 첫 번째로
    const mimeIdx = outputEntries.findIndex(e => e.name === 'mimetype');
    if (mimeIdx > 0) {
      const [mimeEntry] = outputEntries.splice(mimeIdx, 1);
      outputEntries.unshift(mimeEntry);
    }

    const zipBuffer = writeZip(outputEntries);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, zipBuffer);

    return { success: true, filePath: outputPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateMultipleDocuments(
  docTypes: DocumentType[],
  data: ContractData,
  outputDir: string
): Promise<{ success: boolean; files: Array<{ type: DocumentType; label: string; filePath: string }>; errors: string[] }> {
  const files: Array<{ type: DocumentType; label: string; filePath: string }> = [];
  const errors: string[] = [];

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const docType of docTypes) {
    const label = DOCUMENT_TYPE_LABELS[docType];

    // DB 사용자 양식 또는 내장 양식이 없으면 스킵
    let hasTemplate = !!TEMPLATE_MAP[docType];
    try {
      const userTpl = await db.getHwpxTemplateByDocType(docType);
      if (userTpl && userTpl.file_path && fs.existsSync(userTpl.file_path)) {
        hasTemplate = true;
      }
    } catch (e) { /* ignore */ }

    if (!hasTemplate) {
      errors.push(`${label}: 양식 템플릿 미지원`);
      continue;
    }

    const fileName = `${label}.hwpx`;
    const filePath = path.join(outputDir, fileName);

    const result = await generateHwpxDocument(docType, data, filePath);

    if (result.success && result.filePath) {
      files.push({ type: docType, label, filePath: result.filePath });
    } else {
      errors.push(`${label} 생성 실패: ${result.error}`);
    }
  }

  return { success: errors.length === 0, files, errors };
}
