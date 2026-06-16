import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_TEXT_EXTENSIONS = ['.txt', '.csv', '.json'];
const SUPPORTED_BINARY_EXTENSIONS = ['.doc', '.docx', '.pdf', '.hwp', '.hwpx', '.xlsx', '.xls'];
const ALL_SUPPORTED_EXTENSIONS = [...SUPPORTED_TEXT_EXTENSIONS, ...SUPPORTED_BINARY_EXTENSIONS];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for binary files
const MAX_CONTENT_LENGTH = 5000; // Max chars per file content

interface FileInfo {
  name: string;
  relativePath: string;
  extension: string;
  size: number;
  content?: string;
  isImagePdf?: boolean;
}

interface ScanResult {
  folderName: string;
  totalFiles: number;
  files: FileInfo[];
  directoryStructure: string;
}

/**
 * HWP 파일에서 텍스트를 추출 (바이너리 스캔 방식)
 * HWP 파일 내부의 UTF-16LE 한글 텍스트 영역을 찾아서 추출
 */
function extractTextFromHwp(buffer: Buffer): string {
  const texts: string[] = [];
  // HWP files store text in UTF-16LE encoding
  // Scan for runs of valid Korean/ASCII characters
  let i = 0;
  let currentText = '';
  while (i < buffer.length - 1) {
    const code = buffer.readUInt16LE(i);
    // Korean Syllables (가-힣), Basic Latin (space~tilde), Korean Jamo, CJK
    if (
      (code >= 0xAC00 && code <= 0xD7A3) || // Korean syllables
      (code >= 0x0020 && code <= 0x007E) ||  // ASCII printable
      (code >= 0x3131 && code <= 0x318E) ||  // Korean compatibility Jamo
      (code >= 0x2000 && code <= 0x206F) ||  // General punctuation
      code === 0x000A || code === 0x000D     // newline/carriage return
    ) {
      currentText += String.fromCharCode(code);
    } else {
      if (currentText.trim().length > 5) {
        texts.push(currentText.trim());
      }
      currentText = '';
    }
    i += 2;
  }
  if (currentText.trim().length > 5) {
    texts.push(currentText.trim());
  }
  // Filter out noise: keep only segments with Korean characters
  const koreanTexts = texts.filter(t => /[가-힣]/.test(t));
  return koreanTexts.join('\n');
}

/**
 * 파일에서 컨텐츠를 추출 (비동기)
 */
async function extractFileContent(fullPath: string, ext: string, fileSize: number): Promise<{ content: string; isImagePdf?: boolean }> {
  // 텍스트 파일
  if (SUPPORTED_TEXT_EXTENSIONS.includes(ext)) {
    if (fileSize > MAX_FILE_SIZE) return { content: '' };
    try {
      const text = fs.readFileSync(fullPath, 'utf-8');
      return { content: text.substring(0, MAX_CONTENT_LENGTH) };
    } catch {
      return { content: '' };
    }
  }

  // PDF
  if (ext === '.pdf') {
    if (fileSize > MAX_FILE_SIZE) return { content: '' };
    try {
      const pdfParseMod: any = await import('pdf-parse');
      const pdfParse = pdfParseMod.default || pdfParseMod;
      const buffer = fs.readFileSync(fullPath);
      const result = await pdfParse(buffer);
      const text = result.text?.substring(0, MAX_CONTENT_LENGTH) || '';
      // If text is too short, likely an image-based PDF (scanned)
      if (text.trim().length < 50) {
        return { content: text, isImagePdf: true };
      }
      return { content: text };
    } catch {
      return { content: '' };
    }
  }

  // DOCX
  if (ext === '.docx') {
    if (fileSize > MAX_FILE_SIZE) return { content: '' };
    try {
      const mammoth = await import('mammoth');
      const buffer = fs.readFileSync(fullPath);
      const result = await mammoth.extractRawText({ buffer });
      return { content: result.value?.substring(0, MAX_CONTENT_LENGTH) || '' };
    } catch {
      return { content: '' };
    }
  }

  // XLSX / XLS
  if (ext === '.xlsx' || ext === '.xls') {
    if (fileSize > MAX_FILE_SIZE) return { content: '' };
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(fullPath);
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        text += `[${sheetName}]\n${csv}\n`;
        if (text.length > MAX_CONTENT_LENGTH) break;
      }
      return { content: text.substring(0, MAX_CONTENT_LENGTH) };
    } catch {
      return { content: '' };
    }
  }

  // HWP / HWPX (binary text extraction)
  if (ext === '.hwp' || ext === '.hwpx') {
    if (fileSize > MAX_FILE_SIZE) return { content: '' };
    try {
      const buffer = fs.readFileSync(fullPath);
      const text = extractTextFromHwp(buffer);
      return { content: text.substring(0, MAX_CONTENT_LENGTH) };
    } catch {
      return { content: '' };
    }
  }

  return { content: '' };
}

