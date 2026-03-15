import React, { useState } from 'react';
import {
  Card, Typography, Form, Input, Button, Space, Divider, Switch, Select,
  message, Modal, Tabs, Radio, Table, Tag, Popconfirm, Tooltip, Upload, Empty,
  Row, Col, Descriptions, InputNumber, Progress
} from 'antd';
import {
  UserOutlined, LockOutlined, BgColorsOutlined, BellOutlined,
  DatabaseOutlined, InfoCircleOutlined, RobotOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeInvisibleOutlined, EyeOutlined, FolderOutlined,
  FileTextOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined,
  MailOutlined, CloudDownloadOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

declare global {
  interface Window {
    electronAPI: any;
  }
}

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { mode, setMode, isDark } = useThemeStore();

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm] = Form.useForm();

  // 프로필 수정 관련 상태
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // AI 설정 관련 상태
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<{ hasKey: boolean; maskedKey: string | null }>({ hasKey: false, maskedKey: null });
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // 데이터 경로 관련 상태
  const [dataPath, setDataPath] = useState<string>('');
  const [changingDataPath, setChangingDataPath] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);

  // 원본 데이터 경로 관련 상태
  const [sourceDataPath, setSourceDataPath] = useState<string>('');

  // 문서 저장 경로 관련 상태
  const [documentStoragePath, setDocumentStoragePath] = useState<string>('');

  // HWPX 양식 관리 상태
  const [hwpxTemplates, setHwpxTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm] = Form.useForm();

  // 구조화 데이터 가져오기 상태
  const [importingStructured, setImportingStructured] = useState(false);

  // SMTP 이메일 설정 상태
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // 자동 업데이트 상태
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  // 프로필 연락처 동기화
  React.useEffect(() => {
    setEditPhone(user?.phone || '');
    setEditEmail(user?.email || '');
  }, [user?.phone, user?.email]);

  // 연락처 저장
  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const result = await window.electronAPI.users.update(user.id, user.id, {
        phone: editPhone || null,
        email: editEmail || null,
      });
      if (result.success) {
        message.success('연락처가 저장되었습니다.');
        // authStore 갱신
        const { checkAuth } = useAuthStore.getState();
        await checkAuth();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingProfile(false);
    }
  };

  // API 키 상태 확인
  React.useEffect(() => {
    checkApiKeyStatus();
  }, [user?.id]);

  // SMTP 설정 로드
  React.useEffect(() => {
    loadSmtpConfig();
  }, [user?.id]);

  // 앱 버전 로드
  React.useEffect(() => {
    window.electronAPI.app.getVersion().then((v: string) => setAppVersion(v));

    // 업데이트 이벤트 리스너
    const cleanupAvailable = window.electronAPI.updater?.onUpdateAvailable?.((info: any) => {
      setUpdateAvailable(true);
      setUpdateInfo(info);
      setCheckingUpdate(false);
    });
    const cleanupProgress = window.electronAPI.updater?.onDownloadProgress?.((progress: any) => {
      setDownloadProgress(Math.round(progress.percent || 0));
    });
    const cleanupDownloaded = window.electronAPI.updater?.onUpdateDownloaded?.(() => {
      setUpdateDownloaded(true);
      setDownloadingUpdate(false);
    });

    return () => {
      cleanupAvailable?.();
      cleanupProgress?.();
      cleanupDownloaded?.();
    };
  }, []);

  const loadSmtpConfig = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.email.getConfig(user.id);
      if (result.success && result.config) {
        setSmtpHost(result.config.host || '');
        setSmtpPort(result.config.port || 587);
        setSmtpSecure(result.config.secure || false);
        setSmtpUser(result.config.user || '');
        setSmtpPass(result.config.pass || '');
      }
    } catch (err) {
      console.error('Failed to load SMTP config:', err);
    }
  };

  const handleSaveSmtp = async () => {
    if (!user?.id) return;
    setSavingSmtp(true);
    try {
      const result = await window.electronAPI.email.saveConfig(user.id, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass === '••••••••' ? undefined : smtpPass,
      });
      if (result.success) {
        message.success('이메일 설정이 저장되었습니다.');
        loadSmtpConfig();
      } else {
        message.error(result.error || '이메일 설정 저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('이메일 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const result = await window.electronAPI.email.testConnection({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass,
      });
      if (result.success) {
        message.success('SMTP 연결 테스트 성공!');
      } else {
        message.error(result.error || 'SMTP 연결 테스트 실패');
      }
    } catch (err) {
      message.error('SMTP 연결 테스트 중 오류가 발생했습니다.');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateAvailable(false);
    setUpdateInfo(null);
    try {
      const result = await window.electronAPI.updater.check();
      if (result.success) {
        if (result.updateInfo) {
          setUpdateAvailable(true);
          setUpdateInfo(result.updateInfo);
        } else {
          message.info('현재 최신 버전입니다.');
        }
      } else {
        message.error(result.error || '업데이트 확인에 실패했습니다.');
      }
    } catch (err) {
      message.error('업데이트 확인 중 오류가 발생했습니다.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    setDownloadingUpdate(true);
    setDownloadProgress(0);
    try {
      const result = await window.electronAPI.updater.download();
      if (!result.success) {
        message.error(result.error || '업데이트 다운로드에 실패했습니다.');
        setDownloadingUpdate(false);
      }
    } catch (err) {
      message.error('업데이트 다운로드 중 오류가 발생했습니다.');
      setDownloadingUpdate(false);
    }
  };

  const handleInstallUpdate = () => {
    window.electronAPI.updater.install();
  };

  // 데이터 경로 로드
  React.useEffect(() => {
    loadDataPath();
    loadSourceDataPath();
    loadDocumentStoragePath();
    loadHwpxTemplates();
  }, []);

  const loadDataPath = async () => {
    try {
      const result = await window.electronAPI.settings.getDataPath();
      if (result.success) {
        setDataPath(result.path);
      }
    } catch (err) {
      console.error('Failed to load data path:', err);
    }
  };

  // 원본 데이터 경로 로드
  const loadSourceDataPath = async () => {
    try {
      const result = await window.electronAPI.settings.getSourceDataPath();
      if (result.success) {
        setSourceDataPath(result.path || '');
      }
    } catch (err) {
      console.error('Failed to load source data path:', err);
    }
  };

  // 원본 데이터 폴더 변경
  const handleChangeSourceDataFolder = async () => {
    if (!user?.id) return;

    try {
      const selectResult = await window.electronAPI.settings.selectSourceDataFolder();
      if (selectResult.canceled) return;

      const result = await window.electronAPI.settings.setSourceDataPath(user.id, selectResult.path);
      if (result.success) {
        message.success('원본 데이터 경로가 설정되었습니다.');
        setSourceDataPath(selectResult.path);
      } else {
        message.error(result.error || '경로 설정에 실패했습니다.');
      }
    } catch (err) {
      message.error('폴더 선택 중 오류가 발생했습니다.');
    }
  };

  // 문서 저장 경로 로드
  const loadDocumentStoragePath = async () => {
    try {
      const result = await window.electronAPI.settings.getDocumentStoragePath();
      if (result.success) {
        setDocumentStoragePath(result.path || '');
      }
    } catch (err) {
      console.error('Failed to load document storage path:', err);
    }
  };

  // HWPX 양식 목록 로드
  const loadHwpxTemplates = async () => {
    if (!user?.id) return;
    setLoadingTemplates(true);
    try {
      const result = await window.electronAPI.hwpxTemplates.list(user.id);
      if (result.success) {
        setHwpxTemplates(result.templates || []);
      }
    } catch (err) {
      console.error('Failed to load HWPX templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // HWPX 양식 추가
  const handleAddTemplate = async (values: any) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.hwpxTemplates.add(user.id, {
        name: values.name,
        doc_type: values.doc_type || '',
        description: values.description || '',
      });
      if (result.canceled) return;
      if (result.success) {
        message.success('양식이 추가되었습니다.');
        setTemplateModalVisible(false);
        templateForm.resetFields();
        loadHwpxTemplates();
      } else {
        message.error(result.error || '양식 추가에 실패했습니다.');
      }
    } catch (err) {
      message.error('양식 추가 중 오류가 발생했습니다.');
    }
  };

  // HWPX 양식 수정
  const handleUpdateTemplate = async (values: any) => {
    if (!user?.id || !editingTemplate) return;
    try {
      const result = await window.electronAPI.hwpxTemplates.update(user.id, editingTemplate.id, {
        name: values.name,
        doc_type: values.doc_type || '',
        description: values.description || '',
      });
      if (result.success) {
        message.success('양식 정보가 수정되었습니다.');
        setTemplateModalVisible(false);
        setEditingTemplate(null);
        templateForm.resetFields();
        loadHwpxTemplates();
      } else {
        message.error(result.error || '수정에 실패했습니다.');
      }
    } catch (err) {
      message.error('수정 중 오류가 발생했습니다.');
    }
  };

  // HWPX 양식 파일 교체
  const handleReplaceTemplateFile = async (templateId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.hwpxTemplates.replaceFile(user.id, templateId);
      if (result.canceled) return;
      if (result.success) {
        message.success('양식 파일이 교체되었습니다.');
        loadHwpxTemplates();
      } else {
        message.error(result.error || '파일 교체에 실패했습니다.');
      }
    } catch (err) {
      message.error('파일 교체 중 오류가 발생했습니다.');
    }
  };

  // HWPX 양식 삭제
  const handleDeleteTemplate = async (templateId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.hwpxTemplates.delete(user.id, templateId);
      if (result.success) {
        message.success('양식이 삭제되었습니다.');
        loadHwpxTemplates();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 구조화 데이터 가져오기
  const handleImportStructuredData = async () => {
    if (!user?.id) return;

    setImportingStructured(true);
    try {
      const result = await window.electronAPI.settings.importStructuredData(user.id);
      if (result.canceled) {
        // 사용자가 취소함
      } else if (result.success) {
        const s = result.summary;
        Modal.success({
          title: '데이터 가져오기 완료',
          content: (
            <div>
              <p>{result.message}</p>
              <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
                <div><strong>계약서:</strong> {s.contracts.added}건 추가 / {s.contracts.skipped}건 건너뜀 (중복)</div>
                <div><strong>입금내역:</strong> {s.payments.added}건 추가 / {s.payments.skipped}건 건너뜀</div>
                <div><strong>견적서:</strong> {s.quotes.added}건 추가 / {s.quotes.skipped}건 건너뜀 (중복)</div>
                <div><strong>거래처:</strong> {s.clients.added}건 추가 / {s.clients.skipped}건 건너뜀 (중복)</div>
                {s.contacts.added > 0 && <div><strong>담당자:</strong> {s.contacts.added}건 추가</div>}
              </div>
            </div>
          ),
        });
      } else {
        message.error(result.error || '데이터 가져오기에 실패했습니다.');
      }
    } catch (err) {
      message.error('데이터 가져오기 중 오류가 발생했습니다.');
    } finally {
      setImportingStructured(false);
    }
  };

  // 문서 저장 폴더 변경
  const handleChangeDocumentStorageFolder = async () => {
    if (!user?.id) return;

    try {
      const selectResult = await window.electronAPI.settings.selectDocumentStorageFolder();
      if (selectResult.canceled) return;

      const result = await window.electronAPI.settings.setDocumentStoragePath(user.id, selectResult.path);
      if (result.success) {
        message.success('문서 저장 경로가 설정되었습니다.');
        setDocumentStoragePath(selectResult.path);
      } else {
        message.error(result.error || '경로 설정에 실패했습니다.');
      }
    } catch (err) {
      message.error('폴더 선택 중 오류가 발생했습니다.');
    }
  };

  // 데이터 폴더 변경
  const handleChangeDataFolder = async () => {
    if (!user?.id) return;

    try {
      const selectResult = await window.electronAPI.settings.selectDataFolder();
      if (selectResult.canceled) return;

      Modal.confirm({
        title: '데이터 폴더 변경',
        content: (
          <div>
            <p>데이터 저장 위치를 변경하시겠습니까?</p>
            <p style={{ fontSize: 12, color: '#666' }}>
              새 경로: <code>{selectResult.path}</code>
            </p>
            <p style={{ fontSize: 12, color: '#ff4d4f' }}>
              주의: 앱을 재시작해야 변경사항이 적용됩니다.
            </p>
          </div>
        ),
        okText: '변경',
        cancelText: '취소',
        onOk: async () => {
          setChangingDataPath(true);
          try {
            const result = await window.electronAPI.settings.setDataPath(user.id, selectResult.path);
            if (result.success) {
              message.success('데이터 경로가 변경되었습니다. 앱을 재시작해주세요.');
              setDataPath(selectResult.path);
            } else {
              message.error(result.error || '경로 변경에 실패했습니다.');
            }
          } catch (err) {
            message.error('경로 변경 중 오류가 발생했습니다.');
          } finally {
            setChangingDataPath(false);
          }
        },
      });
    } catch (err) {
      message.error('폴더 선택 중 오류가 발생했습니다.');
    }
  };

  // 데이터 내보내기
  const handleExportData = async () => {
    if (!user?.id) return;

    setExportingData(true);
    try {
      const result = await window.electronAPI.settings.exportData(user.id);
      if (result.canceled) {
        // 사용자가 취소함
      } else if (result.success) {
        message.success('데이터가 성공적으로 내보내졌습니다.');
      } else {
        message.error(result.error || '데이터 내보내기에 실패했습니다.');
      }
    } catch (err) {
      message.error('데이터 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingData(false);
    }
  };

  // 데이터 가져오기
  const handleImportData = async () => {
    if (!user?.id) return;

    Modal.confirm({
      title: '데이터 가져오기',
      content: (
        <div>
          <p>백업 파일에서 데이터를 가져오시겠습니까?</p>
          <p style={{ fontSize: 12, color: '#ff4d4f' }}>
            주의: 현재 데이터가 백업된 후 덮어씌워집니다.
          </p>
        </div>
      ),
      okText: '가져오기',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        setImportingData(true);
        try {
          const result = await window.electronAPI.settings.importData(user.id);
          if (result.canceled) {
            // 사용자가 취소함
          } else if (result.success) {
            message.success('데이터가 성공적으로 가져와졌습니다. 앱을 재시작해주세요.');
          } else {
            message.error(result.error || '데이터 가져오기에 실패했습니다.');
          }
        } catch (err) {
          message.error('데이터 가져오기 중 오류가 발생했습니다.');
        } finally {
          setImportingData(false);
        }
      },
    });
  };

  const checkApiKeyStatus = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.ai.getApiKeyStatus(user.id);
      if (result.success) {
        setApiKeyStatus({ hasKey: result.hasKey, maskedKey: result.maskedKey });
      }
    } catch (err) {
      console.error('Failed to check API key status:', err);
    }
  };

  const handleSaveApiKey = async () => {
    if (!user?.id || !apiKey.trim()) {
      message.error('API 키를 입력해주세요.');
      return;
    }

    setSavingApiKey(true);
    try {
      const result = await window.electronAPI.ai.setApiKey(user.id, apiKey.trim());
      if (result.success) {
        message.success('API 키가 저장되었습니다.');
        setApiKey('');
        checkApiKeyStatus();
      } else {
        message.error(result.error || 'API 키 저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('API 키 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!user?.id) return;

    Modal.confirm({
      title: 'API 키 삭제',
      content: 'API 키를 삭제하시겠습니까? AI 문서 생성 기능을 사용할 수 없게 됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          const result = await window.electronAPI.ai.removeApiKey(user.id);
          if (result.success) {
            message.success('API 키가 삭제되었습니다.');
            checkApiKeyStatus();
          } else {
            message.error(result.error || 'API 키 삭제에 실패했습니다.');
          }
        } catch (err) {
          message.error('API 키 삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  // 관리자 권한 확인
  const canManageAI = user?.role === 'super_admin' || user?.role === 'company_admin';
  const canManageTemplates = user?.role === 'super_admin' || user?.role === 'company_admin' || user?.role === 'department_manager';

  // 문서 타입 옵션
  const docTypeOptions = [
    { value: 'contract', label: '계약서' },
    { value: 'commencement', label: '착수계' },
    { value: 'completion', label: '준공계' },
    { value: 'invoice', label: '청구서(대금청구서)' },
    { value: 'task_plan', label: '과업수행계획서' },
    { value: 'settlement', label: '정산 세부내역' },
    { value: '', label: '(기타/미지정)' },
  ];

  // 비밀번호 변경
  const handlePasswordChange = async (values: any) => {
    if (!user?.id) return;

    setChangingPassword(true);
    try {
      const result = await window.electronAPI.auth.changePassword(
        user.id,
        values.oldPassword,
        values.newPassword
      );

      if (result.success) {
        message.success('비밀번호가 변경되었습니다.');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      } else {
        message.error(result.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    } finally {
      setChangingPassword(false);
    }
  };

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          프로필
        </span>
      ),
      children: (
        <Card>
          {/* 기본 정보 */}
          <Title level={5} style={{ marginTop: 0 }}>기본 정보</Title>
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
            <Descriptions.Item label="사번">{user?.employee_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="이름">{user?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="아이디">{user?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="역할">
              {user?.role === 'super_admin' ? '슈퍼관리자' :
               user?.role === 'company_admin' ? '회사 관리자' :
               user?.role === 'department_manager' ? '부서 관리자' : '사원'}
            </Descriptions.Item>
            <Descriptions.Item label="직급">{user?.rank || '-'}</Descriptions.Item>
            <Descriptions.Item label="직책">{user?.position || '-'}</Descriptions.Item>
            <Descriptions.Item label="소속 회사">{user?.company_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="소속 부서">{user?.department_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="입사일">{user?.hire_date || '-'}</Descriptions.Item>
            {user?.resignation_date && (
              <Descriptions.Item label="퇴사일">{user.resignation_date}</Descriptions.Item>
            )}
          </Descriptions>

          <Divider />

          {/* 연락처 (수정 가능) */}
          <Title level={5}>연락처</Title>
          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="전화번호">
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="이메일">
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" onClick={handleSaveProfile} loading={savingProfile}>
              연락처 저장
            </Button>
          </Form>

          {/* 학력 정보 */}
          {user?.education && user.education.length > 0 && (
            <>
              <Divider />
              <Title level={5}>학력</Title>
              <Table
                dataSource={user.education}
                rowKey={(_, i) => `edu-${i}`}
                pagination={false}
                size="small"
                columns={[
                  { title: '학교', dataIndex: 'school', key: 'school' },
                  { title: '전공', dataIndex: 'major', key: 'major' },
                  { title: '학위', dataIndex: 'degree', key: 'degree' },
                  { title: '졸업년도', dataIndex: 'graduation_year', key: 'graduation_year', width: 100 },
                ]}
              />
            </>
          )}

          {/* 자격증 정보 */}
          {user?.certifications && user.certifications.length > 0 && (
            <>
              <Divider />
              <Title level={5}>자격증</Title>
              <Table
                dataSource={user.certifications}
                rowKey={(_, i) => `cert-${i}`}
                pagination={false}
                size="small"
                columns={[
                  { title: '자격증명', dataIndex: 'name', key: 'name' },
                  { title: '발급기관', dataIndex: 'issuer', key: 'issuer' },
                  { title: '취득일', dataIndex: 'acquired_date', key: 'acquired_date', width: 120 },
                ]}
              />
            </>
          )}

          {/* 경력 정보 */}
          {user?.career_history && user.career_history.length > 0 && (
            <>
              <Divider />
              <Title level={5}>경력사항</Title>
              <Table
                dataSource={user.career_history}
                rowKey={(_, i) => `career-${i}`}
                pagination={false}
                size="small"
                columns={[
                  { title: '회사', dataIndex: 'company', key: 'company' },
                  { title: '직위', dataIndex: 'position', key: 'position' },
                  { title: '기간', dataIndex: 'period', key: 'period' },
                  { title: '업무내용', dataIndex: 'description', key: 'description' },
                ]}
              />
            </>
          )}

          <Divider />

          <Space>
            <Button
              icon={<LockOutlined />}
              onClick={() => setPasswordModalVisible(true)}
            >
              비밀번호 변경
            </Button>
          </Space>
        </Card>
      ),
    },
    {
      key: 'appearance',
      label: (
        <span>
          <BgColorsOutlined />
          외관
        </span>
      ),
      children: (
        <Card>
          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item label="테마">
              <Radio.Group
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="light">라이트</Radio.Button>
                <Radio.Button value="dark">다크</Radio.Button>
                <Radio.Button value="system">시스템</Radio.Button>
              </Radio.Group>
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                {mode === 'system' && '시스템 설정에 따라 자동으로 테마가 변경됩니다.'}
                {mode === 'light' && '밝은 테마가 적용됩니다.'}
                {mode === 'dark' && '어두운 테마가 적용됩니다.'}
              </Paragraph>
            </Form.Item>

            <Form.Item label="언어">
              <Select defaultValue="ko" style={{ width: 200 }}>
                <Option value="ko">한국어</Option>
                <Option value="en" disabled>English (준비 중)</Option>
              </Select>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: (
        <span>
          <BellOutlined />
          알림
        </span>
      ),
      children: (
        <Card>
          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item label="데스크톱 알림">
              <Space direction="vertical">
                <Switch defaultChecked /> 알림 활성화
                <Text type="secondary">새로운 알림이 있을 때 데스크톱 알림을 표시합니다.</Text>
              </Space>
            </Form.Item>

            <Form.Item label="알림 종류">
              <Space direction="vertical">
                <Switch defaultChecked /> 계약 관련 알림
                <Switch defaultChecked /> 일정 알림
                <Switch defaultChecked /> 시스템 알림
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'data',
      label: (
        <span>
          <DatabaseOutlined />
          데이터
        </span>
      ),
      children: (
        <Card>
          <Form layout="vertical" style={{ maxWidth: 600 }}>
            {/* 데이터 저장 경로 */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                <DatabaseOutlined style={{ marginRight: 8 }} />
                데이터 저장 위치
              </Title>
              <Text type="secondary">
                견적서, 계약서 등 모든 데이터가 이 폴더에 저장됩니다.
              </Text>
            </div>

            <Form.Item label="현재 데이터 경로">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={dataPath}
                  disabled
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                {canManageAI && (
                  <Button
                    onClick={handleChangeDataFolder}
                    loading={changingDataPath}
                  >
                    변경
                  </Button>
                )}
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                경로 변경 후에는 앱을 재시작해야 합니다.
              </Text>
            </Form.Item>

            <Divider />

            {/* 원본 데이터 경로 */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                <FolderOutlined style={{ marginRight: 8 }} />
                원본 데이터 경로
              </Title>
              <Text type="secondary">
                견적서/계약서 원본 파일(xlsx 등)이 저장된 폴더입니다. 상세보기에서 "원본열기" 시 이 경로를 기준으로 파일을 찾습니다.
              </Text>
            </div>

            <Form.Item label="원본 데이터 경로">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={sourceDataPath || '(설정되지 않음)'}
                  disabled
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                {canManageAI && (
                  <Button
                    onClick={handleChangeSourceDataFolder}
                  >
                    {sourceDataPath ? '변경' : '설정'}
                  </Button>
                )}
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                예: D:\download\easydocs (하위에 견적서/계약서 폴더가 있는 루트 경로)
              </Text>
            </Form.Item>

            <Divider />

            {/* 생성 문서 저장 경로 (네트워크 드라이브) */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                <FolderOutlined style={{ marginRight: 8 }} />
                생성 문서 저장 경로
              </Title>
              <Text type="secondary">
                계약서, 착수계, 청구서 등 생성된 문서가 저장되는 폴더입니다.
                네트워크 드라이브(NAS)를 지정하면 팀원들이 공유할 수 있습니다.
              </Text>
            </div>

            <Form.Item label="문서 저장 경로">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={documentStoragePath || '(기본 경로 - 로컬 AppData)'}
                  disabled
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                {canManageAI && (
                  <Button onClick={handleChangeDocumentStorageFolder}>
                    {documentStoragePath ? '변경' : '설정'}
                  </Button>
                )}
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                {'예: \\\\NAS\\shared\\docs 또는 Z:\\docs (비워두면 로컬 기본 경로 사용)'}
              </Text>
            </Form.Item>

            <Divider />

            {/* 백업 및 복원 */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                백업 및 복원
              </Title>
              <Text type="secondary">
                데이터를 JSON 파일로 내보내거나 기존 백업에서 복원합니다.
              </Text>
            </div>

            <Space>
              <Button
                onClick={handleExportData}
                loading={exportingData}
                disabled={!canManageAI}
              >
                데이터 내보내기
              </Button>
              {user?.role === 'super_admin' && (
                <Button
                  onClick={handleImportData}
                  loading={importingData}
                  danger
                >
                  백업에서 복원
                </Button>
              )}
            </Space>

            {!canManageAI && (
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                데이터 관리는 관리자 이상만 가능합니다.
              </Text>
            )}

            {/* 구조화 데이터 가져오기 - 슈퍼관리자 전용 */}
            {user?.role === 'super_admin' && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                    <DatabaseOutlined style={{ marginRight: 8 }} />
                    구조화 데이터 가져오기
                  </Title>
                  <Text type="secondary">
                    JSON 파일에서 계약서, 견적서, 입금내역, 거래처 데이터를 일괄 가져옵니다.
                    기존 데이터와 병합되며, 중복된 계약번호/견적번호는 건너뜁니다.
                  </Text>
                </div>

                <Button
                  type="primary"
                  onClick={handleImportStructuredData}
                  loading={importingStructured}
                  icon={<DatabaseOutlined />}
                >
                  JSON 데이터 가져오기
                </Button>

                <div style={{ marginTop: 12, padding: 12, background: '#f6f6f6', borderRadius: 8, fontSize: 12, color: '#666' }}>
                  <div style={{ marginBottom: 4 }}><strong>지원 형식:</strong> JSON 파일 (contracts, payments, quotes, clients)</div>
                  <div>기존 데이터를 덮어쓰지 않고 새 데이터만 추가합니다.</div>
                </div>
              </>
            )}

            <Divider />

            {/* 데이터베이스 초기화 - 슈퍼관리자 전용 */}
            {user?.role === 'super_admin' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0, marginBottom: 8, color: '#ff4d4f' }}>
                    위험 영역
                  </Title>
                </div>
                <Button
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: '데이터베이스 초기화',
                      content: (
                        <div>
                          <p>정말로 모든 데이터를 삭제하시겠습니까?</p>
                          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                            이 작업은 되돌릴 수 없습니다!
                          </p>
                        </div>
                      ),
                      okText: '초기화',
                      okType: 'danger',
                      cancelText: '취소',
                      onOk: async () => {
                        try {
                          const result = await window.electronAPI.settings.clearDatabase(user.id);
                          if (result.success) {
                            message.success('데이터베이스가 초기화되었습니다. 앱을 재시작해주세요.');
                          } else {
                            message.error(result.error || '초기화에 실패했습니다.');
                          }
                        } catch (err) {
                          message.error('초기화 중 오류가 발생했습니다.');
                        }
                      },
                    });
                  }}
                >
                  데이터베이스 초기화
                </Button>
              </>
            )}
          </Form>
        </Card>
      ),
    },
    ...(canManageTemplates ? [{
      key: 'templates',
      label: (
        <span>
          <FileTextOutlined />
          양식 관리
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                  <FileTextOutlined style={{ marginRight: 8 }} />
                  양식 관리
                </Title>
                <Text type="secondary">
                  문서 생성 시 사용되는 양식 파일을 관리합니다. 양식을 추가하면 계약서 상세에서 문서 생성 시 사용할 수 있습니다.
                </Text>
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingTemplate(null);
                  templateForm.resetFields();
                  setTemplateModalVisible(true);
                }}
              >
                양식 추가
              </Button>
            </div>
          </div>

          {hwpxTemplates.length === 0 ? (
            <Empty
              description="등록된 양식이 없습니다. '양식 추가' 버튼을 눌러 양식 파일을 등록하세요."
              style={{ padding: '40px 0' }}
            />
          ) : (
            <Table
              dataSource={hwpxTemplates}
              rowKey="id"
              loading={loadingTemplates}
              pagination={false}
              size="middle"
              columns={[
                {
                  title: '양식명',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text: string) => <Text strong>{text}</Text>,
                },
                {
                  title: '문서 타입',
                  dataIndex: 'doc_type',
                  key: 'doc_type',
                  width: 150,
                  render: (docType: string) => {
                    const option = docTypeOptions.find(o => o.value === docType);
                    return docType ? (
                      <Tag color="blue">{option?.label || docType}</Tag>
                    ) : (
                      <Tag>미지정</Tag>
                    );
                  },
                },
                {
                  title: '원본 파일',
                  dataIndex: 'original_filename',
                  key: 'original_filename',
                  render: (text: string) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>
                  ),
                },
                {
                  title: '파일 크기',
                  dataIndex: 'file_size',
                  key: 'file_size',
                  width: 100,
                  render: (size: number) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {size ? `${(size / 1024).toFixed(1)} KB` : '-'}
                    </Text>
                  ),
                },
                {
                  title: '등록일',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  width: 120,
                  render: (date: string) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {date ? new Date(date).toLocaleDateString('ko-KR') : '-'}
                    </Text>
                  ),
                },
                {
                  title: '관리',
                  key: 'actions',
                  width: 180,
                  render: (_: any, record: any) => (
                    <Space size="small">
                      <Tooltip title="정보 수정">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingTemplate(record);
                            templateForm.setFieldsValue({
                              name: record.name,
                              doc_type: record.doc_type || '',
                              description: record.description || '',
                            });
                            setTemplateModalVisible(true);
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="파일 교체">
                        <Button
                          size="small"
                          icon={<SwapOutlined />}
                          onClick={() => handleReplaceTemplateFile(record.id)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="양식 삭제"
                        description="이 양식을 삭제하시겠습니까?"
                        onConfirm={() => handleDeleteTemplate(record.id)}
                        okText="삭제"
                        cancelText="취소"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="삭제">
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}

          <Divider />

          <div>
            <Title level={5}>양식 관리 안내</Title>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>HWPX, HWP, DOCX, XLSX, PDF 등 다양한 형식의 양식 파일을 등록할 수 있습니다.</li>
              <li>"문서 타입"을 지정하면 해당 타입의 문서 생성 시 이 양식이 우선 사용됩니다.</li>
              <li>같은 문서 타입에 대해 기본 내장 양식 대신 여기 등록된 양식이 우선됩니다.</li>
              <li>"파일 교체"로 양식 파일만 새 버전으로 교체할 수 있습니다.</li>
              <li>부서장 이상 권한이 있는 사용자만 양식을 관리할 수 있습니다.</li>
            </ul>
          </div>
        </Card>
      ),
    }] : []),
    {
      key: 'ai',
      label: (
        <span>
          <RobotOutlined />
          AI 설정
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={5} style={{ margin: 0 }}>
              <RobotOutlined style={{ marginRight: 8 }} />
              OpenAI API 설정
            </Title>
            <Text type="secondary">
              AI 문서 분석 기능을 사용하려면 OpenAI API 키가 필요합니다.
            </Text>
          </div>

          {/* 현재 상태 */}
          <div style={{
            padding: 16,
            backgroundColor: apiKeyStatus.hasKey ? '#f6ffed' : '#fff7e6',
            borderRadius: 8,
            marginBottom: 24,
            border: apiKeyStatus.hasKey ? '1px solid #b7eb8f' : '1px solid #ffe58f',
          }}>
            <Space>
              {apiKeyStatus.hasKey ? (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
              )}
              <div>
                <Text strong>
                  {apiKeyStatus.hasKey ? 'API 키가 등록되어 있습니다' : 'API 키가 등록되지 않았습니다'}
                </Text>
                {apiKeyStatus.hasKey && apiKeyStatus.maskedKey && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      등록된 키: {apiKeyStatus.maskedKey}
                    </Text>
                  </div>
                )}
              </div>
            </Space>
          </div>

          {canManageAI ? (
            <Form layout="vertical" style={{ maxWidth: 600 }}>
              <Form.Item
                label="OpenAI API 키"
                extra="API 키는 암호화되어 로컬에 저장됩니다. 외부로 전송되지 않습니다."
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    visibilityToggle={{
                      visible: showApiKey,
                      onVisibleChange: setShowApiKey,
                    }}
                    iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                  />
                  <Button
                    type="primary"
                    onClick={handleSaveApiKey}
                    loading={savingApiKey}
                    disabled={!apiKey.trim()}
                  >
                    {apiKeyStatus.hasKey ? '변경' : '등록'}
                  </Button>
                </Space.Compact>
              </Form.Item>

              {apiKeyStatus.hasKey && (
                <Form.Item>
                  <Button danger onClick={handleRemoveApiKey}>
                    API 키 삭제
                  </Button>
                </Form.Item>
              )}
            </Form>
          ) : (
            <Text type="secondary">
              AI 설정은 회사 관리자 이상만 변경할 수 있습니다.
            </Text>
          )}

          <Divider />

          <div>
            <Title level={5}>AI 기능 안내</Title>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>문서 생성 시 계약 정보를 AI가 분석하여 적절한 내용을 자동 생성합니다.</li>
              <li>금액은 "금 OO원정" 형식으로 자동 변환됩니다.</li>
              <li>날짜, 당사자 정보 등이 문서에 맞게 포맷팅됩니다.</li>
              <li>OpenAI GPT-4o-mini 모델을 사용합니다.</li>
            </ul>
          </div>
        </Card>
      ),
    },
    ...(canManageAI ? [{
      key: 'email',
      label: (
        <span>
          <MailOutlined />
          이메일 설정
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={5} style={{ margin: 0 }}>
              <MailOutlined style={{ marginRight: 8 }} />
              SMTP 이메일 설정
            </Title>
            <Text type="secondary">
              견적서 이메일 발송에 사용할 SMTP 서버를 설정합니다.
            </Text>
          </div>

          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item label="SMTP 호스트">
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="포트">
                  <InputNumber
                    value={smtpPort}
                    onChange={(v) => setSmtpPort(v || 587)}
                    style={{ width: '100%' }}
                    placeholder="587"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="보안 연결 (SSL/TLS)">
                  <Switch
                    checked={smtpSecure}
                    onChange={setSmtpSecure}
                  />
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    포트 465는 보안 연결 필요
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="사용자 이메일">
              <Input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="user@example.com"
              />
            </Form.Item>

            <Form.Item label="비밀번호 (앱 비밀번호)">
              <Input.Password
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="앱 비밀번호"
              />
            </Form.Item>

            <Space>
              <Button
                type="primary"
                onClick={handleSaveSmtp}
                loading={savingSmtp}
              >
                저장
              </Button>
              <Button
                onClick={handleTestSmtp}
                loading={testingSmtp}
                disabled={!smtpHost || !smtpUser}
              >
                연결 테스트
              </Button>
            </Space>
          </Form>

          <Divider />

          <div>
            <Title level={5}>이메일 설정 안내</Title>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>Gmail 사용 시: SMTP 호스트 smtp.gmail.com, 포트 587, 앱 비밀번호 사용</li>
              <li>Naver 사용 시: SMTP 호스트 smtp.naver.com, 포트 587</li>
              <li>Office 365 사용 시: SMTP 호스트 smtp.office365.com, 포트 587</li>
              <li>비밀번호는 로컬에 저장되며 외부로 전송되지 않습니다.</li>
            </ul>
          </div>
        </Card>
      ),
    }] : []),
    {
      key: 'update',
      label: (
        <span>
          <CloudDownloadOutlined />
          업데이트
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={5} style={{ margin: 0 }}>
              <CloudDownloadOutlined style={{ marginRight: 8 }} />
              소프트웨어 업데이트
            </Title>
            <Text type="secondary">
              새로운 버전이 있는지 확인하고 업데이트합니다.
            </Text>
          </div>

          <div style={{
            padding: 16,
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            marginBottom: 24,
          }}>
            <Space direction="vertical">
              <div>
                <Text strong>현재 버전: </Text>
                <Text>{appVersion || '1.0.0'}</Text>
              </div>
              {updateAvailable && updateInfo && (
                <div>
                  <Text strong style={{ color: '#1890ff' }}>
                    새 버전 사용 가능: {updateInfo.version}
                  </Text>
                </div>
              )}
            </Space>
          </div>

          {downloadingUpdate && (
            <div style={{ marginBottom: 16 }}>
              <Text>다운로드 중...</Text>
              <Progress percent={downloadProgress} />
            </div>
          )}

          {updateDownloaded && (
            <div style={{
              padding: 16,
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <Text strong>업데이트가 다운로드되었습니다. 앱을 재시작하면 설치됩니다.</Text>
              </Space>
            </div>
          )}

          <Space>
            <Button
              type="primary"
              onClick={handleCheckUpdate}
              loading={checkingUpdate}
              disabled={downloadingUpdate}
            >
              업데이트 확인
            </Button>
            {updateAvailable && !updateDownloaded && (
              <Button
                onClick={handleDownloadUpdate}
                loading={downloadingUpdate}
              >
                다운로드
              </Button>
            )}
            {updateDownloaded && (
              <Button
                type="primary"
                danger
                onClick={handleInstallUpdate}
              >
                재시작 및 설치
              </Button>
            )}
          </Space>
        </Card>
      ),
    },
    {
      key: 'about',
      label: (
        <span>
          <InfoCircleOutlined />
          정보
        </span>
      ),
      children: (
        <Card>
          <Space direction="vertical" size="large">
            <div>
              <Title level={4} style={{ margin: 0 }}>건설경제연구원</Title>
              <Text type="secondary">업무 효율화 솔루션</Text>
            </div>

            <div>
              <Text strong>버전: </Text>
              <Text>1.0.0</Text>
            </div>

            <div>
              <Text strong>개발: </Text>
              <Text>KOC</Text>
            </div>

            <div>
              <Text strong>라이선스: </Text>
              <Text>Commercial License</Text>
            </div>

            <Divider />

            <div>
              <Text type="secondary">
                © 2026 KOC. All rights reserved.
              </Text>
            </div>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>설정</Title>
        <span style={{ color: '#888' }}>애플리케이션 설정을 관리합니다.</span>
      </div>

      <Tabs
        defaultActiveKey="profile"
        tabPosition="left"
        items={tabItems}
        style={{ minHeight: 400 }}
      />

      {/* 양식 추가/수정 모달 */}
      <Modal
        title={editingTemplate ? '양식 정보 수정' : '새 양식 추가'}
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false);
          setEditingTemplate(null);
          templateForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={editingTemplate ? handleUpdateTemplate : handleAddTemplate}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="양식명"
            rules={[{ required: true, message: '양식명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 용역 계약서" />
          </Form.Item>

          <Form.Item
            name="doc_type"
            label="문서 타입"
            extra="문서 타입을 지정하면 해당 문서 생성 시 이 양식이 우선 사용됩니다."
          >
            <Select placeholder="문서 타입 선택 (선택사항)" allowClear>
              {docTypeOptions.filter(o => o.value).map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <Input.TextArea rows={2} placeholder="양식에 대한 설명 (선택사항)" />
          </Form.Item>

          {!editingTemplate && (
            <div style={{ padding: '12px 16px', backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                "등록" 버튼을 누르면 HWPX 파일 선택 창이 열립니다.
              </Text>
            </div>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setTemplateModalVisible(false);
                setEditingTemplate(null);
                templateForm.resetFields();
              }}>
                취소
              </Button>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? '수정' : '등록'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <Modal
        title="비밀번호 변경"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="oldPassword"
            label="현재 비밀번호"
            rules={[{ required: true, message: '현재 비밀번호를 입력해주세요.' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="새 비밀번호"
            rules={[
              { required: true, message: '새 비밀번호를 입력해주세요.' },
              { min: 6, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="새 비밀번호 확인"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '새 비밀번호를 다시 입력해주세요.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다.'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPasswordModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit" loading={changingPassword}>
                변경
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
