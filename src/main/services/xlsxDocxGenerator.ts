/**
 * XLSX / DOCX 문서 생성기 - 양식 템플릿 기반
 *
 * 1) 템플릿 파일을 읽어서 {{플레이스홀더}} 패턴을 계약 데이터로 치환
 * 2) 플레이스홀더가 없으면 AI(OpenAI)를 이용해 적절한 위치에 데이터 배치
 */

import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { db } from '../database';
import type { ContractData } from './hwpxGenerator';

// ===== 공통 유틸리티 =====

/** 금액 포맷 (천 단위 콤마) */
function formatMoney(amount: number | undefined | null): string {
  if (!amount) return '0';
  return amount.toLocaleString('ko-KR');
}

/** 날짜 포맷 (YYYY.MM.DD) */
function formatDateDot(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** 날짜 포맷 (한국어) */
function formatDateKr(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
}

/** 한글 금액 */
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

/**
 * 계약 데이터를 플레이스홀더 이름 → 값 맵으로 변환
 */
function buildPlaceholderMap(data: ContractData): Record<string, string> {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);
  const vatAmt = data.vat_amount || Math.round((data.contract_amount || 0) * 0.1);

  return {
    // 거래처/발주처
    '거래처': data.client_company || '',
    '발주처': data.client_company || '',
    '발주기관': data.client_company || '',
    '거래처_사업자번호': data.client_business_number || '',
    '발주처_사업자번호': data.client_business_number || '',
    '거래처_담당자': data.client_contact_name || '',
    '발주처_담당자': data.client_contact_name || '',
    '거래처_연락처': data.client_contact_phone || '',
    '발주처_연락처': data.client_contact_phone || '',

    // 용역/계약
    '용역명': data.service_name || '',
    '계약번호': data.contract_number || '',
    '계약유형': data.contract_type || '',
    '설명': data.description || '',
    '비고': data.notes || '',

    // 금액
    '계약금액': formatMoney(data.contract_amount),
    '부가세': formatMoney(vatAmt),
    '총액': formatMoney(totalAmt),
    '총계약금액': formatMoney(totalAmt),
    '계약금액_숫자': String(data.contract_amount || 0),
    '부가세_숫자': String(vatAmt),
    '총액_숫자': String(totalAmt),
    '계약금액_한글': `금${numberToKorean(data.contract_amount || 0)}원정`,
    '총액_한글': `금${numberToKorean(totalAmt)}원정`,

    // 외주
    '외주업체': data.outsource_company || '',
    '외주금액': formatMoney(data.outsource_amount),

    // 입금/잔금
    '수금액': formatMoney(data.received_amount),
    '잔액': formatMoney(data.remaining_amount),

    // 날짜
    '계약일': formatDateDot(data.contract_date),
    '착수일': formatDateDot(data.contract_start_date),
    '준공일': formatDateDot(data.contract_end_date),
    '계약기간': `${formatDateDot(data.contract_start_date)} ~ ${formatDateDot(data.contract_end_date)}`,
    '계약일_한글': formatDateKr(data.contract_date),
    '착수일_한글': formatDateKr(data.contract_start_date),
    '준공일_한글': formatDateKr(data.contract_end_date),
    '오늘': formatDateDot(new Date().toISOString()),
    '오늘_한글': formatDateKr(new Date().toISOString()),

    // 담당자
    '담당자': data.manager_name || '',
    '진행률': data.progress_rate ? `${data.progress_rate}%` : '',

    // 회사 정보
    '회사명': data.company_name || '',
    '회사주소': data.company_address || '',
    '회사전화': data.company_phone || '',
    '대표자': data.company_ceo || '',
  };
}

// ===== XLSX 처리 =====

/**
 * XLSX 템플릿을 읽어서 {{플레이스홀더}}를 치환하고 저장
 */
