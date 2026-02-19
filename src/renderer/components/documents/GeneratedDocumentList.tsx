import React, { useEffect, useState } from 'react';
import {
  List, Button, Typography, Tag, Space, Empty, Popconfirm, message, Tooltip, Modal
} from 'antd';
import {
  FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileOutlined,
  FolderOpenOutlined, DeleteOutlined, DownloadOutlined, RobotOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Text, Paragraph } = Typography;

declare global {
  interface Window {
    electronAPI: any;
  }
}

interface GeneratedDocument {
  id: string;
  template_name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  generated_at: string;
  generated_by: string;
  ai_generated?: boolean;
  ai_content?: string;
}

interface GeneratedDocumentListProps {
  contractId: string;
  refreshTrigger?: number;
}

const getFileIcon = (fileType: string) => {
  switch (fileType?.toLowerCase()) {
    case 'docx':
    case 'doc':
      return <FileWordOutlined style={{ color: '#2b579a', fontSize: 24 }} />;
    case 'xlsx':
    case 'xls':
      return <FileExcelOutlined style={{ color: '#217346', fontSize: 24 }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#d63031', fontSize: 24 }} />;
    default:
      return <FileOutlined style={{ color: '#666', fontSize: 24 }} />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const GeneratedDocumentList: React.FC<GeneratedDocumentListProps> = ({
  contractId,
  refreshTrigger,
}) => {
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiContentModal, setAiContentModal] = useState<{ visible: boolean; content: string; title: string }>({
    visible: false,
    content: '',
    title: '',
  });

  useEffect(() => {
    if (contractId && user?.id) {
      loadDocuments();
    }
  }, [contractId, user?.id, refreshTrigger]);

  const loadDocuments = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.documents.getByContract(user.id, contractId);
      if (result.success) {
        setDocuments(result.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = async (documentId: string) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.documents.open(user.id, documentId);
      if (!result.success) {
        message.error(result.error || '문서를 열 수 없습니다.');
      }
    } catch (err) {
      message.error('문서를 여는 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.documents.delete(user.id, documentId);
      if (result.success) {
        message.success('문서가 삭제되었습니다.');
        loadDocuments();
      } else {
        message.error(result.error || '문서 삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('문서 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenFolder = async () => {
    if (!user?.id) return;

    try {
      await window.electronAPI.documents.openFolder(user.id, 'generated');
    } catch (err) {
      message.error('폴더를 여는 중 오류가 발생했습니다.');
    }
  };

  const handleViewAIContent = async (doc: GeneratedDocument) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.documents.getAIContent(user.id, doc.id);
      if (result.success && result.content) {
        setAiContentModal({
          visible: true,
          content: result.content,
          title: `AI 분석 결과: ${doc.template_name}`,
        });
      } else {
        message.info('AI 분석 내용이 없습니다.');
      }
    } catch (err) {
      message.error('AI 내용을 불러오는 중 오류가 발생했습니다.');
    }
  };

  if (documents.length === 0 && !loading) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="생성된 문서가 없습니다."
        style={{ padding: '20px 0' }}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="문서 폴더 열기">
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={handleOpenFolder}
          >
            폴더 열기
          </Button>
        </Tooltip>
      </div>

      <List
        loading={loading}
        dataSource={documents}
        size="small"
        renderItem={(doc) => (
          <List.Item
            style={{
              padding: '12px',
              backgroundColor: doc.ai_generated ? '#f0f5ff' : '#fafafa',
              borderRadius: 8,
              marginBottom: 8,
              border: doc.ai_generated ? '1px solid #adc6ff' : undefined,
            }}
            actions={[
              ...(doc.ai_generated ? [
                <Tooltip key="ai" title="AI 분석 내용 보기">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewAIContent(doc)}
                    style={{ color: '#1890ff' }}
                  />
                </Tooltip>,
              ] : []),
              <Tooltip key="open" title="파일 열기">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleOpenDocument(doc.id)}
                />
              </Tooltip>,
              <Popconfirm
                key="delete"
                title="이 문서를 삭제하시겠습니까?"
                onConfirm={() => handleDeleteDocument(doc.id)}
                okText="삭제"
                cancelText="취소"
              >
                <Tooltip title="삭제">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={getFileIcon(doc.file_type)}
              title={
                <Space>
                  <Text
                    strong
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenDocument(doc.id)}
                  >
                    {doc.template_name}
                  </Text>
                  <Tag>.{doc.file_type}</Tag>
                  {doc.ai_generated && (
                    <Tag color="blue" icon={<RobotOutlined />}>
                      AI 분석
                    </Tag>
                  )}
                </Space>
              }
              description={
                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatFileSize(doc.file_size)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(doc.generated_at).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />

      {/* AI 분석 내용 모달 */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#1890ff' }} />
            {aiContentModal.title}
          </Space>
        }
        open={aiContentModal.visible}
        onCancel={() => setAiContentModal({ visible: false, content: '', title: '' })}
        footer={
          <Button onClick={() => setAiContentModal({ visible: false, content: '', title: '' })}>
            닫기
          </Button>
        }
        width={700}
      >
        <div style={{
          maxHeight: '60vh',
          overflow: 'auto',
          padding: 16,
          backgroundColor: '#f5f5f5',
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          {aiContentModal.content}
        </div>
      </Modal>
    </div>
  );
};

export default GeneratedDocumentList;
