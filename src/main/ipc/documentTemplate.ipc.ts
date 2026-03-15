import { ipcMain, dialog, app, shell } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { generateDocumentContent, testApiKey, resetOpenAIClient } from '../services/aiService';
import { generateHwpxDocument, generateMultipleDocuments, DOCUMENT_TYPE_LABELS, DocumentType, ContractData } from '../services/hwpxGenerator';

// 문서 저장 경로 (네트워크 드라이브 지원)
const getDocumentsPath = async () => {
  const customPath = await db.getSetting('documentStoragePath');
  let documentsPath: string;

  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    documentsPath = customPath;
    try {
      if (!fs.existsSync(documentsPath)) {
        fs.mkdirSync(documentsPath, { recursive: true });
      }
    } catch (err) {
      console.error(`문서 저장 경로 접근 불가, 로컬 폴백:`, err);
      documentsPath = path.join(app.getPath('userData'), 'documents');
      if (!fs.existsSync(documentsPath)) {
        fs.mkdirSync(documentsPath, { recursive: true });
      }
    }
  } else {
    documentsPath = path.join(app.getPath('userData'), 'documents');
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath, { recursive: true });
    }
  }
  return documentsPath;
};

const getTemplatesPath = async () => {
  const templatesPath = path.join(await getDocumentsPath(), 'templates');
  if (!fs.existsSync(templatesPath)) {
    fs.mkdirSync(templatesPath, { recursive: true });
  }
  return templatesPath;
};

const getGeneratedPath = async () => {
  const generatedPath = path.join(await getDocumentsPath(), 'generated');
  if (!fs.existsSync(generatedPath)) {
    fs.mkdirSync(generatedPath, { recursive: true });
  }
  return generatedPath;
};

// 문서 타입별 설명
function getDocTypeDescription(docType: DocumentType): string {
  const descriptions: Record<DocumentType, string> = {
    contract: '계약서 2부 (발주자/수급자 각 1부 보관)',
    commencement: '착수 신고서 (용역 착수 시 제출)',
    task_plan: '과업 수행 계획서 (수행방법, 인력, 일정)',
    completion: '준공 신고서 (용역 완료 시 제출)',
    invoice: '대금 청구서 (기성/잔금 청구 시)',
    settlement: '정산 세부내역서 (최종 정산 시)',
  };
  return descriptions[docType] || '';
}

// 권한 확인 (부서장 이상)
function canManageTemplates(user: any, departmentId: string): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'company_admin') return true;
  if (user.role === 'department_manager' && user.department_id === departmentId) return true;
  return false;
}

// 문서 접근 권한 확인 (부서별/역할별)
function canAccessDocument(user: any, doc: any): boolean {
  if (!user) return false;
  // super_admin, company_admin: 전체 문서 접근
  if (user.role === 'super_admin' || user.role === 'company_admin') return true;
  // department_manager: 같은 부서 문서 + 본인 생성 문서
  if (user.role === 'department_manager') {
    if (doc.created_by_department_id && doc.created_by_department_id === user.department_id) return true;
    if (doc.generated_by === user.id) return true;
    return false;
  }
  // employee: 본인이 생성한 문서만
  if (user.role === 'employee') {
    return doc.generated_by === user.id;
  }
  return false;
}

