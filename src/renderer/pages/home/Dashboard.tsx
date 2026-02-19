import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Progress, List, Tag, Avatar } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  DollarOutlined,
  TeamOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  // 더미 데이터 (실제로는 API에서 가져옴)
  const stats = {
    contracts: { total: 156, change: 12.5, trend: 'up' },
    revenue: { total: 245000000, change: 8.3, trend: 'up' },
    employees: { total: 42, change: 2, trend: 'up' },
    projects: { total: 23, active: 15, completed: 8 },
  };

  const recentContracts = [
    { id: 1, name: '(주)테크솔루션 웹개발', amount: 15000000, status: 'active', date: '2026-01-20' },
    { id: 2, name: '스마트시스템 유지보수', amount: 5000000, status: 'pending', date: '2026-01-18' },
    { id: 3, name: '이노베이션 컨설팅', amount: 8000000, status: 'completed', date: '2026-01-15' },
    { id: 4, name: '글로벌테크 SI 프로젝트', amount: 45000000, status: 'active', date: '2026-01-10' },
  ];

  const upcomingTasks = [
    { id: 1, title: '(주)테크솔루션 중간 검수', dueDate: '2026-01-28', priority: 'high' },
    { id: 2, title: '스마트시스템 계약서 검토', dueDate: '2026-01-29', priority: 'medium' },
    { id: 3, title: '월간 매출 보고서 작성', dueDate: '2026-01-31', priority: 'high' },
    { id: 4, title: '신규 직원 온보딩', dueDate: '2026-02-01', priority: 'low' },
  ];

  const statusColors: Record<string, string> = {
    active: 'blue',
    pending: 'orange',
    completed: 'green',
  };

  const priorityColors: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'green',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
  };

  // 권한에 따라 대시보드 섹션 필터링
  const canViewFinance = user?.role === 'super_admin' || user?.role === 'company_admin' ||
    user?.permissions?.['receivables']?.view;
  const canViewHR = user?.role === 'super_admin' || user?.role === 'company_admin' ||
    user?.permissions?.['employees']?.view;

  return (
    <div className="fade-in">
      {/* 환영 메시지 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          안녕하세요, {user?.name || '사용자'}님
        </Title>
        <Text type="secondary">오늘도 좋은 하루 되세요!</Text>
      </div>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card" hoverable>
            <Statistic
              title="총 계약 건수"
              value={stats.contracts.total}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              suffix={
                <Text
                  type={stats.contracts.trend === 'up' ? 'success' : 'danger'}
                  style={{ fontSize: 14 }}
                >
                  {stats.contracts.trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {stats.contracts.change}%
                </Text>
              }
            />
          </Card>
        </Col>

        {canViewFinance && (
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-card" hoverable>
              <Statistic
                title="이번 달 매출"
                value={stats.revenue.total}
                precision={0}
                prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                formatter={(value) => `${(Number(value) / 10000).toLocaleString()}만`}
                suffix={
                  <Text type="success" style={{ fontSize: 14 }}>
                    <ArrowUpOutlined /> {stats.revenue.change}%
                  </Text>
                }
              />
            </Card>
          </Col>
        )}

        {canViewHR && (
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-card" hoverable>
              <Statistic
                title="직원 수"
                value={stats.employees.total}
                prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                suffix={<Text style={{ fontSize: 14, color: '#52c41a' }}>+{stats.employees.change}</Text>}
              />
            </Card>
          </Col>
        )}

        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card" hoverable>
            <Statistic
              title="진행 중 프로젝트"
              value={stats.projects.active}
              prefix={<ProjectOutlined style={{ color: '#fa8c16' }} />}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>/ {stats.projects.total}</Text>}
            />
            <Progress
              percent={Math.round((stats.projects.completed / stats.projects.total) * 100)}
              size="small"
              style={{ marginTop: 8 }}
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
            extra={<a href="#/contracts">전체보기</a>}
          >
            <List
              dataSource={recentContracts}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          background: statusColors[item.status] === 'blue' ? '#1890ff' :
                            statusColors[item.status] === 'orange' ? '#fa8c16' : '#52c41a',
                        }}
                        icon={
                          item.status === 'completed' ? <CheckCircleOutlined /> :
                          item.status === 'pending' ? <ClockCircleOutlined /> : <FileTextOutlined />
                        }
                      />
                    }
                    title={item.name}
                    description={item.date}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</div>
                    <Tag color={statusColors[item.status]}>
                      {item.status === 'active' ? '진행중' : item.status === 'pending' ? '대기' : '완료'}
                    </Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 다가오는 일정 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>다가오는 일정</span>
              </Space>
            }
            extra={<a href="#/project/timeline">전체보기</a>}
          >
            <List
              dataSource={upcomingTasks}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          background: priorityColors[item.priority] === 'red' ? '#ff4d4f' :
                            priorityColors[item.priority] === 'orange' ? '#fa8c16' : '#52c41a',
                        }}
                        icon={
                          item.priority === 'high' ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />
                        }
                      />
                    }
                    title={item.title}
                    description={`마감: ${item.dueDate}`}
                  />
                  <Tag color={priorityColors[item.priority]}>
                    {item.priority === 'high' ? '긴급' : item.priority === 'medium' ? '보통' : '낮음'}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