/**
 * 폴더를 재귀적으로 스캔하여 파일 정보를 수집
 * @param dirPath 스캔할 디렉토리 경로
 * @param basePath 기준 경로 (상대 경로 계산용)
 * @param currentDepth 현재 깊이
 * @param maxDepth 최대 깊이 (3단계)
 */
async function scanDirectory(dirPath: string, basePath: string, currentDepth: number, maxDepth: number): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  if (currentDepth > maxDepth) return files;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 숨김 파일/폴더 건너뛰기
      if (entry.name.startsWith('.') || entry.name === '#recycle' || entry.name === 'Thumbs.db') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        // 하위 디렉토리 재귀 스캔
        const subFiles = await scanDirectory(fullPath, basePath, currentDepth + 1, maxDepth);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALL_SUPPORTED_EXTENSIONS.includes(ext)) continue;

        try {
          const stats = fs.statSync(fullPath);
          const fileInfo: FileInfo = {
            name: entry.name,
            relativePath: relativePath.replace(/\\/g, '/'),
            extension: ext,
            size: stats.size,
          };

          // 모든 지원 파일에서 컨텐츠 추출
          const extracted = await extractFileContent(fullPath, ext, stats.size);
          if (extracted.content) {
            fileInfo.content = extracted.content;
          }
          if (extracted.isImagePdf) {
            fileInfo.isImagePdf = true;
          }

          files.push(fileInfo);
        } catch {
          // stat 실패 시 건너뛰기
        }
      }
    }
  } catch {
    // 디렉토리 읽기 실패 시 빈 배열 반환
  }

  return files;
}

/**
 * 디렉토리 구조를 트리 형태 문자열로 생성
 */
function buildDirectoryTree(dirPath: string, basePath: string, currentDepth: number, maxDepth: number, indent: string = ''): string {
  if (currentDepth > maxDepth) return '';

  let tree = '';
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const filtered = entries.filter(e => !e.name.startsWith('.') && e.name !== '#recycle' && e.name !== 'Thumbs.db');

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const prefix = indent + (isLast ? '└── ' : '├── ');
      const childIndent = indent + (isLast ? '    ' : '│   ');

      if (entry.isDirectory()) {
        tree += `${prefix}${entry.name}/\n`;
        tree += buildDirectoryTree(path.join(dirPath, entry.name), basePath, currentDepth + 1, maxDepth, childIndent);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALL_SUPPORTED_EXTENSIONS.includes(ext)) {
          tree += `${prefix}${entry.name}\n`;
        }
      }
    }
  } catch {
    // 디렉토리 읽기 실패
  }

  return tree;
}

/**
 * 견적서 추출을 위한 프롬프트 생성
 */
