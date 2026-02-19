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
  Avatar,
  Empty,
  Tooltip,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  UserOutlined,
  CalendarOutlined,
  CarOutlined,
  MedicineBoxOutlined,
  HomeOutlined,
  CoffeeOutlined,
  GiftOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

type LeaveType = 'annual' | 'sick' | 'business_trip' | 'remote' | 'half_day' | 'birthday';

interface HREvent {
  id: string;
  date: string;
  endDate?: string;
  type: LeaveType;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  description?: string;
  status: 'approved' | 'pending' | 'rejected';
}

const leaveTypeConfig: Record<LeaveType, { color: string; label: string; icon: React.ReactNode }> = {
  annual: { color: 'blue', label: '연차', icon: <CalendarOutlined /> },
  sick: { color: 'red', label: '병가', icon: <MedicineBoxOutlined /> },
  business_trip: { color: 'purple', label: '출장', icon: <CarOutlined /> },
  remote: { color: 'cyan', label: '재택', icon: <HomeOutlined /> },
  half_day: { color: 'orange', label: '반차', icon: <CoffeeOutlined /> },
  birthday: { color: 'magenta', label: '생일', icon: <GiftOutlined /> },
};

const ContractCalendar: React.FC = () => {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<HREvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<HREvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // 더미 데이터 로드
  useEffect(() => {
    const today = dayjs();
    const dummyEvents: HREvent[] = [
      // 이번 주 이벤트
      {
        id: '1',
        date: today.format('YYYY-MM-DD'),
        type: 'annual',
        employeeId: 'emp1',
        employeeName: '김철수',
        departmentId: 'dev',
        departmentName: '개발팀',
        status: 'approved',
      },
      {
        id: '2',
        date: today.add(1, 'day').format('YYYY-MM-DD'),
        endDate: today.add(3, 'day').format('YYYY-MM-DD'),
        type: 'business_trip',
        employeeId: 'emp2',
        employeeName: '이영희',
        departmentId: 'sales',
        departmentName: '영업팀',
        description: '대전 고객사 미팅',
        status: 'approved',
      },
      {
        id: '3',
        date: today.add(2, 'day').format('YYYY-MM-DD'),
        type: 'remote',
        employeeId: 'emp3',
        employeeName: '박민수',
        departmentId: 'dev',
        departmentName: '개발팀',
        status: 'approved',
      },
      {
        id: '4',
        date: today.add(3, 'day').format('YYYY-MM-DD'),
        type: 'half_day',
        employeeId: 'emp4',
        employeeName: '정수진',
        departmentId: 'mgmt',
        departmentName: '경영지원팀',
        description: '오전 반차',
        status: 'approved',
      },
      {
        id: '5',
        date: today.add(5, 'day').format('YYYY-MM-DD'),
        type: 'birthday',
        employeeId: 'emp5',
        employeeName: '최동욱',
        departmentId: 'dev',
        departmentName: '개발팀',
        status: 'approved',
      },
      {
        id: '6',
        date: today.add(7, 'day').format('YYYY-MM-DD'),
        type: 'sick',
        employeeId: 'emp6',
        employeeName: '한지민',
        departmentId: 'rnd',
        departmentName: '연구팀',
        status: 'pending',
      },
      // 지난 주 이벤트
      {
        id: '7',
        date: today.subtract(2, 'day').format('YYYY-MM-DD'),
        type: 'annual',
        employeeId: 'emp7',
        employeeName: '송민호',
        departmentId: 'sales',
        departmentName: '영업팀',
        status: 'approved',
      },
    ];
    setEvents(dummyEvents);
  }, []);

  const getEventsForDate = (date: Dayjs): HREvent[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter((event) => {
      if (filterType !== 'all' && event.type !== filterType) return false;
      if (filterDepartment !== 'all' && event.departmentId !== filterDepartment) return false;

      // 시작일~종료일 범위 체크
      if (event.endDate) {
        const startDate = dayjs(event.date);
        const endDate = dayjs(event.endDate);
        return date.isSame(startDate, 'day') || date.isSame(endDate, 'day') ||
               (date.isAfter(startDate, 'day') && date.isBefore(endDate, 'day'));
      }
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
              color={leaveTypeConfig[event.type]?.color || 'default'}
              text={
                <Text
                  style={{ fontSize: 11 }}
                  ellipsis={{ tooltip: `${event.employeeName} - ${leaveTypeConfig[event.type]?.label}` }}
                >
                  {event.employeeName}
                </Text>
              }
            />
          </li>
        ))}
        {dayEvents.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{dayEvents.length - 3}명 더보기
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

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'approved':
        return <Tag color="success">승인</Tag>;
      case 'pending':
        return <Tag color="warning">대기</Tag>;
      case 'rejected':
        return <Tag color="error">반려</Tag>;
      default:
        return null;
    }
  };

  // 오늘 부재 현황
  const todayAbsent = events.filter((event) => {
    const today = dayjs();
    if (event.endDate) {
      return today.isSame(event.date, 'day') || today.isSame(event.endDate, 'day') ||
             (today.isAfter(event.date, 'day') && today.isBefore(event.endDate, 'day'));
    }
    return event.date === today.format('YYYY-MM-DD');
  });

  // 부서 목록 (더미)
  const departments = [
    { id: 'all', name: '전체 부서' },
    { id: 'dev', name: '개발팀' },
    { id: 'sales', name: '영업팀' },
    { id: 'mgmt', name: '경영지원팀' },
    { id: 'rnd', name: '연구팀' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          인사 캘린더
        </Title>
        <Space>
          <Select
            value={filterDepartment}
            onChange={setFilterDepartment}
            style={{ width: 130 }}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '전체 유형' },
              { value: 'annual', label: '연차' },
              { value: 'sick', label: '병가' },
              { value: 'business_trip', label: '출장' },
              { value: 'remote', label: '재택' },
              { value: 'half_day', label: '반차' },
              { value: 'birthday', label: '생일' },
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

        {/* 오늘 부재 현황 */}
        <Card
          title={
            <Space>
              <UserOutlined />
              오늘 부재 현황
              <Badge count={todayAbsent.length} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          }
          style={{ width: 320 }}
        >
          {todayAbsent.length === 0 ? (
            <Empty description="오늘 부재자가 없습니다" />
          ) : (
            <List
              size="small"
              dataSource={todayAbsent}
              renderItem={(event) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<UserOutlined />}
                        style={{
                          backgroundColor: leaveTypeConfig[event.type]?.color || '#1890ff'
                        }}
                      />
                    }
                    title={
                      <Space>
                        <Text>{event.employeeName}</Text>
                        <Tag color={leaveTypeConfig[event.type]?.color}>
                          {leaveTypeConfig[event.type]?.label}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {event.departmentName}
                        {event.description && ` - ${event.description}`}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {/* 유형별 범례 */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              유형별 표시
            </Text>
            <Space wrap size={[8, 8]}>
              {Object.entries(leaveTypeConfig).map(([key, config]) => (
                <Tag key={key} color={config.color} icon={config.icon}>
                  {config.label}
                </Tag>
              ))}
            </Space>
          </div>
        </Card>
      </div>

      {/* 이벤트 상세 모달 */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            {selectedDate?.format('YYYY년 MM월 DD일')} 부재 현황
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
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ backgroundColor: leaveTypeConfig[event.type]?.color }}
                  />
                }
                title={
                  <Space>
                    <Text strong>{event.employeeName}</Text>
                    <Tag color={leaveTypeConfig[event.type]?.color}>
                      {leaveTypeConfig[event.type]?.label}
                    </Tag>
                    {getStatusTag(event.status)}
                  </Space>
                }
                description={
                  <div>
                    <div><strong>부서:</strong> {event.departmentName}</div>
                    {event.endDate && (
                      <div>
                        <strong>기간:</strong> {event.date} ~ {event.endDate}
                      </div>
                    )}
                    {event.description && <div><strong>사유:</strong> {event.description}</div>}
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
