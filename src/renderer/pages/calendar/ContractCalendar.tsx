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
import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';

const { Title, Text } = Typography;

interface CalendarEvent {
  id: string;
  date: string;
  type: 'contract_start' | 'contract_end' | 'payment_due' | 'milestone' | 'delivery' | 'custom';
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
  custom: { color: 'cyan', label: '커스텀 이벤트', icon: <CalendarOutlined /> },
};

const ContractCalendar: React.FC = () => {
  const { user } = useAuthStore();
  const { contracts, fetchContracts } = useContractStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [customEvents, setCustomEvents] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchContracts(user.id);
    }
  }, [user?.id]);

  // 입금 내역 로드
  useEffect(() => {
    const loadPayments = async () => {
      if (!user?.id || contracts.length === 0) return;
      const allPayments: any[] = [];
      for (const contract of contracts) {
        try {
          const result = await window.electronAPI.contracts.getById(user.id, contract.id);
          if (result.success && result.contract?.payments) {
            allPayments.push(...result.contract.payments.map((p: any) => ({
              ...p,
              contract_id: contract.id,
              service_name: contract.service_name,
            })));
          }
        } catch (err) {
          // skip
        }
      }
      setPayments(allPayments);
    };
    loadPayments();
  }, [contracts, user?.id]);

  // 커스텀 이벤트 로드
  useEffect(() => {
    const loadCustomEvents = async () => {
      if (!user?.id) return;
      try {
        const result = await window.electronAPI.contracts.getAllEvents(user.id);
        if (result.success) {
          setCustomEvents(result.events || []);
        }
      } catch (err) {
        console.error('Failed to load custom events:', err);
      }
    };
    loadCustomEvents();
  }, [user?.id, contracts]);

  // 계약서에서 이벤트 추출
  useEffect(() => {
    const extractedEvents: CalendarEvent[] = [];
    const today = dayjs();

    contracts.forEach((contract: any) => {
      // 계약 시작일 (contract_start_date 필드명 사용)
      const startDateStr = contract.contract_start_date || contract.start_date;
      if (startDateStr) {
        const startDate = dayjs(startDateStr);
        extractedEvents.push({
          id: `${contract.id}-start`,
          date: startDate.format('YYYY-MM-DD'),
          type: 'contract_start',
          title: '계약 시작',
          contractId: contract.id,
          contractName: contract.service_name,
          status: startDate.isBefore(today, 'day') ? 'completed' : startDate.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }

      // 계약 종료일
      const endDateStr = contract.contract_end_date || contract.end_date;
      if (endDateStr) {
        const endDate = dayjs(endDateStr);
        extractedEvents.push({
          id: `${contract.id}-end`,
          date: endDate.format('YYYY-MM-DD'),
          type: 'contract_end',
          title: '계약 종료',
          contractId: contract.id,
          contractName: contract.service_name,
          status: endDate.isBefore(today, 'day') ? 'completed' : endDate.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }

      // 미수금이 있는 계약 - 종료일 기준 입금 예정
      if (contract.remaining_amount > 0 && (contract.contract_end_date || contract.end_date)) {
        const endStr = contract.contract_end_date || contract.end_date;
        const paymentDate = dayjs(endStr).subtract(7, 'day');
        if (paymentDate.isAfter(today.subtract(30, 'day'))) {
          extractedEvents.push({
            id: `${contract.id}-payment`,
            date: paymentDate.format('YYYY-MM-DD'),
            type: 'payment_due',
            title: `입금 예정: ${contract.remaining_amount?.toLocaleString()}원`,
            contractId: contract.id,
            contractName: contract.service_name,
            status: paymentDate.isBefore(today, 'day') ? 'overdue' : paymentDate.isSame(today, 'day') ? 'today' : 'upcoming',
          });
        }
      }
    });

    // 실제 입금 내역 이벤트 추가
    payments.forEach((payment: any) => {
      if (payment.payment_date) {
        const pDate = dayjs(payment.payment_date);
        extractedEvents.push({
          id: `payment-${payment.id}`,
          date: pDate.format('YYYY-MM-DD'),
          type: 'milestone',
          title: `입금: ${payment.amount?.toLocaleString()}원 (${payment.description || payment.payment_type})`,
          contractId: payment.contract_id,
          contractName: payment.service_name || '',
          status: 'completed',
        });
      }
    });

    // 커스텀 이벤트 추가
    customEvents.forEach((ce: any) => {
      if (ce.event_date) {
        const eventDate = dayjs(ce.event_date);
        extractedEvents.push({
          id: `custom-${ce.id}`,
          date: eventDate.format('YYYY-MM-DD'),
          type: 'custom',
          title: ce.event_title,
          description: ce.event_description,
          contractId: ce.contract_id,
          contractName: ce.contract_name || '',
          status: eventDate.isBefore(today, 'day') ? 'completed' : eventDate.isSame(today, 'day') ? 'today' : 'upcoming',
        });
      }
    });

    setEvents(extractedEvents);
  }, [contracts, payments, customEvents]);

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
