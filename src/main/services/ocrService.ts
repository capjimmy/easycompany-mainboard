import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

let openaiClient: OpenAI | null = null;

export function initOCRClient(apiKey: string) {
  openaiClient = new OpenAI({ apiKey });
}

export function getOCRClient(): OpenAI | null {
  return openaiClient;
}

const DOC_TYPE_PROMPTS: Record<string, string> = {
  quote: `이 문서는 견적서입니다. 다음 정보를 JSON 형식으로 추출해주세요:
{
  "recipient_company": "수신처 회사명",
  "recipient_contact": "담당자명",
  "recipient_phone": "연락처",
  "recipient_email": "이메일",
  "service_name": "용역명/프로젝트명",
  "title": "견적서 제목",
  "quote_date": "견적일자 (YYYY-MM-DD)",
  "total_amount": 총금액(숫자),
  "vat_amount": 부가세(숫자),
  "grand_total": 합계(숫자),
  "notes": "비고/특이사항",
  "labor_items": [
    {
      "grade_name": "직급/등급명 (책임연구원, 연구원, 선임연구보조, 연구보조, 기술사, 특급기술자 등)",
      "quantity": 인원수(숫자),
      "participation_rate": 참여율(숫자, 100이 기본),
      "months": 개월수(숫자),
      "unit_price": 월단가(숫자)
    }
  ],
  "expense_items": [
    {
      "category_name": "경비항목명 (제경비, 기술료, 출장비, 사무용품비 등)",
      "calculation_type": "manual 또는 percentage",
      "rate": 비율(percentage일 경우 0~1 소수),
      "amount": 금액(숫자)
    }
  ],
  "sections": [
    {
      "level": 1,
      "title": "대분류명",
      "amount": 금액(숫자),
      "children": [
        {"level": 2, "title": "세부분류명", "amount": 금액, "children": [
          {"level": 3, "title": "세세부분류명", "amount": 금액}
        ]}
      ]
    }
  ]
}
값이 없으면 null, 배열이 없으면 빈 배열로 표시해주세요. 금액은 숫자만 입력해주세요.`,

  contract: `이 문서는 계약서입니다. 다음 정보를 JSON 형식으로 추출해주세요:
{
  "client_company": "발주기관/거래처명",
  "client_contact_name": "담당자명",
  "client_contact_phone": "연락처",
  "service_name": "용역명/프로젝트명",
  "contract_type": "계약유형 (service/research/consulting/maintenance/other)",
  "contract_start_date": "계약시작일 (YYYY-MM-DD)",
  "contract_end_date": "계약종료일 (YYYY-MM-DD)",
  "contract_amount": 계약금액(숫자),
  "vat_amount": 부가세(숫자),
  "total_amount": 총액(숫자),
  "description": "계약 설명",
  "notes": "비고/특이사항",
  "labor_items": [
    {
      "grade_name": "직급/등급명 (책임연구원, 연구원, 선임연구보조, 연구보조, 기술사, 특급기술자 등)",
      "quantity": 인원수(숫자),
      "participation_rate": 참여율(숫자, 100이 기본),
      "months": 개월수(숫자),
      "unit_price": 월단가(숫자)
    }
  ],
  "expense_items": [
    {
      "category_name": "경비항목명 (제경비, 기술료, 출장비, 사무용품비 등)",
      "calculation_type": "manual 또는 percentage",
      "rate": 비율(percentage일 경우 0~1 소수),
      "amount": 금액(숫자)
    }
  ],
  "sections": [
    {
      "level": 1,
      "title": "대분류명",
      "amount": 금액(숫자),
      "children": [
        {"level": 2, "title": "세부분류명", "amount": 금액, "children": [
          {"level": 3, "title": "세세부분류명", "amount": 금액}
        ]}
      ]
    }
  ]
}
값이 없으면 null, 배열이 없으면 빈 배열로 표시해주세요. 금액은 숫자만 입력해주세요.`,

  general: `이 문서의 내용을 분석하여 다음 정보를 JSON 형식으로 추출해주세요:
{
  "document_type": "문서 종류",
  "company_name": "회사/기관명",
  "contact_name": "담당자명",
  "contact_phone": "연락처",
  "contact_email": "이메일",
  "date": "문서 날짜",
  "amount": 금액(숫자),
  "description": "문서 내용 요약",
  "items": [관련 항목 목록],
  "notes": "비고/특이사항"
}
값이 없으면 null로 표시해주세요.`,
};

// 이미지 파일 (Vision API 사용)
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
// 텍스트 추출 가능한 문서 파일
const TEXT_DOC_EXTENSIONS = ['.xlsx', '.xls', '.docx', '.hwp', '.pdf'];

/**
 * xlsx 파일에서 텍스트 추출
 */
