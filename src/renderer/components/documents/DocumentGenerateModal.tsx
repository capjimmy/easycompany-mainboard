import React, { useEffect, useState } from 'react';
import {
  Modal, Checkbox, List, Button, Progress, message, Typography, Tag, Space, Empty, Switch, Tooltip, Alert
} from 'antd';
import {
  FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileOutlined,
  CheckCircleOutlined, LoadingOutlined, RobotOutlined, ThunderboltOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Text, Title } = Typography;

declare global {
  interface Window {
    electronAPI: any;
  }
}

interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  department_name?: string;
  file_type: string;
  original_filename: string;
}

interface DocumentGenerateModalProps {
  visible: boolean;
  contractId: string;
  contractNumber?: string;
  onClose: () => void;
  onGenerated?: () => void;
}

const getFileIcon = (fileType: string) => {
  switch (fileType?.toLowerCase()) {
    case 'docx':
    case 'doc':
      return <FileWordOutlined style={{ color: '#2b579a', fontSize: 20 }} />;
    case 'xlsx':
    case 'xls':
      return <FileExcelOutlined style={{ color: '#217346', fontSize: 20 }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#d63031', fontSize: 20 }} />;
    default:
      return <FileOutlined style={{ color: '#666', fontSize: 20 }} />;
  }
};

const DocumentGenerateModal: React.FC<DocumentGenerateModalProps> = ({
  visible,
  contractId,
  contractNumber,
  onClose,
  onGenerated,
}) => {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTemplate, setCurrentTemplate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadTemplates();
      checkApiKey();
    }
  }, [visible, user?.id]);

  const checkApiKey = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.ai.getApiKeyStatus(user.id);
      if (result.success) {
        setHasApiKey(result.hasKey);
        if (!result.hasKey) {
          setUseAI(false);
        }
      }
    } catch (err) {
      setHasApiKey(false);
      setUseAI(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      // 모달 닫힐 때 상태 초기화
      setSelectedIds([]);
      setProgress(0);
      setCurrentTemplate('');
      setCompleted(false);
      setGenerating(false);
    }
  }, [visible]);

  const loadTemplates = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.documentTemplates.getAccessible(user.id);
      if (result.success) {
        setTemplates(result.templates || []);
      } else {
        message.error(result.error || '템플릿 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      message.error('템플릿 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(templates.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectTemplate = (templateId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, templateId]);
    } else {
      setSelectedIds(selectedIds.filter(id => id !== templateId));
    }
  };

  const handleGenerate = async () => {
    if (!user?.id || selectedIds.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    // 시뮬레이션된 진행률 (있어보이게)
    const totalSteps = selectedIds.length;
    let currentStep = 0;

    // AI 모드일 때는 더 느리게 진행 (실제 API 호출 시간 고려)
    const progressSpeed = useAI ? 50 : 100;

    const progressInterval = setInterval(() => {
      // 현재 단계 내에서 부드러운 진행
      setProgress(prev => {
        const stepProgress = (currentStep / totalSteps) * 100;
        const nextStepProgress = ((currentStep + 1) / totalSteps) * 100;
        const increment = useAI ? 0.5 : 2;
        const targetProgress = Math.min(prev + increment, nextStepProgress - 5);
        return Math.min(targetProgress, 95);
      });
    }, progressSpeed);

    try {
      for (let i = 0; i < selectedIds.length; i++) {
        currentStep = i;
        const template = templates.find(t => t.id === selectedIds[i]);
        setCurrentTemplate(useAI ? `AI 분석 중: ${template?.name}` : template?.name || '문서');

        // AI 모드 또는 일반 모드로 생성
        if (useAI) {
          await window.electronAPI.documents.generateWithAI(user.id, contractId, [selectedIds[i]]);
        } else {
          await window.electronAPI.documents.generate(user.id, contractId, [selectedIds[i]]);
        }

        // 완료된 단계 진행률 업데이트
        setProgress(((i + 1) / totalSteps) * 100);

        // 약간의 딜레이 (UX 개선)
        await new Promise(resolve => setTimeout(resolve, useAI ? 500 : 300));
      }

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentTemplate('');
      setCompleted(true);

      const aiMsg = useAI ? ' (AI 분석 완료)' : '';
      message.success(`${selectedIds.length}개의 문서가 생성되었습니다.${aiMsg}`);

      if (onGenerated) {
        onGenerated();
      }

    } catch (err: any) {
      clearInterval(progressInterval);
      message.error(err.message || '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (!generating) {
      onClose();
    }
  };

  return (
    <Modal
      title={
        <div>
          <Title level={5} style={{ margin: 0 }}>문서 생성</Title>
          {contractNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              계약번호: {contractNumber}
            </Text>
          )}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={600}
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
              disabled={selectedIds.length === 0 || generating}
              loading={generating}
            >
              {generating ? '생성 중...' : `선택한 문서 생성 (${selectedIds.length})`}
            </Button>
          </Space>
        )
      }
    >
      {generating ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Progress
            type="circle"
            percent={Math.round(progress)}
            status={completed ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 24 }}>
            {completed ? (
              <Text type="success" strong style={{ fontSize: 16 }}>
                <CheckCircleOutlined /> 문서 생성이 완료되었습니다!
              </Text>
            ) : (
              <>
                <LoadingOutlined style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14 }}>
                  {currentTemplate} 생성 중...
                </Text>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {templates.length === 0 ? (
            <Empty
              description={
                <div>
                  <Text>등록된 문서 템플릿이 없습니다.</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    부서장에게 템플릿 등록을 요청하세요.
                  </Text>
                </div>
              }
            />
          ) : (
            <>
              {/* AI 모드 토글 */}
              <div style={{
                marginBottom: 16,
                padding: '12px 16px',
                backgroundColor: useAI ? '#f0f5ff' : '#f5f5f5',
                borderRadius: 8,
                border: useAI ? '1px solid #adc6ff' : '1px solid #d9d9d9',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <RobotOutlined style={{ fontSize: 18, color: useAI ? '#1890ff' : '#999' }} />
                    <div>
                      <Text strong style={{ color: useAI ? '#1890ff' : undefined }}>
                        AI 문서 분석
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        계약 정보를 AI가 분석하여 문서 내용을 자동 생성합니다
                      </Text>
                    </div>
                  </Space>
                  <Tooltip title={!hasApiKey ? 'API 키가 설정되지 않았습니다. 설정에서 등록하세요.' : ''}>
                    <Switch
                      checked={useAI}
                      onChange={setUseAI}
                      disabled={!hasApiKey}
                      checkedChildren={<ThunderboltOutlined />}
                      unCheckedChildren="OFF"
                    />
                  </Tooltip>
                </div>
                {!hasApiKey && (
                  <Alert
                    type="warning"
                    message="AI 기능을 사용하려면 설정에서 OpenAI API 키를 등록하세요."
                    style={{ marginTop: 8 }}
                    showIcon
                  />
                )}
              </div>

              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Checkbox
                  indeterminate={selectedIds.length > 0 && selectedIds.length < templates.length}
                  checked={selectedIds.length === templates.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                >
                  전체 선택
                </Checkbox>
                <Text type="secondary">
                  {selectedIds.length}개 선택됨
                </Text>
              </div>

              <List
                loading={loading}
                dataSource={templates}
                style={{ maxHeight: 400, overflow: 'auto' }}
                renderItem={(template) => (
                  <List.Item
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: selectedIds.includes(template.id) ? '#e6f7ff' : undefined,
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                    }}
                    onClick={() => handleSelectTemplate(template.id, !selectedIds.includes(template.id))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Checkbox
                        checked={selectedIds.includes(template.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectTemplate(template.id, e.target.checked);
                        }}
                        style={{ marginRight: 12 }}
                      />
                      {getFileIcon(template.file_type)}
                      <div style={{ marginLeft: 12, flex: 1 }}>
                        <div>
                          <Text strong>{template.name}</Text>
                          <Tag color="blue" style={{ marginLeft: 8 }}>
                            {template.department_name || '전사'}
                          </Tag>
                        </div>
                        {template.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {template.description}
                          </Text>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        .{template.file_type}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default DocumentGenerateModal;
