import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Space, Tag, Input, Select,
  DatePicker, message, Modal, Form, InputNumber, Popconfirm, Row, Col,
  Statistic, Switch, Table,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;

interface MonthlyDeposit {
  id: string;
  deposit_bank?: string;
  deposit_type?: string;          // cash | b2b
  tax_invoice_date?: string;
  payment_date?: string;
  client_name?: string;
  project_name?: string;
  amount: number;
  vat_included?: boolean;
  department?: string;
  notes?: string;
}

const BANK_OPTIONS = [
  '국민은행', '신한은행', '우리은행', '하나은행', 'SC제일은행',
  '기업은행', '농협은행', '카카오뱅크', '토스뱅크', '케이뱅크', '기타',
];

const DEPOSIT_TYPE_OPTIONS = [
  { value: 'cash', label: '현금' },
  { value: 'b2b', label: 'B2B' },
];

const DEPARTMENT_OPTIONS = ['건설', '개발', '학술', '인증', '기타'];

// 입금액(합계)에서 공급가액/부가세 분리. 부가세 포함이면 공급=round(합계/1.1), 부가세=합계-공급(합계와 항상 일치).
function splitVat(d: { amount?: number; vat_included?: boolean }) {
  const total = Number(d.amount) || 0;
  if (d.vat_included === false) return { supply: total, vat: 0, total };
  const supply = Math.round(total / 1.1);
  return { supply, vat: total - supply, total };
}

