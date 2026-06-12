import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Tabs, Progress, Statistic, Tag, Row, Col, Space, Spin, Empty,
  Button, message, Modal, Descriptions, Divider, Tooltip, DatePicker, Select, Input,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, StopOutlined, MinusCircleOutlined,
  DollarOutlined, FundProjectionScreenOutlined, EditOutlined,
  UserOutlined, CalendarOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import type { Contract, ContractProgress } from '../../../shared/types';

interface Subtask {
  id: string;
  contract_id: string;
  parent_id: string | null;
  level: number;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  progress_rate: number;
  sort_order: number;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

const SUBTASK_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '대기', color: 'default', icon: <MinusCircleOutlined /> },
  in_progress: { label: '진행중', color: 'processing', icon: <ClockCircleOutlined /> },
  completed: { label: '완료', color: 'success', icon: <CheckCircleOutlined /> },
};

const { Title, Text } = Typography;

const PROGRESS_CONFIG: Record<ContractProgress, { label: string; color: string }> = {
  contract_signed: { label: '계약체결', color: 'blue' },
  in_progress: { label: '진행중', color: 'processing' },
  inspection: { label: '검수중', color: 'warning' },
  completed: { label: '완료', color: 'success' },
  on_hold: { label: '보류', color: 'default' },
  cancelled: { label: '취소', color: 'error' },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: '용역',
  construction: '공사',
  purchase: '구매',
  maintenance: '유지보수',
  consulting: '컨설팅',
  other: '기타',
};

// 진행중 상태들
const IN_PROGRESS_STATUSES: ContractProgress[] = ['contract_signed', 'in_progress', 'inspection', 'on_hold'];
const COMPLETED_STATUSES: ContractProgress[] = ['completed'];
const CANCELLED_STATUSES: ContractProgress[] = ['cancelled'];

