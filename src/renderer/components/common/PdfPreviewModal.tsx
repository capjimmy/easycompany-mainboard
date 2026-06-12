import React, { useEffect, useState } from 'react';
import { Modal, Spin, message, Button, Space } from 'antd';
import { EyeOutlined, FilePdfOutlined, PrinterOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

interface PdfPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'quote' | 'contract';
  documentId: string;
  documentNumber?: string;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  visible,
  onClose,
  type,
  documentId,
  documentNumber,
}) => {
  const { user } = useAuthStore();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (visible && user?.id && documentId) {
      loadPreview();
    } else if (!visible) {
      setHtml('');
    }
  }, [visible, documentId]);

  const loadPreview = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = type === 'quote'
        ? await window.electronAPI.pdf.previewQuote(user.id, documentId)
        : await window.electronAPI.pdf.previewContract(user.id, documentId);

      if (result.success && result.html) {
        setHtml(result.html);
      } else {
        message.error(result.error || '미리보기 로드에 실패했습니다.');
      }
    } catch (err) {
      message.error('미리보기 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!user?.id) return;
    setPdfGenerating(true);
    try {
      const result = type === 'quote'
        ? await window.electronAPI.pdf.generateQuote(user.id, documentId)
        : await window.electronAPI.pdf.generateContract(user.id, documentId);

      if (result.success && result.filePath) {
        const prefix = type === 'quote' ? '견적서' : '계약서';
        const defaultName = `${prefix}_${documentNumber || ''}.pdf`;
        const saveResult = await window.electronAPI.pdf.saveAs(result.filePath, defaultName);
        if (saveResult.success) {
          message.success('PDF가 저장되었습니다.');
        }
      } else {
        message.error(result.error || 'PDF 생성에 실패했습니다.');
      }
    } catch (err) {
      message.error('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <EyeOutlined />
          <span>{type === 'quote' ? '견적서' : '계약서'} 미리보기</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      destroyOnClose
      width={850}
      style={{ top: 20 }}
      footer={[
        <Button key="close" onClick={onClose}>닫기</Button>,
        <Button
          key="download"
          type="primary"
          icon={<FilePdfOutlined />}
          loading={pdfGenerating}
          onClick={handleDownloadPdf}
        >
          PDF 저장
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: '#fff',
            maxHeight: '70vh',
            overflow: 'auto',
          }}
        >
          <iframe
            srcDoc={html}
            style={{
              width: '100%',
              height: '70vh',
              border: 'none',
            }}
            title="PDF Preview"
          />
        </div>
      )}
    </Modal>
  );
};

export default PdfPreviewModal;
