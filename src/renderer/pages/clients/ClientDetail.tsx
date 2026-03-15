import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Space, Input, message, Popconfirm,
  Modal, Form, Tag, Descriptions, Switch, Spin, Empty, Row, Col, Select, Statistic,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  TeamOutlined, FileTextOutlined, SolutionOutlined, SaveOutlined,
  PhoneOutlined, MailOutlined, UserOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const CLIENT_TYPE_OPTIONS = [
  { value: 'sales', label: '매출거래처' },
  { value: 'purchase', label: '매입거래처' },
  { value: 'both', label: '겸용' },
];

const CLIENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sales: { label: '매출', color: 'blue' },
  purchase: { label: '매입', color: 'orange' },
  both: { label: '겸용', color: 'green' },
};

const ClientDetail: React.FC = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [client, setClient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm] = Form.useForm();
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm] = Form.useForm();

  // Financial summary computed from contracts
  const [financialSummary, setFinancialSummary] = useState({
    totalContract: 0,
    received: 0,
    outstanding: 0,
    collectionRate: 0,
  });

  const loadClient = async () => {
    if (!user?.id || !clientId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.clients.getById(user.id, clientId);
      if (result.success) {
        setClient(result.client);
        setContacts(result.client.contacts || []);
        editForm.setFieldsValue(result.client);
      } else {
        message.error(result.error || '거래처 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      message.error('거래처 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user?.id || !clientId) return;
    try {
      const result = await window.electronAPI.clients.getContracts(user.id, clientId);
      if (result.success) {
        const contractList = result.contracts || [];
        setContracts(contractList);
        setQuotes(result.quotes || []);

        // Calculate financial summary from contracts
        let totalContract = 0;
        let received = 0;
        for (const c of contractList) {
          totalContract += c.total_amount || 0;
          received += c.received_amount || 0;
        }
        const outstanding = totalContract - received;
        const collectionRate = totalContract > 0 ? (received / totalContract) * 100 : 0;
        setFinancialSummary({ totalContract, received, outstanding, collectionRate });
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  useEffect(() => {
    loadClient();
    loadTransactions();
  }, [user?.id, clientId]);

  const handleSave = async (values: any) => {
    if (!user?.id || !clientId) return;
    try {
      const result = await window.electronAPI.clients.update(user.id, clientId, values);
      if (result.success) {
        message.success('거래처 정보가 수정되었습니다.');
        setEditing(false);
        setClient(result.client);
      } else {
        message.error(result.error || '수정에 실패했습니다.');
      }
    } catch (err) {
      message.error('거래처 수정 실패');
    }
  };

  const handleAddContact = async (values: any) => {
    if (!user?.id || !clientId) return;
    try {
      if (editingContact) {
        // 수정
        const result = await window.electronAPI.clients.updateContact(user.id, editingContact.id, values);
        if (result.success) {
          message.success('담당자 정보가 수정되었습니다.');
        } else {
          message.error(result.error || '수정에 실패했습니다.');
          return;
        }
      } else {
        // 추가
        const result = await window.electronAPI.clients.addContact(user.id, clientId, values);
        if (result.success) {
          message.success('담당자가 추가되었습니다.');
        } else {
          message.error(result.error || '추가에 실패했습니다.');
          return;
        }
      }
      setContactModalVisible(false);
      setEditingContact(null);
      contactForm.resetFields();
      loadClient();
    } catch (err) {
      message.error('담당자 처리 실패');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.clients.deleteContact(user.id, contactId);
      if (result.success) {
        message.success('담당자가 삭제되었습니다.');
        loadClient();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('담당자 삭제 실패');
    }
  };

  const openEditContact = (contact: any) => {
    setEditingContact(contact);
    contactForm.setFieldsValue(contact);
    setContactModalVisible(true);
  };

  const openAddContact = () => {
    setEditingContact(null);
    contactForm.resetFields();
    contactForm.setFieldsValue({ is_primary: false });
    setContactModalVisible(true);
  };

  const contactColumns = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <UserOutlined />
          {text}
          {record.is_primary && <Tag color="blue">대표</Tag>}
        </Space>
      ),
    },
    {
      title: '직책',
      dataIndex: 'position',
      key: 'position',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '부서',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '전화',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (v: string) => v ? (
        <Space><PhoneOutlined />{v}</Space>
      ) : '-',
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string) => v ? (
        <Space><MailOutlined />{v}</Space>
      ) : '-',
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditContact(record)} />
          <Popconfirm title="이 담당자를 삭제하시겠습니까?" onConfirm={() => handleDeleteContact(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const contractColumns = [
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 130,
      render: (text: string, record: any) => (
        <a onClick={() => navigate(`/contracts/${record.id}/edit`)}>{text}</a>
      ),
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: '계약금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => v ? `${v.toLocaleString()}원` : '-',
    },
    {
      title: '수금액',
      dataIndex: 'received_amount',
      key: 'received_amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => v ? `${v.toLocaleString()}원` : '-',
    },
    {
      title: '진행상황',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      render: (v: string) => {
        const config: Record<string, { label: string; color: string }> = {
          contract_signed: { label: '계약체결', color: 'blue' },
          in_progress: { label: '진행중', color: 'processing' },
          inspection: { label: '검수중', color: 'orange' },
          completed: { label: '완료', color: 'success' },
          on_hold: { label: '보류', color: 'default' },
          cancelled: { label: '취소', color: 'error' },
        };
        const c = config[v] || { label: v, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '계약시작일',
      dataIndex: 'contract_start_date',
      key: 'contract_start_date',
      width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
  ];

  const quoteColumns = [
    {
      title: '견적번호',
      dataIndex: 'quote_number',
      key: 'quote_number',
      width: 130,
      render: (text: string, record: any) => (
        <a onClick={() => navigate(`/quotes/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: '견적금액',
      dataIndex: 'grand_total',
      key: 'grand_total',
      width: 140,
      align: 'right' as const,
      render: (v: number) => v ? `${v.toLocaleString()}원` : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const config: Record<string, { label: string; color: string }> = {
          draft: { label: '작성중', color: 'default' },
          submitted: { label: '제출', color: 'processing' },
          negotiating: { label: '협상중', color: 'warning' },
          approved: { label: '승인', color: 'success' },
          rejected: { label: '거절', color: 'error' },
          converted: { label: '계약전환', color: 'purple' },
        };
        const c = config[v] || { label: v, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '견적일',
      dataIndex: 'quote_date',
      key: 'quote_date',
      width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <Empty description="거래처를 찾을 수 없습니다." />
        <Button onClick={() => navigate('/clients')}>목록으로</Button>
      </div>
    );
  }

  const clientTypeConfig = CLIENT_TYPE_CONFIG[client.client_type] || { label: '겸용', color: 'green' };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>목록</Button>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            {client.name}
          </Title>
          <Tag color={clientTypeConfig.color}>{clientTypeConfig.label}</Tag>
        </Space>
        <Space>
          {editing ? (
            <>
              <Button onClick={() => { setEditing(false); editForm.setFieldsValue(client); }}>취소</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => editForm.submit()}>저장</Button>
            </>
          ) : (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>수정</Button>
          )}
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* 재무 요약 */}
        <Col span={24}>
          <Card>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="총계약금"
                  value={financialSummary.totalContract}
                  suffix="원"
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="기성금 (수금액)"
                  value={financialSummary.received}
                  suffix="원"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="미수금"
                  value={financialSummary.outstanding}
                  suffix="원"
                  valueStyle={{ color: financialSummary.outstanding > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="수금률"
                  value={financialSummary.collectionRate}
                  precision={1}
                  suffix="%"
                  valueStyle={{
                    color: financialSummary.collectionRate >= 100
                      ? '#52c41a'
                      : financialSummary.collectionRate >= 50
                        ? '#1890ff'
                        : '#ff4d4f',
                  }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 기본 정보 */}
        <Col span={24}>
          <Card title="기본 정보">
            {editing ? (
              <Form form={editForm} layout="vertical" onFinish={handleSave}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="name" label="거래처명" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="client_type" label="거래처 유형">
                      <Select options={CLIENT_TYPE_OPTIONS} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="business_number" label="사업자번호">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="phone" label="대표전화">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="address" label="주소">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="industry" label="업종">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="business_registration_file" label="사업자등록증 파일 경로">
                      <Input placeholder="파일 경로" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="bank_copy_file" label="통장사본 파일 경로">
                      <Input placeholder="파일 경로" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="notes" label="비고">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            ) : (
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="거래처명">{client.name}</Descriptions.Item>
                <Descriptions.Item label="거래처 유형">
                  <Tag color={clientTypeConfig.color}>{clientTypeConfig.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="사업자번호">{client.business_number || '-'}</Descriptions.Item>
                <Descriptions.Item label="대표전화">{client.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="주소" span={2}>{client.address || '-'}</Descriptions.Item>
                <Descriptions.Item label="업종">{client.industry || '-'}</Descriptions.Item>
                <Descriptions.Item label="사업자등록증">{client.business_registration_file || '-'}</Descriptions.Item>
                <Descriptions.Item label="통장사본">{client.bank_copy_file || '-'}</Descriptions.Item>
                <Descriptions.Item label="비고" span={2}>{client.notes || '-'}</Descriptions.Item>
                <Descriptions.Item label="등록일">{dayjs(client.created_at).format('YYYY-MM-DD')}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        {/* 담당자 목록 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <UserOutlined />
                담당자 목록
                <Tag>{contacts.length}명</Tag>
              </Space>
            }
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddContact}>
                담당자 추가
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <Empty description="등록된 담당자가 없습니다." />
            ) : (
              <Table
                dataSource={contacts}
                columns={contactColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        {/* 거래 이력 - 계약 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                계약 이력
                <Tag>{contracts.length}건</Tag>
              </Space>
            }
          >
            {contracts.length === 0 ? (
              <Empty description="연관된 계약이 없습니다." />
            ) : (
              <Table
                dataSource={contracts}
                columns={contractColumns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            )}
          </Card>
        </Col>

        {/* 거래 이력 - 견적 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <SolutionOutlined />
                견적 이력
                <Tag>{quotes.length}건</Tag>
              </Space>
            }
          >
            {quotes.length === 0 ? (
              <Empty description="연관된 견적이 없습니다." />
            ) : (
              <Table
                dataSource={quotes}
                columns={quoteColumns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 담당자 추가/수정 모달 */}
      <Modal
        title={editingContact ? '담당자 수정' : '담당자 추가'}
        open={contactModalVisible}
        onCancel={() => { setContactModalVisible(false); setEditingContact(null); contactForm.resetFields(); }}
        onOk={() => contactForm.submit()}
        okText={editingContact ? '수정' : '추가'}
        cancelText="취소"
      >
        <Form form={contactForm} layout="vertical" onFinish={handleAddContact}>
          <Form.Item
            name="name"
            label="담당자명"
            rules={[{ required: true, message: '이름을 입력하세요' }]}
          >
            <Input placeholder="홍길동" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label="직책">
                <Input placeholder="과장, 팀장, 대리 등" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="부서">
                <Input placeholder="기술부, 계약팀 등" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="전화">
                <Input placeholder="010-0000-0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="이메일">
                <Input placeholder="email@example.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="is_primary" label="대표 담당자" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="메모" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientDetail;
