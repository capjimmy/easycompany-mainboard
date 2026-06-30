import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select,
  DatePicker, message, Modal, Form, InputNumber, Popconfirm, Row, Col, Statistic,
  Switch, AutoComplete,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined, MinusCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

interface ExpenseItem {
  id?: string;
  description: string;
  amount: number;
  vat_included?: boolean;  // true: 부가세 포함, false: 부가세 별도(또는 면세)
  vat_amount?: number;
  supply_amount?: number;
  expense_date: string;
  category_name: string;
  vendor_name?: string;             // 사용처
  summary?: string;                 // 적요
  vendor_business_number?: string;  // 사용처 사업자등록번호
  payment_method?: string;          // 결제수단
  card_number?: string;             // 법인카드 카드번호
  settle_status?: string;           // 개인카드 지급여부(paid/unpaid)
  department?: string;              // 경비사용 사업부
}

interface Expense {
  id: string;
  expense_number: string;
  user_id: string;
  user_name?: string;
  title: string;
  total_amount: number;
  settlement_date: string;
  status: ExpenseStatus;
  items?: ExpenseItem[];
  note?: string;
}

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string }> = {
  draft: { label: '작성', color: 'default' },
  submitted: { label: '제출', color: 'blue' },
  approved: { label: '승인', color: 'success' },
  rejected: { label: '반려', color: 'error' },
  paid: { label: '지급완료', color: 'purple' },
};

const CATEGORY_OPTIONS = [
  '교통비', '식비', '숙박비', '소모품비', '통신비', '회의비', '접대비', '교육비',
  '택배비', '제본비',
  '지급수수료', 'ADT월정료', '공기청정기렌탈료', '정수기렌탈료', '법인차량렌트료',
  '커피머신렌탈료', '관리비', '관리비_1319호', '복사기임대료', '급여',
  '기타',
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'corporate_card', label: '법인카드' },
  { value: 'auto_debit', label: '자동이체' },
  { value: 'account_transfer', label: '계좌이체' },
  { value: 'withdrawal', label: '인출' },
  { value: 'personal_card', label: '개인카드' },
];

const SETTLE_STATUS_OPTIONS = [
  { value: 'unpaid', label: '미지급' },
  { value: 'paid', label: '지급' },
];

const DEPARTMENT_OPTIONS = [
  '건설사업부', '개발사업부', '학술사업부', '인증사업부', '경영관리실',
  '임철희', '유환태', '외주용역', '기타',
];

