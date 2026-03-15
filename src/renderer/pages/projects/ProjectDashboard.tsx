import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Tabs, Progress, Statistic, Tag, Row, Col, Space, Spin, Empty,
  Button, message,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, StopOutlined,
  DollarOutlined, FundProjectionScreenOutlined, DownloadOutlined,
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import type { Contract, ContractProgress } from '../../../shared/types';

const { Title, Text } = Typography;

const PROGRESS_CONFIG: Record<ContractProgress, { label: string; color: string }> = {
  contract_signed: { label: '계약체결', color: 'blue' },
  in_progress: { label: '진행중', color: 'processing' },
  inspection: { label: '검수중', color: 'warning' },
  completed: { label: '완료', color: 'success' },
  on_hold: { label: '보류', color: 'default' },
  cancelled: { label: '취소', color: 'error' },
};

// 진행중 상태들
const IN_PROGRESS_STATUSES: ContractProgress[] = ['contract_signed', 'in_progress', 'inspection', 'on_hold'];
const COMPLETED_STATUSES: ContractProgress[] = ['completed'];
const CANCELLED_STATUSES: ContractProgress[] = ['cancelled'];

const ProjectDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('in_progress');

  useEffect(() => {
    if (user?.id) {
      loadContracts();
    }
  }, [user?.id]);

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
      const result = await window.electronAPI.contracts.getAll(user.id);
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
        // company_admin: already filtered by company in IPC
        // super_admin: all contracts returned

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

  const renderProjectCard = (contract: Contract) => {
    const collectionRate = getCollectionRate(contract);
    const progressPercent = getProgressPercent(contract);

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={contract.id}>
        <Card
          hoverable
          style={{ height: '100%' }}
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
            프로젝트 현황판
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
    </div>
  );
};

export default ProjectDashboard;