const ProjectDashboard: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const canViewFinance = user?.role === 'super_admin' || user?.role === 'company_admin';
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('in_progress');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  // 기간 필터
  const currentYear = dayjs().year();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(`${currentYear}-01-01`),
    dayjs(`${currentYear}-12-31`),
  ]);

  // 검색/부서 필터
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState<string | undefined>(undefined);
  const [departments, setDepartments] = useState<any[]>([]);

  // 회사 전환 시 부서 필터 초기화
  useEffect(() => {
    setFilterDept(undefined);
  }, [selectedCompanyId]);

  const handleQuickRange = (type: string) => {
    const now = dayjs();
    switch (type) {
      case 'thisMonth': setDateRange([now.startOf('month'), now.endOf('month')]); break;
      case 'thisYear': setDateRange([dayjs(`${now.year()}-01-01`), dayjs(`${now.year()}-12-31`)]); break;
      case 'all': setDateRange([dayjs('2020-01-01'), dayjs('2030-12-31')]); break;
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadContracts();
    }
  }, [user?.id, selectedCompanyId]);

  const loadContracts = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const filters = user.role === 'super_admin' && selectedCompanyId ? { company_id: selectedCompanyId } : {};
      const [result, deptResult] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, filters),
        (window as any).electronAPI.departments.getAll(user.id),
      ]);
      if (result.success) {
        setContracts(result.contracts as Contract[]);
      }
      if (deptResult?.success) {
        setDepartments(deptResult.departments || []);
      }
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 회사별 부서 옵션
  const departmentOptions = useMemo(() => {
    const companyFilterId = user?.role === 'super_admin' ? selectedCompanyId : user?.company_id;
    const list = companyFilterId
      ? departments.filter((d: any) => d.company_id === companyFilterId)
      : departments;
    return list.map((d: any) => ({ value: d.id, label: d.name }));
  }, [departments, selectedCompanyId, user?.role, user?.company_id]);

  // 기간/검색/부서 필터 적용
  const filteredContracts = useMemo(() => {
    let list = contracts.slice();
    if (dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      list = list.filter((c: any) => {
        const d = dayjs(c.contract_start_date || c.created_at);
        return !d.isBefore(start) && !d.isAfter(end);
      });
    }
    if (filterDept) {
      list = list.filter((c: any) => c.department_id === filterDept);
    }
    if (searchText.trim()) {
      const k = searchText.trim().toLowerCase();
      list = list.filter((c: any) =>
        (c.service_name || '').toLowerCase().includes(k) ||
        (c.client_company || '').toLowerCase().includes(k) ||
        (c.contract_number || '').toLowerCase().includes(k)
      );
    }
    return list;
  }, [contracts, dateRange, filterDept, searchText]);

  // Categorize contracts
  const categorized = useMemo(() => {
    const inProgress = filteredContracts.filter((c) => IN_PROGRESS_STATUSES.includes(c.progress));
    const completed = filteredContracts.filter((c) => COMPLETED_STATUSES.includes(c.progress));
    const cancelled = filteredContracts.filter((c) => CANCELLED_STATUSES.includes(c.progress));
    return { inProgress, completed, cancelled };
  }, [filteredContracts]);

  const currentList = useMemo(() => {
    switch (activeTab) {
      case 'in_progress':
        return categorized.inProgress;
      case 'completed':
        return categorized.completed;
      case 'cancelled':
        return categorized.cancelled;
      default:
        return [];
    }
  }, [activeTab, categorized]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = filteredContracts.reduce((sum, c) => sum + (c.total_amount || 0), 0);
    const receivedAmount = filteredContracts.reduce((sum, c) => sum + (c.received_amount || 0), 0);
    const collectionRate = totalAmount > 0 ? Math.round((receivedAmount / totalAmount) * 100) : 0;

    return { totalAmount, receivedAmount, collectionRate };
  }, [filteredContracts]);

  const getCollectionRate = (c: Contract) => {
    if (!c.total_amount || c.total_amount === 0) return 0;
    return Math.round((c.received_amount / c.total_amount) * 100);
  };

  const getProgressPercent = (c: Contract) => {
    return c.progress_rate || 0;
  };

  // 인건비/경비/상세내역 상태
  const [contractDetail, setContractDetail] = useState<any>(null);
  const [contractTaxInvoices, setContractTaxInvoices] = useState<any[]>([]);
  const [contractMeetingNotes, setContractMeetingNotes] = useState<any[]>([]);
  const [contractBillings, setContractBillings] = useState<any[]>([]);
  const [contractPaymentReceipts, setContractPaymentReceipts] = useState<any[]>([]);

  const handleCardClick = async (contract: Contract) => {
    setSelectedContract(contract);
    setDetailModalOpen(true);
    setSubtasks([]);
    setContractDetail(null);
    setContractTaxInvoices([]);
    setContractMeetingNotes([]);
    setContractBillings([]);
    setContractPaymentReceipts([]);
    if (user?.id) {
      setSubtasksLoading(true);
      try {
        const companyFilter = user.role === 'super_admin' && selectedCompanyId
          ? { company_id: selectedCompanyId }
          : {};
        const [subtaskResult, detailResult, taxResult, notesResult, billingResult, receiptResult] = await Promise.all([
          window.electronAPI.subtasks.getByContract(user.id, contract.id),
          window.electronAPI.contracts.getById(user.id, contract.id),
          window.electronAPI.taxInvoices.getAll(user.id, companyFilter),
          (window.electronAPI as any).contractMeetingNotes?.getByContract(user.id, contract.id),
          (window.electronAPI as any).billings?.getAll(user.id, companyFilter),
          (window.electronAPI as any).paymentReceipts?.getAll(user.id, companyFilter),
        ]);
        if (subtaskResult.success) {
          setSubtasks(subtaskResult.subtasks || []);
        }
        if (detailResult.success) {
          setContractDetail(detailResult.contract);
        }
        if (taxResult?.success) {
          const all = (taxResult as any).invoices || (taxResult as any).data || [];
          setContractTaxInvoices(
            all
              .filter((t: any) => t.contract_id === contract.id)
              .sort((a: any, b: any) => (b.issue_date || '').localeCompare(a.issue_date || ''))
          );
        }
        if (notesResult?.success) {
          setContractMeetingNotes(notesResult.notes || []);
        }
        if (billingResult?.success) {
          const allB = (billingResult as any).billings || [];
          setContractBillings(
            allB.filter((b: any) => b.contract_id === contract.id)
          );
        }
        if (receiptResult?.success) {
          const allR = (receiptResult as any).paymentReceipts || [];
          setContractPaymentReceipts(
            allR.filter((r: any) => r.contract_id === contract.id)
          );
        }
      } catch (_) {}
      setSubtasksLoading(false);
    }
  };

  const handleEditContract = () => {
    if (selectedContract) {
      setDetailModalOpen(false);
      navigate(`/contracts/${selectedContract.id}`);
    }
  };

  const handleStatusChange = async (contractId: string, newStatus: ContractProgress) => {
    if (!user?.id) return;
    setStatusChanging(true);
    try {
      const result = await window.electronAPI.contracts.updateProgress(user.id, contractId, newStatus);
      if (result.success) {
        message.success('상태가 변경되었습니다.');
        loadContracts();
        // Update selected contract in modal
        if (selectedContract && selectedContract.id === contractId) {
          setSelectedContract({ ...selectedContract, progress: newStatus });
        }
      } else {
        message.error(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      message.error('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setStatusChanging(false);
    }
  };

  const formatAmount = (amount: number) => {
    return (amount || 0).toLocaleString('ko-KR');
  };

  const renderProjectCard = (contract: Contract) => {
    const collectionRate = getCollectionRate(contract);
    const progressPercent = getProgressPercent(contract);

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={contract.id}>
        <Card
          hoverable
          style={{ height: '100%', cursor: 'pointer' }}
          onClick={() => handleCardClick(contract)}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong ellipsis style={{ maxWidth: '70%' }}>
                {contract.service_name || '(프로젝트명 없음)'}
              </Text>
              <Tag color={PROGRESS_CONFIG[contract.progress]?.color}>
                {PROGRESS_CONFIG[contract.progress]?.label}
              </Tag>
            </div>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Client */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>발주처</Text>
              <div>
                <Text ellipsis>{contract.client_company || '-'}</Text>
              </div>
            </div>

            {/* Progress */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>진행률</Text>
              <Progress
                percent={progressPercent}
                size="small"
                status={progressPercent >= 100 ? 'success' : 'active'}
              />
            </div>

            {/* Amounts */}
            {canViewFinance && (
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>계약금액</span>}
                    value={contract.total_amount || 0}
                    suffix="원"
                    valueStyle={{ fontSize: 14, color: '#1890ff' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>입금액</span>}
                    value={contract.received_amount || 0}
                    suffix="원"
                    valueStyle={{ fontSize: 14, color: '#52c41a' }}
                  />
                </Col>
              </Row>
            )}

            {/* Collection rate */}
            {canViewFinance && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>수금률</Text>
                <Progress
                  percent={collectionRate}
                  size="small"
                  strokeColor={collectionRate >= 100 ? '#52c41a' : collectionRate >= 50 ? '#1890ff' : '#ff4d4f'}
                />
              </div>
            )}

            {/* Manager */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>담당자</Text>
              <Text style={{ fontSize: 12 }}>{contract.manager_name || '-'}</Text>
            </div>
          </Space>
        </Card>
      </Col>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <FundProjectionScreenOutlined style={{ marginRight: 8 }} />
              프로젝트 현황
            </Title>
            <span style={{ color: '#888' }}>계약 기반 프로젝트 현황을 한눈에 확인합니다.</span>
          </div>
          <Space wrap>
            <Input
              placeholder="계약명/거래처/계약번호 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
              style={{ width: 240 }}
            />
            <Select
              placeholder="부서"
              value={filterDept}
              onChange={setFilterDept}
              allowClear
              size="small"
              style={{ width: 160 }}
              options={departmentOptions}
            />
            <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('thisMonth')}>이번달</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('thisYear')}>올해</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('all')}>전체</Tag>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
              }}
              format="YYYY-MM-DD"
              allowClear={false}
              size="small"
            />
          </Space>
        </div>
      </div>

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="총 프로젝트"
              value={filteredContracts.length}
              suffix="건"
              prefix={<FundProjectionScreenOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Space>
                <Tag color="processing">{categorized.inProgress.length} 진행</Tag>
                <Tag color="success">{categorized.completed.length} 완료</Tag>
                <Tag color="error">{categorized.cancelled.length} 타절</Tag>
              </Space>
            </div>
          </Card>
        </Col>
        {/* 상단 총 계약금액/수금률 카드는 요청에 따라 숨김 */}
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'in_progress',
            label: (
              <span>
                <ClockCircleOutlined /> 현재 진행중 ({categorized.inProgress.length})
              </span>
            ),
          },
          {
            key: 'completed',
            label: (
              <span>
                <CheckCircleOutlined /> 완료 ({categorized.completed.length})
              </span>
            ),
          },
          {
            key: 'cancelled',
            label: (
              <span>
                <StopOutlined /> 타절 ({categorized.cancelled.length})
              </span>
            ),
          },
        ]}
      />

      {/* Project cards */}
      <Spin spinning={isLoading}>
        {currentList.length === 0 ? (
          <Empty description="해당하는 프로젝트가 없습니다." style={{ marginTop: 48 }} />
        ) : (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {currentList.map(renderProjectCard)}
          </Row>
        )}
      </Spin>

      {/* Project Detail Modal */}
      <Modal
        title={
          <Space>
            <FundProjectionScreenOutlined />
            <span>프로젝트 상세정보</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        destroyOnClose
        width={700}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            닫기
          </Button>,
          ...(user?.role !== 'employee' ? [
            <Button key="edit" type="primary" icon={<EditOutlined />} onClick={handleEditContract}>
              계약 수정
            </Button>,
          ] : []),
        ]}
      >
        {selectedContract && (() => {
          const c = selectedContract;
          const collectionRate = getCollectionRate(c);
          const progressPercent = getProgressPercent(c);

          return (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>{c.service_name || '(프로젝트명 없음)'}</Title>
                <Space>
                  <Select
                    value={c.progress}
                    onChange={(value) => handleStatusChange(c.id, value as ContractProgress)}
                    loading={statusChanging}
                    size="small"
                    style={{ width: 130 }}
                    disabled={user?.role === 'employee'}
                  >
                    {Object.entries(PROGRESS_CONFIG).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        <Tag color={config.color} style={{ margin: 0 }}>{config.label}</Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Space>
              </div>

              {/* 기본 정보 */}
              <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="계약번호">{c.contract_number || '-'}</Descriptions.Item>
                <Descriptions.Item label="계약유형">{CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type || '-'}</Descriptions.Item>
                <Descriptions.Item label="발주처" span={2}>{c.client_company || '-'}</Descriptions.Item>
                <Descriptions.Item label="발주처 담당자">{c.client_contact_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="연락처">{c.client_contact_phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="용역종류" span={2}>{c.service_category || '-'}</Descriptions.Item>
                <Descriptions.Item label="담당자">{c.manager_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="외주업체">{c.outsource_company || '-'}</Descriptions.Item>
              </Descriptions>

              {/* 기간 */}
              <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="계약체결일">{c.contract_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="계약기간">
                  {c.contract_start_date || '-'} ~ {c.contract_end_date || '-'}
                </Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: '12px 0' }} />

              {/* 금액 정보 */}
              {canViewFinance && (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="계약금액 (VAT 포함)"
                      value={formatAmount(c.total_amount)}
                      suffix="원"
                      valueStyle={{ fontSize: 16, color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="입금액"
                      value={formatAmount(c.received_amount)}
                      suffix="원"
                      valueStyle={{ fontSize: 16, color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="미수금"
                      value={formatAmount(c.remaining_amount)}
                      suffix="원"
                      valueStyle={{ fontSize: 16, color: c.remaining_amount > 0 ? '#ff4d4f' : '#52c41a' }}
                    />
                  </Col>
                </Row>
              )}

              {/* 인건비/경비/상세내역 breakdown */}
              {canViewFinance && contractDetail && (contractDetail.laborItems?.length > 0 || contractDetail.expenseItems?.length > 0 || contractDetail.sections?.length > 0) && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
                  <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>금액 내역</Text>
                  {contractDetail.laborItems?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>인건비</Text>
                      {contractDetail.laborItems.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px' }}>
                          <span>{item.grade_name} ({item.quantity}명 x {item.participation_rate} x {item.months}개월)</span>
                          <span style={{ fontWeight: 600 }}>{(item.subtotal || 0).toLocaleString()}원</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px', borderTop: '1px solid #e8e8e8', fontWeight: 600, color: '#1890ff' }}>
                        <span>인건비 소계</span>
                        <span>{(contractDetail.labor_total || contractDetail.laborItems.reduce((s: number, i: any) => s + (i.subtotal || 0), 0)).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                  {contractDetail.expenseItems?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>경비</Text>
                      {contractDetail.expenseItems.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px' }}>
                          <span>{item.category_name}{item.calculation_type === 'percentage' && item.rate ? ` (${(item.rate * 100).toFixed(0)}%)` : ''}</span>
                          <span style={{ fontWeight: 600 }}>{(item.amount || 0).toLocaleString()}원</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px', borderTop: '1px solid #e8e8e8', fontWeight: 600, color: '#52c41a' }}>
                        <span>경비 소계</span>
                        <span>{(contractDetail.expense_total || contractDetail.expenseItems.reduce((s: number, i: any) => s + (i.amount || 0), 0)).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                  {contractDetail.sections?.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>상세내역</Text>
                      {contractDetail.sections.filter((s: any) => s.level === 1).map((item: any, idx: number) => (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px', fontWeight: 600 }}>
                            <span>{item.title}</span>
                            <span>{(item.amount || 0).toLocaleString()}원</span>
                          </div>
                          {contractDetail.sections.filter((s: any) => s.parent_id === item.id).map((child: any, cIdx: number) => (
                            <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 8px 1px 24px', color: '#666' }}>
                              <span>{child.title}</span>
                              <span>{(child.amount || 0).toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 8px', borderTop: '1px solid #e8e8e8', fontWeight: 600, color: '#722ed1' }}>
                        <span>상세내역 소계</span>
                        <span>{(contractDetail.section_total || 0).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canViewFinance && c.outsource_amount ? (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="외주금액"
                      value={formatAmount(c.outsource_amount)}
                      suffix="원"
                      valueStyle={{ fontSize: 14, color: '#faad14' }}
                    />
                  </Col>
                </Row>
              ) : null}

              <Divider style={{ margin: '12px 0' }} />

              {/* 진행률 / 수금률 */}
              <Row gutter={24}>
                <Col span={canViewFinance ? 12 : 24}>
                  <Text type="secondary">진행률</Text>
                  <Progress
                    percent={progressPercent}
                    status={progressPercent >= 100 ? 'success' : 'active'}
                  />
                </Col>
                {canViewFinance && (
                  <Col span={12}>
                    <Text type="secondary">수금률</Text>
                    <Progress
                      percent={collectionRate}
                      strokeColor={collectionRate >= 100 ? '#52c41a' : collectionRate >= 50 ? '#1890ff' : '#ff4d4f'}
                    />
                  </Col>
                )}
              </Row>

              {/* 비고 */}
              {c.notes && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div>
                    <Text type="secondary">비고</Text>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.notes}</div>
                  </div>
                </>
              )}

              {/* 세부작업 */}
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong style={{ fontSize: 14 }}>세부작업</Text>
                <Spin spinning={subtasksLoading} size="small">
                  {subtasks.length === 0 && !subtasksLoading ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: '#999' }}>
                      등록된 세부작업이 없습니다.
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      {(() => {
                        // Build tree: level 1 parents with level 2 children
                        const parents = subtasks.filter(s => s.level === 1).sort((a, b) => a.sort_order - b.sort_order);
                        const children = subtasks.filter(s => s.level === 2);

                        return parents.map(parent => {
                          const parentStatus = SUBTASK_STATUS[parent.status] || SUBTASK_STATUS.pending;
                          const parentChildren = children
                            .filter(ch => ch.parent_id === parent.id)
                            .sort((a, b) => a.sort_order - b.sort_order);

                          return (
                            <div key={parent.id} style={{ marginBottom: 12 }}>
                              {/* Parent task */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  background: '#fafafa',
                                  borderRadius: 8,
                                  border: '1px solid #f0f0f0',
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag color={parentStatus.color} icon={parentStatus.icon} style={{ margin: 0 }}>
                                      {parentStatus.label}
                                    </Tag>
                                    <Text strong ellipsis>{parent.title}</Text>
                                  </div>
                                  {(parent.assignee_name || parent.start_date || parent.end_date) && (
                                    <div style={{ marginTop: 4, display: 'flex', gap: 12, fontSize: 12, color: '#888' }}>
                                      {parent.assignee_name && (
                                        <span><UserOutlined style={{ marginRight: 4 }} />{parent.assignee_name}</span>
                                      )}
                                      {(parent.start_date || parent.end_date) && (
                                        <span><CalendarOutlined style={{ marginRight: 4 }} />{parent.start_date || ''} ~ {parent.end_date || ''}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div style={{ width: 100, flexShrink: 0, marginLeft: 12 }}>
                                  <Tooltip title={`${parent.progress_rate}%`}>
                                    <Progress
                                      percent={parent.progress_rate}
                                      size="small"
                                      status={parent.progress_rate >= 100 ? 'success' : 'active'}
                                    />
                                  </Tooltip>
                                </div>
                              </div>

                              {/* Children tasks */}
                              {parentChildren.length > 0 && (
                                <div style={{ marginLeft: 24, marginTop: 4 }}>
                                  {parentChildren.map(child => {
                                    const childStatus = SUBTASK_STATUS[child.status] || SUBTASK_STATUS.pending;
                                    return (
                                      <div
                                        key={child.id}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '6px 12px',
                                          borderLeft: '2px solid #e8e8e8',
                                          marginBottom: 2,
                                        }}
                                      >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Tag color={childStatus.color} style={{ margin: 0, fontSize: 11 }}>
                                              {childStatus.label}
                                            </Tag>
                                            <Text ellipsis style={{ fontSize: 13 }}>{child.title}</Text>
                                          </div>
                                          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                            {child.assignee_name && (
                                              <><UserOutlined style={{ marginRight: 4 }} />{child.assignee_name}</>
                                            )}
                                            {(child.start_date || child.end_date) && (
                                              <span style={{ marginLeft: child.assignee_name ? 8 : 0 }}>
                                                <CalendarOutlined style={{ marginRight: 4 }} />{child.start_date || ''} ~ {child.end_date || ''}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div style={{ width: 80, flexShrink: 0, marginLeft: 8 }}>
                                          <Progress
                                            percent={child.progress_rate}
                                            size="small"
                                            status={child.progress_rate >= 100 ? 'success' : 'active'}
                                            strokeWidth={4}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </Spin>
              </div>

              {/* 세금계산서 발행 이력 (재무 권한 사용자만) */}
              {canViewFinance && (
              <>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong style={{ fontSize: 14 }}>세금계산서 발행 이력</Text>
                {contractTaxInvoices.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: '#999' }}>
                    발행 이력이 없습니다.
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {contractTaxInvoices.map((inv: any) => (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          borderBottom: '1px solid #f0f0f0',
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <Tag color="blue" style={{ marginRight: 6 }}>{inv.status || '-'}</Tag>
                          <span>{inv.issue_date || '-'}</span>
                          <span style={{ color: '#999', marginLeft: 8 }}>
                            {inv.invoice_number || ''}
                          </span>
                        </div>
                        <div>
                          <span style={{ marginRight: 12 }}>공급가액 {(inv.supply_amount || 0).toLocaleString()}원</span>
                          <span style={{ marginRight: 12 }}>VAT {(inv.vat_amount || 0).toLocaleString()}원</span>
                          <span style={{ fontWeight: 600 }}>합계 {(inv.total_amount || 0).toLocaleString()}원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </>
              )}

              {/* 청구/입금 이력 (재무 권한 사용자만) */}
              {canViewFinance && (() => {
                const billingItems = contractBillings.map((b: any) => ({
                  kind: 'billing' as const,
                  date: b.billing_date || b.created_at || '',
                  data: b,
                }));
                const receiptItems = contractPaymentReceipts.map((r: any) => ({
                  kind: 'receipt' as const,
                  date: r.payment_date || r.created_at || '',
                  data: r,
                }));
                const timeline = [...billingItems, ...receiptItems].sort((a, b) =>
                  (a.date || '').localeCompare(b.date || '')
                );
                const totalBilled = contractBillings.reduce(
                  (s: number, b: any) => s + (b.billing_amount || 0), 0);
                const totalReceived = contractPaymentReceipts.reduce(
                  (s: number, r: any) => s + (r.amount || 0), 0);
                const diff = totalBilled - totalReceived;
                const paymentMethodLabel: Record<string, string> = {
                  bank_transfer: '계좌이체',
                  cash: '현금',
                  card: '카드',
                  check: '수표',
                  other: '기타',
                };
                const billingStatusColor: Record<string, string> = {
                  draft: 'default',
                  pending: 'default',
                  issued: 'blue',
                  partial: 'orange',
                  paid: 'green',
                };
                return (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>청구/입금 이력</Text>
                      <Row gutter={8} style={{ marginTop: 8, marginBottom: 8 }}>
                        <Col span={8}>
                          <Statistic
                            title={<span style={{ fontSize: 11 }}>총 청구액</span>}
                            value={totalBilled}
                            suffix="원"
                            valueStyle={{ fontSize: 14, color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={<span style={{ fontSize: 11 }}>총 입금액</span>}
                            value={totalReceived}
                            suffix="원"
                            valueStyle={{ fontSize: 14, color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={<span style={{ fontSize: 11 }}>차액 (미수)</span>}
                            value={diff}
                            suffix="원"
                            valueStyle={{ fontSize: 14, color: diff > 0 ? '#ff4d4f' : '#999' }}
                          />
                        </Col>
                      </Row>
                      {timeline.length === 0 ? (
                        <div style={{ padding: '12px 0', textAlign: 'center', color: '#999' }}>
                          청구/입금 이력이 없습니다.
                        </div>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          {timeline.map((item) => {
                            if (item.kind === 'billing') {
                              const b = item.data;
                              return (
                                <div
                                  key={`b-${b.id}`}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '6px 12px',
                                    borderBottom: '1px solid #f0f0f0',
                                    fontSize: 12,
                                  }}
                                >
                                  <div>
                                    <Tag color="blue" style={{ marginRight: 6 }}>청구</Tag>
                                    <Tag color={billingStatusColor[b.status] || 'default'} style={{ marginRight: 6 }}>
                                      {b.status || '-'}
                                    </Tag>
                                    <span>{item.date || '-'}</span>
                                    <span style={{ color: '#999', marginLeft: 8 }}>
                                      {b.billing_number || ''}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>
                                      {formatAmount(b.billing_amount || 0)}원
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            const r = item.data;
                            return (
                              <div
                                key={`r-${r.id}`}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '6px 12px',
                                  borderBottom: '1px solid #f0f0f0',
                                  fontSize: 12,
                                  background: '#fafffb',
                                }}
                              >
                                <div>
                                  <Tag color="green" style={{ marginRight: 6 }}>입금</Tag>
                                  <span>{item.date || '-'}</span>
                                  <span style={{ color: '#999', marginLeft: 8 }}>
                                    {paymentMethodLabel[r.payment_method] || r.payment_method || ''}
                                  </span>
                                  {r.depositor_name && (
                                    <span style={{ color: '#666', marginLeft: 8 }}>
                                      {r.depositor_name}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <span style={{ fontWeight: 600, color: '#52c41a' }}>
                                    +{formatAmount(r.amount || 0)}원
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* 회의록/기타자료 (모든 사용자 조회 가능) */}
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong style={{ fontSize: 14 }}>회의록/기타자료</Text>
                {contractMeetingNotes.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: '#999' }}>
                    등록된 회의록이 없습니다.
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {contractMeetingNotes.map((note: any) => (
                      <div
                        key={note.id}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #f0f0f0',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{note.file_name}</div>
                        <div style={{ color: '#999', fontSize: 11 }}>
                          {note.created_at ? dayjs(note.created_at).format('YYYY-MM-DD HH:mm') : ''}
                        </div>
                        {note.content_text && (
                          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#555', maxHeight: 80, overflow: 'auto' }}>
                            {note.content_text.slice(0, 500)}{note.content_text.length > 500 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default ProjectDashboard;
