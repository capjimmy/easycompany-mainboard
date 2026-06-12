import React, { useEffect, useState } from 'react';
import {
  Modal, Checkbox, Button, Progress, message, Typography, Space, Divider, Tag, Upload, Tabs, Spin, Empty
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, LoadingOutlined,
  FileDoneOutlined, AuditOutlined, SolutionOutlined,
  AccountBookOutlined, CalculatorOutlined, FileProtectOutlined,
  MailOutlined, ProfileOutlined, FundOutlined,
  UploadOutlined, FileExcelOutlined, FileWordOutlined,
  DatabaseOutlined, FolderOpenOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Text, Title } = Typography;

declare global {
  interface Window {
    electronAPI: any;
  }
}

// 문서 타입 정의 (견적서 제외)
interface DocTypeItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  phase: string; // 계약 단계
}

const DOCUMENT_TYPES: DocTypeItem[] = [
  {
    key: 'contract',
    label: '계약서',
    description: '계약서 2부 (발주자/수급자 각 1부 보관)',
    icon: <FileProtectOutlined style={{ color: '#1890ff', fontSize: 22 }} />,
    phase: '계약체결',
  },
  {
    key: 'commencement',
    label: '착수계',
    description: '착수 신고서 (용역 착수 시 제출)',
    icon: <FileDoneOutlined style={{ color: '#52c41a', fontSize: 22 }} />,
    phase: '착수',
  },
  {
    key: 'task_plan',
    label: '과업수행계획서',
    description: '과업 수행 계획서 (수행방법, 인력, 일정)',
    icon: <SolutionOutlined style={{ color: '#722ed1', fontSize: 22 }} />,
    phase: '착수',
  },
  {
    key: 'completion',
    label: '준공계',
    description: '준공 신고서 (용역 완료 시 제출)',
    icon: <AuditOutlined style={{ color: '#fa8c16', fontSize: 22 }} />,
    phase: '완료',
  },
  {
    key: 'invoice',
    label: '청구서(대금청구서)',
    description: '대금 청구서 (기성/잔금 청구 시)',
    icon: <AccountBookOutlined style={{ color: '#f5222d', fontSize: 22 }} />,
    phase: '청구',
  },
  {
    key: 'settlement',
    label: '정산 세부내역',
    description: '정산 세부내역서 (최종 정산 시)',
    icon: <CalculatorOutlined style={{ color: '#13c2c2', fontSize: 22 }} />,
    phase: '정산',
  },
  {
    key: 'official_letter',
    label: '공문',
    description: '공문 (발주처/관계기관 공식 서한)',
    icon: <MailOutlined style={{ color: '#597ef7', fontSize: 22 }} />,
    phase: '공문',
  },
  {
    key: 'quote_doc',
    label: '견적서',
    description: '견적서 (용역 견적 제출용)',
    icon: <ProfileOutlined style={{ color: '#9254de', fontSize: 22 }} />,
    phase: '견적',
  },
  {
    key: 'service_cost',
    label: '용역비산출',
    description: '용역비산출서 (인건비/경비 산출 내역)',
    icon: <FundOutlined style={{ color: '#eb2f96', fontSize: 22 }} />,
    phase: '산출',
  },
];

const PHASE_COLORS: Record<string, string> = {
  '계약체결': 'blue',
  '착수': 'green',
  '완료': 'orange',
  '청구': 'red',
  '정산': 'cyan',
  '공문': 'geekblue',
  '견적': 'purple',
  '산출': 'magenta',
};

// 파일 확장자별 아이콘 및 색상
const FILE_TYPE_INFO: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  xlsx: { icon: <FileExcelOutlined />, color: '#52c41a', label: 'Excel' },
  xls: { icon: <FileExcelOutlined />, color: '#52c41a', label: 'Excel' },
  docx: { icon: <FileWordOutlined />, color: '#1890ff', label: 'Word' },
  hwpx: { icon: <FileTextOutlined />, color: '#fa8c16', label: 'HWPX' },
};

interface RegisteredTemplate {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
}

