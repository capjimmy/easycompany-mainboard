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
  Spin,
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
  description?: string;
}

const ROOM_COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d'];

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

const SpaceCalendar: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoom[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [form] = Form.useForm();

  // 공간 목록 로드
  const loadSpaces = async () => {
    if (!user?.id) return;
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      const res = await (window as any).electronAPI.spaces?.getAll(user.id, filters);
      if (res?.success) {
        const active = (res.data || []).filter((s: any) => s.is_active !== false);
        const mapped: MeetingRoom[] = active.map((s: any, idx: number) => ({
          id: s.id,
          name: s.name,
          capacity: s.capacity || 0,
          floor: s.location || '',
          color: ROOM_COLORS[idx % ROOM_COLORS.length],
          description: s.description || '',
        }));
        setMeetingRooms(mapped);
      }
    } catch (err) {
      console.error('Failed to load spaces:', err);
    }
  };

  // DB에서 예약 데이터 로드
  const loadReservations = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      const result = await window.electronAPI.meeting.getAll(user.id, filters);
      if (result.success && result.reservations) {
        const mapped: Reservation[] = result.reservations.map((r: any) => ({
          id: r.id,
          roomId: r.space_id || r.room_id || '',
          roomName: r.space_name || r.room_name || '회의실',
          date: r.reservation_date,
          startTime: (r.start_time || '').substring(0, 5),
          endTime: (r.end_time || '').substring(0, 5),
          title: r.title,
          organizer: r.reserved_by_name || '',
          organizerId: r.reserved_by,
          department: r.department || '',
          phone: r.phone || '',
          email: r.email || '',
          attendees: r.attendees || 1,
          description: r.notes || '',
          createdAt: r.created_at,
          color: r.color || null,
        } as any));
        setReservations(mapped);
      }
    } catch (err) {
      console.error('Failed to load reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
    loadReservations();
  }, [user?.id, selectedCompanyId]);

  const getReservationsForDate = (date: Dayjs): Reservation[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return reservations.filter((res) => {
      if (selectedRoom !== 'all' && res.roomId !== selectedRoom) return false;
      return res.date === dateStr;
    });
  };

  const dateCellRender = (date: Dayjs) => {
    const dayReservations = getReservationsForDate(date);
    if (dayReservations.length === 0) return null;

    const showRoomName = selectedRoom === 'all';

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayReservations.slice(0, 3).map((res) => {
          const room = meetingRooms.find((r) => r.id === res.roomId);
          // 우선순위: 예약자가 지정한 색 > 공간 색
          const bgColor = (res as any).color || room?.color || '#667eea';
          const display = showRoomName
            ? `${res.startTime}~${res.endTime} ${res.title}(${res.roomName})`
            : `${res.startTime}~${res.endTime} ${res.title}`;
          return (
            <li key={res.id} style={{ marginBottom: 3 }}>
              <div
                style={{
                  background: bgColor,
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 500,
                }}
                title={`${res.startTime}~${res.endTime} ${res.title} (${res.roomName}, ${res.organizer})`}
              >
                {display}
              </div>
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
    if (!user?.id) return;

    const room = meetingRooms.find((r) => r.id === values.roomId);
    const spaceName = room?.name || '';
    const dateStr = values.date.format('YYYY-MM-DD');
    const startTimeStr = values.timeRange[0].format('HH:mm');
    const endTimeStr = values.timeRange[1].format('HH:mm');

    try {
      const result = await window.electronAPI.meeting.create(user.id, {
        title: values.title,
        space_id: values.roomId,
        space_name: spaceName,
        department: values.department || user?.department_name || '',
        reservation_date: dateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        attendees: values.attendees || 1,
        phone: values.phone || '',
        email: values.email || '',
        notes: values.description || '',
        color: values.color || null,
      });

      if (result.success) {
        message.success('회의실이 예약되었습니다.');
        setReserveModalVisible(false);
        form.resetFields();
        await loadReservations();
      } else {
        if (result.error?.includes('이미 예약')) {
          Modal.error({
            title: '예약 불가',
            content: result.error,
          });
        } else {
          message.error(result.error || '예약에 실패했습니다.');
        }
      }
    } catch (err) {
      console.error('Failed to create reservation:', err);
      message.error('예약 중 오류가 발생했습니다.');
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.meeting.delete(user.id, id);
      if (result.success) {
        message.success('예약이 취소되었습니다.');
        setSelectedReservations(selectedReservations.filter((r) => r.id !== id));
        await loadReservations();
      } else {
        message.error(result.error || '예약 취소에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to cancel reservation:', err);
      message.error('예약 취소 중 오류가 발생했습니다.');
    }
  };

  // 오늘 예약 현황
  const todayReservations = reservations
    .filter((res) => res.date === dayjs().format('YYYY-MM-DD'))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Spin spinning={loading}>
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
          destroyOnClose
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
              const isAdmin = user?.role === 'super_admin';
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
                    ...((isOwner || isAdmin)
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
          destroyOnClose
          footer={[
            ...(selectedReservation && (selectedReservation.organizerId === user?.id || user?.role === 'super_admin' || user?.role === 'company_admin')
              ? [
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
                  </Popconfirm>,
                ]
              : []),
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              닫기
            </Button>,
          ]}
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
                <Text type="secondary">{dayjs(selectedReservation.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
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

            <Form.Item name="color" label="강조색 (캘린더 표시 배경)" tooltip="비워두면 회의실 기본색 사용">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['', '#667eea', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d', '#1890ff', '#faad14'].map((c) => (
                  <button
                    key={c || 'none'}
                    type="button"
                    onClick={() => form.setFieldsValue({ color: c })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: form.getFieldValue('color') === c ? '2px solid #1f2937' : '1px solid #d9d9d9',
                      background: c || 'repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 3px, #fff 3px, #fff 6px)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                    }}
                    title={c || '기본 (회의실 색)'}
                  />
                ))}
              </div>
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
    </Spin>
  );
};

export default SpaceCalendar;
