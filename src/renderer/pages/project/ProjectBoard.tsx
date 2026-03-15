import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Badge, List, Empty, Space, Statistic, Spin } from 'antd';
import {
  AppstoreOutlined, CalendarOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';

const { Title, Text } = Typography;

const ProjectBoard: React.FC = () => {
  const { user } = useAuthStore();
  const { contracts, fetchContracts } = useContractStore();
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchContracts(user.id);
      loadAllEvents();
    }
  }, [user?.id]);

  const loadAllEvents = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.contracts.getAllEvents(user.id);
      if (result.success) {
        setAllEvents(result.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = dayjs();

  // 통계
  const overdueEvents = allEvents.filter(e => dayjs(e.event_date).isBefore(today, 'day'));
  const todayEvents = allEvents.filter(e => dayjs(e.event_date).isSame(today, 'day'));
  const thisWeekEvents = allEvents.filter(e => {
    const d = dayjs(e.event_date);
    return d.isAfter(today, 'day') && d.isBefore(today.add(7, 'day'), 'day');
  });
  const upcomingEvents = allEvents.filter(e => dayjs(e.event_date).isAfter(today, 'day'))
    .sort((a, b) => dayjs(a.event_date).valueOf() - dayjs(b.event_date).valueOf());

  // 계약별 그룹
  const eventsByContract: Record<string, any[]> = {};
  allEvents.forEach(evt => {
    if (!eventsByContract[evt.contract_id]) {
      eventsByContract[evt.contract_id] = [];
    }
    eventsByContract[evt.contract_id].push(evt);
  });

  // 진행 중인 계약 + 이벤트가 있는 계약만
  const contractsWithEvents = contracts
    .filter((c: any) => eventsByContract[c.id])
    .map((c: any) => ({
      ...c,
      events: (eventsByContract[c.id] || []).sort(
        (a: any, b: any) => dayjs(a.event_date).valueOf() - dayjs(b.event_date).valueOf()
      ),
    }));

  const getEventStatus = (eventDate: string) => {
    const d = dayjs(eventDate);
    if (d.isBefore(today, 'day')) return 'overdue';
    if (d.isSame(today, 'day')) return 'today';
    return 'upcoming';
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'overdue':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>지연</Tag>;
      case 'today':
        return <Tag color="warning" icon={<ClockCircleOutlined />}>오늘</Tag>;
      default:
        return <Tag color="processing" icon={<CalendarOutlined />}>예정</Tag>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <AppstoreOutlined style={{ marginRight: 8 }} />
            프로젝트 현황판
          </Title>
          <span style={{ color: '#888' }}>계약별 일정 이벤트를 한눈에 확인합니다.</span>
        </div>
      </div>

      {/* 통계 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="전체 이벤트"
              value={allEvents.length}
              suffix="건"
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="오늘 이벤트"
              value={todayEvents.length}
              suffix="건"
              valueStyle={{ color: todayEvents.length > 0 ? '#faad14' : undefined }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="이번 주 예정"
              value={thisWeekEvents.length}
              suffix="건"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="지연 이벤트"
              value={overdueEvents.length}
              suffix="건"
              valueStyle={{ color: overdueEvents.length > 0 ? '#ff4d4f' : undefined }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 계약별 이벤트 카드 */}
      {contractsWithEvents.length === 0 ? (
        <Card>
          <Empty description="등록된 일정 이벤트가 없습니다. 계약 수정 화면에서 이벤트를 추가해보세요." />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {contractsWithEvents.map((contract: any) => (
            <Col key={contract.id} xs={24} md={12} lg={8}>
              <Card
                title={
                  <Space>
                    <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/contracts/${contract.id}/edit`)}>
                      {contract.service_name}
                    </span>
                    <Tag>{contract.events.length}개</Tag>
                  </Space>
                }
                size="small"
                hoverable
                extra={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {contract.client_company}
                  </Text>
                }
              >
                <List
                  size="small"
                  dataSource={contract.events.slice(0, 5)}
                  renderItem={(evt: any) => {
                    const status = getEventStatus(evt.event_date);
                    return (
                      <List.Item style={{ padding: '4px 0' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <Badge color={evt.event_color || 'cyan'} />
                            <Text style={{ fontSize: 13 }}>{evt.event_title}</Text>
                          </Space>
                          <Space>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {dayjs(evt.event_date).format('MM/DD')}
                            </Text>
                            {getStatusTag(status)}
                          </Space>
                        </Space>
                      </List.Item>
                    );
                  }}
                />
                {contract.events.length > 5 && (
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      +{contract.events.length - 5}개 더보기
                    </Text>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 예정 이벤트 타임라인 */}
      {upcomingEvents.length > 0 && (
        <Card title="다가오는 일정" style={{ marginTop: 24 }}>
          <List
            size="small"
            dataSource={upcomingEvents.slice(0, 10)}
            renderItem={(evt: any) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Badge color={evt.event_color || 'cyan'} />}
                  title={
                    <Space>
                      <Text>{evt.event_title}</Text>
                      <Tag color="processing">{dayjs(evt.event_date).format('YYYY-MM-DD')}</Tag>
                    </Space>
                  }
                  description={
                    <span
                      style={{ cursor: 'pointer', color: '#1890ff' }}
                      onClick={() => navigate(`/contracts/${evt.contract_id}/edit`)}
                    >
                      {evt.contract_name || evt.contract_number}
                      {evt.event_description ? ` - ${evt.event_description}` : ''}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default ProjectBoard;
