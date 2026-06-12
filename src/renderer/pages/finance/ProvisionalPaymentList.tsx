import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select,
  DatePicker, message, Modal, Form, InputNumber, Popconfirm, Row, Col,
  Statistic, Progress
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  RobotOutlined, LinkOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

type ProvisionalStatus = 'unmatched' | 'matched' | 'partial' | 'returned';

interface ProvisionalPayment {
  id: string;
  payment_number: string;
  depositor_name: string;
  amount: number;
  deposit_date: string;
  bank_name: string;
  status: ProvisionalStatus;
  matched_info?: string;
  matched_receivable_id?: string;
  matched_billing_id?: string;
  note?: string;
}

interface AiSuggestion {
  id: string;
  type: 'receivable' | 'billing';
  label: string;
  amount: number;
  client_name: string;
  confidence: number;
}

const STATUS_CONFIG: Record<ProvisionalStatus, { label: string; color: string }> = {
  unmatched: { label: '미확인', color: 'warning' },
  matched: { label: '매칭완료', color: 'success' },
  partial: { label: '부분매칭', color: 'processing' },
  returned: { label: '반환', color: 'default' },
};

const BANK_OPTIONS = [
  '국민은행', '신한은행', '우리은행', '하나은행', 'SC제일은행',
  '기업은행', '농협은행', '카카오뱅크', '토스뱅크', '케이뱅크', '기타',
];