interface DocumentGenerateModalProps {
  visible: boolean;
  contractId: string;
  contractNumber?: string;
  onClose: () => void;
  onGenerated?: () => void;
}

const DocumentGenerateModal: React.FC<DocumentGenerateModalProps> = ({
  visible,
  contractId,
  contractNumber,
  onClose,
  onGenerated,
}) => {
  const { user } = useAuthStore();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDoc, setCurrentDoc] = useState('');
  const [completed, setCompleted] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('server');
  const [customTemplatePath, setCustomTemplatePath] = useState<string>('');
  const [customTemplateExt, setCustomTemplateExt] = useState<string>('');
  const [customTemplateName, setCustomTemplateName] = useState<string>('');
  // 등록 양식 탭
  const [registeredTemplates, setRegisteredTemplates] = useState<RegisteredTemplate[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [selectedRegisteredIds, setSelectedRegisteredIds] = useState<string[]>([]);
  // 양식보관소(서버) 탭 — 데스크톱/웹 공용 (Supabase 버킷)
  const [serverTemplates, setServerTemplates] = useState<any[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [selectedServerPaths, setSelectedServerPaths] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      setSelectedKeys([]);
      setProgress(0);
      setCurrentDoc('');
      setCompleted(false);
      setGenerating(false);
      setGeneratedCount(0);
      setActiveTab('server');
      setCustomTemplatePath('');
      setCustomTemplateExt('');
      setCustomTemplateName('');
      setSelectedRegisteredIds([]);
      setSelectedServerPaths([]);
    }
  }, [visible]);

  // 등록 양식 탭 선택 시 템플릿 로드
  useEffect(() => {
    if (visible && activeTab === 'registered' && registeredTemplates.length === 0) {
      loadRegisteredTemplates();
    }
    if (visible && activeTab === 'server' && serverTemplates.length === 0) {
      loadServerTemplates();
    }
  }, [visible, activeTab]);

  const loadServerTemplates = async () => {
    setServerLoading(true);
    try {
      const result = await window.electronAPI.templates.list();
      if (result.success) {
        // xlsx/docx/hwpx 양식만 (보고서 등 포함, 채울 수 있는 형식 위주)
        const fillable = (result.data || []).filter((t: any) =>
          /\.(xlsx|xls|docx|hwpx)$/i.test(t.name)
        );
        setServerTemplates(fillable);
      } else {
        message.error(result.error || '양식보관소 목록을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      message.error('양식보관소 조회 중 오류가 발생했습니다.');
    } finally {
      setServerLoading(false);
    }
  };

  const loadRegisteredTemplates = async () => {
    if (!user?.id || !user.company_id) return;
    setRegisteredLoading(true);
    try {
      const result = await window.electronAPI.documentTemplates.getByCompany(user.id, user.company_id);
      if (result.success) {
        setRegisteredTemplates(result.templates || []);
      } else {
        message.error(result.error || '등록 양식 목록을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      message.error('등록 양식 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setRegisteredLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedKeys(checked ? DOCUMENT_TYPES.map(d => d.key) : []);
  };

  // HWPX 기본 생성
  const handleGenerateHwpx = async () => {
    if (!user?.id || selectedKeys.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + 2, 90);
      setProgress(currentProgress);
    }, 100);

    try {
      const result = await window.electronAPI.documents.generateHwpx(
        user.id,
        contractId,
        selectedKeys
      );

      clearInterval(progressInterval);

      if (result.success || (result.documents && result.documents.length > 0)) {
        setProgress(100);
        setCompleted(true);
        setGeneratedCount(result.documents?.length || 0);
        message.success(`${result.documents?.length || 0}개의 문서가 생성되었습니다. (.hwpx)`);

        if (onGenerated) {
          onGenerated();
        }
      } else {
        setProgress(0);
        message.error(result.error || '문서 생성에 실패했습니다.');
      }

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((err: string) => message.warning(err));
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      message.error(err.message || '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // 커스텀 템플릿(XLSX/DOCX/HWPX)으로 생성
  const handleGenerateCustom = async () => {
    if (!user?.id || !customTemplatePath) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + 3, 90);
      setProgress(currentProgress);
    }, 100);

    try {
      let result: any;

      if (customTemplateExt === '.xlsx' || customTemplateExt === '.xls') {
        result = await window.electronAPI.documents.fillXlsx(
          user.id, contractId, customTemplatePath, 'contract'
        );
      } else if (customTemplateExt === '.docx') {
        result = await window.electronAPI.documents.fillDocx(
          user.id, contractId, customTemplatePath, 'contract'
        );
      } else if (customTemplateExt === '.hwpx') {
        // HWPX 커스텀 템플릿은 fillTemplate 사용
        result = await window.electronAPI.documents.fillTemplate(
          user.id, contractId, customTemplatePath, 'contract'
        );
      } else {
        result = { success: false, error: '지원하지 않는 파일 형식입니다.' };
      }

      clearInterval(progressInterval);

      if (result?.success) {
        setProgress(100);
        setCompleted(true);
        setGeneratedCount(1);
        const formatLabel = customTemplateExt.replace('.', '').toUpperCase();
        const aiNote = result.usedAI ? ' (AI 분석 사용)' : '';
        message.success(`${formatLabel} 문서가 생성되었습니다.${aiNote}`);

        if (onGenerated) {
          onGenerated();
        }
      } else {
        setProgress(0);
        message.error(result?.error || '문서 생성에 실패했습니다.');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      message.error(err.message || '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // 등록 양식으로 생성
  const handleGenerateRegistered = async () => {
    if (!user?.id || selectedRegisteredIds.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    const selected = registeredTemplates.filter(t => selectedRegisteredIds.includes(t.id));
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const template = selected[i];
      setCurrentDoc(template.name);
      setProgress(Math.round(((i) / selected.length) * 90));

      try {
        let result: any;
        const ext = ('.' + (template.file_type || '')).toLowerCase();

        if (ext === '.xlsx' || ext === '.xls') {
          result = await window.electronAPI.documents.fillXlsx(
            user.id, contractId, template.file_path, 'contract'
          );
        } else if (ext === '.docx') {
          result = await window.electronAPI.documents.fillDocx(
            user.id, contractId, template.file_path, 'contract'
          );
        } else if (ext === '.hwpx') {
          result = await window.electronAPI.documents.fillTemplate(
            user.id, contractId, template.file_path, 'contract'
          );
        } else {
          errors.push(`${template.name}: 지원하지 않는 파일 형식 (${ext})`);
          continue;
        }

        if (result?.success) {
          successCount++;
        } else {
          errors.push(`${template.name}: ${result?.error || '생성 실패'}`);
        }
      } catch (err: any) {
        errors.push(`${template.name}: ${err.message || '오류 발생'}`);
      }
    }

    setProgress(100);
    setCompleted(true);
    setGeneratedCount(successCount);
    setCurrentDoc('');

    if (successCount > 0) {
      message.success(`${successCount}개 문서 생성 완료`);
      if (onGenerated) onGenerated();
    }
    if (errors.length > 0) {
      errors.forEach(e => message.warning(e));
    }

    setGenerating(false);
  };

  const handleToggleRegistered = (id: string) => {
    setSelectedRegisteredIds(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const handleSelectAllRegistered = (checked: boolean) => {
    setSelectedRegisteredIds(checked ? registeredTemplates.map(t => t.id) : []);
  };

  // 양식보관소(서버) 양식으로 생성 — 버킷 fullPath 를 fill 핸들러에 전달
  const handleGenerateServer = async () => {
    if (!user?.id || selectedServerPaths.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    const selected = serverTemplates.filter(t => selectedServerPaths.includes(t.fullPath));
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const template = selected[i];
      setCurrentDoc(template.name);
      setProgress(Math.round((i / selected.length) * 90));

      try {
        let result: any;
        const ext = (template.name.substring(template.name.lastIndexOf('.')) || '').toLowerCase();

        if (ext === '.xlsx' || ext === '.xls') {
          result = await window.electronAPI.documents.fillXlsx(user.id, contractId, template.fullPath, 'contract');
        } else if (ext === '.docx') {
          result = await window.electronAPI.documents.fillDocx(user.id, contractId, template.fullPath, 'contract');
        } else if (ext === '.hwpx') {
          result = await window.electronAPI.documents.fillTemplate(user.id, contractId, template.fullPath, 'contract');
        } else {
          errors.push(`${template.name}: 지원하지 않는 형식 (${ext})`);
          continue;
        }

        if (result?.success) {
          successCount++;
        } else {
          errors.push(`${template.name}: ${result?.error || '생성 실패'}`);
        }
      } catch (err: any) {
        errors.push(`${template.name}: ${err.message || '오류 발생'}`);
      }
    }

    setProgress(100);
    setCompleted(true);
    setGeneratedCount(successCount);
    setCurrentDoc('');

    if (successCount > 0) {
      message.success(`${successCount}개 문서 생성 완료`);
      if (onGenerated) onGenerated();
    }
    if (errors.length > 0) {
      errors.forEach(e => message.warning(e));
    }

    setGenerating(false);
  };

  const handleToggleServer = (fullPath: string) => {
    setSelectedServerPaths(prev =>
      prev.includes(fullPath) ? prev.filter(k => k !== fullPath) : [...prev, fullPath]
    );
  };

  const handleSelectAllServer = (checked: boolean) => {
    setSelectedServerPaths(checked ? serverTemplates.map(t => t.fullPath) : []);
  };

  const handleGenerate = async () => {
    if (activeTab === 'hwpx') {
      await handleGenerateHwpx();
    } else if (activeTab === 'registered') {
      await handleGenerateRegistered();
    } else if (activeTab === 'server') {
      await handleGenerateServer();
    } else {
      await handleGenerateCustom();
    }
  };

  const handleClose = () => {
    if (!generating) {
      onClose();
    }
  };

  // 커스텀 템플릿 선택 (파일 경로를 input으로 받음)
  const handleSelectTemplate = async () => {
    try {
      // electronAPI.dialog가 없으면 input[type=file]로 대체
      // Electron에서는 preload에 dialog 노출이 필요함
      // 간단히 input element 사용
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.docx,.hwpx';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          // Electron에서 file.path 접근 가능
          const filePath = (file as any).path || file.name;
          const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
          setCustomTemplatePath(filePath);
          setCustomTemplateExt(ext);
          setCustomTemplateName(file.name);
        }
      };
      input.click();
    } catch (err) {
      message.error('파일 선택에 실패했습니다.');
    }
  };

  const canGenerate = activeTab === 'hwpx'
    ? selectedKeys.length > 0
    : activeTab === 'registered'
      ? selectedRegisteredIds.length > 0
      : activeTab === 'server'
        ? selectedServerPaths.length > 0
        : !!customTemplatePath;

  return (
    <Modal
      title={
        <div>
          <Title level={5} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            문서 생성
          </Title>
          {contractNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              계약번호: {contractNumber}
            </Text>
          )}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      destroyOnClose
      width={660}
      maskClosable={!generating}
      closable={!generating}
      footer={
        completed ? (
          <Button type="primary" onClick={handleClose} icon={<CheckCircleOutlined />}>
            완료
          </Button>
        ) : (
          <Space>
            <Button onClick={handleClose} disabled={generating}>
              취소
            </Button>
            <Button
              type="primary"
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              loading={generating}
            >
              {generating ? '생성 중...' : activeTab === 'hwpx'
                ? `선택한 문서 생성 (${selectedKeys.length})`
                : activeTab === 'registered'
                  ? `등록 양식으로 생성 (${selectedRegisteredIds.length})`
                  : activeTab === 'server'
                    ? `양식보관소로 생성 (${selectedServerPaths.length})`
                    : '커스텀 템플릿으로 생성'}
            </Button>
          </Space>
        )
      }
    >
      {generating || completed ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Progress
            type="circle"
            percent={Math.round(progress)}
            status={completed ? 'success' : 'active'}
            strokeColor={{
              '0%': '#7c3aed',
              '100%': '#52c41a',
            }}
          />
          <div style={{ marginTop: 24 }}>
            {completed ? (
              <div>
                <Text type="success" strong style={{ fontSize: 16 }}>
                  <CheckCircleOutlined /> {generatedCount}개 문서 생성 완료!
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13, marginTop: 8, display: 'block' }}>
                  문서 폴더가 자동으로 열렸습니다. 해당 프로그램에서 열어 확인하세요.
                </Text>
              </div>
            ) : (
              <>
                <LoadingOutlined style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14 }}>
                  문서 생성 중...
                </Text>
              </>
            )}
          </div>
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'server',
              label: (
                <span>
                  <FolderOpenOutlined style={{ marginRight: 4 }} />
                  양식보관소
                </span>
              ),
              children: (
                <>
                  <div style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    backgroundColor: '#e6fffb',
                    borderRadius: 8,
                    border: '1px solid #87e8de',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      서버 <strong>양식보관소</strong>에 올린 양식으로 문서를 생성합니다. (데스크톱·웹 공용)
                      <br />
                      양식의 <code style={{ backgroundColor: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>{'{{거래처}}'}</code>,
                      <code style={{ backgroundColor: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>{'{{계약금액}}'}</code> 같은 빈칸이
                      계약 데이터로 채워지며, <strong>양식 서식은 그대로 보존</strong>됩니다.
                    </Text>
                  </div>

                  {serverLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <Spin tip="양식보관소 불러오는 중..." />
                    </div>
                  ) : serverTemplates.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span>
                          양식보관소에 채울 수 있는 양식이 없습니다.<br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            양식 보관소에서 xlsx/docx/hwpx 양식을 업로드하세요.
                          </Text>
                        </span>
                      }
                    />
                  ) : (
                    <>
                      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Checkbox
                          indeterminate={selectedServerPaths.length > 0 && selectedServerPaths.length < serverTemplates.length}
                          checked={selectedServerPaths.length === serverTemplates.length && serverTemplates.length > 0}
                          onChange={(e) => handleSelectAllServer(e.target.checked)}
                        >
                          전체 선택
                        </Checkbox>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {selectedServerPaths.length}개 선택됨 / 총 {serverTemplates.length}개
                        </Text>
                      </div>

                      <div style={{ maxHeight: 380, overflow: 'auto' }}>
                        {serverTemplates.map((template) => {
                          const extKey = (template.name.split('.').pop() || '').toLowerCase();
                          const ftInfo = FILE_TYPE_INFO[extKey] || { icon: <FileTextOutlined />, color: '#999', label: extKey.toUpperCase() || '?' };
                          const isSelected = selectedServerPaths.includes(template.fullPath);
                          return (
                            <div
                              key={template.fullPath}
                              style={{
                                padding: '14px 16px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#e6fffb' : '#fff',
                                borderRadius: 10,
                                marginBottom: 8,
                                border: isSelected ? '1.5px solid #13c2c2' : '1px solid #f0f0f0',
                                transition: 'all 0.2s',
                              }}
                              onClick={() => handleToggleServer(template.fullPath)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleServer(template.fullPath);
                                  }}
                                  style={{ marginRight: 12 }}
                                />
                                <span style={{ fontSize: 20, marginRight: 12 }}>{ftInfo.icon}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong>{template.name}</Text>
                                    <Tag color={ftInfo.color} style={{ fontSize: 10 }}>{ftInfo.label}</Tag>
                                    <Tag style={{ fontSize: 10 }}>{template.category}</Tag>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ),
            },
            {
              key: 'hwpx',
              label: (
                <span>
                  <FileTextOutlined style={{ marginRight: 4 }} />
                  HWPX 양식
                </span>
              ),
              children: (
                <>
                  <div style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    backgroundColor: '#f0f5ff',
                    borderRadius: 8,
                    border: '1px solid #adc6ff',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      계약 데이터를 기반으로 <strong>한글(HWPX)</strong> 양식 문서를 자동 생성합니다.
                      생성된 문서는 한컴오피스에서 편집할 수 있습니다.
                    </Text>
                  </div>

                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Checkbox
                      indeterminate={selectedKeys.length > 0 && selectedKeys.length < DOCUMENT_TYPES.length}
                      checked={selectedKeys.length === DOCUMENT_TYPES.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    >
                      전체 선택
                    </Checkbox>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {selectedKeys.length}개 선택됨
                    </Text>
                  </div>

                  <div style={{ maxHeight: 380, overflow: 'auto' }}>
                    {DOCUMENT_TYPES.map((docType) => (
                      <div
                        key={docType.key}
                        style={{
                          padding: '14px 16px',
                          cursor: 'pointer',
                          backgroundColor: selectedKeys.includes(docType.key) ? '#f0f5ff' : '#fff',
                          borderRadius: 10,
                          marginBottom: 8,
                          border: selectedKeys.includes(docType.key)
                            ? '1.5px solid #7c3aed'
                            : '1px solid #f0f0f0',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => handleToggle(docType.key)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={selectedKeys.includes(docType.key)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggle(docType.key);
                            }}
                            style={{ marginRight: 12 }}
                          />
                          {docType.icon}
                          <div style={{ marginLeft: 12, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Text strong>{docType.label}</Text>
                              <Tag color={PHASE_COLORS[docType.phase]} style={{ fontSize: 11 }}>
                                {docType.phase}
                              </Tag>
                              <Tag style={{ fontSize: 10, color: '#999' }}>.hwpx</Tag>
                            </div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {docType.description}
                            </Text>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ),
            },
            {
              key: 'custom',
              label: (
                <span>
                  <UploadOutlined style={{ marginRight: 4 }} />
                  커스텀 템플릿
                </span>
              ),
              children: (
                <>
                  <div style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    backgroundColor: '#f6ffed',
                    borderRadius: 8,
                    border: '1px solid #b7eb8f',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong>XLSX, DOCX, HWPX</strong> 양식 파일을 업로드하면 계약 데이터로 자동 채워집니다.
                      <br />
                      양식에 <code style={{ backgroundColor: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>{'{{거래처}}'}</code>,
                      <code style={{ backgroundColor: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>{'{{계약금액}}'}</code> 등의
                      플레이스홀더를 넣으면 자동 치환됩니다.
                      플레이스홀더가 없으면 AI가 분석하여 데이터를 배치합니다.
                    </Text>
                  </div>

                  {/* 지원하는 플레이스홀더 안내 */}
                  <div style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    backgroundColor: '#fffbe6',
                    borderRadius: 8,
                    border: '1px solid #ffe58f',
                  }}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      사용 가능한 플레이스홀더:
                    </Text>
                    <div style={{ fontSize: 11, color: '#666', lineHeight: '1.8' }}>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{거래처}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{용역명}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{계약번호}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{계약금액}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{부가세}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{총액}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{착수일}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{준공일}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{계약기간}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{담당자}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{회사명}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{대표자}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{총액_한글}}'}</Tag>
                      <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{'{{오늘}}'}</Tag>
                    </div>
                  </div>

                  {/* 파일 선택 영역 */}
                  <div
                    onClick={handleSelectTemplate}
                    style={{
                      padding: customTemplatePath ? '20px' : '40px 20px',
                      textAlign: 'center',
                      border: customTemplatePath ? '2px solid #52c41a' : '2px dashed #d9d9d9',
                      borderRadius: 12,
                      cursor: 'pointer',
                      backgroundColor: customTemplatePath ? '#f6ffed' : '#fafafa',
                      transition: 'all 0.2s',
                    }}
                  >
                    {customTemplatePath ? (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          {FILE_TYPE_INFO[customTemplateExt.replace('.', '')]?.icon || <FileTextOutlined />}
                          <Text strong style={{ marginLeft: 8, fontSize: 14 }}>
                            {customTemplateName}
                          </Text>
                        </div>
                        <Tag color={FILE_TYPE_INFO[customTemplateExt.replace('.', '')]?.color || '#999'}>
                          {FILE_TYPE_INFO[customTemplateExt.replace('.', '')]?.label || customTemplateExt.toUpperCase()}
                        </Tag>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'inline-block' }}>
                          클릭하여 다른 파일 선택
                        </Text>
                      </div>
                    ) : (
                      <div>
                        <UploadOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
                        <br />
                        <Text strong>클릭하여 양식 템플릿 선택</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          .xlsx, .docx, .hwpx 파일 지원
                        </Text>
                      </div>
                    )}
                  </div>

                  {/* 지원 형식 안내 */}
                  <div style={{ marginTop: 16 }}>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <FileExcelOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                        <br />
                        <Text style={{ fontSize: 11 }}>Excel (.xlsx)</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <FileWordOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                        <br />
                        <Text style={{ fontSize: 11 }}>Word (.docx)</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <FileTextOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
                        <br />
                        <Text style={{ fontSize: 11 }}>한글 (.hwpx)</Text>
                      </div>
                    </div>
                  </div>
                </>
              ),
            },
            {
              key: 'registered',
              label: (
                <span>
                  <DatabaseOutlined style={{ marginRight: 4 }} />
                  등록 양식
                </span>
              ),
              children: (
                <>
                  <div style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    backgroundColor: '#fff7e6',
                    borderRadius: 8,
                    border: '1px solid #ffd591',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong>양식관리</strong>에서 등록한 템플릿으로 문서를 생성합니다.
                      계약 데이터가 자동으로 채워집니다. 플레이스홀더가 없으면 AI가 분석하여 배치합니다.
                    </Text>
                  </div>

                  {registeredLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <Spin tip="등록 양식 불러오는 중..." />
                    </div>
                  ) : registeredTemplates.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span>
                          등록된 양식이 없습니다.<br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            설정 &gt; 양식관리에서 템플릿을 등록하세요.
                          </Text>
                        </span>
                      }
                    />
                  ) : (
                    <>
                      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Checkbox
                          indeterminate={selectedRegisteredIds.length > 0 && selectedRegisteredIds.length < registeredTemplates.length}
                          checked={selectedRegisteredIds.length === registeredTemplates.length && registeredTemplates.length > 0}
                          onChange={(e) => handleSelectAllRegistered(e.target.checked)}
                        >
                          전체 선택
                        </Checkbox>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {selectedRegisteredIds.length}개 선택됨 / 총 {registeredTemplates.length}개
                        </Text>
                      </div>

                      <div style={{ maxHeight: 380, overflow: 'auto' }}>
                        {registeredTemplates.map((template) => {
                          const ftInfo = FILE_TYPE_INFO[template.file_type?.toLowerCase()] || { icon: <FileTextOutlined />, color: '#999', label: template.file_type?.toUpperCase() || '?' };
                          const isSelected = selectedRegisteredIds.includes(template.id);
                          return (
                            <div
                              key={template.id}
                              style={{
                                padding: '14px 16px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#fff7e6' : '#fff',
                                borderRadius: 10,
                                marginBottom: 8,
                                border: isSelected
                                  ? '1.5px solid #fa8c16'
                                  : '1px solid #f0f0f0',
                                transition: 'all 0.2s',
                              }}
                              onClick={() => handleToggleRegistered(template.id)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleRegistered(template.id);
                                  }}
                                  style={{ marginRight: 12 }}
                                />
                                <span style={{ fontSize: 20, marginRight: 12 }}>
                                  {ftInfo.icon}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong>{template.name}</Text>
                                    <Tag color={ftInfo.color} style={{ fontSize: 10 }}>
                                      {ftInfo.label}
                                    </Tag>
                                    {template.department_name && (
                                      <Tag style={{ fontSize: 10 }}>{template.department_name}</Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {template.original_filename}
                                    {template.description ? ` - ${template.description}` : ''}
                                  </Text>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};

export default DocumentGenerateModal;
