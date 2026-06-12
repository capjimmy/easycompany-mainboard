import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select,
  message, Modal, Form, InputNumber, Popconfirm, Row, Col, Statistic, Upload, Alert,
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, SearchOutlined, InboxOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type Status = 'pending' | 'approved' | 'rejected';

const STATUS_MAP: Record<Status, { label: string; color: string }> = {
  pending: { label: '대기', color: 'processing' },
  approved: { label: '승인', color: 'success' },
  rejected: { label: '반려', color: 'error' },
};

const CATEGORY_OPTIONS = [
  '교통비', '식비', '숙박비', '소모품비', '통신비', '회의비',
  '접대비', '교육비', '택배비', '제본비', '기타',
];

const ExpenseRequest: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;
  const isApprover = user?.role === 'super_admin' || user?.role === 'company_admin';
  // 부서장은 조회만, 사원/관리자는 신청 가능
  const canCreate = user?.role !== 'department_manager';

  const isSuperAdmin = user?.role === 'super_admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const showDeptFilter = isSuperAdmin || isCompanyAdmin;

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | undefined>();
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [nameSearch, setNameSearch] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [res, deptRes, compRes] = await Promise.all([
        (window as any).electronAPI.expenseRequests.getAll(user.id, { company_id: companyId }),
        (window as any).electronAPI.departments.getAll(user.id),
        isSuperAdmin ? (window as any).electronAPI.companies.getAll(user.id) : Promise.resolve({ success: true, companies: [] }),
      ]);
      if (res.success) setList(res.data || []);
      else message.error(res.error || '조회 실패');
      if (deptRes.success) {
        let depts = deptRes.departments || [];
        if (companyId) depts = depts.filter((d: any) => d.company_id === companyId);
        setDepartments(depts);
      }
      if (compRes.success) setCompanies(compRes.companies || []);
    } catch (err: any) {
      message.error(err?.message || '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const filtered = useMemo(() => {
    let l = [...list];
    if (statusFilter) l = l.filter((r) => r.status === statusFilter);
    if (deptFilter) l = l.filter((r) => r.requester_department_id === deptFilter);
    if (nameSearch.trim()) {
      const keyword = nameSearch.trim().toLowerCase();
      l = l.filter((r) => (r.requester_name || '').toLowerCase().includes(keyword));
    }
    return l;
  }, [list, statusFilter, deptFilter, nameSearch]);

  const stats = useMemo(() => ({
    total: list.length,
    pending: list.filter((r) => r.status === 'pending').length,
    approvedAmount: list.filter((r) => r.status === 'approved').reduce((s, r) => s + (r.amount || 0), 0),
  }), [list]);

  const handleCreate = async (values: any) => {
    if (!user?.id) return;
    try {
      const attachmentsMeta = attachedFiles.map((f: any) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      // 매입(부가세 공제)이면 공급가+부가세 분리, 일반경비면 amount만
      const supplyAmount = Number(values.supply_amount || 0);
      const vatAmount = Number(values.vat_amount || 0);
      const totalAmount = values.expense_type === 'purchase'
        ? supplyAmount + vatAmount
        : Number(values.amount || 0);

      const payload: any = {
        company_id: companyId,
        department_id: user?.department_id || null,
        title: values.title,
        amount: totalAmount,
        category: values.category,
        expense_type: values.expense_type || 'general',
        supplier_name: values.supplier_name || null,
        supplier_business_number: values.supplier_business_number || null,
        supply_amount: supplyAmount,
        vat_amount: vatAmount,
        reason: values.reason,
        attachment_path: values.attachment_path || null,
        attachments: attachmentsMeta,
      };
      // 백엔드가 attachments 컬럼을 지원하지 않을 수 있으므로 attachment_path에도 JSON으로 저장 (메타데이터 임시 보관)
      if (attachmentsMeta.length > 0 && !payload.attachment_path) {
        payload.attachment_path = JSON.stringify(attachmentsMeta);
      }
      const res = await (window as any).electronAPI.expenseRequests.create(user.id, payload);
      if (res.success) {
        message.success('지출결의서가 신청되었습니다.');
        setModalOpen(false);
        form.resetFields();
        setAttachedFiles([]);
        fetchData();
      } else {
        message.error(res.error || '신청 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '신청 중 오류가 발생했습니다.');
    }
  };

  const parseAttachments = (record: any): any[] => {
    if (Array.isArray(record?.attachments)) return record.attachments;
    const p = record?.attachment_path;
    if (typeof p === 'string' && p.startsWith('[')) {
      try { const arr = JSON.parse(p); if (Array.isArray(arr)) return arr; } catch { /* ignore */ }
    }
    return [];
  };

  const handleApprove = async (id: string) => {
    const res = await (window as any).electronAPI.expenseRequests.approve(user!.id, id);
    if (res.success) { message.success('승인되었습니다. 경비정산에 자동 등록되었습니다.'); fetchData(); }
    else message.error(res.error || '승인 실패');
  };

  const handleReject = async (id: string) => {
    const res = await (window as any).electronAPI.expenseRequests.reject(user!.id, id);
    if (res.success) { message.success('반려되었습니다.'); fetchData(); }
    else message.error(res.error || '반려 실패');
  };

  const handleDelete = async (id: string) => {
    const res = await (window as any).electronAPI.expenseRequests.delete(user!.id, id);
    if (res.success) { message.success('삭제되었습니다.'); fetchData(); }
    else message.error(res.error || '삭제 실패');
  };

  const columns = [
    { title: '제목', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '신청자', dataIndex: 'requester_name', key: 'requester_name', width: 100 },
    { title: '부서', dataIndex: 'requester_department_name', key: 'requester_department_name', width: 120, render: (v: string) => v || '-' },
    { title: '카테고리', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: '금액', dataIndex: 'amount', key: 'amount', width: 130, align: 'right' as const,
      render: (v: number) => `${(v || 0).toLocaleString()}원`,
    },
    { title: '사유', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: '신청일', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '첨부', key: 'attachments', width: 80, align: 'center' as const,
      render: (_: any, record: any) => {
        const files = parseAttachments(record);
        if (files.length === 0) return <span style={{ color: '#bbb' }}>-</span>;
        return <span><PaperClipOutlined style={{ marginRight: 4 }} />{files.length}</span>;
      },
    },
    {
      title: '상태', dataIndex: 'status', key: 'status', width: 90,
      render: (v: Status) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label || v}</Tag>,
    },
    {
      title: '작업', key: 'action', width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          {isApprover && record.status === 'pending' && (
            <>
              <Popconfirm title="승인 시 경비정산에 자동 등록됩니다. 진행할까요?" onConfirm={() => handleApprove(record.id)} okText="승인" cancelText="취소">
                <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />}>승인</Button>
              </Popconfirm>
              <Popconfirm title="반려하시겠습니까?" onConfirm={() => handleReject(record.id)} okText="반려" cancelText="취소">
                <Button type="link" size="small" danger icon={<CloseOutlined />}>반려</Button>
              </Popconfirm>
            </>
          )}
          {(record.requester_id === user?.id || isApprover) && record.status === 'pending' && (
            <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)} okText="삭제" cancelText="취소">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>지출결의서</Title>
          <span style={{ color: '#888' }}>지출 사항을 신청하고 관리자의 승인을 받습니다.</span>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>지출결의서 신청</Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="총 신청 건수" value={stats.total} suffix="건" /></Card></Col>
        <Col span={8}><Card><Statistic title="승인 대기" value={stats.pending} suffix="건" valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="승인 합계" value={stats.approvedAmount} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="상태" value={statusFilter} onChange={setStatusFilter} allowClear style={{ width: 140 }}>
            {Object.entries(STATUS_MAP).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
          </Select>
          {showDeptFilter && (
            <Select placeholder="부서" value={deptFilter} onChange={setDeptFilter} allowClear style={{ width: 160 }}>
              {departments.map((d: any) => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          )}
          <Input
            placeholder="신청자 검색"
            prefix={<SearchOutlined />}
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            allowClear
            style={{ width: 180 }}
          />
        </Space>
      </Card>

      <Card>
        <ResizableTable columns={columns} dataSource={filtered} rowKey="id" loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `총 ${t}건` }} scroll={{ x: 1220 }} />
      </Card>

      <Modal
        title="지출결의서 신청"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setAttachedFiles([]); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ expense_type: 'general' }}>
          <Form.Item name="title" label="제목" rules={[{ required: true, message: '제목을 입력해주세요.' }]}>
            <Input placeholder="예: 사무용품 구입" />
          </Form.Item>

          <Form.Item name="expense_type" label="구분" rules={[{ required: true }]}>
            <Select>
              <Option value="general">일반경비 (부가세 공제 X)</Option>
              <Option value="purchase">매입 (부가세 공제 O)</Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate={(prev, curr) => prev.expense_type !== curr.expense_type} noStyle>
            {({ getFieldValue }) => getFieldValue('expense_type') === 'purchase' ? (
              <>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item name="supplier_name" label="거래처명" rules={[{ required: true }]}>
                      <Input placeholder="거래처명" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item name="supplier_business_number" label="사업자번호">
                      <Input placeholder="000-00-00000" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="supply_amount" label="공급가" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v!.replace(/,/g, '') as unknown as number} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="vat_amount" label="부가세" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v!.replace(/,/g, '') as unknown as number} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="category" label="카테고리" rules={[{ required: true }]}>
                      <Select placeholder="선택">
                        {CATEGORY_OPTIONS.map((c) => <Option key={c} value={c}>{c}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ) : (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="category" label="카테고리" rules={[{ required: true, message: '카테고리를 선택해주세요.' }]}>
                    <Select placeholder="카테고리 선택">
                      {CATEGORY_OPTIONS.map((c) => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="amount" label="금액" rules={[{ required: true, message: '금액을 입력해주세요.' }]}>
                    <InputNumber style={{ width: '100%' }} min={0}
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => v!.replace(/,/g, '') as unknown as number} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form.Item>

          <Form.Item name="reason" label="사유" rules={[{ required: true, message: '사유를 입력해주세요.' }]}>
            <TextArea rows={4} placeholder="지출 사유를 상세히 입력해주세요." />
          </Form.Item>
          <Form.Item label="첨부파일 (선택, 다중 가능)">
            <Upload.Dragger
              multiple
              beforeUpload={(file) => {
                setAttachedFiles((prev) => [...prev, file]);
                return false;
              }}
              onRemove={(file) => {
                setAttachedFiles((prev) => prev.filter((f) => f.uid !== (file as any).uid));
              }}
              fileList={attachedFiles as any}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">파일을 드래그하거나 클릭해 선택</p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>여러 파일 첨부 가능</p>
            </Upload.Dragger>
            {attachedFiles.length > 0 && (
              <Alert
                style={{ marginTop: 8 }}
                type="info"
                showIcon
                message="파일은 임시로 메타데이터만 저장됩니다."
                description="실제 파일 업로드 기능은 추후 작업 예정입니다."
              />
            )}
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setAttachedFiles([]); form.resetFields(); }}>취소</Button>
              <Button type="primary" htmlType="submit">신청</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpenseRequest;
