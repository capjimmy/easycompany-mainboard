import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Calendar, Badge, List, Typography, Space, Tag, Modal, Button, Empty, Select, Row, Col, Spin } from 'antd';
import {
  CalendarOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';

const { Title, Text } = Typography;

interface TimelineEvent {
  id: string;
  date: string;
  type: 'contract_start' | 'contract_end' | 'custom';
  title: string;
  description?: string;
  contractId: string;
  contractName: string;
  color?: string;
  status: 'upcoming' | 'today' | 'overdue' | 'completed';
}

const eventTypeConfig: Record<string, { color: string; label: string }> = {
  contract_start: { color: 'green', label: '계약 시작' },
  contract_end: { color: 'red', label: '계약 종료' },
  custom: { color: 'cyan', label: '커스텀 이벤트' },
};

const ProjectTimeline: React.FC = () => {
  const { user } = useAuthStore();
  const { contracts, fetchContracts } = useContractStore();
  const navigate = useNavigate();
  const [customEvents, setCustomEvents] = useState<any[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchContracts(user.id);
      loadCustomEvents();
    }
  }, [user?.id]);

  const loadCustomEvents = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.contracts.getAllEvents(user.id);
      if (result.success) {
        setCustomEvents(result.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  // 모든 이벤트 통합
  useEffect(() => {
    const today = dayjs();
    const allEvents: TimelineEvent[] = [];

    // 계약 시작/종료
    contracts.forEach((contract: any) => {
      const startDate = contract.contract_start_date || contract.start_date;
      if (startDate) {
        const d = dayjs(startDate);
        allEvents.push({
          id: `${contract.id}-start`,
          date: d.format('YYYY-MM-DD'),
          type: 'contract_start',
          title: '계약 시작',
          contractId: contract.id,
          contractName: contract.service_name,
          status: d.isBefore(today, 'day') ? 'completed' : d.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }

      const endDate = contract.contract_end_date || contract.end_date;
      if (endDate) {
        const d = dayjs(endDate);
        allEvents.push({
          id: `${contract.id}-end`,
          date: d.format('YYYY-MM-DD'),
          type: 'contract_end',
          title: '계약 종료',
          contractId: contract.id,
          contractName: contract.service_name,
          status: d.isBefore(today, 'day') ? 'completed' : d.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }
    });

    // 커스텀 이벤트
    customEvents.forEach((ce: any) => {
      if (ce.event_date) {
        const d = dayjs(ce.event_date);
        allEvents.push({
          id: `custom-${ce.id}`,
          date: d.format('YYYY-MM-DD'),
          type: 'custom',
          title: ce.event_title,
          description: ce.event_description,
          contractId: ce.contract_id,
          contractName: ce.contract_name || '',
          color: ce.event_color,
          status: d.isBefore(today, 'day') ? 'completed' : d.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }
    });

    setEvents(allEvents);
  }, [contracts, customEvents]);

  const getEventsForDate = (date: Dayjs): TimelineEvent[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter((event) => {
      if (filterType !== 'all' && event.type !== filterType) return false;
      return event.date === dateStr;
    });
  };

  const dateCellRender = (date: Dayjs) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayEvents.slice(0, 3).map((event) => (
          <li key={event.id} style={{ marginBottom: 2 }}>
            <Badge
              color={event.type === 'custom' ? (event.color || 'cyan') : eventTypeConfig[event.type]?.color || 'default'}
              text={
                <Text style={{ fontSize: 11 }} ellipsis={{ tooltip: `${event.contractName}: ${event.title}` }}>
                  {event.title.slice(0, 8)}
                </Text>
              }
            />
          </li>
        ))}
        {dayEvents.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: 10 }}>+{dayEvents.length - 3}개 더보기</Text>
          </li>
        )}
      </ul>
    );
  };

  const handleDateSelect = (date: Dayjs) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setSelectedEvents(dayEvents);
      setModalVisible(true);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'overdue':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>지연</Tag>;
      case 'today':
        return <Tag color="warning">오늘</Tag>;
      case 'completed':
        return <Tag color="default">완료</Tag>;
      default:
        return <Tag color="processing">예정</Tag>;
    }
  };

  // 이번 달 이벤트
  const thisMonthEvents = events
    .filter((e) => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      const d = dayjs(e.date);
      return d.month() === dayjs().month() && d.year() === dayjs().year();
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <CalendarOutlined style={{ marginRight: 8 }} />
            일정 관리
          </Title>
          <span style={{ color: '#888' }}>계약 시작/종료 및 커스텀 이벤트를 캘린더로 관리합니다.</span>
        </div>
        <Space>
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '전체 이벤트' },
              { value: 'contract_start', label: '계약 시작' },
              { value: 'contract_end', label: '계약 종료' },
              { value: 'custom', label: '커스텀 이벤트' },
            ]}
          />
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* 캘린더 */}
        <Card style={{ flex: 1 }}>
          <Calendar
            cellRender={(date, info) => {
              if (info.type === 'date') return dateCellRender(date);
              return null;
            }}
            onSelect={handleDateSelect}
          />
        </Card>

        {/* 사이드바 */}
        <Card title="이번 달 일정" style={{ width: 320 }}>
          {thisMonthEvents.length === 0 ? (
            <Empty description="이번 달 일정이 없습니다" />
          ) : (
            <List
              size="small"
              dataSource={thisMonthEvents}
              renderItem={(event) => (
                <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate(`/contracts/${event.contractId}/edit`)}>
                  <List.Item.Meta
                    avatar={
                      <Badge color={event.type === 'custom' ? (event.color || 'cyan') : eventTypeConfig[event.type]?.color || 'default'} />
                    }
                    title={
                      <Space>
                        <Text style={{ fontSize: 12 }}>{dayjs(event.date).format('MM/DD')}</Text>
                        {getStatusTag(event.status)}
                      </Space>
                    }
                    description={
                      <Text ellipsis style={{ fontSize: 12 }}>
                        {event.contractName}: {event.title}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>

      {/* 이벤트 상세 모달 */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            {selectedDate?.format('YYYY년 MM월 DD일')} 일정
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>닫기</Button>,
        ]}
      >
        <List
          dataSource={selectedEvents}
          renderItem={(event) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Badge color={event.type === 'custom' ? (event.color || 'cyan') : eventTypeConfig[event.type]?.color || 'default'} />
                }
                title={
                  <Space>
                    <Tag color={eventTypeConfig[event.type]?.color}>
                      {eventTypeConfig[event.type]?.label}
                    </Tag>
                    {getStatusTag(event.status)}
                  </Space>
                }
                description={
                  <div>
                    <div>
                      <strong>계약명: </strong>
                      <a onClick={() => { setModalVisible(false); navigate(`/contracts/${event.contractId}/edit`); }}>
                        {event.contractName}
                      </a>
                    </div>
                    <div><strong>내용:</strong> {event.title}</div>
                    {event.description && <div>{event.description}</div>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default ProjectTimeline;
