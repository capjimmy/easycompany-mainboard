import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select,
  message, Modal, Form, InputNumber, Row, Col, Statistic
} from 'antd';
import {
  SearchOutlined, EditOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;

type CreditRating = 'good' | 'normal' | 'caution' | 'bad';

interface ClientFinancial {
  id: string;
  client_id: string;
  client_name: string;
  payment_terms_days: number;
  credit_limit: number;
  credit_rating: CreditRating;
  outstanding_receivable: number;
  outstanding_payable: number;
  overdue_amount: number;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
  tax_type?: string;
  tax_email?: string;
  note?: string;
}

const CREDIT_RATING_CONFIG: Record<CreditRating, { label: string; color: string }> = {
  good: { label: '우수', color: 'green' },
  normal: { label: '보통', color: 'blue' },
  caution: { label: '주의', color: 'orange' },
  bad: { label: '불량', color: 'red' },
};

const ClientFinancials: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [financials, setFinancials] = useState<ClientFinancial[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClientFinancial | null>(null);
  const [searchText, setSearchText] = useState('');
  const [ratingFilter, setRatingFilter] = useState<CreditRating | undefined>();
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.clientFinancials.getByCompany(companyId);
      if (result.success) {
        setFinancials(result.data || []);
      } else {
        message.error(result.error || '데이터를 불러오지 못했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const filteredData = useMemo(() => {
    let list = [...financials];
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((f) => f.client_name?.toLowerCase().includes(lower));
    }
    if (ratingFilter) {
      list = list.filter((f) => f.credit_rating === ratingFilter);
    }
    return list;
  }, [financials, searchText, ratingFilter]);

  const stats = useMemo(() => ({
    total: financials.length,
    cautionBad: financials.filter((f) => f.credit_rating === 'caution' || f.credit_rating === 'bad').length,
    totalReceivable: financials.reduce((s, f) => s + (f.outstanding_receivable || 0), 0),
    totalPayable: financials.reduce((s, f) => s + (f.outstanding_payable || 0), 0),
  }), [financials]);

  const handleOpenModal = (record: ClientFinancial) => {
    setEditingRecord(record);
    form.resetFields();
    form.setFieldsValue({
      payment_terms_days: record.payment_terms_days,
      credit_limit: record.credit_limit,
      credit_rating: record.credit_rating,
      bank_name: record.bank_name,
      bank_account: record.bank_account,
      bank_holder: record.bank_holder,
      tax_type: record.tax_type,
      tax_email: record.tax_email,
      note: record.note,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!editingRecord) return;
    try {
      const result = await window.electronAPI.clientFinancials.upsert({
        client_id: editingRecord.client_id,
        company_id: companyId,
        ...values,
      });
      if (result.success) {
        message.success('저장되었습니다.');
        setModalOpen(false);
        fetchData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '거래처명',
      dataIndex: 'client_name',
      key: 'client_name',
      ellipsis: true,
    },
    {
      title: '결제조건',
      dataIndex: 'payment_terms_days',
      key: 'payment_terms_days',
      width: 100,
      align: 'center' as const,
      render: (v: number) => (v ? `${v}일` : '-'),
    },
    {
      title: '신용한도',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (v ? `${v.toLocaleString()}원` : '-'),
    },
    {
      title: '신용등급',
      dataIndex: 'credit_rating',
      key: 'credit_rating',
      width: 90,
      align: 'center' as const,
      render: (v: CreditRating) => (
        <Tag color={CREDIT_RATING_CONFIG[v]?.color}>
          {CREDIT_RATING_CONFIG[v]?.label || v}
        </Tag>
      ),
    },
    {
      title: '미수금',
      dataIndex: 'outstanding_receivable',
      key: 'outstanding_receivable',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#ff4d4f' : undefined }}>
          {(v || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '미지급금',
      dataIndex: 'outstanding_payable',
      key: 'outstanding_payable',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#faad14' : undefined }}>
          {(v || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '연체금액',
      dataIndex: 'overdue_amount',
      key: 'overdue_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a', fontWeight: v > 0 ? 'bold' : undefined }}>
          {(v || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      render: (_: any, record: ClientFinancial) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>거래처 재무확장</Title>
          <span style={{ color: '#888' }}>거래처별 재무 정보를 관리합니다.</span>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="총 거래처 수" value={stats.total} suffix="개" /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="주의/불량 등급"
              value={stats.cautionBad}
              suffix="개"
              valueStyle={{ color: stats.cautionBad > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="총 미수금" value={stats.totalReceivable} suffix="원" valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="총 미지급금" value={stats.totalPayable} suffix="원" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="거래처명 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="신용등급"
            value={ratingFilter}
            onChange={setRatingFilter}
            allowClear
            style={{ width: 120 }}
          >
            {Object.entries(CREDIT_RATING_CONFIG).map(([key, cfg]) => (
              <Option key={key} value={key}>{cfg.label}</Option>
            ))}
          </Select>
          <Button onClick={() => { setSearchText(''); setRatingFilter(undefined); }}>초기화</Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 수정 모달 */}
      <Modal
        title="거래처 재무정보 수정"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        {editingRecord && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>{editingRecord.client_name}</Title>
          </Card>
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="payment_terms_days" label="결제조건 (일)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="30" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="credit_limit" label="신용한도">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="credit_rating" label="신용등급">
                <Select placeholder="등급 선택">
                  {Object.entries(CREDIT_RATING_CONFIG).map(([key, cfg]) => (
                    <Option key={key} value={key}>
                      <Tag color={cfg.color}>{cfg.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>은행 정보</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bank_name" label="은행명">
                <Input placeholder="은행명" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_account" label="계좌번호">
                <Input placeholder="계좌번호" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_holder" label="예금주">
                <Input placeholder="예금주" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>세금 정보</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tax_type" label="과세유형">
                <Select placeholder="과세유형 선택" allowClear>
                  <Option value="taxable">과세</Option>
                  <Option value="tax_free">면세</Option>
                  <Option value="simplified">간이과세</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tax_email" label="세금계산서 이메일">
                <Input placeholder="tax@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="비고">
            <Input.TextArea rows={2} placeholder="메모 (선택)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">저장</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientFinancials;
