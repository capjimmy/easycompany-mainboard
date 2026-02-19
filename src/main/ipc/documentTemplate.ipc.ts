import { ipcMain, dialog, app } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { generateDocumentContent, testApiKey, resetOpenAIClient } from '../services/aiService';

// 문서 저장 경로
const getDocumentsPath = () => {
  const documentsPath = path.join(app.getPath('userData'), 'documents');
  if (!fs.existsSync(documentsPath)) {
    fs.mkdirSync(documentsPath, { recursive: true });
  }
  return documentsPath;
};

const getTemplatesPath = () => {
  const templatesPath = path.join(getDocumentsPath(), 'templates');
  if (!fs.existsSync(templatesPath)) {
    fs.mkdirSync(templatesPath, { recursive: true });
  }
  return templatesPath;
};

const getGeneratedPath = () => {
  const generatedPath = path.join(getDocumentsPath(), 'generated');
  if (!fs.existsSync(generatedPath)) {
    fs.mkdirSync(generatedPath, { recursive: true });
  }
  return generatedPath;
};

// 권한 확인 (부서장 이상)
function canManageTemplates(user: any, departmentId: string): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'company_admin') return true;
  if (user.role === 'department_admin' && user.department_id === departmentId) return true;
  return false;
}

export function registerDocumentTemplateHandlers(): void {
  // ========================================
  // 문서 템플릿 관리
  // ========================================

  // 부서별 템플릿 목록 조회
  ipcMain.handle('documentTemplates:getByDepartment', async (_event, requesterId: string, departmentId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const templates = db.getDocumentTemplatesByDepartmentId(departmentId);
    return { success: true, templates };
  });

  // 회사별 템플릿 목록 조회 (전체)
  ipcMain.handle('documentTemplates:getByCompany', async (_event, requesterId: string, companyId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const templates = db.getDocumentTemplatesByCompanyId(companyId);
    return { success: true, templates };
  });

  // 사용자가 접근 가능한 템플릿 목록 (본인 부서 + 전사)
  ipcMain.handle('documentTemplates:getAccessible', async (_event, requesterId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let templates: any[] = [];

    // 본인 부서 템플릿
    if (user.department_id) {
      const deptTemplates = db.getDocumentTemplatesByDepartmentId(user.department_id);
      templates = [...templates, ...deptTemplates];
    }

    // 전사 공용 템플릿 (department_id가 null인 경우)
    if (user.company_id) {
      const companyTemplates = db.getDocumentTemplatesByCompanyId(user.company_id)
        .filter((t: any) => !t.department_id);
      templates = [...templates, ...companyTemplates];
    }

    // 부서 정보 추가
    const templatesWithDept = templates.map((t: any) => {
      const dept = t.department_id ? db.getDepartmentById(t.department_id) : null;
      return {
        ...t,
        department_name: dept?.name || '전사 공용',
      };
    });

    return { success: true, templates: templatesWithDept };
  });

  // 템플릿 생성 (파일 업로드)
  ipcMain.handle('documentTemplates:create', async (_event, requesterId: string, templateData: any) => {
    const user = db.getUserById(requesterId);
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
    const destPath = path.join(getTemplatesPath(), storedFileName);

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

      db.addDocumentTemplate(template);

      return { success: true, template };
    } catch (err: any) {
      return { success: false, error: `파일 저장 실패: ${err.message}` };
    }
  });

  // 템플릿 수정
  ipcMain.handle('documentTemplates:update', async (_event, requesterId: string, templateId: string, updates: any) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const template = db.getDocumentTemplateById(templateId);
    if (!template) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    if (!canManageTemplates(user, template.department_id)) {
      return { success: false, error: '템플릿 관리 권한이 없습니다.' };
    }

    const updatedTemplate = db.updateDocumentTemplate(templateId, {
      name: updates.name,
      description: updates.description,
      field_mappings: updates.field_mappings,
    });

    return { success: true, template: updatedTemplate };
  });

  // 템플릿 삭제
  ipcMain.handle('documentTemplates:delete', async (_event, requesterId: string, templateId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const template = db.getDocumentTemplateById(templateId);
    if (!template) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    if (!canManageTemplates(user, template.department_id)) {
      return { success: false, error: '템플릿 관리 권한이 없습니다.' };
    }

    db.deleteDocumentTemplate(templateId);

    return { success: true };
  });

  // ========================================
  // 문서 생성
  // ========================================

  // 계약 정보로 문서 생성
  ipcMain.handle('documents:generate', async (_event, requesterId: string, contractId: string, templateIds: string[]) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약을 찾을 수 없습니다.' };
    }

    // 회사 정보
    const company = contract.company_id ? db.getCompanyById(contract.company_id) : null;

    const generatedDocs: any[] = [];
    const errors: string[] = [];

    for (const templateId of templateIds) {
      const template = db.getDocumentTemplateById(templateId);
      if (!template) {
        errors.push(`템플릿 ${templateId}를 찾을 수 없습니다.`);
        continue;
      }

      try {
        // 생성 문서 ID
        const docId = uuidv4();
        const ext = path.extname(template.original_filename);
        const generatedFileName = `${contract.contract_number || 'C'}_${template.name}_${Date.now()}${ext}`;
        const destPath = path.join(getGeneratedPath(), `${docId}${ext}`);

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
          stored_filename: `${docId}${ext}`,
          file_path: destPath,
          file_type: ext.replace('.', ''),
          file_size: fs.statSync(destPath).size,
          // 생성 시 사용된 데이터 스냅샷
          data_snapshot: {
            contract,
            company,
          },
          generated_by: requesterId,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        db.addGeneratedDocument(generatedDoc);
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
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const documents = db.getGeneratedDocumentsByContractId(contractId);
    return { success: true, documents };
  });

  // 생성 문서 열기 (파일 탐색기에서)
  ipcMain.handle('documents:open', async (_event, requesterId: string, documentId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
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
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    // 파일 삭제
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    db.deleteGeneratedDocument(documentId);

    return { success: true };
  });

  // 문서 저장 경로 열기
  ipcMain.handle('documents:openFolder', async (_event, requesterId: string, type: 'templates' | 'generated') => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const { shell } = require('electron');
    const folderPath = type === 'templates' ? getTemplatesPath() : getGeneratedPath();
    shell.openPath(folderPath);

    return { success: true };
  });

  // ========================================
  // AI 문서 생성
  // ========================================

  // AI를 사용하여 문서 내용 생성
  ipcMain.handle('documents:generateWithAI', async (_event, requesterId: string, contractId: string, templateIds: string[]) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약을 찾을 수 없습니다.' };
    }

    // 회사 정보
    const company = contract.company_id ? db.getCompanyById(contract.company_id) : null;

    const generatedDocs: any[] = [];
    const errors: string[] = [];

    for (const templateId of templateIds) {
      const template = db.getDocumentTemplateById(templateId);
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
        const generatedFileName = `${contract.contract_number || 'C'}_${template.name}_${Date.now()}${ext}`;
        const destPath = path.join(getGeneratedPath(), `${docId}${ext}`);

        // AI 분석 결과를 텍스트 파일로도 저장
        const aiContentPath = path.join(getGeneratedPath(), `${docId}_ai_content.txt`);

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
          stored_filename: `${docId}${ext}`,
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
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        db.addGeneratedDocument(generatedDoc);
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
    const user = db.getUserById(requesterId);
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
    db.setSetting('openai_api_key', apiKey);
    resetOpenAIClient();

    return { success: true };
  });

  // API 키 확인 (마스킹된 값 반환)
  ipcMain.handle('ai:getApiKeyStatus', async (_event, requesterId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const apiKey = db.getSetting('openai_api_key');

    if (!apiKey) {
      return { success: true, hasKey: false, maskedKey: null };
    }

    // 키의 앞 8자리와 뒷 4자리만 표시
    const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);

    return { success: true, hasKey: true, maskedKey: masked };
  });

  // API 키 삭제
  ipcMain.handle('ai:removeApiKey', async (_event, requesterId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin') {
      return { success: false, error: 'API 키 삭제 권한이 없습니다.' };
    }

    db.setSetting('openai_api_key', null);
    resetOpenAIClient();

    return { success: true };
  });

  // AI 분석 결과 조회
  ipcMain.handle('documents:getAIContent', async (_event, requesterId: string, documentId: string) => {
    const user = db.getUserById(requesterId);
    if (!user) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const doc = db.getGeneratedDocumentById(documentId);
    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
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