const MonthlyDepositList: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [deposits, setDeposits] = useState<MonthlyDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MonthlyDeposit | null>(null);
  const [searchText, setSearchText] = useState('');
  const [monthFilter, setMonthFilter] = useState<dayjs.Dayjs | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.monthlyDeposits.getAll(user!.id, { company_id: companyId });
      if (result.success) {
        setDeposits(result.data || []);
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

  const filteredDeposits = useMemo(() => {
    let list = [...deposits];
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter(
        (d) =>
          d.client_name?.toLowerCase().includes(lower) ||
          d.project_name?.toLowerCase().includes(lower) ||
          d.deposit_bank?.toLowerCase().includes(lower) ||
          d.notes?.toLowerCase().includes(lower)
      );
    }
    if (monthFilter) {
      const ym = monthFilter.format('YYYY-MM');
      list = list.filter((d) => (d.payment_date || '').startsWith(ym));
    }
    return list;
  }, [deposits, searchText, monthFilter]);

  const stats = useMemo(() => {
    let supply = 0, vat = 0, total = 0;
    for (const d of filteredDeposits) {
      const s = splitVat(d);
      supply += s.supply; vat += s.vat; total += s.total;
    }
    return { count: filteredDeposits.length, supply, vat, total };
  }, [filteredDeposits]);

  const handleOpenModal = (record?: MonthlyDeposit) => {
    setEditingRecord(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        tax_invoice_date: record.tax_invoice_date ? dayjs(record.tax_invoice_date) : undefined,
        payment_date: record.payment_date ? dayjs(record.payment_date) : undefined,
      });
    } else {
      form.setFieldsValue({ payment_date: dayjs(), vat_included: true });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!companyId) return;
    const payload = {
      ...values,
      company_id: companyId,
      tax_invoice_date: values.tax_invoice_date?.format('YYYY-MM-DD') || null,
      payment_date: values.payment_date?.format('YYYY-MM-DD') || null,
    };

    try {
      const result = editingRecord
        ? await window.electronAPI.monthlyDeposits.update(user!.id, editingRecord.id, payload)
        : await window.electronAPI.monthlyDeposits.create(user!.id, payload);

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
      const result = await window.electronAPI.monthlyDeposits.delete(user!.id, id);
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

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      const exportColumns = [
        { title: '입금은행', key: 'deposit_bank' },
        { title: '입금구분', key: 'deposit_type_label' },
        { title: '세금계산서발행일', key: 'tax_invoice_date' },
        { title: '입금일', key: 'payment_date' },
        { title: '거래업체', key: 'client_name' },
        { title: '건명', key: 'project_name' },
        { title: '공급가액', key: 'supply_amount' },
        { title: '부가세', key: 'vat_amount' },
        { title: '합계(입금액)', key: 'amount' },
        { title: '부가세구분', key: 'vat_label' },
        { title: '사업부', key: 'department' },
        { title: '참고사항', key: 'notes' },
      ];
      const exportData = filteredDeposits.map((d) => {
        const s = splitVat(d);
        return {
          ...d,
          supply_amount: s.supply,
          vat_amount: s.vat,
          deposit_type_label: DEPOSIT_TYPE_OPTIONS.find((o) => o.value === d.deposit_type)?.label || '',
          vat_label: d.vat_included ? '포함' : '별도',
        };
      });
      const result = await window.electronAPI.export.financeGeneric(user.id, '월별입금현황', exportColumns, exportData);
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
    { title: '입금은행', dataIndex: 'deposit_bank', key: 'deposit_bank', width: 100, render: (v: string) => v || '-' },
    {
      title: '입금구분', dataIndex: 'deposit_type', key: 'deposit_type', width: 90,
      render: (v: string) => {
        const label = DEPOSIT_TYPE_OPTIONS.find((o) => o.value === v)?.label;
        return label ? <Tag color={v === 'cash' ? 'green' : 'blue'}>{label}</Tag> : '-';
      },
    },
    {
      title: '세금계산서발행일', dataIndex: 'tax_invoice_date', key: 'tax_invoice_date', width: 130,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '입금일', dataIndex: 'payment_date', key: 'payment_date', width: 110,
      sorter: (a: MonthlyDeposit, b: MonthlyDeposit) => (a.payment_date || '').localeCompare(b.payment_date || ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    { title: '거래업체', dataIndex: 'client_name', key: 'client_name', width: 140, ellipsis: true, render: (v: string) => v || '-' },
    { title: '건명', dataIndex: 'project_name', key: 'project_name', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '공급가액', key: 'supply', width: 120, align: 'right' as const,
      render: (_: any, r: MonthlyDeposit) => `${splitVat(r).supply.toLocaleString()}원`,
    },
    {
      title: '부가세', key: 'vat', width: 110, align: 'right' as const,
      render: (_: any, r: MonthlyDeposit) => `${splitVat(r).vat.toLocaleString()}원`,
    },
    {
      title: '합계(입금액)', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const,
      render: (v: number, r: MonthlyDeposit) => (
        <span>
          <b>{(v || 0).toLocaleString()}원</b>
          <Tag style={{ marginLeft: 4 }} color={r.vat_included ? 'orange' : 'default'}>
            {r.vat_included ? 'VAT포함' : '별도'}
          </Tag>
        </span>
      ),
    },
    { title: '사업부', dataIndex: 'department', key: 'department', width: 80, render: (v: string) => v || '-' },
    { title: '참고사항', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '작업', key: 'action', width: 90,
      render: (_: any, record: MonthlyDeposit) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
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
          <Title level={4} style={{ margin: 0 }}>월별입금현황</Title>
          <span style={{ color: '#888' }}>월별 입금 내역을 등록하고 합계를 확인합니다.</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          입금 등록
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title={monthFilter ? `${monthFilter.format('YYYY-MM')} 건수` : '전체 건수'} value={stats.count} suffix="건" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="공급가액 합계" value={stats.supply} suffix="원" valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="부가세 합계" value={stats.vat} suffix="원" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="입금 합계" value={stats.total} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="거래업체, 건명, 은행 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <DatePicker.MonthPicker
            placeholder="월 선택 (입금일 기준)"
            value={monthFilter}
            onChange={setMonthFilter}
            style={{ width: 180 }}
          />
          <Button onClick={() => { setSearchText(''); setMonthFilter(null); }}>초기화</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>엑셀 다운로드</Button>
        </Space>
      </Card>

      <Card>
        <ResizableTable
          columns={columns}
          dataSource={filteredDeposits}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
          scroll={{ x: 1550 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6}>
                  <b>합계</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <b>{stats.supply.toLocaleString()}원</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <b>{stats.vat.toLocaleString()}원</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <b style={{ color: '#1890ff' }}>{stats.total.toLocaleString()}원</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} colSpan={3} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        title={editingRecord ? '월별입금 수정' : '입금 등록'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="deposit_bank" label="입금은행">
                <Select placeholder="입금은행" allowClear showSearch>
                  {BANK_OPTIONS.map((b) => (<Option key={b} value={b}>{b}</Option>))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deposit_type" label="입금구분">
                <Select placeholder="현금 / B2B" allowClear>
                  {DEPOSIT_TYPE_OPTIONS.map((o) => (<Option key={o.value} value={o.value}>{o.label}</Option>))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tax_invoice_date" label="세금계산서 발행일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="입금일" rules={[{ required: true, message: '입금일을 선택해주세요.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client_name" label="거래업체" rules={[{ required: true, message: '거래업체를 입력해주세요.' }]}>
                <Input placeholder="거래업체명" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="project_name" label="건명">
                <Input placeholder="건명(용역명 등)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="입금액" rules={[{ required: true, message: '입금액을 입력해주세요.' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="vat_included" label="부가세" valuePropName="checked">
                <Switch checkedChildren="포함" unCheckedChildren="별도" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="department" label="관련 사업부">
                <Select placeholder="사업부" allowClear>
                  {DEPARTMENT_OPTIONS.map((d) => (<Option key={d} value={d}>{d}</Option>))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="별도 참고사항">
            <Input.TextArea rows={2} placeholder="업체오류입금·은행간 이체 등 특이사항 (선택)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">{editingRecord ? '수정' : '등록'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MonthlyDepositList;
