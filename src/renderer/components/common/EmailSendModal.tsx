import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Select, Space, message, Divider, Tag, Spin, Typography } from 'antd';
import { MailOutlined, PlusOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { TextArea } = Input;
const { Text } = Typography;

interface EmailSendModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'quote' | 'contract';
  documentId: string;
  documentNumber: string;
  serviceName: string;
  recipientCompany?: string;
  recipientEmail?: string;
}

interface ContactInfo {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  position?: string;
  department?: string;
  email?: string;
  phone?: string;
}

const EmailSendModal: React.FC<EmailSendModalProps> = ({
  visible,
  onClose,
  type,
  documentId,
  documentNumber,
  serviceName,
  recipientCompany,
  recipientEmail,
}) => {
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  // 담당자 검색
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 즉석 담당자 추가
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  const typeLabel = type === 'quote' ? '견적서' : '계약서';

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        to: recipientEmail || '',
        subject: `[${typeLabel}] ${serviceName} - ${documentNumber}`,
        body: `안녕하세요.\n\n${typeLabel}를 첨부하여 보내드립니다.\n\n문서번호: ${documentNumber}\n용역명: ${serviceName}\n\n검토 부탁드립니다.\n감사합니다.`,
      });
      setPdfPath(null);

      // 수신처가 있으면 담당자 검색
      if (recipientCompany) {
        searchContacts(recipientCompany);
      }
    }
  }, [visible]);

  const searchContacts = async (query: string) => {
    if (!user?.id || !query) return;
    setSearchLoading(true);
    try {
      const result = await window.electronAPI.pdf.searchContacts(user.id, query);
      if (result.success) {
        setContacts(result.contacts || []);
      }
    } catch (err) {
      console.error('Failed to search contacts:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectContact = (contact: ContactInfo) => {
    if (contact.email) {
      const currentTo = form.getFieldValue('to') || '';
      const emails = currentTo ? currentTo.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
      if (!emails.includes(contact.email)) {
        emails.push(contact.email);
      }
      form.setFieldValue('to', emails.join(', '));
    } else {
      message.warning(`${contact.name}님의 이메일이 등록되어 있지 않습니다.`);
    }
  };

  const handleAddNewContact = async () => {
    if (!user?.id || !newContactName || !newContactEmail) {
      message.warning('이름과 이메일을 입력해주세요.');
      return;
    }

    setAddingContact(true);
    try {
      // 거래처 찾기
      const clientResult = await window.electronAPI.clients.getAll(user.id);
      if (!clientResult.success) {
        message.error('거래처 정보를 불러올 수 없습니다.');
        return;
      }

      const targetClient = clientResult.clients?.find((c: any) =>
        c.name === recipientCompany
      );

      if (targetClient) {
        // 기존 거래처에 담당자 추가
        const addResult = await window.electronAPI.clients.addContact(user.id, targetClient.id, {
          name: newContactName,
          email: newContactEmail,
          position: newContactPosition || undefined,
          phone: newContactPhone || undefined,
          is_primary: false,
        });

        if (addResult.success) {
          message.success(`${newContactName}님이 담당자로 추가되었습니다.`);
          // 이메일 수신자에 자동 추가
          const currentTo = form.getFieldValue('to') || '';
          const emails = currentTo ? currentTo.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
          if (!emails.includes(newContactEmail)) {
            emails.push(newContactEmail);
          }
          form.setFieldValue('to', emails.join(', '));

          // 목록 새로고침
          if (recipientCompany) searchContacts(recipientCompany);
          setShowAddContact(false);
          setNewContactName('');
          setNewContactEmail('');
          setNewContactPosition('');
          setNewContactPhone('');
        } else {
          message.error(addResult.error || '담당자 추가에 실패했습니다.');
        }
      } else {
        // 거래처가 없으면 이메일만 추가
        const currentTo = form.getFieldValue('to') || '';
        const emails = currentTo ? currentTo.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
        if (!emails.includes(newContactEmail)) {
          emails.push(newContactEmail);
        }
        form.setFieldValue('to', emails.join(', '));
        message.info('해당 거래처를 찾을 수 없어 이메일만 추가되었습니다.');
        setShowAddContact(false);
        setNewContactName('');
        setNewContactEmail('');
        setNewContactPosition('');
        setNewContactPhone('');
      }
    } catch (err) {
      message.error('담당자 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingContact(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!user?.id) return;
    setGeneratingPdf(true);
    try {
      const result = type === 'quote'
        ? await window.electronAPI.pdf.generateQuote(user.id, documentId)
        : await window.electronAPI.pdf.generateContract(user.id, documentId);

      if (result.success && result.filePath) {
        setPdfPath(result.filePath);
        message.success('PDF가 생성되었습니다.');
      } else {
        message.error(result.error || 'PDF 생성에 실패했습니다.');
      }
    } catch (err) {
      message.error('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleOpenPdf = async () => {
    if (!pdfPath) return;
    try {
      await window.electronAPI.pdf.open(pdfPath);
    } catch (err) {
      message.error('PDF 열기에 실패했습니다.');
    }
  };

  const handleSavePdfAs = async () => {
    if (!pdfPath) return;
    try {
      const defaultName = `${typeLabel}_${documentNumber}.pdf`;
      const result = await window.electronAPI.pdf.saveAs(pdfPath, defaultName);
      if (result.success) {
        message.success('PDF가 저장되었습니다.');
      } else if (result.error !== 'canceled') {
        message.error(result.error || 'PDF 저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('PDF 저장 중 오류가 발생했습니다.');
    }
  };

  const handleSend = async () => {
    if (!user?.id) return;

    try {
      const values = await form.validateFields();

      if (!pdfPath) {
        // 자동 생성
        setGeneratingPdf(true);
        const pdfResult = type === 'quote'
          ? await window.electronAPI.pdf.generateQuote(user.id, documentId)
          : await window.electronAPI.pdf.generateContract(user.id, documentId);
        setGeneratingPdf(false);

        if (!pdfResult.success || !pdfResult.filePath) {
          message.error(pdfResult.error || 'PDF 생성에 실패했습니다.');
          return;
        }
        setPdfPath(pdfResult.filePath);

        // 이메일 발송
        setSending(true);
        const sendResult = await window.electronAPI.email.sendQuote(user.id, {
          to: values.to,
          subject: values.subject,
          body: values.body.replace(/\n/g, '<br>'),
          attachmentPath: pdfResult.filePath,
          attachmentName: `${typeLabel}_${documentNumber}.pdf`,
        });

        if (sendResult.success) {
          message.success('이메일이 발송되었습니다.');
          onClose();
        } else {
          message.error(sendResult.error || '이메일 발송에 실패했습니다.');
        }
      } else {
        setSending(true);
        const sendResult = await window.electronAPI.email.sendQuote(user.id, {
          to: values.to,
          subject: values.subject,
          body: values.body.replace(/\n/g, '<br>'),
          attachmentPath: pdfPath,
          attachmentName: `${typeLabel}_${documentNumber}.pdf`,
        });

        if (sendResult.success) {
          message.success('이메일이 발송되었습니다.');
          onClose();
        } else {
          message.error(sendResult.error || '이메일 발송에 실패했습니다.');
        }
      }
    } catch (err) {
      // validation error
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <MailOutlined />
          <span>{typeLabel} 이메일 발송</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>취소</Button>,
        <Button key="send" type="primary" icon={<MailOutlined />} loading={sending || generatingPdf} onClick={handleSend}>
          {pdfPath ? '발송' : 'PDF 생성 후 발송'}
        </Button>,
      ]}
    >
      {/* PDF 생성 영역 */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
        <Space>
          <Button
            onClick={handleGeneratePdf}
            loading={generatingPdf}
          >
            PDF 생성
          </Button>
          {pdfPath && (
            <>
              <Tag color="green">PDF 생성 완료</Tag>
              <Button size="small" onClick={handleOpenPdf}>미리보기</Button>
              <Button size="small" onClick={handleSavePdfAs}>다른이름으로 저장</Button>
            </>
          )}
        </Space>
      </div>

      {/* 수신자 검색 영역 */}
      <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          <UserOutlined /> 담당자 검색
        </Text>
        <Space style={{ marginBottom: 8, width: '100%' }}>
          <Input
            placeholder="거래처명으로 검색"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => searchContacts(searchText)}
            style={{ width: 250 }}
          />
          <Button icon={<SearchOutlined />} onClick={() => searchContacts(searchText)} loading={searchLoading}>
            검색
          </Button>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setShowAddContact(!showAddContact)}
          >
            담당자 추가
          </Button>
        </Space>

        {/* 검색 결과 */}
        {contacts.length > 0 && (
          <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
            {contacts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 8px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                }}
                onClick={() => handleSelectContact(c)}
              >
                <Space size={4}>
                  <Text strong>{c.name}</Text>
                  {c.position && <Text type="secondary">({c.position})</Text>}
                  <Text type="secondary">- {c.client_name}</Text>
                </Space>
                <Text type="secondary">{c.email || '이메일 없음'}</Text>
              </div>
            ))}
          </div>
        )}

        {/* 즉석 담당자 추가 */}
        {showAddContact && (
          <div style={{ padding: 8, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Space>
                <Input placeholder="이름 *" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} style={{ width: 120 }} />
                <Input placeholder="이메일 *" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} style={{ width: 200 }} />
                <Input placeholder="직위" value={newContactPosition} onChange={(e) => setNewContactPosition(e.target.value)} style={{ width: 100 }} />
                <Input placeholder="전화번호" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} style={{ width: 140 }} />
              </Space>
              <Space>
                <Button type="primary" size="small" onClick={handleAddNewContact} loading={addingContact}>
                  추가 및 수신자 등록
                </Button>
                <Button size="small" onClick={() => setShowAddContact(false)}>취소</Button>
              </Space>
            </Space>
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 이메일 폼 */}
      <Form form={form} layout="vertical">
        <Form.Item
          name="to"
          label="수신자 이메일"
          rules={[{ required: true, message: '수신자 이메일을 입력해주세요.' }]}
        >
          <Input placeholder="이메일 (콤마로 구분하여 여러명 입력 가능)" />
        </Form.Item>
        <Form.Item
          name="subject"
          label="제목"
          rules={[{ required: true, message: '제목을 입력해주세요.' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="body"
          label="본문"
          rules={[{ required: true, message: '본문을 입력해주세요.' }]}
        >
          <TextArea rows={6} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EmailSendModal;