function getQuotePrompt(scanResult: ScanResult): string {
  return `당신은 문서 분석 전문가입니다. 아래 폴더에서 스캔한 파일 정보를 분석하여 견적서 관련 데이터를 추출해주세요.

폴더명: ${scanResult.folderName}
총 파일 수: ${scanResult.totalFiles}

디렉토리 구조:
${scanResult.directoryStructure}

파일 목록 및 내용:
${scanResult.files.map(f => {
  let info = `\n--- 파일: ${f.relativePath} (${f.extension}, ${(f.size / 1024).toFixed(1)}KB) ---`;
  if (f.isImagePdf) {
    info += '\n[이미지 기반 PDF - 스캔된 문서로 텍스트 추출 불가. 파일명과 폴더 구조에서 정보를 추출해주세요.]';
  } else if (f.content) {
    info += `\n내용:\n${f.content.substring(0, 3000)}`;
    if (f.content.length > 3000) info += '\n... (내용 생략)';
  } else {
    info += '\n(내용 추출 실패 - 파일명에서 정보 추출)';
  }
  return info;
}).join('\n')}

위 정보를 분석하여 다음 JSON 형식으로 견적서 데이터를 추출해주세요.
파일 내용(텍스트, PDF, DOCX, XLSX, HWP 등에서 추출)과 파일명에서 유추할 수 있는 정보를 최대한 활용하세요.
특히 거래처명, 사업자번호, 용역명, 계약금액, 부가세, 합계, 계약일, 착수일, 완료일, 담당자 등의 정보를 찾아주세요.
확인할 수 없는 필드는 빈 문자열이나 빈 배열로 남겨주세요.

{
  "recipient_company": "수신 회사명",
  "recipient_contact": "담당자명",
  "recipient_phone": "연락처",
  "recipient_email": "이메일",
  "service_name": "용역명/서비스명",
  "title": "견적서 제목",
  "quote_date": "견적일 (YYYY-MM-DD 형식)",
  "notes": "비고/특이사항",
  "total_amount": 0,
  "labor_items": [
    {
      "grade_name": "직급/등급명 (예: 책임연구원, 연구원, 선임연구보조, 연구보조, 기술사, 특급기술자, 고급기술자, 중급기술자, 초급기술자)",
      "quantity": 1,
      "participation_rate": 100,
      "months": 1,
      "unit_price": 월단가(숫자)
    }
  ],
  "expense_items": [
    {
      "category_name": "경비항목명 (예: 제경비, 기술료, 출장비, 사무용품비, 회의비, 인쇄비, 여비교통비 등)",
      "calculation_type": "manual 또는 percentage",
      "rate": 비율(percentage일 경우 0~1 사이 소수, 예: 0.1),
      "amount": 금액(숫자)
    }
  ],
  "sections": [
    {
      "level": 1,
      "title": "대분류명",
      "amount": 금액(숫자),
      "children": [
        {
          "level": 2,
          "title": "세부분류명",
          "amount": 금액(숫자),
          "children": [
            {
              "level": 3,
              "title": "세세부분류명",
              "amount": 금액(숫자)
            }
          ]
        }
      ]
    }
  ]
}

labor_items: 인건비 내역 (직급별 투입인원, 참여율, 개월수, 단가)
expense_items: 경비 내역 (제경비, 기술료 등. 직접인건비의 비율로 산정되면 calculation_type을 percentage로)
sections: 용역 내용의 대분류/세부/세세부 구조. 금액이 없으면 0으로.

반드시 유효한 JSON만 응답해주세요. 설명이나 마크다운 코드블록 없이 순수 JSON만 출력하세요.`;
}

/**
 * 계약서 추출을 위한 프롬프트 생성
 */
