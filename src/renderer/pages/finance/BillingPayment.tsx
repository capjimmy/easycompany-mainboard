import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Table, Button, Space, Tag, Select, Modal,
  Form, InputNumber, DatePicker, Input, Tabs, Row, Col, message, Popconfirm
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Billing {
  id: string;
  billing_number: string;
  contract_id: string;
  contract_number?: string;
  client_name?: string;
  billing_type: string;
  billing_amount: number;
  vat_amount: number;
  total_amount: number;
  billing_date: string;
  due_date: string;
  status: string;
  description?: string;
  created_at: string;
}

interface PaymentReceipt {
  id: string;
  billing_id: string;
  billing_number?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payer_name: string;
  notes?: string;
  created_at: string;
}

const BILLING_TYPE_MAP: Record<string, string> = {
  advance: '선급',
  progress: '기성',
  final: '최종',
  other: '기타',
};

const BILLING_STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '작성' },
  sent: { color: 'blue', label: '발송' },
  paid: { color: 'green', label: '수금완료' },
  partial: { color: 'orange', label: '부분수금' },
  overdue: { color: 'red', label: '연체' },
  cancelled: { color: 'default', label: '취소' },
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  transfer: '계좌이체',
  cash: '현금',
  check: '수표',
  card: '카드',
  other: '기타',
};

