import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Table, Button, Space, Tag, Input, Select, Modal,
  Form, InputNumber, DatePicker, Row, Col, Statistic, message, Popconfirm
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  SyncOutlined, DollarOutlined, WarningOutlined, ClockCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Payable {
  id: string;
  outsourcing_id?: string;
  contract_id?: string;
  contract_number?: string;
  vendor_name?: string;
  description: string;
  principal_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  outstanding: { color: 'orange', label: '미지급' },
  partial: { color: 'blue', label: '부분지급' },
  paid: { color: 'green', label: '완납' },
  overdue: { color: 'red', label: '연체' },
};

const PayableList: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;
  const [form] = Form.useForm();

  const [payables, setPayables] = useState<Payable[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

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

      const [payResult, contractsResult] = await Promise.all([
        window.electronAPI.payables.getAll(user.id, { company_id: companyId }),
        window.electronAPI.contracts.getAll(user.id, filters),
      ]);

      if (payResult.success) setPayables(payResult.data || []);
      if (contractsResult.success) setContracts(contractsResult.contracts || []);
    } catch (err) {
      console.error('Failed to load payables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Stats
  const totalOutstanding = payables.reduce((sum, p) => sum + (p.outstanding_amount || 0), 0);
  const overdueAmount = payables
    .filter((p) => p.status === 'overdue')
    .reduce((sum, p) => sum + (p.outstanding_amount || 0), 0);
  const thisMonthDue = payables
    .filter((p) => {
      if (!p.due_date) return false;
      const due = dayjs(p.due_date);
      return due.month() === dayjs().month() && due.year() === dayjs().year();
    })
    .reduce((sum, p) => sum + (p.outstanding_amount || 0), 0);

  const filteredData = payables.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        p.contract_number?.toLowerCase().includes(s) ||
        p.vendor_name?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      issue_date: dayjs(),
      status: 'outstanding',
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Payable) => {
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
      const result = await window.electronAPI.payables.delete(user.id, id);
      if (result.success) {
        message.success('미지급금이 삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;

    const principalAmt = values.principal_amount || 0;
    const paidAmt = values.paid_amount || 0;

    const data = {
      ...values,
      issue_date: values.issue_date?.format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      outstanding_amount: principalAmt - paidAmt,
      company_id: companyId,
    };

    try {
      let result;
      if (editingId) {
        result = await window.electronAPI.payables.update(user.id, editingId, data);
        if (result.success) message.success('미지급금이 수정되었습니다.');
      } else {
        result = await window.electronAPI.payables.create(user.id, data);
        if (result.success) message.success('미지급금이 등록되었습니다.');
      }

      if (result?.success) {
        setModalVisible(false);
        form.resetFields();
        loadData();
      } else {
        message.error(result?.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  const handleSync = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.payables.syncFromOutsourcings(user.id, companyId);
      if (result.success) {
        message.success('외주 동기화가 완료되었습니다.');
        loadData();
      } else {
        message.error(result.error || '동기화에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '동기화 중 오류가 발생했습니다.');
    }
  };

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      const exportColumns = [
        { title: '외주/계약', key: 'contract_number' },
        { title: '거래처', key: 'vendor_name' },
        { title: '설명', key: 'description' },
        { title: '원금', key: 'principal_amount' },
        { title: '지급액', key: 'paid_amount' },
        { title: '잔액', key: 'outstanding_amount' },
        { title: '발행일', key: 'issue_date' },
        { title: '만기일', key: 'due_date' },
        { title: '상태', key: 'status' },
      ];
      const exportData = filteredData.map((d) => ({
        ...d,
        status: STATUS_MAP[d.status]?.label || d.status,
      }));
      const result = await window.electronAPI.export.financeGeneric(user.id, '미지급금관리', exportColumns, exportData);
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
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '외주/계약',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 120,
    },
    {
      title: '거래처',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 140,
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '원금',
      dataIndex: 'principal_amount',
      key: 'principal_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '지급액',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '잔액',
      dataIndex: 'outstanding_amount',
      key: 'outstanding_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>
          {(v || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '발행일',
      dataIndex: 'issue_date',
      key: 'issue_date',
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
        const s = STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_: any, record: Payable) => (
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
      <Title level={3}>미지급금관리</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 미지급금"
              value={totalOutstanding}
              prefix={<DollarOutlined />}
              suffix="원"
              valueStyle={{ color: '#cf1322' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="연체금액"
              value={overdueAmount}
              prefix={<WarningOutlined />}
              suffix="원"
              valueStyle={{ color: '#fa541c' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="이번달 만기"
              value={thisMonthDue}
              prefix={<ClockCircleOutlined />}
              suffix="원"
              valueStyle={{ color: '#faad14' }}
              formatter={(value) => Number(value).toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="검색 (계약번호, 거래처, 설명)"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="상태 필터"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
            allowClear
          >
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <Option key={key} value={key}>{val.label}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            미지급금 등록
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleSync}>
            외주 동기화
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
            엑셀 다운로드
          </Button>
        </Space>

        <ResizableTable
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editingId ? '미지급금 수정' : '미지급금 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="contract_id" label="계약">
            <Select placeholder="계약 선택 (선택사항)" showSearch optionFilterProp="children" allowClear>
              {contracts.map((c: any) => (
                <Option key={c.id} value={c.id}>
                  {c.contract_number} - {c.service_name || c.client_company || ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor_name" label="거래처">
                <Input placeholder="거래처명" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="상태" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="미지급금 설명" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="principal_amount" label="원금" rules={[{ required: true, message: '금액을 입력하세요' }]}>
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
              <Form.Item name="paid_amount" label="지급액" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  placeholder="0"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issue_date" label="발행일" rules={[{ required: true, message: '발행일을 선택하세요' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="만기일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default PayableList;