// HWPX 양식 매니페스트 (공유 동기화용)
async function getHwpxTemplatesDir(): Promise<string> {
  const dir = path.join(await getDocumentsPath(), 'hwpx_templates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function writeTemplateManifest(): Promise<void> {
  try {
    const templates = (await db.getHwpxTemplates()).filter((t: any) => t.is_active);
    const manifest = templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      doc_type: t.doc_type,
      description: t.description,
      original_filename: t.original_filename,
      stored_filename: t.stored_filename,
      file_size: t.file_size,
      created_by: t.created_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    const manifestPath = path.join(await getHwpxTemplatesDir(), 'templates.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch (err) {
    console.error('매니페스트 저장 실패:', err);
  }
}

async function syncFromManifest(): Promise<void> {
  try {
    const hwpxDir = await getHwpxTemplatesDir();
    const manifestPath = path.join(hwpxDir, 'templates.json');
    if (!fs.existsSync(manifestPath)) return;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as any[];
    if (!Array.isArray(manifest)) return;

    const localTemplates = await db.getHwpxTemplates();
    const localIds = new Set(localTemplates.map((t: any) => t.id));
    let added = 0;

    for (const m of manifest) {
      if (localIds.has(m.id)) continue;

      // 파일이 공유 디렉토리에 있는지 확인
      const filePath = path.join(hwpxDir, m.stored_filename);
      if (!fs.existsSync(filePath)) continue;

      await db.addHwpxTemplate({
        id: m.id,
        name: m.name,
        doc_type: m.doc_type || null,
        description: m.description || null,
        original_filename: m.original_filename,
        stored_filename: m.stored_filename,
        file_path: filePath,
        file_size: m.file_size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0),
        is_active: true,
        created_by: m.created_by || 'shared',
        created_at: m.created_at || new Date().toISOString(),
        updated_at: m.updated_at || new Date().toISOString(),
      });
      added++;
    }

    // 매니페스트에서 삭제된 항목은 로컬에서도 비활성화
    const manifestIds = new Set(manifest.map((m: any) => m.id));
    for (const local of localTemplates) {
      if (local.is_active && !manifestIds.has(local.id)) {
        // 파일도 없으면 삭제된 것으로 판단
        if (!fs.existsSync(local.file_path)) {
          await db.updateHwpxTemplate(local.id, { is_active: false });
        }
      }
    }

    if (added > 0) {
      console.log(`Synced ${added} templates from shared manifest`);
    }
  } catch (err) {
    console.error('매니페스트 동기화 실패:', err);
  }
}

export function registerDocumentTemplateHandlers(): void {
  // ========================================
  // 문서 템플릿 관리
  // ========================================

  // 부서별 템플릿 목록 조회
  ipcMain.handle('documentTemplates:getByDepartment', async (_event, requesterId: string, departmentId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const templates = await db.getDocumentTemplatesByDepartmentId(departmentId);
    return { success: true, templates };
  });

  // 회사별 템플릿 목록 조회 (전체)
  ipcMain.handle('documentTemplates:getByCompany', async (_event, requesterId: string, companyId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const templates = await db.getDocumentTemplatesByCompanyId(companyId);
    return { success: true, templates };
  });

  // 사용자가 접근 가능한 템플릿 목록 (본인 부서 + 전사)
  ipcMain.handle('documentTemplates:getAccessible', async (_event, requesterId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let templates: any[] = [];

    // 본인 부서 템플릿
    if (user.department_id) {
      const deptTemplates = await db.getDocumentTemplatesByDepartmentId(user.department_id);
      templates = [...templates, ...deptTemplates];
    }

    // 전사 공용 템플릿 (department_id가 null인 경우)
    if (user.company_id) {
      const companyTemplates = (await db.getDocumentTemplatesByCompanyId(user.company_id))
        .filter((t: any) => !t.department_id);
      templates = [...templates, ...companyTemplates];
    }

    // 부서 정보 추가
    const templatesWithDept = [];
    for (const t of templates) {
      const dept = t.department_id ? await db.getDepartmentById(t.department_id) : null;
      templatesWithDept.push({
        ...t,
        department_name: dept?.name || '전사 공용',
      });
    }

    return { success: true, templates: templatesWithDept };
  });

  // 템플릿 생성 (파일 업로드)
  ipcMain.handle('documentTemplates:create', async (_event, requesterId: string, templateData: any) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 부서장 이상만 템플릿 생성 가능
    if (!canManageTemplates(user, templateData.department_id)) {
      return { success: false, error: '템플릿 관리 권한이 없습니다.' };
    }

    // 파일 선택 다이얼로그
    const result = await dialog.showOpenDialog({
      title: '문서 템플릿 선택',
      filters: [
        { name: '문서 파일', extensions: ['docx', 'xlsx', 'pptx', 'pdf', 'hwp'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '파일을 선택하지 않았습니다.' };
    }

    const sourcePath = result.filePaths[0];
    const originalName = path.basename(sourcePath);
    const ext = path.extname(originalName);
    const templateId = uuidv4();
    const storedFileName = `${templateId}${ext}`;
    const destPath = path.join(await getTemplatesPath(), storedFileName);

    try {
      // 파일 복사
      fs.copyFileSync(sourcePath, destPath);

      const template = {
        id: templateId,
        company_id: templateData.company_id || user.company_id,
        department_id: templateData.department_id || null,
        name: templateData.name || originalName.replace(ext, ''),
        description: templateData.description || null,
        original_filename: originalName,
        stored_filename: storedFileName,
        file_path: destPath,
        file_type: ext.replace('.', ''),
        file_size: fs.statSync(destPath).size,
        // 필드 매핑 (템플릿 내에서 치환될 변수들)
        field_mappings: templateData.field_mappings || [],
        is_active: true,
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addDocumentTemplate(template);

      return { success: true, template };
    } catch (err: any) {
      return { success: false, error: `파일 저장 실패: ${err.message}` };
    }
  });

  // 템플릿 수정
  ipcMain.handle('documentTemplates:update', async (_event, requesterId: string, templateId: string, updates: any) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const template = await db.getDocumentTemplateById(templateId);
    if (!template) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    if (!canManageTemplates(user, template.department_id)) {
      return { success: false, error: '템플릿 관리 권한이 없습니다.' };
    }

    const updatedTemplate = await db.updateDocumentTemplate(templateId, {
      name: updates.name,
      description: updates.description,
      field_mappings: updates.field_mappings,
    });

    return { success: true, template: updatedTemplate };
  });

  // 템플릿 삭제
  ipcMain.handle('documentTemplates:delete', async (_event, requesterId: string, templateId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const template = await db.getDocumentTemplateById(templateId);
    if (!template) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    if (!canManageTemplates(user, template.department_id)) {
      return { success: false, error: '템플릿 관리 권한이 없습니다.' };
    }

    await db.deleteDocumentTemplate(templateId);

    return { success: true };
  });

  // ========================================
  // HWPX 양식 템플릿 관리
  // ========================================

  // 양식 목록 조회 (공유 매니페스트에서 동기화 후 반환)
  ipcMain.handle('hwpxTemplates:list', async (_event, requesterId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 공유 폴더의 매니페스트에서 동기화
    await syncFromManifest();

    const templates = (await db.getHwpxTemplates()).filter((t: any) => t.is_active);
    return { success: true, templates };
  });

  // 양식 추가 (파일 업로드)
  ipcMain.handle('hwpxTemplates:add', async (_event, requesterId: string, templateData: { name: string; doc_type: string; description?: string }) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 부서장 이상만 가능
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'department_manager') {
      return { success: false, error: '양식 관리 권한이 없습니다. (부서장 이상)' };
    }

    // 파일 선택 다이얼로그
    const result = await dialog.showOpenDialog({
      title: '양식 파일 선택',
      filters: [
        { name: '문서 파일', extensions: ['hwpx', 'hwp', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '파일을 선택하지 않았습니다.', canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const originalName = path.basename(sourcePath);
    const ext = path.extname(originalName);
    const templateId = uuidv4();
    const storedFileName = `${templateId}${ext}`;
    const hwpxTemplatesDir = path.join(await getDocumentsPath(), 'hwpx_templates');
    if (!fs.existsSync(hwpxTemplatesDir)) {
      fs.mkdirSync(hwpxTemplatesDir, { recursive: true });
    }
    const destPath = path.join(hwpxTemplatesDir, storedFileName);

    try {
      fs.copyFileSync(sourcePath, destPath);

      const template = {
        id: templateId,
        name: templateData.name,
        doc_type: templateData.doc_type || null,
        description: templateData.description || null,
        original_filename: originalName,
        stored_filename: storedFileName,
        file_path: destPath,
        file_size: fs.statSync(destPath).size,
        is_active: true,
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addHwpxTemplate(template);
      await writeTemplateManifest();
      return { success: true, template };
    } catch (err: any) {
      return { success: false, error: `파일 저장 실패: ${err.message}` };
    }
  });

  // 양식 파일 교체
  ipcMain.handle('hwpxTemplates:replaceFile', async (_event, requesterId: string, templateId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'department_manager') {
      return { success: false, error: '양식 관리 권한이 없습니다.' };
    }

    const template = await db.getHwpxTemplateById(templateId);
    if (!template) {
      return { success: false, error: '양식을 찾을 수 없습니다.' };
    }

    const result = await dialog.showOpenDialog({
      title: '양식 파일 선택 (교체)',
      filters: [
        { name: '문서 파일', extensions: ['hwpx', 'hwp', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '파일을 선택하지 않았습니다.', canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const originalName = path.basename(sourcePath);

    try {
      // 확장자가 변경된 경우 새 파일명으로 저장
      const newExt = path.extname(originalName);
      const oldExt = path.extname(template.stored_filename);
      let destPath = template.file_path;
      let newStoredFilename = template.stored_filename;

      if (newExt !== oldExt) {
        newStoredFilename = template.id + newExt;
        destPath = path.join(path.dirname(template.file_path), newStoredFilename);
        // 기존 파일 삭제
        if (fs.existsSync(template.file_path)) {
          fs.unlinkSync(template.file_path);
        }
      }

      fs.copyFileSync(sourcePath, destPath);

      const updated = await db.updateHwpxTemplate(templateId, {
        original_filename: originalName,
        stored_filename: newStoredFilename,
        file_path: destPath,
        file_size: fs.statSync(destPath).size,
      });

      await writeTemplateManifest();
      return { success: true, template: updated };
    } catch (err: any) {
      return { success: false, error: `파일 교체 실패: ${err.message}` };
    }
  });

  // 양식 정보 수정 (이름, 설명, 문서타입)
  ipcMain.handle('hwpxTemplates:update', async (_event, requesterId: string, templateId: string, updates: { name?: string; description?: string; doc_type?: string }) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'department_manager') {
      return { success: false, error: '양식 관리 권한이 없습니다.' };
    }

    const template = await db.getHwpxTemplateById(templateId);
    if (!template) {
      return { success: false, error: '양식을 찾을 수 없습니다.' };
    }

    const updated = await db.updateHwpxTemplate(templateId, updates);
    await writeTemplateManifest();
    return { success: true, template: updated };
  });

  // 양식 삭제
  ipcMain.handle('hwpxTemplates:delete', async (_event, requesterId: string, templateId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'department_manager') {
      return { success: false, error: '양식 관리 권한이 없습니다.' };
    }

    const template = await db.getHwpxTemplateById(templateId);
    if (!template) {
      return { success: false, error: '양식을 찾을 수 없습니다.' };
    }

    // 파일 삭제
    try {
      if (template.file_path && fs.existsSync(template.file_path)) {
        fs.unlinkSync(template.file_path);
      }
    } catch (err) {
      console.error('양식 파일 삭제 실패:', err);
    }

    await db.deleteHwpxTemplate(templateId);
    await writeTemplateManifest();
    return { success: true };
  });

  // ========================================
  // 문서 생성
  // ========================================

  // 계약 정보로 문서 생성
  ipcMain.handle('documents:generate', async (_event, requesterId: string, contractId: string, templateIds: string[]) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약을 찾을 수 없습니다.' };
    }

    // 회사 정보
    const company = contract.company_id ? await db.getCompanyById(contract.company_id) : null;

    // 프로젝트별 폴더 생성
    const safeContractNum = (contract.contract_number || 'no-number').replace(/[\\/:*?"<>|]/g, '_');
    const safeSvcName = (contract.service_name || 'document').replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
    const projFolderName = `${safeContractNum}_${safeSvcName}`;
    const projDir = path.join(await getGeneratedPath(), projFolderName);
    if (!fs.existsSync(projDir)) {
      fs.mkdirSync(projDir, { recursive: true });
    }

    const generatedDocs: any[] = [];
    const errors: string[] = [];

    for (const templateId of templateIds) {
      const template = await db.getDocumentTemplateById(templateId);
      if (!template) {
        errors.push(`템플릿 ${templateId}를 찾을 수 없습니다.`);
        continue;
      }

      try {
        // 생성 문서 ID
        const docId = uuidv4();
        const ext = path.extname(template.original_filename);
        const generatedFileName = `${template.name}${ext}`;
        const destPath = path.join(projDir, generatedFileName);

        // 템플릿 파일 복사 (실제로는 여기서 변수 치환이 이루어져야 함)
        // 간단한 구현: 파일 복사만 수행 (추후 docx 템플릿 엔진 적용 가능)
        if (fs.existsSync(template.file_path)) {
          fs.copyFileSync(template.file_path, destPath);
        } else {
          errors.push(`템플릿 파일을 찾을 수 없습니다: ${template.name}`);
          continue;
        }

        // 생성 문서 정보 저장
        const generatedDoc = {
          id: docId,
          contract_id: contractId,
          template_id: templateId,
          template_name: template.name,
          original_filename: generatedFileName,
          stored_filename: generatedFileName,
          file_path: destPath,
          file_type: ext.replace('.', ''),
          file_size: fs.statSync(destPath).size,
          // 생성 시 사용된 데이터 스냅샷
          data_snapshot: {
            contract,
            company,
          },
          generated_by: requesterId,
          created_by_department_id: user.department_id || null,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.addGeneratedDocument(generatedDoc);
        generatedDocs.push(generatedDoc);
      } catch (err: any) {
        errors.push(`${template.name} 생성 실패: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      documents: generatedDocs,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  // 계약에 연결된 생성 문서 목록
  ipcMain.handle('documents:getByContract', async (_event, requesterId: string, contractId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const allDocuments = await db.getGeneratedDocumentsByContractId(contractId);
    const documents = allDocuments.filter((doc: any) => canAccessDocument(user, doc));
    return { success: true, documents };
  });

  // 생성 문서 열기 (파일 탐색기에서)
  ipcMain.handle('documents:open', async (_event, requesterId: string, documentId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = await db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (!canAccessDocument(user, doc)) {
      return { success: false, error: '이 문서에 대한 접근 권한이 없습니다.' };
    }

    if (!fs.existsSync(doc.file_path)) {
      return { success: false, error: '문서 파일을 찾을 수 없습니다.' };
    }

    const { shell } = require('electron');
    shell.openPath(doc.file_path);

    return { success: true };
  });

  // 생성 문서 삭제
  ipcMain.handle('documents:delete', async (_event, requesterId: string, documentId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = await db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (!canAccessDocument(user, doc)) {
      return { success: false, error: '이 문서를 삭제할 권한이 없습니다.' };
    }

    // 파일 삭제
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    await db.deleteGeneratedDocument(documentId);

    return { success: true };
  });

  // 문서 저장 경로 열기
  ipcMain.handle('documents:openFolder', async (_event, requesterId: string, type: 'templates' | 'generated') => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const { shell } = require('electron');
    const folderPath = type === 'templates' ? await getTemplatesPath() : await getGeneratedPath();
    shell.openPath(folderPath);

    return { success: true };
  });

  // ========================================
  // AI 문서 생성
  // ========================================

  // AI를 사용하여 문서 내용 생성
  ipcMain.handle('documents:generateWithAI', async (_event, requesterId: string, contractId: string, templateIds: string[]) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약을 찾을 수 없습니다.' };
    }

    // 회사 정보
    const company = contract.company_id ? await db.getCompanyById(contract.company_id) : null;

    // 프로젝트별 폴더 생성
    const safeContractNum2 = (contract.contract_number || 'no-number').replace(/[\\/:*?"<>|]/g, '_');
    const safeSvcName2 = (contract.service_name || 'document').replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
    const projFolderName2 = `${safeContractNum2}_${safeSvcName2}`;
    const projDir2 = path.join(await getGeneratedPath(), projFolderName2);
    if (!fs.existsSync(projDir2)) {
      fs.mkdirSync(projDir2, { recursive: true });
    }

    const generatedDocs: any[] = [];
    const errors: string[] = [];

    for (const templateId of templateIds) {
      const template = await db.getDocumentTemplateById(templateId);
      if (!template) {
        errors.push(`템플릿 ${templateId}를 찾을 수 없습니다.`);
        continue;
      }

      try {
        // AI로 문서 내용 생성
        const aiResult = await generateDocumentContent(contract, template, company);

        // 생성 문서 ID
        const docId = uuidv4();
        const ext = path.extname(template.original_filename);
        const generatedFileName = `${template.name}${ext}`;
        const destPath = path.join(projDir2, generatedFileName);

        // AI 분석 결과를 텍스트 파일로도 저장
        const aiContentPath = path.join(projDir2, `${template.name}_AI분석.txt`);

        // 템플릿 파일 복사
        if (fs.existsSync(template.file_path)) {
          fs.copyFileSync(template.file_path, destPath);
        } else {
          errors.push(`템플릿 파일을 찾을 수 없습니다: ${template.name}`);
          continue;
        }

        // AI 생성 내용 저장
        if (aiResult.success && aiResult.content) {
          fs.writeFileSync(aiContentPath, aiResult.content, 'utf-8');
        }

        // 생성 문서 정보 저장
        const generatedDoc = {
          id: docId,
          contract_id: contractId,
          template_id: templateId,
          template_name: template.name,
          original_filename: generatedFileName,
          stored_filename: generatedFileName,
          file_path: destPath,
          file_type: ext.replace('.', ''),
          file_size: fs.statSync(destPath).size,
          // AI 생성 내용
          ai_content: aiResult.success ? aiResult.content : null,
          ai_content_path: aiResult.success ? aiContentPath : null,
          ai_generated: aiResult.success,
          ai_error: aiResult.error || null,
          // 생성 시 사용된 데이터 스냅샷
          data_snapshot: {
            contract,
            company,
          },
          generated_by: requesterId,
          created_by_department_id: user.department_id || null,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.addGeneratedDocument(generatedDoc);
        generatedDocs.push(generatedDoc);

      } catch (err: any) {
        errors.push(`${template.name} 생성 실패: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      documents: generatedDocs,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  // ========================================
  // API 키 관리
  // ========================================

  // API 키 저장
  ipcMain.handle('ai:setApiKey', async (_event, requesterId: string, apiKey: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사관리자 이상만 API 키 설정 가능
    if (user.role !== 'super_admin' && user.role !== 'company_admin') {
      return { success: false, error: 'API 키 설정 권한이 없습니다.' };
    }

    // API 키 유효성 테스트
    const testResult = await testApiKey(apiKey);
    if (!testResult.success) {
      return { success: false, error: testResult.error };
    }

    // 저장
    await db.setSetting('openai_api_key', apiKey);
    resetOpenAIClient();

    return { success: true };
  });

  // API 키 확인 (마스킹된 값 반환)
  ipcMain.handle('ai:getApiKeyStatus', async (_event, requesterId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const apiKey = await db.getSetting('openai_api_key');

    if (!apiKey) {
      return { success: true, hasKey: false, maskedKey: null };
    }

    // 키의 앞 8자리와 뒷 4자리만 표시
    const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);

    return { success: true, hasKey: true, maskedKey: masked };
  });

  // API 키 삭제
  ipcMain.handle('ai:removeApiKey', async (_event, requesterId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin') {
      return { success: false, error: 'API 키 삭제 권한이 없습니다.' };
    }

    await db.setSetting('openai_api_key', null);
    resetOpenAIClient();

    return { success: true };
  });

  // ========================================
  // HWPX 문서 생성 (착수계, 준공계, 청구서 등)
  // ========================================

  // 문서 타입 목록 조회
  ipcMain.handle('documents:getDocumentTypes', async (_event) => {
    return {
      success: true,
      types: Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => ({
        key,
        label,
        description: getDocTypeDescription(key as DocumentType),
      })),
    };
  });

  // HWPX 문서 생성
  ipcMain.handle('documents:generateHwpx', async (_event, requesterId: string, contractId: string, docTypes: string[]) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약을 찾을 수 없습니다.' };
    }

    // 회사 정보
    const company = contract.company_id ? await db.getCompanyById(contract.company_id) : null;

    // 입금 내역
    const payments = await db.getContractPaymentsByContractId(contractId);
    const receivedAmount = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // ContractData 매핑
    const data: ContractData = {
      contract_number: contract.contract_number,
      client_company: contract.client_company,
      client_business_number: contract.client_business_number,
      client_contact_name: contract.client_contact_name,
      client_contact_phone: contract.client_contact_phone,
      service_name: contract.service_name,
      description: contract.description,
      contract_type: contract.contract_type,
      contract_date: contract.contract_date,
      contract_start_date: contract.contract_start_date,
      contract_end_date: contract.contract_end_date,
      contract_amount: contract.contract_amount,
      vat_amount: contract.vat_amount,
      total_amount: contract.total_amount,
      outsource_company: contract.outsource_company,
      outsource_amount: contract.outsource_amount,
      progress_rate: contract.progress_rate,
      manager_name: contract.manager_name,
      notes: contract.notes,
      received_amount: receivedAmount || contract.received_amount,
      remaining_amount: contract.remaining_amount,
      company_name: company?.name || '(주)이지컨설턴트',
      company_address: company?.address,
      company_phone: company?.phone,
      company_ceo: company?.ceo_name,
    };

    const validDocTypes = docTypes.filter(t => t in DOCUMENT_TYPE_LABELS) as DocumentType[];
    if (validDocTypes.length === 0) {
      return { success: false, error: '유효한 문서 타입이 없습니다.' };
    }

    // 프로젝트별 폴더 생성
    const safeContractNumber = (contract.contract_number || 'no-number').replace(/[\\/:*?"<>|]/g, '_');
    const safeServiceName = (contract.service_name || 'document').replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
    const projectFolderName = `${safeContractNumber}_${safeServiceName}`;
    const projectDir = path.join(await getGeneratedPath(), projectFolderName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const generatedDocs: any[] = [];
    const errors: string[] = [];

    for (const docType of validDocTypes) {
      const docId = uuidv4();
      const label = DOCUMENT_TYPE_LABELS[docType];
      const fileName = `${label}.hwpx`;
      const filePath = path.join(projectDir, fileName);

      const result = await generateHwpxDocument(docType, data, filePath);

      if (result.success) {
        const generatedDoc = {
          id: docId,
          contract_id: contractId,
          template_id: `hwpx_${docType}`,
          template_name: label,
          original_filename: fileName,
          stored_filename: fileName,
          file_path: filePath,
          file_type: 'hwpx',
          file_size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
          data_snapshot: { contract, company },
          generated_by: requesterId,
          created_by_department_id: user.department_id || null,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.addGeneratedDocument(generatedDoc);
        generatedDocs.push(generatedDoc);
      } else {
        errors.push(`${label}: ${result.error}`);
      }
    }

    return {
      success: generatedDocs.length > 0,
      documents: generatedDocs,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  // 생성된 HWPX 파일을 탐색기에서 열기 (파일 선택 상태로)
  ipcMain.handle('documents:openInExplorer', async (_event, requesterId: string, documentId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = await db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (!canAccessDocument(user, doc)) {
      return { success: false, error: '이 문서에 대한 접근 권한이 없습니다.' };
    }

    if (!fs.existsSync(doc.file_path)) {
      return { success: false, error: '문서 파일을 찾을 수 없습니다.' };
    }

    shell.showItemInFolder(doc.file_path);
    return { success: true };
  });

  // AI 분석 결과 조회
  ipcMain.handle('documents:getAIContent', async (_event, requesterId: string, documentId: string) => {
    const user = await db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = await db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (!canAccessDocument(user, doc)) {
      return { success: false, error: '이 문서에 대한 접근 권한이 없습니다.' };
    }

    // AI 내용 파일에서 읽기
    if (doc.ai_content_path && fs.existsSync(doc.ai_content_path)) {
      const content = fs.readFileSync(doc.ai_content_path, 'utf-8');
      return { success: true, content, aiGenerated: true };
    }

    // DB에 저장된 내용 반환
    if (doc.ai_content) {
      return { success: true, content: doc.ai_content, aiGenerated: true };
    }

    return { success: true, content: null, aiGenerated: false };
  });
}
