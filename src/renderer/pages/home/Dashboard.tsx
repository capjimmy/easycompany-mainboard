import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Space, List, Tag, Avatar, Spin, Select } from 'antd';
import {
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  AuditOutlined,
  BankOutlined,
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

interface DashboardStats {
  totalContracts: number;
  inProgressCount: number;
  completedCount: number;
  contractSignedCount: number;
  totalContractAmount: number;
  totalReceivedAmount: number;
  totalRemainingAmount: number;
  totalQuotes: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalContracts: 0,
    inProgressCount: 0,
    completedCount: 0,
    contractSignedCount: 0,
    totalContractAmount: 0,
    totalReceivedAmount: 0,
    totalRemainingAmount: 0,
    totalQuotes: 0,
  });
  const [recentContracts, setRecentContracts] = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  // 슈퍼관리자 회사별 필터
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const isSuperAdmin = user?.role === 'super_admin';

  // 회사 목록 로드 (슈퍼관리자만)
  useEffect(() => {
    if (isSuperAdmin && user?.id) {
      window.electronAPI.companies.getAll(user.id).then((result: any) => {
        if (result.success && result.companies) {
          setCompanies(result.companies);
        }
      }).catch(() => {});
    }
  }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id, selectedCompanyId]);

  const loadDashboardData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 계약서와 견적서 데이터를 병렬로 로드
      const [contractResult, quoteResult] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id),
        window.electronAPI.quotes.getAll(user.id),
      ]);

      if (contractResult.success && contractResult.contracts) {
        let contracts = contractResult.contracts;

        // 슈퍼관리자 회사별 필터링
        if (isSuperAdmin && selectedCompanyId !== 'all') {
          contracts = contracts.filter((c: any) => c.company_id === selectedCompanyId);
        }

        // 통계 계산
        const inProgress = contracts.filter((c: any) => c.progress === 'in_progress');
        const completed = contracts.filter((c: any) => c.progress === 'completed');
        const signed = contracts.filter((c: any) => c.progress === 'contract_signed');

        setStats(prev => ({
          ...prev,
          totalContracts: contracts.length,
          inProgressCount: inProgress.length,
          completedCount: completed.length,
          contractSignedCount: signed.length,
          totalContractAmount: contracts.reduce((sum: number, c: any) => sum + (c.total_amount || 0), 0),
          totalReceivedAmount: contracts.reduce((sum: number, c: any) => sum + (c.received_amount || 0), 0),
          totalRemainingAmount: contracts.reduce((sum: number, c: any) => sum + (c.remaining_amount || 0), 0),
        }));

        // 최근 계약 5건 (최신순)
        setRecentContracts(contracts.slice(0, 5));
      }

      if (quoteResult.success && quoteResult.quotes) {
        let quotes = quoteResult.quotes;

        // 슈퍼관리자 회사별 필터링
        if (isSuperAdmin && selectedCompanyId !== 'all') {
          quotes = quotes.filter((q: any) => q.company_id === selectedCompanyId);
        }

        setStats(prev => ({
          ...prev,
          totalQuotes: quotes.length,
        }));
        setRecentQuotes(quotes.slice(0, 5));
      }
    } catch (err) {
      console.error('Dashboard data load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    }
    if (value >= 10000) {
      return `${Math.round(value / 10000).toLocaleString()}만`;
    }
    return value.toLocaleString();
  };

  const progressLabels: Record<string, { color: string; label: string }> = {
    contract_signed: { color: 'blue', label: '계약체결' },
    in_progress: { color: 'processing', label: '진행중' },
    completed: { color: 'green', label: '완료' },
    cancelled: { color: 'red', label: '취소' },
    inspection: { color: 'orange', label: '검수중' },
    on_hold: { color: 'warning', label: '보류' },
  };

  const quoteStatusLabels: Record<string, { color: string; label: string }> = {
    draft: { color: 'default', label: '초안' },
    submitted: { color: 'cyan', label: '제출' },
    approved: { color: 'green', label: '승인' },
    rejected: { color: 'red', label: '반려' },
    converted: { color: 'geekblue', label: '전환완료' },
    negotiating: { color: 'orange', label: '협상중' },
  };

  // 권한에 따라 대시보드 섹션 필터링
  const canViewFinance = user?.role === 'super_admin' || user?.role === 'company_admin' ||
    user?.permissions?.['receivables']?.view;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 환영 메시지 + 회사 필터 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            안녕하세요, {user?.name || '사용자'}님
          </Title>
          <Text type="secondary">오늘도 좋은 하루 되세요!</Text>
        </div>

        {/* 슈퍼관리자 회사별 필터 */}
        {isSuperAdmin && companies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BankOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            <Select
              value={selectedCompanyId}
              onChange={(value) => setSelectedCompanyId(value)}
              style={{ minWidth: 200 }}
              size="middle"
            >
              <Option value="all">전체</Option>
              {companies.map((company: any) => (
                <Option key={company.id} value={company.id}>
                  {company.name}
                </Option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card" hoverable onClick={() => navigate('/contracts')}>
            <Statistic
              title="총 계약 건수"
              value={stats.totalContracts}
              suffix="건"
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card" hoverable onClick={() => navigate('/contracts')}>
            <Statistic
              title="진행중"
              value={stats.inProgressCount}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>/ 완료 {stats.completedCount}건</Text>}
              prefix={<SyncOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>

        {canViewFinance && (
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-card" hoverable>
              <Statistic
                title="총 계약금액"
                value={stats.totalContractAmount}
                prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                formatter={() => formatCurrency(stats.totalContractAmount)}
              />
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  수금: {formatCurrency(stats.totalReceivedAmount)}원 / 미수금: {formatCurrency(stats.totalRemainingAmount)}원
                </Text>
              </div>
            </Card>
          </Col>
        )}

        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card" hoverable onClick={() => navigate('/quotes')}>
            <Statistic
              title="견적서"
              value={stats.totalQuotes}
              suffix="건"
              prefix={<AuditOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 하단 섹션 */}
      <Row gutter={[16, 16]}>
        {/* 최근 계약 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>최근 계약</span>
              </Space>
            }
            extra={<a onClick={() => navigate('/contracts')}>전체보기</a>}
          >
            {recentContracts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                등록된 계약이 없습니다.
              </div>
            ) : (
              <List
                dataSource={recentContracts}
                renderItem={(item) => {
                  const p = progressLabels[item.progress] || { color: 'default', label: item.progress };
                  return (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/contracts/${item.id}`)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{
                              background: item.progress === 'completed' ? '#52c41a' :
                                item.progress === 'in_progress' ? '#1890ff' : '#fa8c16',
                            }}
                            icon={
                              item.progress === 'completed' ? <CheckCircleOutlined /> :
                              item.progress === 'in_progress' ? <SyncOutlined /> : <ClockCircleOutlined />
                            }
                          />
                        }
                        title={
                          <span>
                            <Text strong style={{ fontSize: 13 }}>{item.contract_number}</Text>
                            <Text style={{ marginLeft: 8, fontSize: 13 }}>{item.client_company}</Text>
                          </span>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                            {item.service_name}
                          </Text>
                        }
                      />
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {item.total_amount ? `${(item.total_amount / 10000).toLocaleString()}만` : '-'}
                        </div>
                        <Tag color={p.color} style={{ marginRight: 0 }}>{p.label}</Tag>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        {/* 최근 견적서 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <AuditOutlined />
                <span>최근 견적서</span>
              </Space>
            }
            extra={<a onClick={() => navigate('/quotes')}>전체보기</a>}
          >
            {recentQuotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                등록된 견적서가 없습니다.
              </div>
            ) : (
              <List
                dataSource={recentQuotes}
                renderItem={(item) => {
                  const s = quoteStatusLabels[item.status] || { color: 'default', label: item.status };
                  return (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/quotes/${item.id}`)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{
                              background: item.status === 'converted' ? '#2f54eb' :
                                item.status === 'approved' ? '#52c41a' : '#722ed1',
                            }}
                            icon={<AuditOutlined />}
                          />
                        }
                        title={
                          <span>
                            <Text strong style={{ fontSize: 13 }}>{item.quote_number}</Text>
                            <Text style={{ marginLeft: 8, fontSize: 13 }}>{item.recipient_company}</Text>
                          </span>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                            {item.service_name || item.title}
                          </Text>
                        }
                      />
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {item.grand_total ? `${(item.grand_total / 10000).toLocaleString()}만` : '-'}
                        </div>
                        <Tag color={s.color} style={{ marginRight: 0 }}>{s.label}</Tag>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
