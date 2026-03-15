import React, { useEffect, useState } from 'react';
import {
  Modal, Checkbox, Button, Progress, message, Typography, Space, Divider, Tag
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, LoadingOutlined,
  FileDoneOutlined, AuditOutlined, SolutionOutlined,
  AccountBookOutlined, CalculatorOutlined, FileProtectOutlined
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
];

const PHASE_COLORS: Record<string, string> = {
  '계약체결': 'blue',
  '착수': 'green',
  '완료': 'orange',
  '청구': 'red',
  '정산': 'cyan',
};

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

  useEffect(() => {
    if (!visible) {
      setSelectedKeys([]);
      setProgress(0);
      setCurrentDoc('');
      setCompleted(false);
      setGenerating(false);
      setGeneratedCount(0);
    }
  }, [visible]);

  const handleToggle = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedKeys(checked ? DOCUMENT_TYPES.map(d => d.key) : []);
  };

  const handleGenerate = async () => {
    if (!user?.id || selectedKeys.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setCompleted(false);

    // 부드러운 진행률 애니메이션
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

  const handleClose = () => {
    if (!generating) {
      onClose();
    }
  };

  return (
    <Modal
      title={
        <div>
          <Title level={5} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            문서 생성 (HWPX)
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
      width={620}
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
              disabled={selectedKeys.length === 0 || generating}
              loading={generating}
            >
              {generating ? '생성 중...' : `선택한 문서 생성 (${selectedKeys.length})`}
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
                  한글(HWP)에서 열어 확인하세요
                </Text>
              </div>
            ) : (
              <>
                <LoadingOutlined style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14 }}>
                  HWPX 문서 생성 중...
                </Text>
              </>
            )}
          </div>
        </div>
      ) : (
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

          <div style={{ maxHeight: 420, overflow: 'auto' }}>
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
      )}
    </Modal>
  );
};

export default DocumentGenerateModal;