const ProvisionalPaymentList: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [payments, setPayments] = useState<ProvisionalPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProvisionalPayment | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProvisionalStatus | undefined>();
  const [form] = Form.useForm();

  // AI Suggest
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiTargetPayment, setAiTargetPayment] = useState<ProvisionalPayment | null>(null);

  // Manual match
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchTargetPayment, setMatchTargetPayment] = useState<ProvisionalPayment | null>(null);
  const [matchForm] = Form.useForm();

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.provisional.getAll(user!.id, { company_id: companyId });
      if (result.success) {
        setPayments(result.data || []);
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

  const filteredPayments = useMemo(() => {
    let list = [...payments];
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter(
        (p) =>
          p.payment_number?.toLowerCase().includes(lower) ||
          p.depositor_name?.toLowerCase().includes(lower) ||
          p.bank_name?.toLowerCase().includes(lower)
      );
    }
    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }
    return list;
  }, [payments, searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: payments.length,
    unmatched: payments.filter((p) => p.status === 'unmatched').length,
    unmatched_amount: payments
      .filter((p) => p.status === 'unmatched')
      .reduce((s, p) => s + (p.amount || 0), 0),
    matched_amount: payments
      .filter((p) => p.status === 'matched')
      .reduce((s, p) => s + (p.amount || 0), 0),
  }), [payments]);

  const handleOpenModal = (record?: ProvisionalPayment) => {
    setEditingRecord(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        deposit_date: record.deposit_date ? dayjs(record.deposit_date) : undefined,
      });
    } else {
      form.setFieldsValue({ deposit_date: dayjs() });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!companyId) return;
    const payload = {
      ...values,
      company_id: companyId,
      deposit_date: values.deposit_date?.format('YYYY-MM-DD'),
    };

    try {
      const result = editingRecord
        ? await window.electronAPI.provisional.update(user!.id, editingRecord.id, payload)
        : await window.electronAPI.provisional.create(user!.id, payload);

      if (result.success) {
        message.success(editingRecord ? '수정되었습니다.' : '등록되었습니다.');
        setModalOpen(false);
        fetchData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.provisional.delete(user!.id, id);
      if (result.success) {
        message.success('삭제되었습니다.');
        fetchData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAiSuggest = async (record: ProvisionalPayment) => {
    setAiTargetPayment(record);
    setAiSuggestions([]);
    setAiModalOpen(true);
    setAiLoading(true);
    try {
      const result = await window.electronAPI.provisional.aiSuggest(user!.id, record.id);
      if (result.success) {
        setAiSuggestions(result.data || []);
      } else {
        message.error(result.error || 'AI 매칭 제안을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || 'AI 매칭 제안 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleMatch = async (provisionalId: string, targetId: string, targetType: string) => {
    try {
      const result = await window.electronAPI.provisional.match(user!.id, provisionalId, {
        target_id: targetId,
        target_type: targetType,
      });
      if (result.success) {
        message.success('매칭이 완료되었습니다.');
        setAiModalOpen(false);
        setMatchModalOpen(false);
        fetchData();
      } else {
        message.error(result.error || '매칭에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '매칭 중 오류가 발생했습니다.');
    }
  };

  const handleManualMatch = (record: ProvisionalPayment) => {
    setMatchTargetPayment(record);
    matchForm.resetFields();
    setMatchModalOpen(true);
  };

  const handleManualMatchSubmit = async (values: any) => {
    if (!matchTargetPayment) return;
    await handleMatch(matchTargetPayment.id, values.target_id, values.target_type);
  };

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      const exportColumns = [
        { title: '번호', key: 'payment_number' },
        { title: '입금자', key: 'depositor_name' },
        { title: '금액', key: 'amount' },
        { title: '입금일', key: 'deposit_date' },
        { title: '은행', key: 'bank_name' },
        { title: '상태', key: 'status' },
        { title: '매칭정보', key: 'matched_info' },
      ];
      const exportData = filteredPayments.map((d) => ({
        ...d,
        status: STATUS_CONFIG[d.status]?.label || d.status,
      }));
      const result = await window.electronAPI.export.financeGeneric(user.id, '가수금관리', exportColumns, exportData);
      if (result.success) {
        message.success('엑셀 파일이 저장되었습니다.');
      } else {
        message.error(result.error || '엑셀 저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '엑셀 저장 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '번호',
      dataIndex: 'payment_number',
      key: 'payment_number',
      width: 130,
    },
    {
      title: '입금자',
      dataIndex: 'depositor_name',
      key: 'depositor_name',
      width: 120,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '입금일',
      dataIndex: 'deposit_date',
      key: 'deposit_date',
      width: 110,
      sorter: (a: ProvisionalPayment, b: ProvisionalPayment) =>
        (a.deposit_date || '').localeCompare(b.deposit_date || ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '은행',
      dataIndex: 'bank_name',
      key: 'bank_name',
      width: 100,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: ProvisionalStatus) => (
        <Tag color={STATUS_CONFIG[v]?.color}>{STATUS_CONFIG[v]?.label || v}</Tag>
      ),
    },
    {
      title: '매칭정보',
      dataIndex: 'matched_info',
      key: 'matched_info',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '작업',
      key: 'action',
      width: 180,
      render: (_: any, record: ProvisionalPayment) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.status === 'unmatched' && (
            <>
              <Button type="link" size="small" icon={<RobotOutlined />} onClick={() => handleAiSuggest(record)} title="AI 매칭" />
              <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => handleManualMatch(record)} title="수동 매칭" />
            </>
          )}
          <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)} okText="삭제" cancelText="취소">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>가수금관리</Title>
          <span style={{ color: '#888' }}>가수금을 관리하고 매칭합니다.</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          가수금 등록
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="총 건수" value={stats.total} suffix="건" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="미확인 건수" value={stats.unmatched} suffix="건" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="미확인 금액" value={stats.unmatched_amount} suffix="원" valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="매칭완료 금액" value={stats.matched_amount} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="번호, 입금자, 은행 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="상태"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 120 }}
          >
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <Option key={key} value={key}>{cfg.label}</Option>
            ))}
          </Select>
          <Button onClick={() => { setSearchText(''); setStatusFilter(undefined); }}>초기화</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
            엑셀 다운로드
          </Button>
        </Space>
      </Card>

      <Card>
        <ResizableTable
          columns={columns}
          dataSource={filteredPayments}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        title={editingRecord ? '가수금 수정' : '가수금 등록'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="depositor_name" label="입금자명" rules={[{ required: true, message: '입금자명을 입력해주세요.' }]}>
            <Input placeholder="입금자명" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="금액" rules={[{ required: true, message: '금액을 입력해주세요.' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deposit_date" label="입금일" rules={[{ required: true, message: '입금일을 선택해주세요.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="bank_name" label="은행" rules={[{ required: true, message: '은행을 선택해주세요.' }]}>
            <Select placeholder="은행 선택">
              {BANK_OPTIONS.map((b) => (
                <Option key={b} value={b}>{b}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="note" label="비고">
            <Input.TextArea rows={2} placeholder="메모 (선택)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">{editingRecord ? '수정' : '등록'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI 매칭 제안 모달 */}
      <Modal
        title="AI 매칭 제안"
        open={aiModalOpen}
        onCancel={() => setAiModalOpen(false)}
        footer={<Button onClick={() => setAiModalOpen(false)}>닫기</Button>}
        destroyOnClose
        width={640}
      >
        {aiTargetPayment && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Text strong>입금자: </Text>{aiTargetPayment.depositor_name}
            <Text strong style={{ marginLeft: 16 }}>금액: </Text>
            <Text type="success">{aiTargetPayment.amount?.toLocaleString()}원</Text>
          </Card>
        )}

        {aiLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text>AI가 매칭 후보를 분석 중입니다...</Text>
          </div>
        ) : aiSuggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text type="secondary">매칭 후보가 없습니다.</Text>
          </div>
        ) : (
          aiSuggestions.map((s) => (
            <Card key={s.id} size="small" style={{ marginBottom: 8 }}>
              <Row align="middle" gutter={16}>
                <Col span={14}>
                  <div>
                    <Tag color={s.type === 'receivable' ? 'blue' : 'orange'}>
                      {s.type === 'receivable' ? '매출채권' : '청구'}
                    </Tag>
                    <Text strong>{s.client_name}</Text>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text>{s.label}</Text>
                    <Text style={{ marginLeft: 8 }}>{s.amount?.toLocaleString()}원</Text>
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>신뢰도</Text>
                  <Progress
                    percent={Math.round(s.confidence * 100)}
                    size="small"
                    strokeColor={s.confidence >= 0.8 ? '#52c41a' : s.confidence >= 0.5 ? '#faad14' : '#ff4d4f'}
                  />
                </Col>
                <Col span={4} style={{ textAlign: 'right' }}>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleMatch(aiTargetPayment!.id, s.id, s.type)}
                  >
                    매칭
                  </Button>
                </Col>
              </Row>
            </Card>
          ))
        )}
      </Modal>

      {/* 수동 매칭 모달 */}
      <Modal
        title="수동 매칭"
        open={matchModalOpen}
        onCancel={() => setMatchModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        {matchTargetPayment && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Text strong>입금자: </Text>{matchTargetPayment.depositor_name}
            <Text strong style={{ marginLeft: 16 }}>금액: </Text>
            <Text type="success">{matchTargetPayment.amount?.toLocaleString()}원</Text>
          </Card>
        )}
        <Form form={matchForm} layout="vertical" onFinish={handleManualMatchSubmit}>
          <Form.Item name="target_type" label="매칭 대상 유형" rules={[{ required: true, message: '유형을 선택해주세요.' }]}>
            <Select placeholder="유형 선택">
              <Option value="receivable">매출채권</Option>
              <Option value="billing">청구</Option>
            </Select>
          </Form.Item>

          <Form.Item name="target_id" label="매칭 대상 ID" rules={[{ required: true, message: '대상 ID를 입력해주세요.' }]}>
            <Input placeholder="매출채권 또는 청구 ID" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setMatchModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">매칭</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProvisionalPaymentList;