export async function fillXlsxTemplate(
  templatePath: string,
  data: ContractData,
  outputPath: string,
): Promise<{ success: boolean; filePath?: string; error?: string; usedAI?: boolean }> {
  try {
    if (!fs.existsSync(templatePath)) {
      return { success: false, error: `템플릿 파일을 찾을 수 없습니다: ${templatePath}` };
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(templatePath, { cellStyles: true, cellFormula: true, cellDates: true });
    const placeholderMap = buildPlaceholderMap(data);
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    let placeholderCount = 0;

    // 모든 시트 순회하며 플레이스홀더 치환
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[cellRef];
          if (!cell || cell.t !== 's') continue; // 문자열 셀만 처리

          const original = cell.v;
          if (typeof original !== 'string') continue;

          let replaced = original;
          let hasMatch = false;

          replaced = replaced.replace(placeholderPattern, (match: string, key: string) => {
            const trimmedKey = key.trim();
            if (trimmedKey in placeholderMap) {
              hasMatch = true;
              placeholderCount++;
              return placeholderMap[trimmedKey];
            }
            return match; // 매칭 안 되면 원본 유지
          });

          if (hasMatch) {
            cell.v = replaced;
            cell.w = replaced; // 표시 값도 업데이트
            // 숫자로 변환 가능한 경우 숫자 타입으로
            if (/^\d+$/.test(replaced) && replaced.length < 15) {
              cell.v = Number(replaced);
              cell.t = 'n';
              delete cell.w;
            }
          }
        }
      }
    }

    // 플레이스홀더가 없으면 AI로 처리 시도
    if (placeholderCount === 0) {
      const aiResult = await fillXlsxWithAI(workbook, data, XLSX);
      if (aiResult.modified) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        XLSX.writeFile(workbook, outputPath);
        return { success: true, filePath: outputPath, usedAI: true };
      }
      // AI도 실패하면 원본 그대로 복사
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      XLSX.writeFile(workbook, outputPath);
      return { success: true, filePath: outputPath, usedAI: false };
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    XLSX.writeFile(workbook, outputPath);

    return { success: true, filePath: outputPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * AI를 사용하여 XLSX 템플릿에 데이터 배치
 */
async function fillXlsxWithAI(
  workbook: any,
  data: ContractData,
  XLSX: any,
): Promise<{ modified: boolean }> {
  try {
    const OpenAI = require('openai').default;
    const apiKey = await db.getSetting('openai_api_key');
    if (!apiKey) return { modified: false };

    const client = new OpenAI({ apiKey });

    // 템플릿의 현재 내용을 텍스트로 추출
    let templateText = '';
    const cellMap: Array<{ sheet: string; ref: string; value: string }> = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      templateText += `[시트: ${sheetName}]\n`;

      for (let r = range.s.r; r <= range.e.r; r++) {
        const rowCells: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[cellRef];
          const val = cell ? String(cell.v || '') : '';
          rowCells.push(val);
          if (cell && val) {
            cellMap.push({ sheet: sheetName, ref: cellRef, value: val });
          }
        }
        const row = rowCells.join(' | ');
        if (row.trim()) templateText += row + '\n';
      }
      templateText += '\n';
    }

    const contractDataStr = JSON.stringify({
      거래처: data.client_company,
      용역명: data.service_name,
      계약번호: data.contract_number,
      계약금액: data.contract_amount,
      부가세: data.vat_amount,
      총액: data.total_amount,
      착수일: data.contract_start_date,
      준공일: data.contract_end_date,
      담당자: data.manager_name,
      회사명: data.company_name,
      대표자: data.company_ceo,
    }, null, 2);

    const prompt = `다음은 엑셀 양식 템플릿의 내용입니다:\n\n${templateText}\n\n` +
      `다음 계약 데이터를 이 양식에 채워넣어야 합니다:\n${contractDataStr}\n\n` +
      `양식의 각 셀에서 빈칸이나 예시 데이터가 있는 곳을 찾아서, 어떤 셀에 어떤 값을 넣어야 하는지 JSON 배열로 알려주세요.\n` +
      `응답 형식 (JSON만 출력): [{"sheet":"시트명","ref":"A1","value":"값"}, ...]\n` +
      `금액은 천 단위 콤마를 포함하여 표시하세요. 날짜는 YYYY.MM.DD 형식으로 표시하세요.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '';

    // JSON 파싱 시도
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { modified: false };

    const replacements: Array<{ sheet: string; ref: string; value: string }> = JSON.parse(jsonMatch[0]);
    let modified = false;

    for (const rep of replacements) {
      const sheet = workbook.Sheets[rep.sheet];
      if (!sheet) continue;

      const cell = sheet[rep.ref];
      if (cell) {
        cell.v = rep.value;
        cell.w = rep.value;
        if (/^\d[\d,]*$/.test(String(rep.value).replace(/,/g, '')) && String(rep.value).replace(/,/g, '').length < 15) {
          const num = Number(String(rep.value).replace(/,/g, ''));
          if (!isNaN(num)) {
            cell.v = num;
            cell.t = 'n';
            delete cell.w;
          }
        }
        modified = true;
      } else {
        // 셀이 없으면 새로 생성
        sheet[rep.ref] = { t: 's', v: rep.value };
        modified = true;
        // !ref 범위 확장
        const decoded = XLSX.utils.decode_cell(rep.ref);
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        if (decoded.r > range.e.r) range.e.r = decoded.r;
        if (decoded.c > range.e.c) range.e.c = decoded.c;
        sheet['!ref'] = XLSX.utils.encode_range(range);
      }
    }

    return { modified };
  } catch (err) {
    console.error('AI XLSX 처리 실패:', err);
    return { modified: false };
  }
}

// ===== DOCX 처리 =====

/**
 * DOCX 템플릿을 읽어서 {{플레이스홀더}}를 치환하고 저장
 * DOCX = ZIP(word/document.xml + 기타)
 */
export async function fillDocxTemplate(
  templatePath: string,
  data: ContractData,
  outputPath: string,
): Promise<{ success: boolean; filePath?: string; error?: string; usedAI?: boolean }> {
  try {
    if (!fs.existsSync(templatePath)) {
      return { success: false, error: `템플릿 파일을 찾을 수 없습니다: ${templatePath}` };
    }

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(templatePath);
    const placeholderMap = buildPlaceholderMap(data);
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    let placeholderCount = 0;

    // word/document.xml 에서 플레이스홀더 치환
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];

    for (const xmlPath of xmlFiles) {
      const entry = zip.getEntry(xmlPath);
      if (!entry) continue;

      let xml = entry.getData().toString('utf8');

      // DOCX에서는 {{key}} 가 <w:r> 태그로 분할될 수 있음
      // 먼저 직접 치환 시도
      let replaced = xml.replace(placeholderPattern, (match: string, key: string) => {
        const trimmedKey = key.trim();
        if (trimmedKey in placeholderMap) {
          placeholderCount++;
          return escapeXml(placeholderMap[trimmedKey]);
        }
        return match;
      });

      // run-split 패턴도 처리: <w:r>..{{..</w:r><w:r>..key..</w:r><w:r>..}}..</w:r>
      // 중괄호가 여러 run에 걸쳐있는 경우를 통합 처리
      replaced = mergeAndReplaceSplitPlaceholders(replaced, placeholderMap, (count: number) => {
        placeholderCount += count;
      });

      zip.updateFile(xmlPath, Buffer.from(replaced, 'utf8'));
    }

    // 플레이스홀더가 없으면 AI 시도
    if (placeholderCount === 0) {
      const docEntry = zip.getEntry('word/document.xml');
      if (docEntry) {
        const xml = docEntry.getData().toString('utf8');
        const aiResult = await fillDocxWithAI(xml, data);
        if (aiResult.modified && aiResult.xml) {
          zip.updateFile('word/document.xml', Buffer.from(aiResult.xml, 'utf8'));
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
          zip.writeZip(outputPath);
          return { success: true, filePath: outputPath, usedAI: true };
        }
      }
      // AI도 실패하면 원본 그대로 저장
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      zip.writeZip(outputPath);
      return { success: true, filePath: outputPath, usedAI: false };
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    zip.writeZip(outputPath);

    return { success: true, filePath: outputPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * DOCX XML에서 여러 <w:r> 태그에 걸쳐 분할된 플레이스홀더를 통합 처리
 *
 * 예: <w:r><w:t>{{</w:t></w:r><w:r><w:t>거래처</w:t></w:r><w:r><w:t>}}</w:t></w:r>
 */
function mergeAndReplaceSplitPlaceholders(
  xml: string,
  placeholderMap: Record<string, string>,
  onCount: (count: number) => void,
): string {
  // <w:p> 단위로 처리
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    // 이 단락의 전체 텍스트 추출
    const textParts: Array<{ text: string; start: number; end: number }> = [];
    const runRegex = /<w:r[ >][\s\S]*?<\/w:r>/g;
    let runMatch;

    while ((runMatch = runRegex.exec(paragraph)) !== null) {
      // <w:t ...> 내용 추출
      const tMatch = runMatch[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
      if (tMatch) {
        textParts.push({
          text: tMatch[1],
          start: runMatch.index,
          end: runMatch.index + runMatch[0].length,
        });
      }
    }

    const fullText = textParts.map(p => p.text).join('');

    // 플레이스홀더 패턴 확인
    const pattern = /\{\{([^}]+)\}\}/g;
    let match;
    const replacements: Array<{ key: string; value: string }> = [];

    while ((match = pattern.exec(fullText)) !== null) {
      const key = match[1].trim();
      if (key in placeholderMap) {
        replacements.push({ key: match[1], value: placeholderMap[key] });
      }
    }

    if (replacements.length === 0) return paragraph;

    // 치환이 필요하면, 전체 텍스트에서 치환 후 첫 번째 run에 넣고 나머지 run의 텍스트 비우기
    let newText = fullText;
    let count = 0;
    for (const rep of replacements) {
      newText = newText.replace(`{{${rep.key}}}`, escapeXml(rep.value));
      count++;
    }
    onCount(count);

    if (textParts.length === 0) return paragraph;

    // 첫 번째 <w:t>에 전체 치환 텍스트를 넣고, 나머지 <w:t>는 비움
    let result = paragraph;
    let isFirst = true;

    for (let i = textParts.length - 1; i >= 0; i--) {
      const part = textParts[i];
      const runStr = paragraph.substring(part.start, part.end);
      let newRun: string;

      if (isFirst) {
        // 가장 마지막 part의 <w:t> 내용을 전체 치환 텍스트로 교체
        // (역순으로 처리하므로 마지막이 첫번째로 처리됨... 수정)
        isFirst = false;
      }

      if (i === 0) {
        // 첫 번째 run: 전체 텍스트 삽입
        newRun = runStr.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/, `<w:t xml:space="preserve">${newText}</w:t>`);
      } else {
        // 나머지 run: 텍스트 비우기
        newRun = runStr.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/, '<w:t></w:t>');
      }

      result = result.substring(0, part.start) + newRun + result.substring(part.end);
    }

    return result;
  });
}

function escapeXml(s: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * AI를 사용하여 DOCX XML에 데이터 배치
 */
async function fillDocxWithAI(
  xml: string,
  data: ContractData,
): Promise<{ modified: boolean; xml?: string }> {
  try {
    const OpenAI = require('openai').default;
    const apiKey = await db.getSetting('openai_api_key');
    if (!apiKey) return { modified: false };

    const client = new OpenAI({ apiKey });

    // DOCX XML에서 텍스트 추출
    const plainText = xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim();

    const contractDataStr = JSON.stringify({
      거래처: data.client_company,
      용역명: data.service_name,
      계약번호: data.contract_number,
      계약금액: formatMoney(data.contract_amount),
      부가세: formatMoney(data.vat_amount),
      총액: formatMoney(data.total_amount),
      착수일: formatDateDot(data.contract_start_date),
      준공일: formatDateDot(data.contract_end_date),
      담당자: data.manager_name,
      회사명: data.company_name,
      대표자: data.company_ceo,
    }, null, 2);

    const prompt = `다음은 Word(DOCX) 문서 양식의 텍스트입니다:\n\n${plainText.substring(0, 3000)}\n\n` +
      `다음 계약 데이터를 이 양식에 채워넣어야 합니다:\n${contractDataStr}\n\n` +
      `양식에서 빈칸이나 예시 데이터를 찾아서 실제 값으로 교체해야 합니다.\n` +
      `결과를 JSON 배열로 알려주세요: [{"find":"원본텍스트","replace":"대체텍스트"}, ...]\n` +
      `find에는 원본 문서에 정확히 있는 텍스트를 넣고, replace에는 대체할 텍스트를 넣어주세요.\n` +
      `금액은 천 단위 콤마를 포함하여 표시하세요. 날짜는 YYYY.MM.DD 형식으로 표시하세요.\n` +
      `JSON만 출력해주세요.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { modified: false };

    const replacements: Array<{ find: string; replace: string }> = JSON.parse(jsonMatch[0]);
    let modifiedXml = xml;
    let modified = false;

    for (const rep of replacements) {
      if (!rep.find || !rep.replace) continue;
      // XML 내의 <w:t> 텍스트에서 찾아서 치환
      const escapedFind = escapeXml(rep.find);
      const escapedReplace = escapeXml(rep.replace);

      if (modifiedXml.includes(escapedFind)) {
        modifiedXml = modifiedXml.replace(new RegExp(escapeRegex(escapedFind), 'g'), escapedReplace);
        modified = true;
      } else if (modifiedXml.includes(rep.find)) {
        modifiedXml = modifiedXml.replace(new RegExp(escapeRegex(rep.find), 'g'), escapeXml(rep.replace));
        modified = true;
      }
    }

    return { modified, xml: modifiedXml };
  } catch (err) {
    console.error('AI DOCX 처리 실패:', err);
    return { modified: false };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== 견적서 데이터용 플레이스홀더 맵 =====

export interface QuoteData {
  quote_number?: string;
  recipient_company?: string;
  recipient_contact?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_department?: string;
  recipient_address?: string;
  service_name?: string;
  title?: string;
  quote_date?: string;
  valid_until?: string;
  project_period_months?: number;
  labor_total?: number;
  expense_total?: number;
  total_amount?: number;
  vat_amount?: number;
  grand_total?: number;
  notes?: string;
  company_name?: string;
  company_representative?: string;
  company_business_number?: string;
  company_address?: string;
  company_phone?: string;
}

function buildQuotePlaceholderMap(data: QuoteData): Record<string, string> {
  return {
    '견적번호': data.quote_number || '',
    '수신사': data.recipient_company || '',
    '거래처': data.recipient_company || '',
    '수신_담당자': data.recipient_contact || '',
    '수신_연락처': data.recipient_phone || '',
    '수신_이메일': data.recipient_email || '',
    '수신_부서': data.recipient_department || '',
    '수신_주소': data.recipient_address || '',
    '용역명': data.service_name || '',
    '제목': data.title || '',
    '견적일': formatDateDot(data.quote_date),
    '유효기한': formatDateDot(data.valid_until),
    '사업기간': data.project_period_months ? `${data.project_period_months}개월` : '',
    '인건비': formatMoney(data.labor_total),
    '경비': formatMoney(data.expense_total),
    '합계': formatMoney(data.total_amount),
    '부가세': formatMoney(data.vat_amount),
    '총액': formatMoney(data.grand_total),
    '총견적금액': formatMoney(data.grand_total),
    '비고': data.notes || '',
    '회사명': data.company_name || '',
    '대표자': data.company_representative || '',
    '사업자번호': data.company_business_number || '',
    '회사주소': data.company_address || '',
    '회사전화': data.company_phone || '',
    '오늘': formatDateDot(new Date().toISOString()),
    '오늘_한글': formatDateKr(new Date().toISOString()),
  };
}

/**
 * 견적서용 XLSX 템플릿 채우기
 */
export async function fillXlsxQuoteTemplate(
  templatePath: string,
  data: QuoteData,
  outputPath: string,
): Promise<{ success: boolean; filePath?: string; error?: string; usedAI?: boolean }> {
  // QuoteData를 ContractData처럼 처리하되 견적서 전용 플레이스홀더 맵 사용
  try {
    if (!fs.existsSync(templatePath)) {
      return { success: false, error: `템플릿 파일을 찾을 수 없습니다: ${templatePath}` };
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(templatePath, { cellStyles: true, cellFormula: true, cellDates: true });
    const placeholderMap = buildQuotePlaceholderMap(data);
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    let placeholderCount = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[cellRef];
          if (!cell || cell.t !== 's') continue;

          const original = cell.v;
          if (typeof original !== 'string') continue;

          let replaced = original;
          let hasMatch = false;

          replaced = replaced.replace(placeholderPattern, (match: string, key: string) => {
            const trimmedKey = key.trim();
            if (trimmedKey in placeholderMap) {
              hasMatch = true;
              placeholderCount++;
              return placeholderMap[trimmedKey];
            }
            return match;
          });

          if (hasMatch) {
            cell.v = replaced;
            cell.w = replaced;
            if (/^\d+$/.test(replaced) && replaced.length < 15) {
              cell.v = Number(replaced);
              cell.t = 'n';
              delete cell.w;
            }
          }
        }
      }
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    XLSX.writeFile(workbook, outputPath);

    return { success: true, filePath: outputPath, usedAI: false };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 견적서용 DOCX 템플릿 채우기
 */
export async function fillDocxQuoteTemplate(
  templatePath: string,
  data: QuoteData,
  outputPath: string,
): Promise<{ success: boolean; filePath?: string; error?: string; usedAI?: boolean }> {
  try {
    if (!fs.existsSync(templatePath)) {
      return { success: false, error: `템플릿 파일을 찾을 수 없습니다: ${templatePath}` };
    }

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(templatePath);
    const placeholderMap = buildQuotePlaceholderMap(data);
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    let placeholderCount = 0;

    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];

    for (const xmlPath of xmlFiles) {
      const entry = zip.getEntry(xmlPath);
      if (!entry) continue;

      let xml = entry.getData().toString('utf8');

      let replaced = xml.replace(placeholderPattern, (match: string, key: string) => {
        const trimmedKey = key.trim();
        if (trimmedKey in placeholderMap) {
          placeholderCount++;
          return escapeXml(placeholderMap[trimmedKey]);
        }
        return match;
      });

      replaced = mergeAndReplaceSplitPlaceholders(replaced, placeholderMap, (count: number) => {
        placeholderCount += count;
      });

      zip.updateFile(xmlPath, Buffer.from(replaced, 'utf8'));
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    zip.writeZip(outputPath);

    return { success: true, filePath: outputPath, usedAI: false };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