function extractTextFromXlsx(filePath: string): string {
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
    if (csv.trim()) {
      parts.push(`[시트: ${sheetName}]\n${csv}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * docx 파일에서 텍스트 추출 (xml 파싱)
 */
function extractTextFromDocx(filePath: string): string {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) return '';
    const xml = entry.getData().toString('utf8');
    // XML 태그 제거하고 텍스트만 추출
    const text = xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  } catch {
    return '';
  }
}

/**
 * hwp 파일에서 텍스트 추출 (바이너리에서 유니코드 문자열 추출)
 */
function extractTextFromHwp(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    // HWP 파일에서 UTF-16LE 텍스트 블록 추출 시도
    const texts: string[] = [];
    let current = '';

    for (let i = 0; i < buffer.length - 1; i += 2) {
      const charCode = buffer[i] | (buffer[i + 1] << 8);
      // 일반적인 한글/영문/숫자/공백/구두점 범위
      if (
        (charCode >= 0x20 && charCode <= 0x7E) || // ASCII printable
        (charCode >= 0xAC00 && charCode <= 0xD7AF) || // 한글 음절
        (charCode >= 0x3131 && charCode <= 0x318E) || // 한글 자모
        charCode === 0x0A || charCode === 0x0D // 줄바꿈
      ) {
        current += String.fromCharCode(charCode);
      } else {
        if (current.length > 5) {
          texts.push(current.trim());
        }
        current = '';
      }
    }
    if (current.length > 5) texts.push(current.trim());

    return texts.join('\n');
  } catch {
    return '';
  }
}

/**
 * PDF 파일에서 텍스트 추출 (바이너리에서 텍스트 스트림 추출)
 */
function extractTextFromPdf(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('latin1');
    const texts: string[] = [];

    // PDF 텍스트 스트림에서 텍스트 추출
    // BT ... ET 블록 내의 텍스트 오퍼레이터 (Tj, TJ, ') 추출
    const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
    let match;
    while ((match = streamRegex.exec(content)) !== null) {
      const stream = match[1];
      // 괄호 안의 텍스트 추출 (Tj 오퍼레이터)
      const textRegex = /\(([^)]*)\)/g;
      let textMatch;
      while ((textMatch = textRegex.exec(stream)) !== null) {
        const text = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (text.trim().length > 0) {
          texts.push(text);
        }
      }
    }

    // UTF-16BE로 인코딩된 한글 텍스트도 추출 시도
    const utf16Texts: string[] = [];
    const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
    while ((match = hexRegex.exec(content)) !== null) {
      const hex = match[1].replace(/\s/g, '');
      if (hex.length >= 4 && hex.length % 4 === 0) {
        try {
          let str = '';
          for (let i = 0; i < hex.length; i += 4) {
            const charCode = parseInt(hex.substring(i, i + 4), 16);
            if (charCode > 0x1F) {
              str += String.fromCharCode(charCode);
            }
          }
          if (str.trim().length > 1) {
            utf16Texts.push(str.trim());
          }
        } catch { /* ignore */ }
      }
    }

    const allTexts = [...texts, ...utf16Texts].filter(t => t.length > 0);
    const result = allTexts.join(' ');

    // 텍스트 추출 실패 시 바이너리에서 직접 추출 시도
    if (result.length < 10) {
      const rawTexts: string[] = [];
      let current = '';
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x0A || byte === 0x0D) {
          current += String.fromCharCode(byte);
        } else {
          if (current.length > 10) {
            const cleaned = current.trim().replace(/[^a-zA-Z0-9가-힣\s.,()-]/g, '');
            if (cleaned.length > 5) rawTexts.push(cleaned);
          }
          current = '';
        }
      }
      if (current.length > 10) rawTexts.push(current.trim());
      return rawTexts.join('\n');
    }

    return result;
  } catch {
    return '';
  }
}

export async function processImageWithOCR(
  filePath: string,
  docType: string = 'general'
): Promise<{ success: boolean; data?: any; rawText?: string; error?: string }> {
  if (!openaiClient) {
    return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다.' };
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const prompt = DOC_TYPE_PROMPTS[docType] || DOC_TYPE_PROMPTS['general'];

    let response;

    if (TEXT_DOC_EXTENSIONS.includes(ext)) {
      // 텍스트 기반 문서: 텍스트 추출 후 AI 분석
      let extractedText = '';

      if (ext === '.xlsx' || ext === '.xls') {
        extractedText = extractTextFromXlsx(filePath);
      } else if (ext === '.docx') {
        extractedText = extractTextFromDocx(filePath);
      } else if (ext === '.hwp') {
        extractedText = extractTextFromHwp(filePath);
      } else if (ext === '.pdf') {
        extractedText = extractTextFromPdf(filePath);
      }

      if (!extractedText || extractedText.length < 10) {
        return { success: false, error: '문서에서 텍스트를 추출할 수 없습니다. 다른 형식의 파일을 시도해주세요.' };
      }

      // 텍스트가 너무 길면 잘라내기
      const truncated = extractedText.length > 15000
        ? extractedText.substring(0, 15000) + '\n... (이하 생략)'
        : extractedText;

      response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `다음은 문서에서 추출한 텍스트입니다:\n\n${truncated}\n\n${prompt}`,
          },
        ],
        max_tokens: 4000,
      });
    } else {
      // 이미지/PDF: Vision API 사용
      const fileBuffer = fs.readFileSync(filePath);
      const base64Image = fileBuffer.toString('base64');

      let mimeType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';

      response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      });
    }

    const responseText = response.choices[0]?.message?.content || '';

    // JSON 추출 시도
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      const parsedData = JSON.parse(jsonStr);
      return { success: true, data: parsedData, rawText: responseText };
    } catch {
      return { success: true, data: null, rawText: responseText };
    }
  } catch (err: any) {
    return { success: false, error: err.message || '문서 분석에 실패했습니다.' };
  }
}
