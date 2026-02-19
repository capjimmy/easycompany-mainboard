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
  Form,
  Input,
  TimePicker,
  DatePicker,
  message,
  Popconfirm,
  Avatar,
  Empty,
  Alert,
  Descriptions,
  InputNumber,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  floor: string;
  color: string;
  equipment?: string[];
}

interface Reservation {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  organizer: string;
  organizerId: string;
  department?: string;
  phone?: string;
  email?: string;
  attendees: number;
  description?: string;
  createdAt: string;
}

const meetingRooms: MeetingRoom[] = [
  { id: 'room1', name: '대회의실', capacity: 20, floor: '3층', color: '#1890ff', equipment: ['프로젝터', '화이트보드', '화상회의'] },
  { id: 'room2', name: '중회의실 A', capacity: 10, floor: '3층', color: '#52c41a', equipment: ['프로젝터', '화이트보드'] },
  { id: 'room3', name: '중회의실 B', capacity: 10, floor: '2층', color: '#faad14', equipment: ['TV 모니터', '화이트보드'] },
  { id: 'room4', name: '소회의실', capacity: 4, floor: '2층', color: '#eb2f96', equipment: ['화이트보드'] },
];

const SpaceCalendar: React.FC = () => {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [form] = Form.useForm();

  // 더미 데이터 로드
  useEffect(() => {
    const today = dayjs();
    const dummyReservations: Reservation[] = [
      {
        id: '1',
        roomId: 'room1',
        roomName: '대회의실',
        date: today.format('YYYY-MM-DD'),
        startTime: '10:00',
        endTime: '11:30',
        title: '주간 팀 미팅',
        organizer: '김철수',
        organizerId: 'emp1',
        department: '개발팀',
        phone: '010-1234-5678',
        email: 'kim@company.com',
        attendees: 12,
        description: '이번 주 진행 상황 공유 및 다음 주 계획 논의',
        createdAt: today.subtract(2, 'day').format('YYYY-MM-DD HH:mm'),
      },
      {
        id: '2',
        roomId: 'room2',
        roomName: '중회의실 A',
        date: today.format('YYYY-MM-DD'),
        startTime: '14:00',
        endTime: '15:00',
        title: '고객 미팅',
        organizer: '이영희',
        organizerId: 'emp2',
        department: '영업팀',
        phone: '010-2345-6789',
        email: 'lee@company.com',
        attendees: 5,
        description: 'ABC 회사 담당자 미팅',
        createdAt: today.subtract(1, 'day').format('YYYY-MM-DD HH:mm'),
      },
      {
        id: '3',
        roomId: 'room1',
        roomName: '대회의실',
        date: today.add(1, 'day').format('YYYY-MM-DD'),
        startTime: '09:00',
        endTime: '12:00',
        title: '월간 보고',
        organizer: '박민수',
        organizerId: 'emp3',
        department: '경영지원팀',
        phone: '010-3456-7890',
        attendees: 15,
        createdAt: today.subtract(3, 'day').format('YYYY-MM-DD HH:mm'),
      },
      {
        id: '4',
        roomId: 'room4',
        roomName: '소회의실',
        date: today.format('YYYY-MM-DD'),
        startTime: '16:00',
        endTime: '17:00',
        title: '1:1 면담',
        organizer: '정수진',
        organizerId: 'emp4',
        department: '인사팀',
        phone: '010-4567-8901',
        email: 'jung@company.com',
        attendees: 2,
        createdAt: today.format('YYYY-MM-DD HH:mm'),
      },
      {
        id: '5',
        roomId: 'room3',
        roomName: '중회의실 B',
        date: today.add(2, 'day').format('YYYY-MM-DD'),
        startTime: '13:00',
        endTime: '14:00',
        title: '프로젝트 킥오프',
        organizer: '최동욱',
        organizerId: 'emp5',
        department: '연구팀',
        phone: '010-5678-9012',
        attendees: 8,
        description: '신규 프로젝트 시작 미팅',
        createdAt: today.subtract(1, 'day').format('YYYY-MM-DD HH:mm'),
      },
    ];
    setReservations(dummyReservations);
  }, []);

  const getReservationsForDate = (date: Dayjs): Reservation[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return reservations.filter((res) => {
      if (selectedRoom !== 'all' && res.roomId !== selectedRoom) return false;
      return res.date === dateStr;
    });
  };

  // 중복 예약 체크 함수
  const checkConflict = (
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Reservation | null => {
    return reservations.find(
      (res) =>
        res.roomId === roomId &&
        res.date === date &&
        res.id !== excludeId &&
        !(endTime <= res.startTime || startTime >= res.endTime)
    ) || null;
  };

  const dateCellRender = (date: Dayjs) => {
    const dayReservations = getReservationsForDate(date);
    if (dayReservations.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayReservations.slice(0, 3).map((res) => {
          const room = meetingRooms.find((r) => r.id === res.roomId);
          return (
            <li key={res.id} style={{ marginBottom: 2 }}>
              <Badge
                color={room?.color || 'default'}
                text={
                  <Text
                    style={{ fontSize: 11 }}
                    ellipsis={{ tooltip: `${res.startTime} ${res.title} (${res.organizer})` }}
                  >
                    {res.startTime} {res.roomName.slice(0, 3)}
                  </Text>
                }
              />
            </li>
          );
        })}
        {dayReservations.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{dayReservations.length - 3}개 더보기
            </Text>
          </li>
        )}
      </ul>
    );
  };

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
    const dayReservations = getReservationsForDate(date);
    if (dayReservations.length > 0) {
      setSelectedReservations(dayReservations);
      setModalVisible(true);
    }
  };

  const handleReserve = () => {
    form.setFieldsValue({
      date: selectedDate,
      phone: user?.phone || '',
      email: user?.email || '',
    });
    setReserveModalVisible(true);
  };

  const handleViewDetail = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailModalVisible(true);
  };

  const handleReserveSubmit = async (values: any) => {
    const room = meetingRooms.find((r) => r.id === values.roomId);
    const dateStr = values.date.format('YYYY-MM-DD');
    const startTimeStr = values.timeRange[0].format('HH:mm');
    const endTimeStr = values.timeRange[1].format('HH:mm');

    // 중복 체크
    const conflicting = checkConflict(values.roomId, dateStr, startTimeStr, endTimeStr);

    if (conflicting) {
      Modal.error({
        title: '예약 불가',
        content: (
          <div>
            <p>해당 시간에 이미 예약이 있습니다.</p>
            <Alert
              type="warning"
              style={{ marginTop: 12 }}
              message={
                <div>
                  <div><strong>{conflicting.title}</strong></div>
                  <div>시간: {conflicting.startTime} - {conflicting.endTime}</div>
                  <div>신청자: {conflicting.organizer} ({conflicting.department})</div>
                  {conflicting.phone && <div>연락처: {conflicting.phone}</div>}
                </div>
              }
            />
            <p style={{ marginTop: 12, color: '#666' }}>
              다른 시간대를 선택하거나, 위 신청자에게 문의해주세요.
            </p>
          </div>
        ),
      });
      return;
    }

    // 참석 인원이 회의실 수용 인원 초과 체크
    if (room && values.attendees > room.capacity) {
      Modal.warning({
        title: '수용 인원 초과',
        content: `${room.name}의 최대 수용 인원은 ${room.capacity}명입니다. 더 큰 회의실을 선택해주세요.`,
      });
      return;
    }

    const newReservation: Reservation = {
      id: Date.now().toString(),
      roomId: values.roomId,
      roomName: room?.name || '',
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      title: values.title,
      organizer: user?.name || '사용자',
      organizerId: user?.id || '',
      department: values.department || user?.department || '',
      phone: values.phone,
      email: values.email,
      attendees: values.attendees || 1,
      description: values.description,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    };

    setReservations([...reservations, newReservation]);
    message.success('회의실이 예약되었습니다.');
    setReserveModalVisible(false);
    form.resetFields();
  };

  const handleCancelReservation = (id: string) => {
    setReservations(reservations.filter((r) => r.id !== id));
    setSelectedReservations(selectedReservations.filter((r) => r.id !== id));
    message.success('예약이 취소되었습니다.');
  };

  // 오늘 예약 현황
  const todayReservations = reservations
    .filter((res) => res.date === dayjs().format('YYYY-MM-DD'))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <EnvironmentOutlined style={{ marginRight: 8 }} />
          공간 캘린더 (회의실)
        </Title>
        <Space>
          <Select
            value={selectedRoom}
            onChange={setSelectedRoom}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '전체 회의실' },
              ...meetingRooms.map((room) => ({
                value: room.id,
                label: `${room.name} (${room.capacity}인)`,
              })),
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleReserve}>
            예약하기
          </Button>
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

        {/* 오늘 예약 현황 */}
        <div style={{ width: 320 }}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                오늘 예약 현황
                <Badge count={todayReservations.length} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {todayReservations.length === 0 ? (
              <Empty description="오늘 예약이 없습니다" />
            ) : (
              <List
                size="small"
                dataSource={todayReservations}
                renderItem={(res) => {
                  const room = meetingRooms.find((r) => r.id === res.roomId);
                  return (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleViewDetail(res)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{ backgroundColor: room?.color }}
                            size="small"
                          >
                            {res.roomName.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <Text style={{ fontSize: 13 }}>{res.title}</Text>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <ClockCircleOutlined /> {res.startTime} - {res.endTime}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <UserOutlined /> {res.organizer} ({res.department})
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>

          {/* 회의실 안내 */}
          <Card title="회의실 안내" size="small">
            <List
              size="small"
              dataSource={meetingRooms}
              renderItem={(room) => (
                <List.Item>
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space>
                      <Badge color={room.color} />
                      <Text strong>{room.name}</Text>
                      <Tag>{room.floor}</Tag>
                      <Tag icon={<TeamOutlined />}>{room.capacity}인</Tag>
                    </Space>
                    {room.equipment && (
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 14 }}>
                        {room.equipment.join(', ')}
                      </Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </div>
      </div>

      {/* 예약 목록 모달 */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            {selectedDate?.format('YYYY년 MM월 DD일')} 예약 현황
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={600}
        footer={[
          <Button key="reserve" type="primary" icon={<PlusOutlined />} onClick={handleReserve}>
            예약하기
          </Button>,
          <Button key="close" onClick={() => setModalVisible(false)}>
            닫기
          </Button>,
        ]}
      >
        <List
          dataSource={selectedReservations.sort((a, b) => a.startTime.localeCompare(b.startTime))}
          renderItem={(res) => {
            const room = meetingRooms.find((r) => r.id === res.roomId);
            const isOwner = res.organizerId === user?.id;
            return (
              <List.Item
                actions={[
                  <Button
                    key="detail"
                    type="link"
                    icon={<InfoCircleOutlined />}
                    onClick={() => handleViewDetail(res)}
                  >
                    상세
                  </Button>,
                  ...(isOwner
                    ? [
                        <Popconfirm
                          key="cancel"
                          title="예약을 취소하시겠습니까?"
                          onConfirm={() => handleCancelReservation(res.id)}
                          okText="취소"
                          cancelText="아니오"
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} size="small">
                            취소
                          </Button>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ backgroundColor: room?.color }}>
                      {res.roomName.charAt(0)}
                    </Avatar>
                  }
                  title={
                    <Space>
                      <Text strong>{res.title}</Text>
                      <Tag color={room?.color}>{res.roomName}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">
                        <ClockCircleOutlined /> {res.startTime} - {res.endTime}
                      </Text>
                      <Text type="secondary">
                        <UserOutlined /> {res.organizer} ({res.department}) · {res.attendees}명
                      </Text>
                      {res.phone && (
                        <Text type="secondary">
                          <PhoneOutlined /> {res.phone}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>

      {/* 예약 상세 모달 */}
      <Modal
        title="예약 상세 정보"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          selectedReservation?.organizerId === user?.id && (
            <Popconfirm
              key="cancel"
              title="예약을 취소하시겠습니까?"
              onConfirm={() => {
                handleCancelReservation(selectedReservation!.id);
                setDetailModalVisible(false);
              }}
              okText="취소"
              cancelText="아니오"
            >
              <Button danger>예약 취소</Button>
            </Popconfirm>
          ),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            닫기
          </Button>,
        ].filter(Boolean)}
        width={500}
      >
        {selectedReservation && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="회의 제목">
              <Text strong>{selectedReservation.title}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="회의실">
              {(() => {
                const room = meetingRooms.find((r) => r.id === selectedReservation.roomId);
                return (
                  <Space>
                    <Badge color={room?.color} />
                    {selectedReservation.roomName}
                    <Tag>{room?.floor}</Tag>
                  </Space>
                );
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="일시">
              {selectedReservation.date} {selectedReservation.startTime} - {selectedReservation.endTime}
            </Descriptions.Item>
            <Descriptions.Item label="참석 인원">
              {selectedReservation.attendees}명
            </Descriptions.Item>
            <Descriptions.Item label="신청자">
              <Space direction="vertical" size={0}>
                <Text strong>{selectedReservation.organizer}</Text>
                {selectedReservation.department && (
                  <Text type="secondary">{selectedReservation.department}</Text>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="연락처">
              <Space direction="vertical" size={0}>
                {selectedReservation.phone && (
                  <Text>
                    <PhoneOutlined style={{ marginRight: 8 }} />
                    {selectedReservation.phone}
                  </Text>
                )}
                {selectedReservation.email && (
                  <Text>
                    <MailOutlined style={{ marginRight: 8 }} />
                    {selectedReservation.email}
                  </Text>
                )}
                {!selectedReservation.phone && !selectedReservation.email && (
                  <Text type="secondary">연락처 없음</Text>
                )}
              </Space>
            </Descriptions.Item>
            {selectedReservation.description && (
              <Descriptions.Item label="회의 내용">
                {selectedReservation.description}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="신청일시">
              <Text type="secondary">{selectedReservation.createdAt}</Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 예약 폼 모달 */}
      <Modal
        title="회의실 예약"
        open={reserveModalVisible}
        onCancel={() => {
          setReserveModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleReserveSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="roomId"
            label="회의실"
            rules={[{ required: true, message: '회의실을 선택하세요' }]}
          >
            <Select placeholder="회의실 선택">
              {meetingRooms.map((room) => (
                <Select.Option key={room.id} value={room.id}>
                  <Space>
                    <Badge color={room.color} />
                    {room.name} ({room.floor}, {room.capacity}인)
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="date"
            label="날짜"
            rules={[{ required: true, message: '날짜를 선택하세요' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="시간"
            rules={[{ required: true, message: '시간을 선택하세요' }]}
          >
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={30}
              style={{ width: '100%' }}
              hideDisabledOptions
              disabledTime={() => ({
                disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 22, 23],
              })}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="회의 제목"
            rules={[{ required: true, message: '회의 제목을 입력하세요' }]}
          >
            <Input placeholder="예: 주간 팀 미팅" />
          </Form.Item>

          <Form.Item
            name="attendees"
            label="참석 인원"
            rules={[{ required: true, message: '참석 인원을 입력하세요' }]}
          >
            <InputNumber min={1} max={50} placeholder="예: 5" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="department" label="부서">
            <Input placeholder="예: 개발팀" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="연락처 (전화번호)"
            rules={[{ required: true, message: '연락처를 입력하세요' }]}
          >
            <Input placeholder="예: 010-1234-5678" prefix={<PhoneOutlined />} />
          </Form.Item>

          <Form.Item name="email" label="이메일">
            <Input placeholder="예: name@company.com" prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item name="description" label="회의 내용 (선택)">
            <TextArea rows={2} placeholder="회의 목적이나 안건을 간략히 입력하세요" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReserveModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                예약하기
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpaceCalendar;
