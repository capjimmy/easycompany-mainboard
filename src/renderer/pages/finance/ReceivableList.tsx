import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Table, Button, Space, Tag, Input, Modal,
  Form, InputNumber, DatePicker, Row, Col, Statistic, message, Popconfirm, Tabs
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  DollarOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { TextArea } = Input;

interface ManualReceivable {
  id: string;
  description: string;
  amount: number;
  received_amount?: number;
  outstanding_amount?: number;
  issue_date?: string;
  due_date?: string;
  client_company_name?: string;
  notes?: string;
}

interface AutoReceivable {
  id: string;
  contract_number?: string;
  client_company?: string;
  service_name?: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  contract_end_date?: string;
}

const ReceivableList: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;
  const [form] = Form.useForm();

  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');
  const [autoList, setAutoList] = useState<AutoReceivable[]>([]);
  const [manualList, setManualList] = useState<ManualReceivable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, selectedCompanyId]);

  const loadData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;

      const [contractsResult, recResult] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, filters),
        window.electronAPI.receivables.getAll(user.id, filters),
      ]);

      if (contractsResult.success) {
        const inactiveStatuses = ['cancelled'];
        const auto: AutoReceivable[] = (contractsResult.contracts || [])
          .filter((c: any) => !inactiveStatuses.includes(c.progress))
          .map((c: any) => {
            const total = Number(c.total_amount || 0);
            const paid = Number(c.received_amount || c.paid_amount || 0);
            return {
              id: c.id,
              contract_number: c.contract_number,
              client_company: c.client_company,
              service_name: c.service_name,
              total_amount: total,
              paid_amount: paid,
              outstanding: total - paid,
              contract_end_date: c.contract_end_date,
            };
          })
          .filter((r: AutoReceivable) => r.outstanding > 0);
        setAutoList(auto);
      }
      if (recResult.success) {
        const items: ManualReceivable[] = (recResult.receivables || []).map((r: any) => ({
          id: r.id,
          description: r.description || '',
          amount: Number(r.original_amount || r.amount || 0),
          received_amount: Number(r.received_amount || 0),
          outstanding_amount: Number(r.outstanding_amount ?? (r.original_amount || 0) - (r.received_amount || 0)),
          issue_date: r.issue_date,
          due_date: r.due_date,
          client_company_name: r.client_company_name,
          notes: r.notes,
        }));
        setManualList(items);
      }
    } catch (err) {
      console.error('Failed to load receivables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAuto = autoList.filter((r) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      r.contract_number?.toLowerCase().includes(s) ||
      r.client_company?.toLowerCase().includes(s) ||
      r.service_name?.toLowerCase().includes(s)
    );
  });

  const filteredManual = manualList.filter((r) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      r.description?.toLowerCase().includes(s) ||
      r.client_company_name?.toLowerCase().includes(s)
    );
  });

  const totalAuto = autoList.reduce((sum, r) => sum + r.outstanding, 0);
  const totalManual = manualList.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ issue_date: dayjs(), received_amount: 0 });
    setModalVisible(true);
  };

  const handleEdit = (record: ManualReceivable) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      issue_date: record.issue_date ? dayjs(record.issue_date) : null,
      due_date: record.due_date ? dayjs(record.due_date) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.receivables.delete(user.id, id);
      if (result.success) {
        message.success('삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '오류 발생');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    const originalAmt = Number(values.amount || 0);
    const receivedAmt = Number(values.received_amount || 0);
    const data = {
      description: values.description,
      original_amount: originalAmt,
      received_amount: receivedAmt,
      outstanding_amount: originalAmt - receivedAmt,
      issue_date: values.issue_date?.format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      client_company_name: values.client_company_name || '',
      notes: values.notes || '',
      status: receivedAmt >= originalAmt ? 'paid' : 'outstanding',
      company_id: companyId,
    };
    try {
      const result = editingId
        ? await window.electronAPI.receivables.update(user.id, editingId, data)
        : await window.electronAPI.receivables.create(user.id, data);
      if (result?.success) {
        message.success(editingId ? '수정되었습니다.' : '등록되었습니다.');
        setModalVisible(false);
        form.resetFields();
        loadData();
      } else {
        message.error(result?.error || '저장 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '오류 발생');
    }
  };

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      let columns: any[];
      let data: any[];
      let title: string;
      if (activeTab === 'auto') {
        title = '미수금관리(자동)';
        columns = [
          { title: '계약번호', key: 'contract_number' },
          { title: '거래처', key: 'client_company' },
          { title: '용역명', key: 'service_name' },
          { title: '계약금액', key: 'total_amount' },
          { title: '입금합계', key: 'paid_amount' },
          { title: '미수잔액', key: 'outstanding' },
          { title: '계약종료일', key: 'contract_end_date' },
        ];
        data = filteredAuto;
      } else {
        title = '미수금관리(수동)';
        columns = [
          { title: '거래처', key: 'client_company_name' },
          { title: '내용', key: 'description' },
          { title: '금액', key: 'amount' },
          { title: '수금액', key: 'received_amount' },
          { title: '미수잔액', key: 'outstanding_amount' },
          { title: '발행일', key: 'issue_date' },
          { title: '만기일', key: 'due_date' },
        ];
        data = filteredManual;
      }
      const result = await window.electronAPI.export.financeGeneric(user.id, title, columns, data);
      if (result.success) message.success('엑셀 저장 완료');
      else message.error(result.error || '엑셀 저장 실패');
    } catch (err: any) {
      message.error(err?.message || '엑셀 저장 오류');
    }
  };

  const autoColumns = [
    { title: '계약번호', dataIndex: 'contract_number', key: 'contract_number', width: 130 },
    { title: '거래처', dataIndex: 'client_company', key: 'client_company', width: 160 },
    { title: '용역명', dataIndex: 'service_name', key: 'service_name', ellipsis: true },
    {
      title: '계약금액', dataIndex: 'total_amount', key: 'total_amount', width: 140, align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '입금합계', dataIndex: 'paid_amount', key: 'paid_amount', width: 140, align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '미수잔액', dataIndex: 'outstanding', key: 'outstanding', width: 140, align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: '#cf1322', fontWeight: 600 }}>{(v || 0).toLocaleString()}원</span>
      ),
    },
    {
      title: '계약종료일', dataIndex: 'contract_end_date', key: 'contract_end_date', width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    { title: '구분', key: 'type', width: 80, render: () => <Tag color="blue">자동</Tag> },
  ];

  const manualColumns = [
    { title: '거래처', dataIndex: 'client_company_name', key: 'client_company_name', width: 160 },
    { title: '내용', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '금액', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '수금액', dataIndex: 'received_amount', key: 'received_amount', width: 140, align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '미수잔액', dataIndex: 'outstanding_amount', key: 'outstanding_amount', width: 140, align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>
          {(v || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '발행일', dataIndex: 'issue_date', key: 'issue_date', width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '만기일', dataIndex: 'due_date', key: 'due_date', width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    { title: '구분', key: 'type', width: 80, render: () => <Tag color="orange">수동</Tag> },
    {
      title: '작업', key: 'action', width: 100,
      render: (_: any, record: ManualReceivable) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)} okText="삭제" cancelText="취소">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>미수금관리</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="자동 미수금 (계약 기반)"
              value={totalAuto}
              prefix={<DollarOutlined />}
              suffix="원"
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="수동 미수금 (직접 입력)"
              value={totalManual}
              prefix={<DollarOutlined />}
              suffix="원"
              valueStyle={{ color: '#fa8c16' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 미수금"
              value={totalAuto + totalManual}
              prefix={<DollarOutlined />}
              suffix="원"
              valueStyle={{ color: '#cf1322' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          {activeTab === 'manual' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              수동 미수금 등록
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
            엑셀 다운로드
          </Button>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'auto' | 'manual')}
          items={[
            {
              key: 'auto',
              label: `자동 미수금 (${autoList.length})`,
              children: (
                <ResizableTable
                  columns={autoColumns}
                  dataSource={filteredAuto}
                  rowKey="id"
                  loading={isLoading}
                  size="middle"
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
                  scroll={{ x: 1200 }}
                />
              ),
            },
            {
              key: 'manual',
              label: `수동 미수금 (${manualList.length})`,
              children: (
                <ResizableTable
                  columns={manualColumns}
                  dataSource={filteredManual}
                  rowKey="id"
                  loading={isLoading}
                  size="middle"
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
                  scroll={{ x: 1200 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingId ? '수동 미수금 수정' : '수동 미수금 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="client_company_name" label="거래처">
            <Input placeholder="거래처명" />
          </Form.Item>
          <Form.Item name="description" label="내용" rules={[{ required: true, message: '내용을 입력하세요' }]}>
            <TextArea rows={2} placeholder="미수금 내용" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="금액" rules={[{ required: true, message: '금액을 입력하세요' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="received_amount" label="수금액" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issue_date" label="발행일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="만기일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="비고">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReceivableList;
