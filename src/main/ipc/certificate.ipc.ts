import { ipcMain, dialog, app, shell } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { initOCRClient, getOCRClient } from '../services/ocrService';

export function registerCertificateHandlers(): void {
  // 증명서 목록 조회
  ipcMain.handle('certificates:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      let certificates = await db.getCertificates();

      // 역할 기반 필터링
      if (requester.role === 'super_admin') {
        // 슈퍼관리자는 전체 조회
      } else if (requester.role === 'company_admin') {
        // 회사 관리자는 같은 회사만
        certificates = certificates.filter((c: any) => c.company_id === requester.company_id);
      } else if (requester.role === 'department_manager') {
        // 부서 관리자는 같은 회사만
        certificates = certificates.filter((c: any) => c.company_id === requester.company_id);
      } else {
        // 일반 사원은 본인 것만
        certificates = certificates.filter((c: any) => c.user_id === requester.id);
      }

      // 필터 적용
      if (filters) {
        if (filters.status) {
          certificates = certificates.filter((c: any) => c.status === filters.status);
        }
        if (filters.certificate_type) {
          certificates = certificates.filter((c: any) => c.certificate_type === filters.certificate_type);
        }
        if (filters.user_id) {
          certificates = certificates.filter((c: any) => c.user_id === filters.user_id);
        }
      }

      // 최신순 정렬
      certificates.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { success: true, certificates };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 목록 조회에 실패했습니다.' };
    }
  });

  // 증명서 신청
  ipcMain.handle('certificates:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const now = new Date().toISOString();
      const issueNumber = `CERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const certificate = {
        id: uuidv4(),
        company_id: requester.company_id,
        user_id: requester.id,
        user_name: requester.name,
        certificate_type: data.certificate_type,
        issue_number: issueNumber,
        issue_date: now.split('T')[0],
        purpose: data.purpose || null,
        status: 'pending',
        approved_by: null,
        approved_by_name: null,
        approved_at: null,
        content: data.content || null,
        created_at: now,
      };

      await db.addCertificate(certificate);

      return { success: true, certificateId: certificate.id, issueNumber };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 신청에 실패했습니다.' };
    }
  });

  // 증명서 승인
  ipcMain.handle('certificates:approve', async (_event, requesterId: string, certificateId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자만 승인 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 증명서를 승인할 수 있습니다.' };
    }

    try {
      // 같은 회사 증명서만 승인 가능
      const certificates = await db.getCertificates();
      const cert = certificates.find((c: any) => c.id === certificateId);
      if (!cert) {
        return { success: false, error: '증명서를 찾을 수 없습니다.' };
      }
      if (requester.role !== 'super_admin' && cert.company_id !== requester.company_id) {
        return { success: false, error: '같은 회사의 증명서만 승인할 수 있습니다.' };
      }

      const now = new Date().toISOString();
      await db.updateCertificate(certificateId, {
        status: 'approved',
        approved_by: requester.id,
        approved_by_name: requester.name,
        approved_at: now,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 승인에 실패했습니다.' };
    }
  });

  // 증명서 반려
  ipcMain.handle('certificates:reject', async (_event, requesterId: string, certificateId: string, reason?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자만 반려 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 증명서를 반려할 수 있습니다.' };
    }

    try {
      // 같은 회사 증명서만 반려 가능
      const certificates = await db.getCertificates();
      const cert = certificates.find((c: any) => c.id === certificateId);
      if (!cert) {
        return { success: false, error: '증명서를 찾을 수 없습니다.' };
      }
      if (requester.role !== 'super_admin' && cert.company_id !== requester.company_id) {
        return { success: false, error: '같은 회사의 증명서만 반려할 수 있습니다.' };
      }

      const now = new Date().toISOString();
      await db.updateCertificate(certificateId, {
        status: 'rejected',
        approved_by: requester.id,
        approved_by_name: requester.name,
        approved_at: now,
        content: reason ? { reject_reason: reason } : undefined,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 반려에 실패했습니다.' };
    }
  });

  // ========== 증명서 종류 관리 ==========

  // 증명서 종류 목록 조회
  ipcMain.handle('certificateTypes:getAll', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      const companyId = requester.role === 'super_admin' ? undefined : requester.company_id;
      const types = await db.getCertificateTypes(companyId);
      return { success: true, types };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 종류 조회에 실패했습니다.' };
    }
  });

  // 증명서 종류 추가
  ipcMain.handle('certificateTypes:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '회사관리자 이상만 증명서 종류를 추가할 수 있습니다.' };
    }

    try {
      const certType = {
        id: uuidv4(),
        company_id: requester.role === 'super_admin' && data.company_id ? data.company_id : requester.company_id,
        key: data.key,
        name: data.name,
        description: data.description || null,
        sort_order: data.sort_order || 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await db.addCertificateType(certType);
      return { success: true, certType: result };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 종류 추가에 실패했습니다.' };
    }
  });

  // 증명서 종류 수정
  ipcMain.handle('certificateTypes:update', async (_event, requesterId: string, typeId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '회사관리자 이상만 증명서 종류를 수정할 수 있습니다.' };
    }

    try {
      const result = await db.updateCertificateType(typeId, {
        ...data,
        updated_at: new Date().toISOString(),
      });
      return { success: true, certType: result };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 종류 수정에 실패했습니다.' };
    }
  });

  // 증명서 종류 삭제 (soft delete)
  ipcMain.handle('certificateTypes:delete', async (_event, requesterId: string, typeId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '회사관리자 이상만 증명서 종류를 삭제할 수 있습니다.' };
    }

    try {
      await db.deleteCertificateType(typeId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 종류 삭제에 실패했습니다.' };
    }
  });

  // ========== 증명서 양식 템플릿 관리 ==========

  // 증명서 종류에 템플릿 파일 업로드
  ipcMain.handle('certificateTypes:uploadTemplate', async (_event, requesterId: string, typeId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 템플릿을 업로드할 수 있습니다.' };
    }

    try {
      const result = await dialog.showOpenDialog({
        title: '증명서 양식 파일 선택',
        filters: [
          { name: '문서 파일', extensions: ['docx', 'xlsx', 'hwp', 'pdf'] },
          { name: '모든 파일', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'canceled' };
      }

      const srcPath = result.filePaths[0];
      const ext = path.extname(srcPath);
      const templateDir = path.join(app.getPath('userData'), 'certificate_templates');

      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      const destFilename = `${typeId}${ext}`;
      const destPath = path.join(templateDir, destFilename);

      fs.copyFileSync(srcPath, destPath);

      // DB에 template_path 저장
      await db.updateCertificateType(typeId, {
        template_path: destPath,
        updated_at: new Date().toISOString(),
      });

      return { success: true, templatePath: destPath, fileName: path.basename(srcPath) };
    } catch (err: any) {
      return { success: false, error: err.message || '템플릿 업로드에 실패했습니다.' };
    }
  });

  // 증명서 종류의 템플릿 삭제
  ipcMain.handle('certificateTypes:removeTemplate', async (_event, requesterId: string, typeId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 템플릿을 삭제할 수 있습니다.' };
    }

    try {
      const types = await db.getCertificateTypes();
      const certType = types.find((t: any) => t.id === typeId);
      if (certType?.template_path && fs.existsSync(certType.template_path)) {
        fs.unlinkSync(certType.template_path);
      }

      await db.updateCertificateType(typeId, {
        template_path: null,
        updated_at: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '템플릿 삭제에 실패했습니다.' };
    }
  });

  // ========== 증명서 발급 (AI 기반 생성 + 다운로드) ==========

  // 승인 시 증명서 생성
  ipcMain.handle('certificates:generate', async (_event, requesterId: string, certificateId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 증명서를 생성할 수 있습니다.' };
    }

    try {
      const certificates = await db.getCertificates();
      const cert = certificates.find((c: any) => c.id === certificateId);
      if (!cert) return { success: false, error: '증명서를 찾을 수 없습니다.' };
      if (cert.status !== 'approved' && cert.status !== 'issued') {
        return { success: false, error: '승인된 증명서만 생성할 수 있습니다.' };
      }

      // 증명서 종류에서 템플릿 가져오기
      const allTypes = await db.getCertificateTypes();
      const certType = allTypes.find((t: any) => t.key === cert.certificate_type);

      // 신청자 정보 가져오기
      const applicant = await db.getUserById(cert.user_id);
      if (!applicant) return { success: false, error: '신청자 정보를 찾을 수 없습니다.' };

      // 회사 정보 가져오기
      const company = await db.getCompanyById(applicant.company_id);

      const now = new Date();
      const issueDate = now.toISOString().split('T')[0];

      // 신청자 데이터 준비
      const applicantData = {
        name: applicant.name,
        department: applicant.position || applicant.department_name || '',
        rank: applicant.rank || '',
        hire_date: applicant.hire_date || '',
        birth_date: applicant.birth_date || '',
        address: applicant.address || '',
        employee_number: applicant.employee_number || '',
        phone: applicant.phone || '',
        company_name: company?.name || '건설경제연구원',
        certificate_type: certType?.name || cert.certificate_type,
        issue_number: cert.issue_number,
        issue_date: issueDate,
        purpose: cert.purpose || '',
      };

      let generatedContent: string;

      // 템플릿이 있으면 템플릿 기반 생성, 없으면 기본 형식
      if (certType?.template_path && fs.existsSync(certType.template_path)) {
        // 템플릿 파일을 읽어서 AI로 채우기
        const apiKey = await db.getSetting('openai_api_key');
        if (!apiKey) {
          return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다.' };
        }

        initOCRClient(apiKey);
        const client = getOCRClient();
        if (!client) {
          return { success: false, error: 'AI 클라이언트 초기화에 실패했습니다.' };
        }

        const ext = path.extname(certType.template_path).toLowerCase();
        let templateText = '';

        // 템플릿 텍스트 추출
        if (ext === '.xlsx' || ext === '.xls') {
          const XLSX = require('xlsx');
          const workbook = XLSX.readFile(certType.template_path);
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
            if (csv.trim()) templateText += `[시트: ${sheetName}]\n${csv}\n`;
          }
        } else if (ext === '.docx') {
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(certType.template_path);
            const entry = zip.getEntry('word/document.xml');
            if (entry) {
              const xml = entry.getData().toString('utf8');
              templateText = xml
                .replace(/<w:p[^>]*>/g, '\n')
                .replace(/<w:tab\/>/g, '\t')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/\n{3,}/g, '\n\n').trim();
            }
          } catch { /* ignore */ }
        } else if (ext === '.hwp') {
          try {
            const buffer = fs.readFileSync(certType.template_path);
            const texts: string[] = [];
            let current = '';
            for (let i = 0; i < buffer.length - 1; i += 2) {
              const charCode = buffer[i] | (buffer[i + 1] << 8);
              if ((charCode >= 0x20 && charCode <= 0x7E) || (charCode >= 0xAC00 && charCode <= 0xD7AF) ||
                  (charCode >= 0x3131 && charCode <= 0x318E) || charCode === 0x0A || charCode === 0x0D) {
                current += String.fromCharCode(charCode);
              } else {
                if (current.length > 5) texts.push(current.trim());
                current = '';
              }
            }
            if (current.length > 5) texts.push(current.trim());
            templateText = texts.join('\n');
          } catch { /* ignore */ }
        } else if (ext === '.pdf') {
          // PDF는 이미지로 처리
          templateText = '[PDF 템플릿 - 구조를 참고하여 생성]';
        }

        const prompt = `다음은 증명서 양식 템플릿입니다:\n\n${templateText}\n\n` +
          `이 양식에 다음 신청자 정보를 채워서 완성된 증명서 텍스트를 생성해주세요:\n` +
          JSON.stringify(applicantData, null, 2) + '\n\n' +
          `양식의 구조와 형식을 최대한 유지하면서, 빈칸이나 플레이스홀더에 해당 정보를 채워넣어주세요. ` +
          `날짜는 한국어 형식(YYYY년 MM월 DD일)으로 표시해주세요. ` +
          `완성된 증명서 텍스트만 출력해주세요.`;

        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
        });

        generatedContent = response.choices[0]?.message?.content || '';
      } else {
        // 기본 형식으로 생성
        generatedContent = generateDefaultCertificate(applicantData);
      }

      // 생성된 증명서를 파일로 저장
      const certDir = path.join(app.getPath('userData'), 'generated_certificates');
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      const certFileName = `${cert.issue_number}_${applicant.name}.txt`;
      const certFilePath = path.join(certDir, certFileName);
      fs.writeFileSync(certFilePath, generatedContent, 'utf8');

      // DB 업데이트: issued 상태 + 파일 경로
      await db.updateCertificate(certificateId, {
        status: 'issued',
        content: {
          generated_path: certFilePath,
          generated_at: new Date().toISOString(),
          applicant_data: applicantData,
        },
      });

      return { success: true, filePath: certFilePath, content: generatedContent };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 생성에 실패했습니다.' };
    }
  });

  // 증명서 다운로드 (파일 저장 다이얼로그)
  ipcMain.handle('certificates:download', async (_event, requesterId: string, certificateId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      const certificates = await db.getCertificates();
      const cert = certificates.find((c: any) => c.id === certificateId);
      if (!cert) return { success: false, error: '증명서를 찾을 수 없습니다.' };

      // 본인 것이거나 관리자만 다운로드 가능
      if (cert.user_id !== requester.id &&
          requester.role !== 'super_admin' && requester.role !== 'company_admin') {
        return { success: false, error: '본인의 증명서만 다운로드할 수 있습니다.' };
      }

      if (cert.status !== 'issued' && cert.status !== 'approved') {
        return { success: false, error: '발급완료된 증명서만 다운로드할 수 있습니다.' };
      }

      const generatedPath = cert.content?.generated_path;
      if (!generatedPath || !fs.existsSync(generatedPath)) {
        return { success: false, error: '생성된 증명서 파일을 찾을 수 없습니다. 관리자에게 발급을 요청해주세요.' };
      }

      const saveResult = await dialog.showSaveDialog({
        title: '증명서 저장',
        defaultPath: path.basename(generatedPath),
        filters: [
          { name: '텍스트 파일', extensions: ['txt'] },
          { name: '모든 파일', extensions: ['*'] },
        ],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, error: 'canceled' };
      }

      fs.copyFileSync(generatedPath, saveResult.filePath);
      return { success: true, savedPath: saveResult.filePath };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 다운로드에 실패했습니다.' };
    }
  });
}

// 기본 증명서 형식 생성
function generateDefaultCertificate(data: any): string {
  const lines = [
    '',
    '                    증  명  서',
    '',
    `  증명서 종류: ${data.certificate_type}`,
    `  발급번호: ${data.issue_number}`,
    '',
    '─────────────────────────────────────',
    '',
    `  성    명: ${data.name}`,
    `  부    서: ${data.department}`,
    `  직    급: ${data.rank}`,
    `  입 사 일: ${data.hire_date}`,
  ];

  if (data.birth_date) {
    lines.push(`  생년월일: ${data.birth_date}`);
  }
  if (data.address) {
    lines.push(`  주    소: ${data.address}`);
  }

  lines.push('');
  lines.push('─────────────────────────────────────');
  lines.push('');
  lines.push(`  용    도: ${data.purpose}`);
  lines.push('');
  lines.push('  위 사실을 증명합니다.');
  lines.push('');

  const issueDate = new Date(data.issue_date);
  const y = issueDate.getFullYear();
  const m = issueDate.getMonth() + 1;
  const d = issueDate.getDate();
  lines.push(`                ${y}년 ${m}월 ${d}일`);
  lines.push('');
  lines.push(`                ${data.company_name}`);
  lines.push('');

  return lines.join('\n');
}
