import { ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db, clearDatabase, getDataPath, setDataPath, exportData, importData } from '../database';

export function registerSettingsHandlers(): void {
  // 데이터베이스 초기화 (개발용)
  ipcMain.handle('settings:clearDatabase', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 데이터베이스를 초기화할 수 있습니다.' };
    }

    clearDatabase();
    return { success: true, message: '데이터베이스가 초기화되었습니다.' };
  });
  // 설정 값 가져오기
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return await db.getSetting(key);
  });

  // 설정 값 저장하기
  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    await db.setSetting(key, value);
    return { success: true };
  });

  // 모든 설정 가져오기
  ipcMain.handle('settings:getAll', async () => {
    return await db.getSettings();
  });

  // 테마 설정
  ipcMain.handle('settings:getTheme', async () => {
    return (await db.getSetting('theme')) || 'light';
  });

  ipcMain.handle('settings:setTheme', async (_event, theme: 'light' | 'dark' | 'system') => {
    await db.setSetting('theme', theme);
    return { success: true };
  });

  // 데이터 경로 가져오기
  ipcMain.handle('settings:getDataPath', async () => {
    return { success: true, path: getDataPath() };
  });

  // 데이터 경로 설정
  ipcMain.handle('settings:setDataPath', async (_event, requesterId: string, newPath: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 데이터 경로를 변경할 수 있습니다.' };
    }

    return setDataPath(newPath);
  });

  // 폴더 선택 다이얼로그
  ipcMain.handle('settings:selectDataFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '데이터 저장 폴더 선택',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // 데이터 내보내기
  ipcMain.handle('settings:exportData', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 데이터를 내보낼 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '백업 저장 위치 선택',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return exportData(result.filePaths[0]);
  });

  // 데이터 가져오기
  ipcMain.handle('settings:importData', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 데이터를 가져올 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '백업 파일 선택',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return importData(result.filePaths[0]);
  });

  // ========================================
  // 원본 데이터 경로 (Source Data Path)
  // ========================================

  // 원본 데이터 경로 가져오기
  ipcMain.handle('settings:getSourceDataPath', async () => {
    const sourcePath = (await db.getSetting('sourceDataPath')) || '';
    return { success: true, path: sourcePath };
  });

  // 원본 데이터 경로 설정
  ipcMain.handle('settings:setSourceDataPath', async (_event, requesterId: string, newPath: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 원본 데이터 경로를 변경할 수 있습니다.' };
    }

    await db.setSetting('sourceDataPath', newPath);
    return { success: true };
  });

  // 원본 데이터 폴더 선택 다이얼로그
  ipcMain.handle('settings:selectSourceDataFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '원본 데이터 폴더 선택',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // ========================================
  // 문서 저장 경로 (Document Storage Path)
  // ========================================

  // 문서 저장 경로 가져오기
  ipcMain.handle('settings:getDocumentStoragePath', async () => {
    const docPath = (await db.getSetting('documentStoragePath')) || '';
    return { success: true, path: docPath };
  });

  // 문서 저장 경로 설정
  ipcMain.handle('settings:setDocumentStoragePath', async (_event, requesterId: string, newPath: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 문서 저장 경로를 변경할 수 있습니다.' };
    }

    // 경로 쓰기 가능 여부 확인
    try {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      const testFile = path.join(newPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err: any) {
      return { success: false, error: `경로에 쓸 수 없습니다: ${err.message}` };
    }

    await db.setSetting('documentStoragePath', newPath);
    return { success: true };
  });

  // 문서 저장 폴더 선택 다이얼로그
  ipcMain.handle('settings:selectDocumentStorageFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '문서 저장 폴더 선택 (네트워크 드라이브 가능)',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // ========================================
  // 구조화 데이터 가져오기 (JSON → DB 병합)
  // ========================================
  ipcMain.handle('settings:importStructuredData', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 데이터를 가져올 수 있습니다.' };
    }

    // 파일 선택
    const fileResult = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '구조화 데이터 JSON 파일 선택',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (fileResult.canceled || fileResult.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const fileContent = fs.readFileSync(fileResult.filePaths[0], 'utf-8');
      const data = JSON.parse(fileContent);

      // 기본 회사 ID
      const companies = await db.getCompanies();
      const defaultCompanyId = companies.length > 0 ? companies[0].id : null;
      if (!defaultCompanyId) {
        return { success: false, error: '회사 정보가 없습니다. 먼저 회사를 생성해주세요.' };
      }

      const summary = {
        contracts: { added: 0, skipped: 0 },
        payments: { added: 0, skipped: 0 },
        quotes: { added: 0, skipped: 0 },
        clients: { added: 0, skipped: 0 },
        contacts: { added: 0 },
      };

      // contract_number → id 매핑 (기존 + 새로 추가된 것)
      const contractNumberToId: Record<string, string> = {};
      const existingContracts = await db.getContracts();
      for (const c of existingContracts) {
        if (c.contract_number) {
          contractNumberToId[c.contract_number] = c.id;
        }
      }

      // 1) 계약서 가져오기
      if (Array.isArray(data.contracts)) {
        for (const c of data.contracts) {
          if (!c.contract_number) continue;

          // 중복 체크
          if (contractNumberToId[c.contract_number]) {
            summary.contracts.skipped++;
            continue;
          }

          const contractId = uuidv4();
          const now = new Date().toISOString();

          await db.addContract({
            id: contractId,
            company_id: defaultCompanyId,
            contract_number: c.contract_number,
            contract_code: c.contract_code || c.contract_number,
            client_company: c.client_company || '',
            client_business_number: c.client_business_number || '',
            client_contact_name: c.client_contact_name || '',
            client_contact_phone: c.client_contact_phone || '',
            client_contact_email: c.client_contact_email || '',
            contract_type: c.contract_type || 'service',
            service_name: c.service_name || '',
            service_category: c.service_category || null,
            description: c.description || '',
            contract_date: c.contract_date || null,
            contract_start_date: c.contract_start_date || null,
            contract_end_date: c.contract_end_date || null,
            contract_amount: c.contract_amount || 0,
            vat_amount: c.vat_amount || 0,
            total_amount: c.total_amount || 0,
            received_amount: c.received_amount || 0,
            remaining_amount: c.remaining_amount || 0,
            outsource_company: c.outsource_company || null,
            outsource_amount: c.outsource_amount || 0,
            progress: c.progress || 'in_progress',
            progress_rate: c.progress_rate || 0,
            progress_note: c.progress_note || '',
            manager_name: c.manager_name || null,
            notes: c.notes || '',
            created_by: requesterId,
            created_at: now,
            updated_at: now,
          });

          contractNumberToId[c.contract_number] = contractId;
          summary.contracts.added++;
        }
      }

      // 2) 입금 내역 가져오기
      if (Array.isArray(data.payments)) {
        for (const p of data.payments) {
          if (!p.contract_number) continue;

          const contractId = contractNumberToId[p.contract_number];
          if (!contractId) {
            summary.payments.skipped++;
            continue;
          }

          await db.addContractPayment({
            id: uuidv4(),
            contract_id: contractId,
            invoice_date: p.invoice_date || null,
            invoice_amount: p.invoice_amount || 0,
            payment_date: p.payment_date || null,
            amount: p.payment_amount || p.amount || 0,
            description: p.description || '',
            created_at: new Date().toISOString(),
          });

          summary.payments.added++;
        }
      }

      // 3) 견적서 가져오기
      if (Array.isArray(data.quotes)) {
        const existingQuotes = await db.getQuotes();
        const existingQuoteNumbers = new Set(existingQuotes.map((q: any) => q.quote_number));

        for (const q of data.quotes) {
          if (!q.quote_number) continue;

          if (existingQuoteNumbers.has(q.quote_number)) {
            summary.quotes.skipped++;
            continue;
          }

          const now = new Date().toISOString();

          await db.addQuote({
            id: uuidv4(),
            company_id: defaultCompanyId,
            quote_number: q.quote_number,
            recipient_company: q.recipient_company || '',
            recipient_contact: q.recipient_contact || '',
            recipient_phone: q.recipient_phone || '',
            recipient_email: q.recipient_email || '',
            title: q.title || q.service_name || '',
            service_name: q.service_name || '',
            labor_total: q.labor_total || 0,
            expense_total: q.expense_total || 0,
            total_amount: q.total_amount || 0,
            vat_amount: q.vat_amount || 0,
            grand_total: q.grand_total || 0,
            status: q.status || 'draft',
            quote_date: q.quote_date || null,
            valid_until: q.valid_until || null,
            notes: q.notes || '',
            created_by: requesterId,
            created_at: now,
            updated_at: now,
          });

          summary.quotes.added++;
        }
      }

      // 4) 거래처 가져오기
      if (Array.isArray(data.clients)) {
        const existingClients = await db.getClientCompanies();
        const existingClientNames = new Set(existingClients.map((c: any) => c.name));

        for (const client of data.clients) {
          if (!client.name) continue;

          if (existingClientNames.has(client.name)) {
            summary.clients.skipped++;
            continue;
          }

          const now = new Date().toISOString();
          const clientId = uuidv4();

          await db.addClientCompany({
            id: clientId,
            company_id: defaultCompanyId,
            name: client.name,
            business_number: client.business_number || '',
            ceo_name: client.ceo_name || '',
            address: client.address || '',
            phone: client.phone || '',
            fax: client.fax || '',
            email: client.email || '',
            website: client.website || '',
            industry: client.industry || '',
            notes: client.notes || '',
            is_active: true,
            created_at: now,
            updated_at: now,
          });

          summary.clients.added++;

          // 담당자 추가
          if (Array.isArray(client.contacts)) {
            for (const contact of client.contacts) {
              if (!contact.name) continue;

              await db.addClientContact({
                id: uuidv4(),
                client_id: clientId,
                name: contact.name,
                position: contact.position || '',
                department: contact.department || '',
                phone: contact.phone || '',
                mobile: contact.mobile || contact.phone || '',
                email: contact.email || '',
                is_primary: contact.is_primary || false,
                notes: contact.notes || '',
                created_at: now,
                updated_at: now,
              });

              summary.contacts.added++;
            }
          }
        }
      }

      console.log('Structured data import completed:', summary);

      return {
        success: true,
        summary,
        message: `가져오기 완료: 계약 ${summary.contracts.added}건, 입금 ${summary.payments.added}건, 견적 ${summary.quotes.added}건, 거래처 ${summary.clients.added}건 추가`,
      };
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        return { success: false, error: 'JSON 형식이 올바르지 않습니다. 파일을 확인해주세요.' };
      }
      return { success: false, error: `가져오기 실패: ${err.message}` };
    }
  });

  // 원본 파일 열기 (상대경로 + 기본경로 조합)
  ipcMain.handle('settings:openOriginalFile', async (_event, relativePath: string) => {
    const sourceDataPath = await db.getSetting('sourceDataPath');

    if (!sourceDataPath) {
      return { success: false, error: '원본 데이터 경로가 설정되지 않았습니다. 설정 > 데이터에서 경로를 지정해주세요.' };
    }

    if (!relativePath) {
      return { success: false, error: '원본 파일 경로 정보가 없습니다.' };
    }

    // 상대경로를 절대경로로 변환
    const fullPath = path.join(sourceDataPath, relativePath);

    // 파일 존재 확인
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `파일을 찾을 수 없습니다: ${fullPath}` };
    }

    // 시스템 기본 프로그램으로 파일 열기
    const result = await shell.openPath(fullPath);
    if (result) {
      return { success: false, error: `파일 열기 실패: ${result}` };
    }

    return { success: true };
  });
}
