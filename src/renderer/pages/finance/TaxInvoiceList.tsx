import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select, DatePicker,
  message, Modal, Form, InputNumber, Tabs, Statistic, Row, Col, Popconfirm, AutoComplete,
  Descriptions, Progress,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;

type Direction = 'issued' | 'received';
type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'confirmed' | 'cancelled';

interface TaxInvoice {
  id: string;
  invoice_number: string;
  direction: Direction;
  contract_id?: string | null;
  contract_name?: string;
  outsourcing_name?: string;
  client_name: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  issue_date: string;
  status: InvoiceStatus;
  supplier_name?: string;
  supplier_business_number?: string;
  buyer_name?: string;
  buyer_business_number?: string;
  note?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '작성', color: 'default' },
  issued: { label: '발행', color: 'blue' },
  sent: { label: '전송', color: 'processing' },
  confirmed: { label: '확인', color: 'success' },
  paid: { label: '입금완료', color: 'green' },
  cancelled: { label: '취소', color: 'error' },
};

const TaxInvoiceList: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Direction>('issued');
  const [viewMode, setViewMode] = useState<'list' | 'monthly'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaxInvoice | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [contractOptions, setContractOptions] = useState<{ value: string; label: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ value: string }[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, any>>({});
  // 추가 필터
  const [contracts, setContracts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterDeptId, setFilterDeptId] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | undefined>(undefined);
  const [filterClient, setFilterClient] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchAuxData = async () => {
    if (!user?.id) return;
    try {
      const filter = companyId ? { company_id: companyId } : {};
      const [contractsRes, clientsRes, deptRes] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, { ...filter, status: 'active' }),
        window.electronAPI.clients.getAll(user.id, filter),
        (window as any).electronAPI.departments.getAll(user.id, companyId).catch(() => null),
      ]);
      if (contractsRes?.success) {
        const all = contractsRes.contracts || [];
        setContracts(all);
        const list = all.filter((c: any) => c.progress !== 'cancelled' && c.progress !== 'completed');
        setContractOptions(list.map((c: any) => ({
          value: c.id,
          label: `${c.service_name || c.contract_number || '(이름없음)'}${c.client_company ? ' / ' + c.client_company : ''}`,
        })));
      }
      if (deptRes?.success) setDepartments(deptRes.departments || []);
      if (clientsRes?.success) {
        const clients = clientsRes.clients || clientsRes.data || [];
        const seen = new Set<string>();
        const opts: { value: string }[] = [];
        const map: Record<string, any> = {};
        clients.forEach((cl: any) => {
          const name = cl.company_name || cl.name;
          if (name && !seen.has(name)) {
            seen.add(name);
            opts.push({ value: name });
            map[name] = cl;
          }
        });
        setClientOptions(opts);
        setClientMap(map);
      }
    } catch (_) {}
  };

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 슈퍼관리자가 회사 미선택이면 companyId 없이 호출 → 모든 회사 조회
      const filters: any = {};
      if (companyId) filters.company_id = companyId;
      const result = await window.electronAPI.taxInvoices.getAll(user.id, filters);
      if (result.success) {
        setInvoices(result.invoices || result.data || []);
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
    fetchAuxData();
  }, [user?.id, companyId]);

  // 계약→부서 매핑 (필터링용)
  const contractDeptMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    contracts.forEach((c: any) => { m[c.id] = c.department_id || null; });
    return m;
  }, [contracts]);

  // 폼에서 선택된 계약 감시 (모달의 프로젝트 상세 패널용)
  const watchedContractId = Form.useWatch('contract_id', form);
  const linkedContract = useMemo(() => {
    if (!watchedContractId) return null;
    return contracts.find((c: any) => c.id === watchedContractId) || null;
  }, [watchedContractId, contracts]);

  const filteredInvoices = useMemo(() => {
    let list = invoices.filter((inv) => inv.direction === activeTab);
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoice_number?.toLowerCase().includes(lower) ||
          inv.client_name?.toLowerCase().includes(lower) ||
          inv.contract_name?.toLowerCase().includes(lower)
      );
    }
    if (filterDeptId) {
      list = list.filter((inv: any) => {
        const cid = inv.contract_id;
        return cid && contractDeptMap[cid] === filterDeptId;
      });
    }
    if (filterStatus) {
      list = list.filter((inv) => inv.status === filterStatus);
    }
    if (filterClient) {
      const lower = filterClient.toLowerCase();
      list = list.filter((inv) =>
        (inv.client_name || '').toLowerCase().includes(lower) ||
        (inv as any).buyer_name?.toLowerCase().includes(lower)
      );
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const start = filterDateRange[0].format('YYYY-MM-DD');
      const end = filterDateRange[1].format('YYYY-MM-DD');
      list = list.filter((inv) => {
        const d = inv.issue_date;
        return d && d >= start && d <= end;
      });
    }
    return list;
  }, [invoices, activeTab, searchText, filterDeptId, filterStatus, filterClient, filterDateRange, contractDeptMap]);

  const monthlyStats = useMemo(() => {
    const currentMonth = dayjs().format('YYYY-MM');
    const monthItems = filteredInvoices.filter(
      (inv) => dayjs(inv.issue_date).format('YYYY-MM') === currentMonth
    );
    return {
      count: monthItems.length,
      supply: monthItems.reduce((s, i) => s + (i.supply_amount || 0), 0),
      vat: monthItems.reduce((s, i) => s + (i.vat_amount || 0), 0),
      total: monthItems.reduce((s, i) => s + (i.total_amount || 0), 0),
    };
  }, [filteredInvoices]);

  // 월별 통계 (전체 기간)
  const monthlyAggregate = useMemo(() => {
    const map: Record<string, { month: string; count: number; supply: number; vat: number; total: number }> = {};
    for (const inv of filteredInvoices) {
      if (!inv.issue_date) continue;
      const k = dayjs(inv.issue_date).format('YYYY-MM');
      if (!map[k]) map[k] = { month: k, count: 0, supply: 0, vat: 0, total: 0 };
      map[k].count += 1;
      map[k].supply += inv.supply_amount || 0;
      map[k].vat += inv.vat_amount || 0;
      map[k].total += inv.total_amount || 0;
    }
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredInvoices]);

  const handleOpenModal = (record?: TaxInvoice) => {
    setEditingRecord(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        issue_date: record.issue_date ? dayjs(record.issue_date) : undefined,
        payment_date: (record as any).payment_date ? dayjs((record as any).payment_date) : undefined,
      });
    } else {
      form.setFieldsValue({ direction: activeTab });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!companyId) return;
    const payload = {
      ...values,
      company_id: companyId,
      issue_date: values.issue_date?.format('YYYY-MM-DD'),
      payment_date: values.payment_date?.format('YYYY-MM-DD') || null,
    };

    try {
      const result = editingRecord
        ? await window.electronAPI.taxInvoices.update(user!.id, editingRecord.id, payload)
        : await window.electronAPI.taxInvoices.create(user!.id, payload);

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
      const result = await window.electronAPI.taxInvoices.delete(user!.id, id);
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

  const handleSupplyChange = (value: number | null) => {
    const supply = value || 0;
    form.setFieldsValue({
      vat_amount: Math.round(supply * 0.1),
      total_amount: Math.round(supply * 1.1),
    });
  };

  const handleExcelExport = async () => {
    if (!user?.id) return;
    try {
      const exportColumns = [
        { title: '번호', key: 'invoice_number' },
        { title: '거래처', key: 'client_name' },
        { title: '공급가액', key: 'supply_amount' },
        { title: 'VAT', key: 'vat_amount' },
        { title: '합계', key: 'total_amount' },
        { title: '발행일', key: 'issue_date' },
        { title: '상태', key: 'status' },
      ];
      const exportData = filteredInvoices.map((d) => ({
        ...d,
        status: STATUS_CONFIG[d.status]?.label || d.status,
      }));
      const result = await window.electronAPI.export.financeGeneric(user.id, '세금계산서', exportColumns, exportData);
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
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 130,
    },
    {
      title: '계약/외주',
      key: 'ref_name',
      ellipsis: true,
      render: (_: any, record: TaxInvoice) =>
        record.contract_name || record.outsourcing_name || '-',
    },
    {
      title: '거래처',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 180,
      ellipsis: true,
      render: (v: string, record: TaxInvoice) => v || record.buyer_name || '-',
    },
    {
      title: '적요',
      dataIndex: 'item_description',
      key: 'item_description',
      ellipsis: true,
    },
    {
      title: '공급가액',
      dataIndex: 'supply_amount',
      key: 'supply_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: 'VAT',
      dataIndex: 'vat_amount',
      key: 'vat_amount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '합계',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    {
      title: '발행일',
      dataIndex: 'issue_date',
      key: 'issue_date',
      width: 110,
      sorter: (a: TaxInvoice, b: TaxInvoice) =>
        (a.issue_date || '').localeCompare(b.issue_date || ''),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: InvoiceStatus) => (
        <Tag color={STATUS_CONFIG[v]?.color}>{STATUS_CONFIG[v]?.label || v}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_: any, record: TaxInvoice) => (
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
          <Title level={4} style={{ margin: 0 }}>세금계산서관리</Title>
          <span style={{ color: '#888' }}>세금계산서를 조회하고 관리합니다.</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          세금계산서 등록
        </Button>
      </div>

      {/* 월별 통계 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title={`이번 달 건수 (${activeTab === 'issued' ? '매출' : '매입'})`} value={monthlyStats.count} suffix="건" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="공급가액 합계" value={monthlyStats.supply} suffix="원" valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="VAT 합계" value={monthlyStats.vat} suffix="원" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="합계" value={monthlyStats.total} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as Direction)}
          items={[
            { key: 'issued', label: '매출 (발행)' },
            { key: 'received', label: '매입 (수취)' },
          ]}
        />

        <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="번호, 거래처, 계약명 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="부서"
            value={filterDeptId}
            onChange={setFilterDeptId}
            allowClear
            style={{ width: 160 }}
            options={departments.map((d: any) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="상태"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as InvoiceStatus | undefined)}
            allowClear
            style={{ width: 140 }}
            options={Object.entries(STATUS_CONFIG).map(([k, c]) => ({ value: k, label: c.label }))}
          />
          <Input
            placeholder="거래처명"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value || undefined)}
            allowClear
            style={{ width: 180 }}
          />
          <DatePicker.RangePicker
            value={filterDateRange as any}
            onChange={(dates) => setFilterDateRange(dates as any)}
            placeholder={['발행일 시작', '발행일 종료']}
            allowClear
          />
          <Button
            type={viewMode === 'monthly' ? 'primary' : 'default'}
            icon={<BarChartOutlined />}
            onClick={() => setViewMode(viewMode === 'monthly' ? 'list' : 'monthly')}
          >
            {viewMode === 'monthly' ? '목록 보기' : '월별 통계'}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
            엑셀 다운로드
          </Button>
        </Space>

        {viewMode === 'monthly' ? (
          <Table
            dataSource={monthlyAggregate}
            rowKey="month"
            size="small"
            pagination={false}
            scroll={{ x: 700 }}
            columns={[
              { title: '월', dataIndex: 'month', width: 120, render: (v: string) => dayjs(v).format('YYYY년 M월') },
              { title: '건수', dataIndex: 'count', width: 80, align: 'right' as const, render: (v: number) => `${v}건` },
              { title: '공급가액', dataIndex: 'supply', align: 'right' as const, render: (v: number) => `${(v || 0).toLocaleString()}원` },
              { title: 'VAT', dataIndex: 'vat', align: 'right' as const, render: (v: number) => `${(v || 0).toLocaleString()}원` },
              { title: '합계', dataIndex: 'total', align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{(v || 0).toLocaleString()}원</span> },
            ]}
            summary={() => {
              const t = monthlyAggregate.reduce(
                (a, r) => ({ count: a.count + r.count, supply: a.supply + r.supply, vat: a.vat + r.vat, total: a.total + r.total }),
                { count: 0, supply: 0, vat: 0, total: 0 }
              );
              return (
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0}>합계</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{t.count}건</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{t.supply.toLocaleString()}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{t.vat.toLocaleString()}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><span style={{ color: '#52c41a' }}>{t.total.toLocaleString()}원</span></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        ) : (
          <ResizableTable
            columns={columns}
            dataSource={filteredInvoices}
            rowKey="id"
            loading={loading}
            pagination={{ showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        title={editingRecord ? '세금계산서 수정' : '세금계산서 등록'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="direction" label="구분" rules={[{ required: true, message: '구분을 선택해주세요.' }]}>
                <Select>
                  <Option value="issued">매출 (발행)</Option>
                  <Option value="received">매입 (수취)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="상태" initialValue="draft">
                <Select>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <Option key={key} value={key}>{cfg.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier_name" label="공급자명">
                <Input placeholder="공급자 상호" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_business_number" label="공급자 사업자번호">
                <Input placeholder="000-00-00000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buyer_name" label="공급받는자명">
                <Input placeholder="공급받는자 상호" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buyer_business_number" label="공급받는자 사업자번호">
                <Input placeholder="000-00-00000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buyer_email" label="이메일">
                <Input placeholder="buyer@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buyer_representative" label="대표자명">
                <Input placeholder="대표자명" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="contract_id" label="프로젝트(계약) - 선택사항">
            <Select
              allowClear
              showSearch
              placeholder="연결할 프로젝트(활성 계약) 선택"
              options={contractOptions}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {linkedContract && (
            <Card
              size="small"
              title={<span style={{ fontSize: 13 }}>📋 연결된 프로젝트 상세</span>}
              style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#91d5ff' }}
              bodyStyle={{ padding: 12 }}
            >
              <Descriptions size="small" column={2} colon={false} labelStyle={{ width: 90, color: '#666' }}>
                <Descriptions.Item label="계약번호">{linkedContract.contract_number || '-'}</Descriptions.Item>
                <Descriptions.Item label="진행상태">
                  {(() => {
                    const map: Record<string, { color: string; label: string }> = {
                      contract_signed: { color: 'blue', label: '계약체결' },
                      in_progress: { color: 'processing', label: '진행중' },
                      inspection: { color: 'orange', label: '검수중' },
                      completed: { color: 'green', label: '완료' },
                      on_hold: { color: 'warning', label: '보류' },
                      cancelled: { color: 'red', label: '취소' },
                    };
                    const s = map[linkedContract.progress] || { color: 'default', label: linkedContract.progress || '-' };
                    return <Tag color={s.color}>{s.label}</Tag>;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="용역명" span={2}>
                  <strong>{linkedContract.service_name || '-'}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="거래처">{linkedContract.client_company || '-'}</Descriptions.Item>
                <Descriptions.Item label="담당자">{linkedContract.manager_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="계약기간" span={2}>
                  {linkedContract.contract_start_date || '-'} ~ {linkedContract.contract_end_date || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="계약금액">
                  {(linkedContract.total_amount || 0).toLocaleString()}원
                </Descriptions.Item>
                <Descriptions.Item label="수금액">
                  <span style={{ color: '#52c41a' }}>{(linkedContract.received_amount || 0).toLocaleString()}원</span>
                </Descriptions.Item>
                <Descriptions.Item label="미수금">
                  <span style={{ color: (linkedContract.remaining_amount || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {(linkedContract.remaining_amount || 0).toLocaleString()}원
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="수금율">
                  {(() => {
                    const t = linkedContract.total_amount || 0;
                    const r = linkedContract.received_amount || 0;
                    const rate = t > 0 ? Math.round((r / t) * 100) : 0;
                    return <Progress percent={rate} size="small" style={{ maxWidth: 140 }} />;
                  })()}
                </Descriptions.Item>
                {linkedContract.progress_rate != null && (
                  <Descriptions.Item label="용역 진행률" span={2}>
                    <Progress percent={linkedContract.progress_rate || 0} size="small" style={{ maxWidth: 200 }} />
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          <Form.Item name="client_name" label="거래처명" rules={[{ required: true, message: '거래처명을 입력해주세요.' }]}>
            <AutoComplete
              options={clientOptions}
              placeholder="거래처명 (기존 거래처 선택 또는 새로 입력)"
              filterOption={(inputValue, option) =>
                (option?.value as string ?? '').toLowerCase().includes(inputValue.toLowerCase())
              }
              onSelect={(value) => {
                const cl = clientMap[value];
                if (cl) {
                  form.setFieldsValue({
                    buyer_name: cl.name || value,
                    buyer_business_number: cl.business_number || '',
                    buyer_representative: cl.ceo_name || '',
                    buyer_email: cl.email || '',
                  });
                }
              }}
              allowClear
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="supply_amount" label="공급가액" rules={[{ required: true, message: '공급가액을 입력해주세요.' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  min={0}
                  onChange={handleSupplyChange}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vat_amount" label="VAT">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="total_amount" label="합계">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  min={0}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issue_date" label="발행일" rules={[{ required: true, message: '발행일을 선택해주세요.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="입금일">
                <DatePicker style={{ width: '100%' }} placeholder="입금완료일 (직접 입력)" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="item_description" label="적요">
            <Input.TextArea rows={2} placeholder="용역명/품목 등을 직접 입력하거나 비워두면 계약명이 자동 사용됩니다" />
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

export default TaxInvoiceList;