function getContractPrompt(scanResult: ScanResult): string {
  return `당신은 문서 분석 전문가입니다. 아래 폴더에서 스캔한 파일 정보를 분석하여 계약서 관련 데이터를 추출해주세요.

폴더명: ${scanResult.folderName}
총 파일 수: ${scanResult.totalFiles}

디렉토리 구조:
${scanResult.directoryStructure}

파일 목록 및 내용:
${scanResult.files.map(f => {
  let info = `\n--- 파일: ${f.relativePath} (${f.extension}, ${(f.size / 1024).toFixed(1)}KB) ---`;
  if (f.isImagePdf) {
    info += '\n[이미지 기반 PDF - 스캔된 문서로 텍스트 추출 불가. 파일명과 폴더 구조에서 정보를 추출해주세요.]';
  } else if (f.content) {
    info += `\n내용:\n${f.content.substring(0, 3000)}`;
    if (f.content.length > 3000) info += '\n... (내용 생략)';
  } else {
    info += '\n(내용 추출 실패 - 파일명에서 정보 추출)';
  }
  return info;
}).join('\n')}

위 정보를 분석하여 다음 JSON 형식으로 계약서 데이터를 추출해주세요.
파일 내용(텍스트, PDF, DOCX, XLSX, HWP 등에서 추출)과 파일명에서 유추할 수 있는 정보를 최대한 활용하세요.
특히 거래처명, 사업자번호, 용역명, 계약금액, 부가세, 합계, 계약일, 착수일, 완료일, 담당자 등의 정보를 찾아주세요.
확인할 수 없는 필드는 빈 문자열이나 빈 배열로 남겨주세요.

{
  "client_company": "발주처/클라이언트 회사명",
  "client_contact_name": "담당자명",
  "client_contact_phone": "연락처",
  "client_contact_email": "이메일",
  "service_name": "용역명/서비스명",
  "contract_type": "계약 유형 (용역, 구매, 위탁 등)",
  "contract_start_date": "계약 시작일 (YYYY-MM-DD 형식)",
  "contract_end_date": "계약 종료일 (YYYY-MM-DD 형식)",
  "contract_amount": 0,
  "description": "계약 내용 요약",
  "notes": "비고/특이사항",
  "labor_items": [
    {
      "grade_name": "직급/등급명 (예: 책임연구원, 연구원, 선임연구보조, 연구보조, 기술사, 특급기술자, 고급기술자, 중급기술자, 초급기술자)",
      "quantity": 1,
      "participation_rate": 100,
      "months": 1,
      "unit_price": 월단가(숫자)
    }
  ],
  "expense_items": [
    {
      "category_name": "경비항목명 (예: 제경비, 기술료, 출장비, 사무용품비, 회의비, 인쇄비, 여비교통비 등)",
      "calculation_type": "manual 또는 percentage",
      "rate": 비율(percentage일 경우 0~1 사이 소수, 예: 0.1),
      "amount": 금액(숫자)
    }
  ],
  "sections": [
    {
      "level": 1,
      "title": "대분류명",
      "amount": 금액(숫자),
      "children": [
        {
          "level": 2,
          "title": "세부분류명",
          "amount": 금액(숫자),
          "children": [
            {
              "level": 3,
              "title": "세세부분류명",
              "amount": 금액(숫자)
            }
          ]
        }
      ]
    }
  ]
}

labor_items: 인건비 내역 (직급별 투입인원, 참여율, 개월수, 단가)
expense_items: 경비 내역 (제경비, 기술료 등. 직접인건비의 비율로 산정되면 calculation_type을 percentage로)
sections: 용역 내용의 대분류/세부/세세부 구조. 금액이 없으면 0으로.

반드시 유효한 JSON만 응답해주세요. 설명이나 마크다운 코드블록 없이 순수 JSON만 출력하세요.`;
}

export function registerFolderScanIPC(): void {
  ipcMain.handle('folderScan:scanFolder', async (_event, docType: 'quote' | 'contract') => {
    try {
      // 1. OpenAI API 키 확인
      const apiKey = await db.getSetting('openai_api_key');
      if (!apiKey) {
        return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다. 설정에서 API 키를 등록해주세요.' };
      }

      // 2. 폴더 선택 다이얼로그
      const dialogResult = await dialog.showOpenDialog({
        title: '문서 폴더 선택 - 폴더 스캔',
        properties: ['openDirectory'],
      });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return { success: false, error: 'canceled' };
      }

      const selectedFolder = dialogResult.filePaths[0];
      const folderName = path.basename(selectedFolder);

      // 3. 폴더 재귀 스캔 (최대 3단계, 파일 내용 추출 포함)
      const files = await scanDirectory(selectedFolder, selectedFolder, 1, 3);

      if (files.length === 0) {
        return { success: false, error: '선택한 폴더에서 지원되는 문서 파일을 찾을 수 없습니다.' };
      }

      // 4. 디렉토리 구조 생성
      const directoryStructure = `${folderName}/\n${buildDirectoryTree(selectedFolder, selectedFolder, 1, 3)}`;

      const scanResult: ScanResult = {
        folderName,
        totalFiles: files.length,
        files,
        directoryStructure,
      };

      // 5. OpenAI API 호출
      const openai = new OpenAI({ apiKey });
      const rawPrompt = docType === 'quote' ? getQuotePrompt(scanResult) : getContractPrompt(scanResult);
      // 짝 안 맞는 유니코드 surrogate 제거 (HWP 바이너리 추출/잘림으로 생긴 lone surrogate → OpenAI 400 방지)
      const prompt = rawPrompt.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

      // Use gpt-4o for better document content analysis (not mini)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      // 6. JSON 파싱
      let parsedData: any;
      try {
        // 코드블록 제거 후 파싱 시도
        const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsedData = JSON.parse(cleaned);
      } catch {
        return { success: false, error: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.' };
      }

      return {
        success: true,
        data: parsedData,
        folderPath: selectedFolder,
        scannedFiles: files.length,
      };
    } catch (err: any) {
      return { success: false, error: err.message || '폴더 스캔 중 오류가 발생했습니다.' };
    }
  });
}
