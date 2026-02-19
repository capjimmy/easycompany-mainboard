import React, { useState } from 'react';
import {
  Card, Typography, Form, Input, Button, Space, Divider, Switch, Select,
  message, Modal, Tabs, Radio
} from 'antd';
import {
  UserOutlined, LockOutlined, BgColorsOutlined, BellOutlined,
  DatabaseOutlined, InfoCircleOutlined, RobotOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeInvisibleOutlined, EyeOutlined, FolderOutlined
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

  // API 키 상태 확인
  React.useEffect(() => {
    checkApiKeyStatus();
  }, [user?.id]);

  // 데이터 경로 로드
  React.useEffect(() => {
    loadDataPath();
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
          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item label="이름">
              <Input value={user?.name} disabled />
            </Form.Item>
            <Form.Item label="사용자명">
              <Input value={user?.username} disabled />
            </Form.Item>
            <Form.Item label="이메일">
              <Input value={user?.email || '-'} disabled />
            </Form.Item>
            <Form.Item label="역할">
              <Input
                value={
                  user?.role === 'super_admin' ? '슈퍼관리자' :
                  user?.role === 'company_admin' ? '회사 관리자' :
                  user?.role === 'department_admin' ? '부서 관리자' : '사원'
                }
                disabled
              />
            </Form.Item>
            <Form.Item label="소속 회사">
              <Input value={user?.company_name || '-'} disabled />
            </Form.Item>
          </Form>

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
              <Title level={4} style={{ margin: 0 }}>EasyCompany</Title>
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