const ExpenseSettlement: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Expense | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [monthFilter, setMonthFilter] = useState<dayjs.Dayjs | null>(null);
  const [clients, setClients] = useState<{ value: string; label: string; business_number?: string }[]>([]);
  const [form] = Form.useForm();

  const isManager = user?.role === 'super_admin' || user?.role === 'company_admin' || user?.role === 'department_manager';

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.expenses.getAll(user!.id, { company_id: companyId });
      if (result.success) {
        setExpenses(result.data || []);
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

  // 거래처 목록 로드 (사용처 자동완성 → 사업자등록번호 자동 입력)
  useEffect(() => {
    const loadClients = async () => {
      if (!user?.id) return;
      try {
        const res = await window.electronAPI.clients.getAll(user.id);
        if (res.success && res.clients) {
          setClients(res.clients.map((c: any) => ({
            value: c.name,
            label: c.business_number ? `${c.name} (${c.business_number})` : c.name,
            business_number: c.business_number || '',
          })));
        }
      } catch { /* ignore */ }
    };
    loadClients();
  }, [user?.id]);

  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter(
        (e) =>
          e.expense_number?.toLowerCase().includes(lower) ||
          e.title?.toLowerCase().includes(lower) ||
          e.user_name?.toLowerCase().includes(lower)
      );
    }
    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }
    if (categoryFilter) {
      list = list.filter((e) =>
        (e.items || []).some((it: any) => (it.category_name || it.category) === categoryFilter)
      );
    }
    if (monthFilter) {
      const ym = monthFilter.format('YYYY-MM');
      list = list.filter((e) => (e.settlement_date || '').startsWith(ym));
    }
    return list;
  }, [expenses, searchText, statusFilter, categoryFilter, monthFilter]);

  // 카테고리별 월 합계 (택배비/제본비 강조)
  const categoryMonthlyStats = useMemo(() => {
    const ym = (monthFilter || dayjs()).format('YYYY-MM');
    const monthList = expenses.filter((e) => (e.settlement_date || '').startsWith(ym));
    const sums: Record<string, number> = {};
    monthList.forEach((e) => {
      (e.items || []).forEach((it: any) => {
        const cat = it.category_name || it.category || '기타';
        sums[cat] = (sums[cat] || 0) + (it.amount || 0);
      });
    });
    return { ym, sums };
  }, [expenses, monthFilter]);

  const stats = useMemo(() => {
    let supply = 0;
    let vat = 0;
    let totalApproved = 0;
    for (const e of expenses) {
      if (e.status !== 'approved' && e.status !== 'paid') continue;
      totalApproved += e.total_amount || 0;
      for (const it of (e.items || []) as any[]) {
        const amt = Number(it.amount) || 0;
        if (it.vat_included) {
          const s = Math.round(amt / 1.1);
          supply += s;
          vat += amt - s;
        } else {
          supply += amt;
        }
      }
    }
    return {
      total: expenses.length,
      pending: expenses.filter((e) => e.status === 'submitted').length,
      approved_amount: totalApproved,
      supply_amount: supply,
      vat_amount: vat,
    };
  }, [expenses]);

  const handleOpenModal = async (record?: Expense) => {
    setEditingRecord(record || null);
    form.resetFields();
    if (record) {
      let items = record.items || [];
      if (!items.length) {
        try {
          const res = await window.electronAPI.expenses.getItems(user!.id, record.id);
          if (res.success) items = res.data || [];
        } catch { /* ignore */ }
      }
      form.setFieldsValue({
        title: record.title,
        settlement_date: record.settlement_date ? dayjs(record.settlement_date) : undefined,
        note: record.note,
        items: items.map((it) => ({
          ...it,
          expense_date: it.expense_date ? dayjs(it.expense_date) : undefined,
        })),
      });
    } else {
      form.setFieldsValue({
        settlement_date: dayjs(),
        items: [{ description: '', amount: 0, expense_date: dayjs(), category_name: '기타' }],
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!companyId || !user?.id) return;
    const items = (values.items || []).map((it: any) => {
      const amount = Number(it.amount) || 0;
      const vatIncluded = !!it.vat_included;
      // 부가세 포함: 공급가액 = 금액÷1.1, 부가세 = 금액 - 공급가액
      // 부가세 별도(또는 면세): 공급가액 = 금액, 부가세 = 0
      const supply = vatIncluded ? Math.round(amount / 1.1) : amount;
      const vat = vatIncluded ? amount - supply : 0;
      return {
        description: it.description,
        amount,
        supply_amount: supply,
        vat_amount: vat,
        vat_included: vatIncluded,
        expense_date: it.expense_date?.format('YYYY-MM-DD'),
        category_name: it.category_name,
        vendor_name: it.vendor_name || null,
        summary: it.summary || null,
        vendor_business_number: it.vendor_business_number || null,
        payment_method: it.payment_method || null,
        card_number: it.payment_method === 'corporate_card' ? (it.card_number || null) : null,
        settle_status: it.payment_method === 'personal_card' ? (it.settle_status || null) : null,
        department: it.department || null,
      };
    });
    const totalAmount = items.reduce((s: number, it: any) => s + (it.amount || 0), 0);

    const payload = {
      company_id: companyId,
      user_id: user.id,
      title: values.title,
      total_amount: totalAmount,
      settlement_date: values.settlement_date?.format('YYYY-MM-DD'),
      note: values.note,
      items,
    };

    try {
      const result = editingRecord
        ? await window.electronAPI.expenses.update(user!.id, editingRecord.id, payload)
        : await window.electronAPI.expenses.create(user!.id, payload);

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
      const result = await window.electronAPI.expenses.delete(user!.id, id);
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

  const handleApprove = async (id: string) => {
    try {
      const result = await window.electronAPI.expenses.approve(user!.id, id);
      if (result.success) {
        message.success('승인되었습니다.');
        fetchData();
      } else {
        message.error(result.error || '승인에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '승인 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const result = await window.electronAPI.expenses.reject(user!.id, id);
      if (result.success) {
        message.success('반려되었습니다.');
        fetchData();
      } else {
        message.error(result.error || '반려에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '반려 중 오류가 발생했습니다.');
    }
  };

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      const exportColumns = [
        { title: '번호', key: 'expense_number' },
        { title: '신청자', key: 'user_name' },
        { title: '계정과목', key: 'title' },
        { title: '카테고리', key: 'categories' },
        { title: '총금액', key: 'total_amount' },
        { title: '사용년월일', key: 'settlement_date' },
        { title: '상태', key: 'status' },
      ];
      const exportData = filteredExpenses.map((d) => ({
        ...d,
        categories: Array.from(new Set((d.items || []).map((it: any) => it.category_name || it.category).filter(Boolean))).join(', '),
        status: STATUS_CONFIG[d.status]?.label || d.status,
      }));
      const result = await window.electronAPI.export.financeGeneric(user.id, '경비내역', exportColumns, exportData);
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
      dataIndex: 'expense_number',
      key: 'expense_number',
      width: 130,
    },
    {
      title: '신청자',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '계정과목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '총금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '사용년월일',
      dataIndex: 'settlement_date',
      key: 'settlement_date',
      width: 120,
      sorter: (a: Expense, b: Expense) =>
        (a.settlement_date || '').localeCompare(b.settlement_date || ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: ExpenseStatus) => (
        <Tag color={STATUS_CONFIG[v]?.color}>{STATUS_CONFIG[v]?.label || v}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      width: 160,
      render: (_: any, record: Expense) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {isManager && record.status === 'submitted' && (
            <>
              <Popconfirm title="승인하시겠습니까?" onConfirm={() => handleApprove(record.id)} okText="승인" cancelText="취소">
                <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />} />
              </Popconfirm>
              <Popconfirm title="반려하시겠습니까?" onConfirm={() => handleReject(record.id)} okText="반려" cancelText="취소">
                <Button type="link" size="small" danger icon={<CloseOutlined />} />
              </Popconfirm>
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
          <Title level={4} style={{ margin: 0 }}>경비내역</Title>
          <span style={{ color: '#888' }}>경비를 입력하고 내역을 관리합니다.</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          경비 입력
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card><Statistic title="총 신청 건수" value={stats.total} suffix="건" /></Card>
        </Col>
        <Col span={5}>
          <Card><Statistic title="승인 대기" value={stats.pending} suffix="건" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={5}>
          <Card><Statistic title="공급가액 (승인분)" value={stats.supply_amount} suffix="원" valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="부가세 (승인분)" value={stats.vat_amount} suffix="원" valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col span={5}>
          <Card><Statistic title="승인/지급 합계" value={stats.approved_amount} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap split={<span style={{ color: '#ddd' }}>|</span>}>
          <Text strong>{categoryMonthlyStats.ym} 카테고리별 합계</Text>
          <Text>택배비: <Text strong style={{ color: '#1890ff' }}>{(categoryMonthlyStats.sums['택배비'] || 0).toLocaleString()}원</Text></Text>
          <Text>제본비: <Text strong style={{ color: '#1890ff' }}>{(categoryMonthlyStats.sums['제본비'] || 0).toLocaleString()}원</Text></Text>
          {Object.entries(categoryMonthlyStats.sums)
            .filter(([k]) => k !== '택배비' && k !== '제본비')
            .map(([k, v]) => (
              <Text key={k}>{k}: <Text strong>{v.toLocaleString()}원</Text></Text>
            ))}
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="번호, 계정과목, 신청자 검색"
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
          <Select
            placeholder="카테고리"
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
            style={{ width: 140 }}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <Option key={c} value={c}>{c}</Option>
            ))}
          </Select>
          <DatePicker.MonthPicker
            placeholder="월 선택"
            value={monthFilter}
            onChange={setMonthFilter}
            style={{ width: 140 }}
          />
          <Button onClick={() => { setSearchText(''); setStatusFilter(undefined); setCategoryFilter(undefined); setMonthFilter(null); }}>초기화</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
            엑셀 다운로드
          </Button>
        </Space>
      </Card>

      <Card>
        <ResizableTable
          columns={columns}
          dataSource={filteredExpenses}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        title={editingRecord ? '경비내역 수정' : '경비 입력'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="계정과목" rules={[{ required: true, message: '계정과목을 입력해주세요.' }]}>
                <Input placeholder="계정과목" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="settlement_date" label="사용년월일" rules={[{ required: true, message: '사용년월일을 선택해주세요.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>경비 항목 (부가세 포함 여부 체크 시 자동 분리)</Text>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, marginBottom: 12, position: 'relative', background: '#fafafa' }}>
                    {fields.length > 1 && (
                      <MinusCircleOutlined
                        style={{ color: '#ff4d4f', cursor: 'pointer', position: 'absolute', top: 10, right: 10, fontSize: 16 }}
                        onClick={() => remove(name)}
                      />
                    )}
                    <Row gutter={8}>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'expense_date']} label="지출일" style={{ marginBottom: 8 }}>
                          <DatePicker style={{ width: '100%' }} placeholder="지출일" />
                        </Form.Item>
                      </Col>
                      <Col span={7}>
                        <Form.Item {...restField} name={[name, 'vendor_name']} label="사용처" style={{ marginBottom: 8 }}>
                          <AutoComplete
                            options={clients}
                            placeholder="사용처(거래처/상호)"
                            filterOption={(input, option) =>
                              (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            onSelect={(_val, option: any) => {
                              if (option?.business_number) {
                                form.setFieldValue(['items', name, 'vendor_business_number'], option.business_number);
                              }
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'vendor_business_number']} label="사업자등록번호" style={{ marginBottom: 8 }}>
                          <Input placeholder="000-00-00000" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'department']} label="사용 사업부" style={{ marginBottom: 8 }}>
                          <Select placeholder="사업부" allowClear>
                            {DEPARTMENT_OPTIONS.map((d) => (<Option key={d} value={d}>{d}</Option>))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item {...restField} name={[name, 'description']} label="내용" rules={[{ required: true, message: '내용 필수' }]} style={{ marginBottom: 8 }}>
                          <Input placeholder="내용" />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item {...restField} name={[name, 'summary']} label="적요" style={{ marginBottom: 8 }}>
                          <Input placeholder="적요(상세 설명)" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'category_name']} label="분류" style={{ marginBottom: 8 }}>
                          <Select placeholder="분류">
                            {CATEGORY_OPTIONS.map((c) => (<Option key={c} value={c}>{c}</Option>))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={8} align="bottom">
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'payment_method']} label="결제수단" style={{ marginBottom: 0 }}>
                          <Select placeholder="결제수단" allowClear>
                            {PAYMENT_METHOD_OPTIONS.map((p) => (<Option key={p.value} value={p.value}>{p.label}</Option>))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.items?.[name]?.payment_method !== cur.items?.[name]?.payment_method}>
                          {() => {
                            const pm = form.getFieldValue(['items', name, 'payment_method']);
                            if (pm === 'corporate_card') {
                              return (
                                <Form.Item {...restField} name={[name, 'card_number']} label="카드번호" style={{ marginBottom: 0 }}>
                                  <Input placeholder="법인카드 번호" />
                                </Form.Item>
                              );
                            }
                            if (pm === 'personal_card') {
                              return (
                                <Form.Item {...restField} name={[name, 'settle_status']} label="지급여부" style={{ marginBottom: 0 }}>
                                  <Select placeholder="미지급/지급">
                                    {SETTLE_STATUS_OPTIONS.map((s) => (<Option key={s.value} value={s.value}>{s.label}</Option>))}
                                  </Select>
                                </Form.Item>
                              );
                            }
                            return <div style={{ height: 1 }} />;
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'amount']} label="금액" rules={[{ required: true, message: '금액 필수' }]} style={{ marginBottom: 0 }}>
                          <InputNumber style={{ width: '100%' }} placeholder="금액" min={0}
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(v) => v!.replace(/,/g, '') as unknown as number} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item {...restField} name={[name, 'vat_included']} label="부가세" valuePropName="checked" style={{ marginBottom: 0 }}>
                          <Switch checkedChildren="VAT포함" unCheckedChildren="별도/면세" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add({ description: '', amount: 0, vat_included: false, expense_date: dayjs(), category_name: '기타' })} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                  항목 추가
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item
            shouldUpdate={(prev, cur) => prev.items !== cur.items}
            noStyle
          >
            {() => {
              const items = form.getFieldValue('items') || [];
              let totalAmount = 0;
              let totalSupply = 0;
              let totalVat = 0;
              for (const it of items) {
                const amount = Number(it?.amount) || 0;
                totalAmount += amount;
                if (it?.vat_included) {
                  const supply = Math.round(amount / 1.1);
                  totalSupply += supply;
                  totalVat += amount - supply;
                } else {
                  totalSupply += amount;
                }
              }
              return (
                <div style={{ textAlign: 'right', marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                  <Space size="large">
                    <span><Text type="secondary">공급가액:</Text> <Text strong>{totalSupply.toLocaleString()}원</Text></span>
                    <span><Text type="secondary">부가세:</Text> <Text strong style={{ color: '#fa8c16' }}>{totalVat.toLocaleString()}원</Text></span>
                    <span><Text type="secondary">합계:</Text> <Text strong style={{ fontSize: 16, color: '#1890ff' }}>{totalAmount.toLocaleString()}원</Text></span>
                  </Space>
                </div>
              );
            }}
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
    </div>
  );
};

export default ExpenseSettlement;
