import React, { useState, useEffect } from 'react';
import {
  Card,
  Calendar,
  Badge,
  Modal,
  List,
  Tag,
  Typography,
  Space,
  Select,
  Button,
  Tooltip,
  Empty,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  FileTextOutlined,
  CalendarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useContractStore } from '../../store/contractStore';

const { Title, Text } = Typography;

interface CalendarEvent {
  id: string;
  date: string;
  type: 'contract_start' | 'contract_end' | 'payment_due' | 'milestone' | 'delivery';
  title: string;
  description?: string;
  contractId: string;
  contractName: string;
  status?: 'upcoming' | 'today' | 'overdue' | 'completed';
}

const eventTypeConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  contract_start: { color: 'green', label: '계약 시작', icon: <FileTextOutlined /> },
  contract_end: { color: 'red', label: '계약 종료', icon: <ClockCircleOutlined /> },
  payment_due: { color: 'gold', label: '입금 예정', icon: <DollarOutlined /> },
  milestone: { color: 'blue', label: '마일스톤', icon: <CheckCircleOutlined /> },
  delivery: { color: 'purple', label: '납품', icon: <CalendarOutlined /> },
};

const ContractCalendar: React.FC = () => {
  const { contracts, fetchContracts } = useContractStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchContracts();
  }, []);

  // 계약서에서 이벤트 추출
  useEffect(() => {
    const extractedEvents: CalendarEvent[] = [];
    const today = dayjs();

    contracts.forEach((contract) => {
      // 계약 시작일
      if (contract.start_date) {
        const startDate = dayjs(contract.start_date);
        extractedEvents.push({
          id: `${contract.id}-start`,
          date: contract.start_date,
          type: 'contract_start',
          title: '계약 시작',
          contractId: contract.id,
          contractName: contract.service_name,
          status: startDate.isBefore(today, 'day') ? 'completed' : startDate.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }

      // 계약 종료일
      if (contract.end_date) {
        const endDate = dayjs(contract.end_date);
        extractedEvents.push({
          id: `${contract.id}-end`,
          date: contract.end_date,
          type: 'contract_end',
          title: '계약 종료',
          contractId: contract.id,
          contractName: contract.service_name,
          status: endDate.isBefore(today, 'day') ? 'completed' : endDate.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }

      // 입금 예정일 (계약금액이 있고 미수금이 있는 경우)
      if (contract.remaining_amount > 0 && contract.end_date) {
        // 임의로 종료일 7일 전을 입금 예정일로 설정 (실제로는 계약서에서 추출)
        const paymentDate = dayjs(contract.end_date).subtract(7, 'day');
        if (paymentDate.isAfter(today.subtract(30, 'day'))) {
          extractedEvents.push({
            id: `${contract.id}-payment`,
            date: paymentDate.format('YYYY-MM-DD'),
            type: 'payment_due',
            title: `입금 예정: ${contract.remaining_amount.toLocaleString()}원`,
            contractId: contract.id,
            contractName: contract.service_name,
            status: paymentDate.isBefore(today, 'day') ? 'overdue' : paymentDate.isSame(today, 'day') ? 'today' : 'upcoming',
          });
        }
      }
    });

    setEvents(extractedEvents);
  }, [contracts]);

  const getEventsForDate = (date: Dayjs): CalendarEvent[] => {
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
              color={eventTypeConfig[event.type]?.color || 'default'}
              text={
                <Text
                  style={{ fontSize: 11 }}
                  ellipsis={{ tooltip: `${event.contractName}: ${event.title}` }}
                >
                  {event.contractName.slice(0, 8)}
                </Text>
              }
            />
          </li>
        ))}
        {dayEvents.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{dayEvents.length - 3}개 더보기
            </Text>
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

  const getStatusTag = (status?: string) => {
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

  // 이번 달 주요 이벤트
  const thisMonthEvents = events.filter((event) => {
    const eventDate = dayjs(event.date);
    return eventDate.month() === dayjs().month() && eventDate.year() === dayjs().year();
  });

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          계약 캘린더
        </Title>
        <Space>
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '전체 이벤트' },
              { value: 'contract_start', label: '계약 시작' },
              { value: 'contract_end', label: '계약 종료' },
              { value: 'payment_due', label: '입금 예정' },
              { value: 'milestone', label: '마일스톤' },
              { value: 'delivery', label: '납품' },
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

        {/* 이번 달 이벤트 요약 */}
        <Card title="이번 달 일정" style={{ width: 320 }}>
          {thisMonthEvents.length === 0 ? (
            <Empty description="이번 달 일정이 없습니다" />
          ) : (
            <List
              size="small"
              dataSource={thisMonthEvents.sort((a, b) => a.date.localeCompare(b.date))}
              renderItem={(event) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Badge color={eventTypeConfig[event.type]?.color || 'default'} />
                    }
                    title={
                      <Space>
                        <Text style={{ fontSize: 12 }}>
                          {dayjs(event.date).format('MM/DD')}
                        </Text>
                        {getStatusTag(event.status)}
                      </Space>
                    }
                    description={
                      <Tooltip title={event.contractName}>
                        <Text ellipsis style={{ fontSize: 12 }}>
                          {event.contractName}: {event.title}
                        </Text>
                      </Tooltip>
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
          <Button key="close" onClick={() => setModalVisible(false)}>
            닫기
          </Button>,
        ]}
      >
        <List
          dataSource={selectedEvents}
          renderItem={(event) => (
            <List.Item>
              <List.Item.Meta
                avatar={eventTypeConfig[event.type]?.icon}
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
                    <div><strong>계약명:</strong> {event.contractName}</div>
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

export default ContractCalendar;
