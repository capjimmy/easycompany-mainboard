import { ipcMain } from 'electron';
import OpenAI from 'openai';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

/**
 * 계약/프로젝트 회의록 및 기타자료 IPC 핸들러
 *
 * 테이블 스키마 (contract_meeting_notes):
 *  - id            uuid PK
 *  - contract_id   uuid
 *  - file_name     text
 *  - file_size     int
 *  - mime_type     text
 *  - content_text  text   (추출된 텍스트)
 *  - ai_summary    text   (TODO: LLM 요약)
 *  - created_by    uuid
 *  - created_at    timestamptz
 *
 * 텍스트 추출:
 *  - text/plain   : 그대로 사용
 *  - PDF / DOCX   : TODO - pdf-parse / mammoth 패키지 추가 필요
 *  - 이미지       : TODO - OCR 호출 필요
 */

async function extractTextFromFile(fileName: string, mimeType: string, base64: string): Promise<string> {
  try {
    const lower = (fileName || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    if (!base64) return '';

    if (mime.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }

    if (mime.includes('pdf') || lower.endsWith('.pdf')) {
      try {
        const pdfParseMod: any = await import('pdf-parse');
        const pdfParse = pdfParseMod.default || pdfParseMod;
        const buffer = Buffer.from(base64, 'base64');
        const result = await pdfParse(buffer);
        return result.text || '';
      } catch (err: any) {
        console.error('[contractMeetingNote] PDF 추출 실패:', err?.message || err);
        return `(PDF 텍스트 추출 실패: ${fileName})`;
      }
    }

    if (
      mime.includes('wordprocessingml') ||
      lower.endsWith('.docx')
    ) {
      try {
        const mammoth = await import('mammoth');
        const buffer = Buffer.from(base64, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (err: any) {
        console.error('[contractMeetingNote] DOCX 추출 실패:', err?.message || err);
        return `(DOCX 텍스트 추출 실패: ${fileName})`;
      }
    }

    if (mime.startsWith('image/')) {
      // TODO: 이미지 OCR - 기존 OCR IPC/서비스 활용 (본 작업 범위 외)
      return `(이미지 OCR 미구현 - 파일: ${fileName})`;
    }

    return `(자동 텍스트 추출 미지원 - 파일: ${fileName})`;
  } catch (err) {
    console.error('[contractMeetingNote] extractTextFromFile 오류:', err);
    return '';
  }
}

/**
 * LLM 요약
 * - 시스템 설정의 openai_api_key 를 사용 (src/main/services/aiService.ts 와 동일 패턴)
 * - 키 미설정 시 빈 문자열 반환
 */
async function summarizeWithLLM(text: string): Promise<string> {
  try {
    if (!text || !text.trim()) return '';

    const apiKey = await db.getSetting('openai_api_key');
    if (!apiKey) {
      // API 키 미설정 - 요약 기능은 시스템 설정에서 OpenAI API 키 등록 후 사용 가능
      return '';
    }

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '당신은 회의록 요약 전문가입니다. 다음 회의록을 한국어로 핵심 내용만 5~10줄로 요약해주세요. 결정사항, 액션 아이템, 일정을 명확히 표시하세요.',
        },
        {
          role: 'user',
          content: text.slice(0, 8000),
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    return response.choices[0]?.message?.content || '';
  } catch (err: any) {
    console.error('[contractMeetingNote] summarizeWithLLM 오류:', err?.message || err);
    return '';
  }
}

export function registerContractMeetingNoteHandlers(): void {
  ipcMain.handle('contractMeetingNotes:getByContract', async (_event, requesterId: string, contractId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const notes = await db.getContractMeetingNotes(contractId);
      return { success: true, notes };
    } catch (error: any) {
      return { success: false, error: error.message || '회의록 조회에 실패했습니다.' };
    }
  });

  ipcMain.handle('contractMeetingNotes:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      if (!data.contract_id || !data.file_name) {
        return { success: false, error: '계약과 파일명이 필요합니다.' };
      }

      const contentText =
        data.content_text ??
        (await extractTextFromFile(data.file_name, data.mime_type || '', data.file_base64 || ''));

      const aiSummary = await summarizeWithLLM(contentText);

      const note = {
        id: uuidv4(),
        contract_id: data.contract_id,
        file_name: data.file_name,
        file_size: data.file_size || 0,
        mime_type: data.mime_type || '',
        content_text: contentText,
        ai_summary: aiSummary,
        created_by: requesterId,
        created_at: new Date().toISOString(),
      };

      const result = await db.addContractMeetingNote(note);
      return { success: true, note: result };
    } catch (error: any) {
      return { success: false, error: error.message || '회의록 저장에 실패했습니다.' };
    }
  });

  ipcMain.handle('contractMeetingNotes:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const note = await db.getContractMeetingNoteById(id);
      if (!note) return { success: false, error: '회의록을 찾을 수 없습니다.' };

      const isAdmin = ['super_admin', 'company_admin'].includes(requester.role);
      const isOwner = note.created_by === requesterId;
      if (!isAdmin && !isOwner) return { success: false, error: '삭제 권한이 없습니다.' };

      await db.deleteContractMeetingNote(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '회의록 삭제에 실패했습니다.' };
    }
  });
}
