import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Tabs, Progress, Statistic, Tag, Row, Col, Space, Spin, Empty,
  Button, message, Modal, Descriptions, Divider, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, StopOutlined, MinusCircleOutlined,
  DollarOutlined, FundProjectionScreenOutlined, DownloadOutlined, EditOutlined,
  UserOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('in_progress');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadContracts();
    }
  }, [user?.id, selectedCompanyId]);

  const handleExportExcel = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.export.projects(user.id);
      if (result.success) {
        message.success(`엑셀 파일이 저장되었습니다: ${result.filePath}`);
      } else if (result.error !== '저장이 취소되었습니다.') {
        message.error(result.error || '내보내기에 실패했습니다.');
      }
    } catch (err) {
      message.error('엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const loadContracts = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const filters = user.role === 'super_admin' && selectedCompanyId ? { company_id: selectedCompanyId } : {};
      const result = await window.electronAPI.contracts.getAll(user.id, filters);
      if (result.success) {
        let filtered = result.contracts as Contract[];

        // Role-based filtering
        if (user.role === 'employee') {
          filtered = filtered.filter(
            (c) => c.created_by === user.id || c.manager_id === user.id
          );
        } else if (user.role === 'department_manager') {
          filtered = filtered.filter(
            (c) =>
              c.department_id === user.department_id ||
              c.created_by === user.id ||
              c.manager_id === user.id
          );
        }

        setContracts(filtered);
      }
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Categorize contracts
  const categorized = useMemo(() => {
    const inProgress = contracts.filter((c) => IN_PROGRESS_STATUSES.includes(c.progress));
    const completed = contracts.filter((c) => COMPLETED_STATUSES.includes(c.progress));
    const cancelled = contracts.filter((c) => CANCELLED_STATUSES.includes(c.progress));
    return { inProgress, completed, cancelled };
  }, [contracts]);

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
    const totalAmount = contracts.reduce((sum, c) => sum + (c.total_amount || 0), 0);
    const receivedAmount = contracts.reduce((sum, c) => sum + (c.received_amount || 0), 0);
    const collectionRate = totalAmount > 0 ? Math.round((receivedAmount / totalAmount) * 100) : 0;

    return { totalAmount, receivedAmount, collectionRate };
  }, [contracts]);

  const getCollectionRate = (c: Contract) => {
    if (!c.total_amount || c.total_amount === 0) return 0;
    return Math.round((c.received_amount / c.total_amount) * 100);
  };

  const getProgressPercent = (c: Contract) => {
    return c.progress_rate || 0;
  };

  const handleCardClick = async (contract: Contract) => {
    setSelectedContract(contract);
    setDetailModalOpen(true);
    setSubtasks([]);
    if (user?.id) {
      setSubtasksLoading(true);
      try {
        const result = await window.electronAPI.subtasks.getByContract(user.id, contract.id);
        if (result.success) {
          setSubtasks(result.subtasks || []);
        }
      } catch (_) {}
      setSubtasksLoading(false);
    }
  };

  const handleEditContract = () => {
    if (selectedContract) {
      setDetailModalOpen(false);
      navigate(`/contracts/edit/${selectedContract.id}`);
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

            {/* Collection rate */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>수금률</Text>
              <Progress
                percent={collectionRate}
                size="small"
                strokeColor={collectionRate >= 100 ? '#52c41a' : collectionRate >= 50 ? '#1890ff' : '#ff4d4f'}
              />
            </div>

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
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <FundProjectionScreenOutlined style={{ marginRight: 8 }} />
            프로젝트 현황
          </Title>
          <span style={{ color: '#888' }}>계약 기반 프로젝트 현황을 한눈에 확인합니다.</span>
        </div>
        {(user?.role === 'super_admin' || user?.role === 'company_admin') && (
          <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
            엑셀 내보내기
          </Button>
        )}
      </div>

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="총 프로젝트"
              value={contracts.length}
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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="총 계약금액"
              value={summaryStats.totalAmount}
              suffix="원"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="총 수금률"
              value={summaryStats.collectionRate}
              suffix="%"
              valueStyle={{ color: summaryStats.collectionRate >= 80 ? '#52c41a' : '#ff4d4f' }}
            />
            <Progress
              percent={summaryStats.collectionRate}
              size="small"
              showInfo={false}
              strokeColor={summaryStats.collectionRate >= 80 ? '#52c41a' : '#ff4d4f'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
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
        width={700}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            닫기
          </Button>,
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={handleEditContract}>
            계약 수정
          </Button>,
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
                <Tag color={PROGRESS_CONFIG[c.progress]?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {PROGRESS_CONFIG[c.progress]?.label}
                </Tag>
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

              {c.outsource_amount ? (
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
                <Col span={12}>
                  <Text type="secondary">진행률</Text>
                  <Progress
                    percent={progressPercent}
                    status={progressPercent >= 100 ? 'success' : 'active'}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary">수금률</Text>
                  <Progress
                    percent={collectionRate}
                    strokeColor={collectionRate >= 100 ? '#52c41a' : collectionRate >= 50 ? '#1890ff' : '#ff4d4f'}
                  />
                </Col>
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
                                          {child.assignee_name && (
                                            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                              <UserOutlined style={{ marginRight: 4 }} />{child.assignee_name}
                                              {(child.start_date || child.end_date) && (
                                                <span style={{ marginLeft: 8 }}>
                                                  <CalendarOutlined style={{ marginRight: 4 }} />{child.start_date || ''} ~ {child.end_date || ''}
                                                </span>
                                              )}
                                            </div>
                                          )}
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
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default ProjectDashboard;
