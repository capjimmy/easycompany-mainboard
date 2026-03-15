import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

// 견적 상태 레이블
const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: '작성중',
  submitted: '제출완료',
  negotiating: '협상중',
  approved: '승인됨',
  rejected: '거절됨',
  converted: '계약전환',
};

// 계약 진행상황 레이블
const CONTRACT_PROGRESS_LABELS: Record<string, string> = {
  contract_signed: '계약체결',
  in_progress: '진행중',
  inspection: '검수중',
  completed: '완료',
  on_hold: '보류',
  cancelled: '취소',
};

// 계약 유형 레이블
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: '용역계약',
  research: '연구용역',
  consulting: '컨설팅',
  maintenance: '유지보수',
  other: '기타',
};

type ExportResult = { success: boolean; filePath?: string; error?: string };

/**
 * 권한 확인: super_admin 또는 company_admin만 허용
 */
async function checkExportPermission(requesterId: string): Promise<{ allowed: boolean; error?: string }> {
  const requester = await db.getUserById(requesterId);
  if (!requester) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }
  if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
    return { allowed: false, error: '내보내기 권한이 없습니다. 관리자만 사용할 수 있습니다.' };
  }
  return { allowed: true };
}

/**
 * 워크북을 파일로 저장 (사용자에게 저장 경로 선택 다이얼로그 표시)
 */
async function saveWorkbook(
  workbook: XLSX.WorkBook,
  defaultFileName: string
): Promise<ExportResult> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Excel 파일 저장',
    defaultPath: defaultFileName,
    filters: [
      { name: 'Excel 파일', extensions: ['xlsx'] },
    ],
  });

  if (canceled || !filePath) {
    return { success: false, error: '저장이 취소되었습니다.' };
  }

  XLSX.writeFile(workbook, filePath);
  return { success: true, filePath };
}

export function registerExportIPC(): void {
  // ========================================
  // 견적 목록 내보내기
  // ========================================
  ipcMain.handle('export:quotes', async (_event, requesterId: string, filters?: any): Promise<ExportResult> => {
    try {
      const permission = await checkExportPermission(requesterId);
      if (!permission.allowed) {
        return { success: false, error: permission.error };
      }

      const requester = await db.getUserById(requesterId);
      let quotes = await db.getQuotes();

      // 회사 필터링
      if (requester && requester.role !== 'super_admin' && requester.company_id) {
        quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
      }

      const rows = (quotes || []).map((q: any) => {
        const subtotal = q.total_amount || 0;
        const vat = Math.round(subtotal * 0.1);
        const grandTotal = q.grand_total || (subtotal + vat);
        return {
          '견적번호': q.quote_number || '',
          '수신처': q.recipient_company || '',
          '용역명': q.service_name || '',
          '견적일자': q.quote_date ? dayjs(q.quote_date).format('YYYY-MM-DD') : '',
          '합계(VAT별도)': subtotal,
          'VAT': vat,
          '총액(VAT포함)': grandTotal,
          '상태': QUOTE_STATUS_LABELS[q.status] || q.status || '',
          '작성자': q.created_by_name || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '견적목록');

      const today = dayjs().format('YYYY-MM-DD');
      return await saveWorkbook(workbook, `견적목록_${today}.xlsx`);
    } catch (error: any) {
      console.error('견적 내보내기 오류:', error);
      return { success: false, error: error.message || '견적 내보내기 중 오류가 발생했습니다.' };
    }
  });

  // ========================================
  // 계약 목록 내보내기
  // ========================================
  ipcMain.handle('export:contracts', async (_event, requesterId: string, filters?: any): Promise<ExportResult> => {
    try {
      const permission = await checkExportPermission(requesterId);
      if (!permission.allowed) {
        return { success: false, error: permission.error };
      }

      const requesterC = await db.getUserById(requesterId);
      let contracts = await db.getContracts();

      // 회사 필터링
      if (requesterC && requesterC.role !== 'super_admin' && requesterC.company_id) {
        contracts = contracts.filter((c: any) => c.company_id === requesterC.company_id);
      }

      const rows = (contracts || []).map((c: any) => {
        const contractAmount = c.contract_amount ?? 0;
        const vat = Math.round(contractAmount * 0.1);
        const totalAmount = c.total_amount ?? (contractAmount + vat);
        const receivedAmount = c.received_amount ?? 0;
        const remainingAmount = c.remaining_amount ?? (totalAmount - receivedAmount);
        const collectionRate = totalAmount > 0
          ? `${((receivedAmount / totalAmount) * 100).toFixed(1)}%`
          : '0.0%';

        return {
          '계약번호': c.contract_number || '',
          '발주기관': c.client_company || '',
          '용역명': c.service_name || '',
          '계약유형': CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type || '',
          '계약일': c.contract_date ? dayjs(c.contract_date).format('YYYY-MM-DD') : '',
          '계약금액': contractAmount,
          'VAT': vat,
          '총액': totalAmount,
          '입금액': receivedAmount,
          '미수금': remainingAmount,
          '수금률': collectionRate,
          '진행상황': CONTRACT_PROGRESS_LABELS[c.progress] || c.progress || '',
          '담당자': c.manager_name || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '계약목록');

      const today = dayjs().format('YYYY-MM-DD');
      return await saveWorkbook(workbook, `계약목록_${today}.xlsx`);
    } catch (error: any) {
      console.error('계약 내보내기 오류:', error);
      return { success: false, error: error.message || '계약 내보내기 중 오류가 발생했습니다.' };
    }
  });

  // ========================================
  // 프로젝트 목록 내보내기 (계약 기반)
  // ========================================
  ipcMain.handle('export:projects', async (_event, requesterId: string, filters?: any): Promise<ExportResult> => {
    try {
      const permission = await checkExportPermission(requesterId);
      if (!permission.allowed) {
        return { success: false, error: permission.error };
      }

      const requesterP = await db.getUserById(requesterId);
      let contractsP = await db.getContracts();

      // 회사 필터링
      if (requesterP && requesterP.role !== 'super_admin' && requesterP.company_id) {
        contractsP = contractsP.filter((c: any) => c.company_id === requesterP.company_id);
      }

      const rows = (contractsP || []).map((c: any) => {
        const contractAmount = c.contract_amount ?? 0;
        const totalAmount = c.total_amount ?? contractAmount;
        const receivedAmount = c.received_amount ?? 0;
        const collectionRate = totalAmount > 0
          ? `${((receivedAmount / totalAmount) * 100).toFixed(1)}%`
          : '0.0%';
        const progressRate = c.progress_rate != null
          ? `${c.progress_rate}%`
          : '';

        return {
          '프로젝트명': c.service_name || '',
          '발주처': c.client_company || '',
          '계약금액': contractAmount,
          '입금액': receivedAmount,
          '수금률': collectionRate,
          '진행률': progressRate,
          '진행상황': CONTRACT_PROGRESS_LABELS[c.progress] || c.progress || '',
          '담당자': c.manager_name || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '프로젝트목록');

      const today = dayjs().format('YYYY-MM-DD');
      return await saveWorkbook(workbook, `프로젝트목록_${today}.xlsx`);
    } catch (error: any) {
      console.error('프로젝트 내보내기 오류:', error);
      return { success: false, error: error.message || '프로젝트 내보내기 중 오류가 발생했습니다.' };
    }
  });
}
