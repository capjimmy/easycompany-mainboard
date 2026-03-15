import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_TEXT_EXTENSIONS = ['.txt', '.csv', '.json'];
const SUPPORTED_BINARY_EXTENSIONS = ['.doc', '.docx', '.pdf', '.hwp', '.hwpx', '.xlsx', '.xls'];
const ALL_SUPPORTED_EXTENSIONS = [...SUPPORTED_TEXT_EXTENSIONS, ...SUPPORTED_BINARY_EXTENSIONS];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

interface FileInfo {
  name: string;
  relativePath: string;
  extension: string;
  size: number;
  content?: string;
}

interface ScanResult {
  folderName: string;
  totalFiles: number;
  files: FileInfo[];
  directoryStructure: string;
}

/**
 * 폴더를 재귀적으로 스캔하여 파일 정보를 수집
 * @param dirPath 스캔할 디렉토리 경로
 * @param basePath 기준 경로 (상대 경로 계산용)
 * @param currentDepth 현재 깊이
 * @param maxDepth 최대 깊이 (3단계)
 */
function scanDirectory(dirPath: string, basePath: string, currentDepth: number, maxDepth: number): FileInfo[] {
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
        const subFiles = scanDirectory(fullPath, basePath, currentDepth + 1, maxDepth);
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

          // 텍스트 파일이고 1MB 이하이면 내용 읽기
          if (SUPPORTED_TEXT_EXTENSIONS.includes(ext) && stats.size <= MAX_FILE_SIZE) {
            try {
              fileInfo.content = fs.readFileSync(fullPath, 'utf-8');
            } catch {
              // 읽기 실패 시 내용 없이 진행
            }
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
  if (f.content) {
    info += `\n내용:\n${f.content.substring(0, 3000)}`;
    if (f.content.length > 3000) info += '\n... (내용 생략)';
  } else {
    info += '\n(바이너리 파일 - 내용 읽기 불가, 파일명에서 정보 추출)';
  }
  return info;
}).join('\n')}

위 정보를 분석하여 다음 JSON 형식으로 견적서 데이터를 추출해주세요.
파일 내용이나 파일명에서 유추할 수 있는 정보만 포함하고, 확인할 수 없는 필드는 빈 문자열로 남겨주세요.

{
  "recipient_company": "수신 회사명",
  "recipient_contact": "담당자명",
  "recipient_phone": "연락처",
  "recipient_email": "이메일",
  "service_name": "용역명/서비스명",
  "title": "견적서 제목",
  "quote_date": "견적일 (YYYY-MM-DD 형식)",
  "notes": "비고/특이사항",
  "total_amount": 0
}

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
  if (f.content) {
    info += `\n내용:\n${f.content.substring(0, 3000)}`;
    if (f.content.length > 3000) info += '\n... (내용 생략)';
  } else {
    info += '\n(바이너리 파일 - 내용 읽기 불가, 파일명에서 정보 추출)';
  }
  return info;
}).join('\n')}

위 정보를 분석하여 다음 JSON 형식으로 계약서 데이터를 추출해주세요.
파일 내용이나 파일명에서 유추할 수 있는 정보만 포함하고, 확인할 수 없는 필드는 빈 문자열로 남겨주세요.

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
  "notes": "비고/특이사항"
}

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

      // 3. 폴더 재귀 스캔 (최대 3단계)
      const files = scanDirectory(selectedFolder, selectedFolder, 1, 3);

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
      const prompt = docType === 'quote' ? getQuotePrompt(scanResult) : getContractPrompt(scanResult);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
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