const BillingPayment: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;
  const [billingForm] = Form.useForm();
  const [paymentForm] = Form.useForm();

  const [billings, setBillings] = useState<Billing[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [billClients, setBillClients] = useState<any[]>([]); // 선택 계약의 발주처(공동발주)
  const [isLoading, setIsLoading] = useState(false);
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('billing');

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, selectedCompanyId]);

  const loadData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;

      const [billingsResult, paymentsResult, contractsResult] = await Promise.all([
        window.electronAPI.billings.getAll(user.id, { company_id: companyId }),
        window.electronAPI.paymentReceipts.getAll(user.id, { company_id: companyId }),
        window.electronAPI.contracts.getAll(user.id, filters),
      ]);

      if (billingsResult.success) setBillings(billingsResult.data || []);
      if (paymentsResult.success) setPayments(paymentsResult.data || []);
      if (contractsResult.success) setContracts(contractsResult.contracts || []);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Billing CRUD ----
  const handleAddBilling = () => {
    setEditingBillingId(null);
    billingForm.resetFields();
    billingForm.setFieldsValue({
      billing_date: dayjs(),
      status: 'draft',
      billing_type: 'progress',
    });
    setBillingModalVisible(true);
  };

  const handleEditBilling = (record: Billing) => {
    setEditingBillingId(record.id);
    billingForm.setFieldsValue({
      ...record,
      billing_date: record.billing_date ? dayjs(record.billing_date) : null,
      due_date: record.due_date ? dayjs(record.due_date) : null,
    });
    setBillingModalVisible(true);
  };

  const handleDeleteBilling = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.billings.delete(user.id, id);
      if (result.success) {
        message.success('청구가 삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  const handleBillingSubmit = async (values: any) => {
    if (!user?.id) return;

    const billingAmt = values.billing_amount || 0;
    const vatAmt = values.vat_amount || Math.round(billingAmt * 0.1);

    const data = {
      ...values,
      billing_date: values.billing_date?.format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      vat_amount: vatAmt,
      total_amount: billingAmt + vatAmt,
      company_id: companyId,
    };

    try {
      let result;
      if (editingBillingId) {
        result = await window.electronAPI.billings.update(user.id, editingBillingId, data);
        if (result.success) message.success('청구가 수정되었습니다.');
      } else {
        result = await window.electronAPI.billings.create(user.id, data);
        if (result.success) message.success('청구가 등록되었습니다.');
      }

      if (result?.success) {
        setBillingModalVisible(false);
        billingForm.resetFields();
        loadData();
      } else {
        message.error(result?.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  // ---- Payment Receipt CRUD ----
  const handleAddPayment = () => {
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      payment_date: dayjs(),
      payment_method: 'transfer',
    });
    setPaymentModalVisible(true);
  };

  const handlePaymentSubmit = async (values: any) => {
    if (!user?.id) return;

    const data = {
      ...values,
      payment_date: values.payment_date?.format('YYYY-MM-DD'),
      company_id: companyId,
    };

    try {
      const result = await window.electronAPI.paymentReceipts.create(user.id, data);
      if (result.success) {
        message.success('입금이 등록되었습니다.');
        setPaymentModalVisible(false);
        paymentForm.resetFields();
        loadData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  // Filtering
  const filteredBillings = billings.filter((b) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      b.billing_number?.toLowerCase().includes(s) ||
      b.contract_number?.toLowerCase().includes(s) ||
      b.client_name?.toLowerCase().includes(s)
    );
  });

  const filteredPayments = payments.filter((p) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      p.billing_number?.toLowerCase().includes(s) ||
      p.payer_name?.toLowerCase().includes(s)
    );
  });

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      let exportColumns: { title: string; key: string }[];
      let exportData: any[];
      if (activeTab === 'billing') {
        exportColumns = [
          { title: '청구번호', key: 'billing_number' },
          { title: '계약', key: 'contract_number' },
          { title: '거래처', key: 'client_name' },
          { title: '유형', key: 'billing_type' },
          { title: '청구금액', key: 'billing_amount' },
          { title: 'VAT', key: 'vat_amount' },
          { title: '합계', key: 'total_amount' },
          { title: '청구일', key: 'billing_date' },
          { title: '만기일', key: 'due_date' },
          { title: '상태', key: 'status' },
        ];
        exportData = filteredBillings.map((d) => ({
          ...d,
          status: BILLING_STATUS_MAP[d.status]?.label || d.status,
          billing_type: BILLING_TYPE_MAP[d.billing_type] || d.billing_type,
        }));
      } else {
        exportColumns = [
          { title: '청구연결', key: 'billing_number' },
          { title: '금액', key: 'amount' },
          { title: '입금일', key: 'payment_date' },
          { title: '입금방법', key: 'payment_method' },
          { title: '입금자', key: 'payer_name' },
        ];
        exportData = filteredPayments.map((d) => ({
          ...d,
          payment_method: PAYMENT_METHOD_MAP[d.payment_method] || d.payment_method,
        }));
      }
      const sheetName = activeTab === 'billing' ? '청구관리' : '입금관리';
      const result = await window.electronAPI.export.financeGeneric(user.id, sheetName, exportColumns, exportData);
      if (result.success) {
        message.success('엑셀 파일이 저장되었습니다.');
      } else {
        message.error(result.error || '엑셀 저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '엑셀 저장 중 오류가 발생했습니다.');
    }
  };

  // Billing columns
  const billingColumns = [
    {
      title: '청구번호',
      dataIndex: 'billing_number',
      key: 'billing_number',
      width: 120,
    },
    {
      title: '계약',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 120,
    },
    {
      title: '거래처',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 140,
    },
    {
      title: '유형',
      dataIndex: 'billing_type',
      key: 'billing_type',
      width: 80,
      render: (v: string) => BILLING_TYPE_MAP[v] || v,
    },
    {
      title: '청구금액',
      dataIndex: 'billing_amount',
      key: 'billing_amount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: 'VAT',
      dataIndex: 'vat_amount',
      key: 'vat_amount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '합계',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600 }}>{(v || 0).toLocaleString()}원</span>
      ),
    },
    {
      title: '청구일',
      dataIndex: 'billing_date',
      key: 'billing_date',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '만기일',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const s = BILLING_STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_: any, record: Billing) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditBilling(record)} />
          <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDeleteBilling(record.id)} okText="삭제" cancelText="취소">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Payment columns
  const paymentColumns = [
    {
      title: '번호',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '청구연결',
      dataIndex: 'billing_number',
      key: 'billing_number',
      width: 120,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#3f8600' }}>{(v || 0).toLocaleString()}원</span>
      ),
    },
    {
      title: '입금일',
      dataIndex: 'payment_date',
      key: 'payment_date',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '입금방법',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 100,
      render: (v: string) => PAYMENT_METHOD_MAP[v] || v,
    },
    {
      title: '입금자',
      dataIndex: 'payer_name',
      key: 'payer_name',
      width: 120,
    },
  ];

  const tabItems = [
    {
      key: 'billing',
      label: '청구',
      children: (
        <>
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="검색 (청구번호, 계약, 거래처)"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBilling}>
              청구 등록
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
              엑셀 다운로드
            </Button>
          </Space>
          <ResizableTable
            columns={billingColumns}
            dataSource={filteredBillings}
            rowKey="id"
            loading={isLoading}
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
            scroll={{ x: 1400 }}
          />
        </>
      ),
    },
    {
      key: 'payment',
      label: '입금',
      children: (
        <>
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="검색 (청구번호, 입금자)"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPayment}>
              입금 등록
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
              엑셀 다운로드
            </Button>
          </Space>
          <ResizableTable
            columns={paymentColumns}
            dataSource={filteredPayments}
            rowKey="id"
            loading={isLoading}
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
            scroll={{ x: 800 }}
          />
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>청구/입금관리</Title>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      {/* Billing Modal */}
      <Modal
        title={editingBillingId ? '청구 수정' : '청구 등록'}
        open={billingModalVisible}
        onCancel={() => setBillingModalVisible(false)}
        onOk={() => billingForm.submit()}
        width={640}
        destroyOnClose
      >
        <Form form={billingForm} layout="vertical" onFinish={handleBillingSubmit}>
          <Form.Item name="contract_id" label="계약" rules={[{ required: true, message: '계약을 선택하세요' }]}>
            <Select
              placeholder="계약 선택"
              showSearch
              optionFilterProp="children"
              onChange={async (cid: string) => {
                billingForm.setFieldsValue({ contract_client_id: undefined });
                try {
                  const r: any = await window.electronAPI.contracts.getById(user!.id, cid);
                  setBillClients(r?.contract?.clients || []);
                } catch { setBillClients([]); }
              }}
            >
              {contracts.map((c: any) => (
                <Option key={c.id} value={c.id}>
                  {c.contract_number} - {c.service_name || c.client_company || ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          {billClients.length > 0 && (
            <Form.Item name="contract_client_id" label="발주처 (공동발주)" rules={[{ required: true, message: '청구할 발주처를 선택하세요' }]}>
              <Select placeholder="이 청구의 발주처 선택">
                {billClients.map((c: any) => (
                  <Option key={c.id} value={c.id}>
                    {c.client_company} (계약액 {(c.total_amount || 0).toLocaleString()}원)
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="billing_type" label="청구유형" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(BILLING_TYPE_MAP).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="상태" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(BILLING_STATUS_MAP).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="billing_amount" label="청구금액" rules={[{ required: true, message: '금액을 입력하세요' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  placeholder="0"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vat_amount" label="VAT">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  placeholder="자동계산 (10%)"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="billing_date" label="청구일" rules={[{ required: true, message: '청구일을 선택하세요' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="만기일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="비고">
            <TextArea rows={2} placeholder="비고" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        title="입금 등록"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={() => paymentForm.submit()}
        width={540}
        destroyOnClose
      >
        <Form form={paymentForm} layout="vertical" onFinish={handlePaymentSubmit}>
          <Form.Item name="billing_id" label="청구 연결" rules={[{ required: true, message: '청구를 선택하세요' }]}>
            <Select placeholder="청구 선택" showSearch optionFilterProp="children">
              {billings.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.billing_number} - {b.client_name || ''} ({(b.total_amount || 0).toLocaleString()}원)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="입금금액" rules={[{ required: true, message: '금액을 입력하세요' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  placeholder="0"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="입금일" rules={[{ required: true, message: '입금일을 선택하세요' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_method" label="입금방법" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(PAYMENT_METHOD_MAP).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payer_name" label="입금자">
                <Input placeholder="입금자명" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="비고">
            <TextArea rows={2} placeholder="비고" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BillingPayment;
