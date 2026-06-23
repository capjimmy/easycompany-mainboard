import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Table, Button, Space, Tag, Input, Select, Modal,
  Form, InputNumber, DatePicker, Row, Col, Statistic, Spin, message,
  Popconfirm, Switch, Radio, AutoComplete, Tooltip, Checkbox
} from 'antd';
import {
  TeamOutlined, ArrowLeftOutlined, PlusOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, DollarOutlined, CheckCircleOutlined,
  LinkOutlined, UserOutlined, BankOutlined, CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Outsourcing {
  id: string;
  contract_id: string;
  contract_number: string;
  vendor_name: string;
  vendor_type: 'company' | 'individual';
  vendor_business_number: string;
  vendor_contact_name: string;
  vendor_contact_phone: string;
  vendor_contact_email: string;
  service_description: string;
  outsourcing_amount: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  show_on_calendar: boolean;
  vat_included: boolean;
  service_name?: string;
  client_company?: string;
  created_at: string;
}

const OutsourcingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedCompanyId } = useAuthStore();
  const [form] = Form.useForm();

  const [outsourcings, setOutsourcings] = useState<Outsourcing[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [clientCompanies, setClientCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualContract, setManualContract] = useState(false); // 계약 직접입력(미등록) 모드
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [vendorNameOptions, setVendorNameOptions] = useState<{ value: string; label: string; client: any }[]>([]);

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

      // Load contracts, outsourcings, departments, and client companies in parallel
      const companyId = user.role === 'super_admin' ? selectedCompanyId : user.company_id;
      const [contractsResult, outsourcingsResult, clientsResult, deptsResult] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, filters),
        window.electronAPI.outsourcings.getAll(user.id, filters),
        window.electronAPI.clients.getAll(user.id, filters),
        (window as any).electronAPI.departments.getAll(user.id, companyId || undefined).catch(() => null),
      ]);

      if (contractsResult.success) {
        setContracts(contractsResult.contracts || []);
      }
      if (outsourcingsResult.success) {
        setOutsourcings(outsourcingsResult.outsourcings || []);
      }
      if (clientsResult.success) {
        setClientCompanies(clientsResult.clients || []);
      }
      if (deptsResult?.success) {
        setDepartments(deptsResult.departments || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setManualContract(false);
    form.resetFields();
    form.setFieldsValue({
      start_date: dayjs(),
      status: 'pending',
      vendor_type: 'company',
      vat_included: true,
      show_on_calendar: false,
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Outsourcing) => {
    setEditingId(record.id);
    setManualContract(!record.contract_id && !!(record as any).manual_service_name);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
      vat_included: record.vat_included ?? true,
      show_on_calendar: record.show_on_calendar ?? false,
      vendor_type: record.vendor_type || 'company',
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.outsourcings.delete(user.id, id);
      if (result.success) {
        message.success('외주 정보가 삭제되었습니다.');
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

    const isVatIncluded = values.vat_included ?? true;
    const baseAmount = values.outsourcing_amount || 0;
    const vatAmt = isVatIncluded ? Math.round(baseAmount * 0.1) : 0;
    const totalAmt = baseAmount + vatAmt;
    const paidAmt = values.paid_amount || 0;

    const outsourcingData = {
      ...values,
      company_id: selectedCompanyId || user?.company_id,
      start_date: values.start_date?.format('YYYY-MM-DD'),
      end_date: values.end_date?.format('YYYY-MM-DD'),
      vat_amount: vatAmt,
      total_amount: totalAmt,
      remaining_amount: totalAmt - paidAmt,
      vendor_type: values.vendor_type || 'company',
      show_on_calendar: values.show_on_calendar ?? false,
      vat_included: isVatIncluded,
      // 계약 직접입력 모드: 계약 미연결 + 용역명 직접 기재 / 아니면 계약 연결
      contract_id: manualContract ? null : values.contract_id,
      manual_service_name: manualContract ? (values.manual_service_name || null) : null,
    };

    try {
      let result;
      if (editingId) {
        result = await window.electronAPI.outsourcings.update(user.id, editingId, outsourcingData);
        if (result.success) {
          message.success('외주 정보가 수정되었습니다.');
        }
      } else {
        result = await window.electronAPI.outsourcings.create(user.id, outsourcingData);
        if (result.success) {
          message.success('외주가 등록되었습니다.');
        }
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

  // C4: Auto-fill vendor info from client_companies
  const handleVendorNameSearch = useCallback((searchValue: string) => {
    if (!searchValue) {
      setVendorNameOptions([]);
      return;
    }
    const lower = searchValue.toLowerCase();
    const filtered = clientCompanies
      .filter((c: any) => c.name?.toLowerCase().includes(lower))
      .slice(0, 10)
      .map((c: any) => ({
        value: c.name,
        label: `${c.name}${c.business_number ? ` (${c.business_number})` : ''}`,
        client: c,
      }));
    setVendorNameOptions(filtered);
  }, [clientCompanies]);

  const handleVendorNameSelect = (value: string, option: any) => {
    const client = option.client;
    if (client) {
      form.setFieldsValue({
        vendor_name: client.name,
        vendor_business_number: client.business_number || '',
        vendor_contact_name: client.primary_contact?.name || '',
        vendor_contact_phone: client.primary_contact?.phone || client.phone || '',
      });
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'default', label: '대기' },
      in_progress: { color: 'processing', label: '진행중' },
      completed: { color: 'green', label: '완료' },
      cancelled: { color: 'red', label: '취소' },
    };
    const s = statusMap[status] || { color: 'default', label: status };
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const getVendorTypeTag = (vendorType: string) => {
    if (vendorType === 'individual') {
      return <Tag icon={<UserOutlined />} color="purple">개인</Tag>;
    }
    return <Tag icon={<BankOutlined />} color="blue">업체</Tag>;
  };

  // Filtering
  const filteredOutsourcings = outsourcings.filter((o) => {
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesSearch =
        o.vendor_name?.toLowerCase().includes(search) ||
        o.contract_number?.toLowerCase().includes(search) ||
        o.service_description?.toLowerCase().includes(search) ||
        o.service_name?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (statusFilter && o.status !== statusFilter) return false;
    return true;
  });

  // Statistics
  const totalOutsourcingAmount = outsourcings.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalPaidAmount = outsourcings.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
  const totalRemainingAmount = outsourcings.reduce((sum, o) => sum + (o.remaining_amount || 0), 0);
  const inProgressCount = outsourcings.filter((o) => o.status === 'in_progress').length;

  // C7: VAT calculation based on vat_included toggle
  const vatIncluded = Form.useWatch('vat_included', form) ?? true;
  const outsourcingAmount = Form.useWatch('outsourcing_amount', form) || 0;
  const paidAmount = Form.useWatch('paid_amount', form) || 0;
  const vatAmount = vatIncluded ? Math.round(outsourcingAmount * 0.1) : 0;
  const totalAmount = outsourcingAmount + vatAmount;
  const remainingAmount = totalAmount - paidAmount;

  // 부서 매핑맵 (id -> name)
  const departmentMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  // contract_id -> department_id 매핑맵
  const contractDeptIdMap = React.useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const c of contracts) m.set(c.id, c.department_id);
    return m;
  }, [contracts]);

  // 폼에서 선택된 계약의 부서명 (읽기 전용 표시)
  const watchedContractId = Form.useWatch('contract_id', form);
  const watchedContractDeptName = React.useMemo(() => {
    if (!watchedContractId) return '';
    const deptId = contractDeptIdMap.get(watchedContractId);
    if (!deptId) return '(부서 미지정)';
    return departmentMap.get(deptId) || '(부서 미지정)';
  }, [watchedContractId, contractDeptIdMap, departmentMap]);

  // C1 & C6: Table columns with contract info
  const columns = [
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 130,
      render: (num: string, record: Outsourcing) => (
        record.contract_id ? (
          <Tooltip title="계약 상세보기">
            <a onClick={() => navigate(`/contracts/${record.contract_id}`)}>
              <LinkOutlined style={{ marginRight: 4 }} />
              {num}
            </a>
          </Tooltip>
        ) : (
          <Tag color="orange">직접입력</Tag>
        )
      ),
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      width: 150,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: '부서',
      key: 'department',
      width: 100,
      render: (_: any, record: Outsourcing) => {
        const deptId = record.contract_id ? contractDeptIdMap.get(record.contract_id) : undefined;
        if (!deptId) return '-';
        return departmentMap.get(deptId) || '-';
      },
    },
    {
      title: '구분',
      dataIndex: 'vendor_type',
      key: 'vendor_type',
      width: 80,
      render: (type: string) => getVendorTypeTag(type),
    },
    {
      title: '외주업체/개인',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 150,
    },
    {
      title: '용역내용',
      dataIndex: 'service_description',
      key: 'service_description',
      ellipsis: true,
    },
    {
      title: '공급가액',
      dataIndex: 'outsourcing_amount',
      key: 'outsourcing_amount',
      width: 120,
      align: 'right' as const,
      render: (amount: number) => <span>{(amount || 0).toLocaleString()}원</span>,
    },
    {
      title: '부가세',
      dataIndex: 'vat_amount',
      key: 'vat_amount',
      width: 110,
      align: 'right' as const,
      render: (amount: number) => <span>{(amount || 0).toLocaleString()}원</span>,
    },
    {
      title: '합계금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number, record: Outsourcing) => {
        const label = record.vat_included === false ? '(VAT 없음)' : '(VAT 포함)';
        return (
          <Tooltip title={label}>
            <span style={{ fontWeight: 600 }}>{(amount || 0).toLocaleString()}원</span>
          </Tooltip>
        );
      },
    },
    {
      title: '지급액',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: '#52c41a' }}>{(amount || 0).toLocaleString()}원</span>
      ),
    },
    {
      title: '미지급액',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#000' }}>
          {(amount || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 180,
      render: (_: any, record: Outsourcing) => (
        <span>
          {record.start_date} ~ {record.end_date || ''}
        </span>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: getStatusTag,
    },
    {
      title: <Tooltip title="캘린더에 표시"><CalendarOutlined /></Tooltip>,
      dataIndex: 'show_on_calendar',
      key: 'show_on_calendar',
      width: 50,
      align: 'center' as const,
      render: (val: boolean) => val ? <CalendarOutlined style={{ color: '#1890ff' }} /> : null,
    },
    {
      title: '담당자',
      dataIndex: 'vendor_contact_name',
      key: 'vendor_contact_name',
      width: 80,
    },
    {
      title: '액션',
      key: 'action',
      width: 100,
      render: (_: any, record: Outsourcing) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <TeamOutlined /> 외주 관리
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              계약별 외주 현황을 관리합니다. (1계약 : N외주)
            </Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          외주 등록
        </Button>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 외주 건수"
              value={outsourcings.length}
              suffix={`건 (진행중 ${inProgressCount}건)`}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 외주 금액"
              value={totalOutsourcingAmount}
              suffix="원"
              prefix={<DollarOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 지급액"
              value={totalPaidAmount}
              suffix="원"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="미지급액"
              value={totalRemainingAmount}
              suffix="원"
              valueStyle={{ color: totalRemainingAmount > 0 ? '#ff4d4f' : '#000' }}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Input
              placeholder="업체명, 계약번호, 용역내용, 용역명 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="상태 선택"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="pending">대기</Option>
              <Option value="in_progress">진행중</Option>
              <Option value="completed">완료</Option>
              <Option value="cancelled">취소</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <ResizableTable
          columns={columns}
          dataSource={filteredOutsourcings}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
          size="middle"
          locale={{ emptyText: '등록된 외주가 없습니다.' }}
          scroll={{ x: 1850 }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingId ? '외주 수정' : '외주 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={850}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* 계약 연결 방식: 등록된 계약 선택 / 직접입력(미등록) */}
          <Form.Item style={{ marginBottom: 8 }}>
            <Space>
              <Switch
                checkedChildren="직접입력"
                unCheckedChildren="계약선택"
                checked={manualContract}
                onChange={(v) => {
                  setManualContract(v);
                  if (v) form.setFieldsValue({ contract_id: undefined });
                  else form.setFieldsValue({ manual_service_name: undefined });
                }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {manualContract
                  ? '계약 미등록 건 — 용역명을 직접 기재합니다 (추후 계약 등록 후 연결 가능)'
                  : '등록된 계약에서 선택'}
              </Text>
            </Space>
          </Form.Item>
          {/* C3: Searchable contract select with contract_number + service_name */}
          <Row gutter={16}>
            <Col span={12}>
              {manualContract ? (
                <Form.Item
                  name="manual_service_name"
                  label="용역명 (직접입력)"
                  rules={[{ required: true, message: '용역명을 입력해주세요.' }]}
                >
                  <Input placeholder="검색되지 않는 용역명을 직접 기재" />
                </Form.Item>
              ) : (
                <Form.Item
                  name="contract_id"
                  label="관련 계약"
                  rules={[{ required: true, message: '계약을 선택해주세요.' }]}
                >
                  <Select
                    placeholder="계약번호 또는 용역명으로 검색"
                    showSearch
                    filterOption={(input, option) => {
                      const ch: any = option?.children;
                      const label = Array.isArray(ch) ? ch.join('') : String(ch ?? '');
                      return label.toLowerCase().includes(input.toLowerCase());
                    }}
                  >
                    {contracts.map((c) => (
                      <Option key={c.id} value={c.id}>
                        {c.contract_number} - {c.service_name || c.client_company || ''}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
            </Col>
            <Col span={4}>
              {/* 선택한 계약의 부서 (읽기 전용) */}
              <Form.Item label="부서">
                <Input
                  value={watchedContractDeptName}
                  disabled
                  placeholder="계약 선택 시 자동"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              {/* C2: Vendor type (company vs individual) */}
              <Form.Item
                name="vendor_type"
                label="외주 구분"
                rules={[{ required: true }]}
              >
                <Radio.Group>
                  <Radio.Button value="company"><BankOutlined /> 업체</Radio.Button>
                  <Radio.Button value="individual"><UserOutlined /> 개인</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          {/* C4: Vendor name with autocomplete from client_companies */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="vendor_name"
                label="외주업체/개인명"
                rules={[{ required: true, message: '업체명 또는 개인명을 입력해주세요.' }]}
              >
                <AutoComplete
                  options={vendorNameOptions}
                  onSearch={handleVendorNameSearch}
                  onSelect={handleVendorNameSelect}
                  placeholder="업체명 입력 (기존 거래처에서 자동완성)"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vendor_business_number" label="사업자번호">
                <Input placeholder="000-00-00000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="vendor_contact_name" label="담당자">
                <Input placeholder="담당자명" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_contact_phone" label="연락처">
                <Input placeholder="전화번호" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_contact_email" label="이메일">
                <Input placeholder="이메일" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="service_description"
            label="용역 내용"
            rules={[{ required: true, message: '용역 내용을 입력해주세요.' }]}
          >
            <TextArea rows={2} placeholder="외주 용역 내용" />
          </Form.Item>

          {/* C7: VAT option */}
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Form.Item
                name="outsourcing_amount"
                label={vatIncluded ? '외주금액 (VAT 별도)' : '외주금액 (VAT 없음)'}
                rules={[{ required: true, message: '금액을 입력해주세요.' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="vat_included"
                label="VAT 포함"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="VAT 포함"
                  unCheckedChildren="VAT 없음"
                />
              </Form.Item>
            </Col>
            {vatIncluded && (
              <Col span={6}>
                <Form.Item label="VAT (10%)">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={vatAmount}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    disabled
                  />
                </Form.Item>
              </Col>
            )}
            <Col span={vatIncluded ? 6 : 12}>
              <Form.Item label="총액">
                <div
                  style={{
                    padding: '4px 11px',
                    background: '#f5f5f5',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    lineHeight: '30px',
                  }}
                >
                  {totalAmount.toLocaleString()}원
                  {vatIncluded && (
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                      (공급가 {outsourcingAmount.toLocaleString()} + VAT {vatAmount.toLocaleString()})
                    </Text>
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="paid_amount" label="지급액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="미지급액">
                <div
                  style={{
                    padding: '4px 11px',
                    background: remainingAmount > 0 ? '#fff2f0' : '#f5f5f5',
                    borderRadius: 6,
                    color: remainingAmount > 0 ? '#ff4d4f' : '#000',
                    lineHeight: '30px',
                  }}
                >
                  {remainingAmount.toLocaleString()}원
                </div>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label="상태"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="pending">대기</Option>
                  <Option value="in_progress">진행중</Option>
                  <Option value="completed">완료</Option>
                  <Option value="cancelled">취소</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="start_date"
                label="시작일"
                rules={[{ required: true, message: '시작일을 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="종료일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              {/* C5: Calendar display toggle */}
              <Form.Item
                name="show_on_calendar"
                label="캘린더 표시"
                valuePropName="checked"
              >
                <Checkbox>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  캘린더에 표시
                </Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="비고">
            <TextArea rows={2} placeholder="메모 또는 특이사항" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingId ? '수정' : '등록'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OutsourcingManagement;
