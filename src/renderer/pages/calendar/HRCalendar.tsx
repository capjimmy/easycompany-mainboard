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
  Spin,
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
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
  status: 'approved' | 'pending' | 'rejected' | 'dept_approved';
}

const leaveTypeConfig: Record<LeaveType, { color: string; label: string; icon: React.ReactNode }> = {
  annual: { color: 'blue', label: '연차', icon: <CalendarOutlined /> },
  sick: { color: 'red', label: '병가', icon: <MedicineBoxOutlined /> },
  business_trip: { color: 'purple', label: '출장', icon: <CarOutlined /> },
  remote: { color: 'cyan', label: '재택', icon: <HomeOutlined /> },
  half_day: { color: 'orange', label: '반차', icon: <CoffeeOutlined /> },
  birthday: { color: 'magenta', label: '생일', icon: <GiftOutlined /> },
};

// leave_requests의 leave_type을 HREvent type으로 매핑
const mapLeaveType = (leaveType: string): LeaveType => {
  const mapping: Record<string, LeaveType> = {
    annual: 'annual',
    half_day_am: 'half_day',
    half_day_pm: 'half_day',
    sick: 'sick',
    business_trip: 'business_trip',
    remote: 'remote',
  };
  return mapping[leaveType] || 'annual';
};

const HRCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedCompanyId, setSelectedCompany } = useAuthStore();
  const [events, setEvents] = useState<HREvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<HREvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const isDeptManager = user?.role === 'department_manager';
  const isAdmin = isSuperAdmin || isCompanyAdmin;
  // 부서 콤보박스를 사용할 수 있는 역할 (전체부서 선택 가능)
  const canPickDept = isAdmin;
  // 회사 콤보박스 (super_admin만)
  const canPickCompany = isSuperAdmin;

  // 회사 목록 (super_admin 전용)
  useEffect(() => {
    if (!isSuperAdmin || !user?.id) return;
    (async () => {
      try {
        const result = await window.electronAPI.companies.getAll(user.id);
        if (result.success && result.companies) {
          setCompanies(result.companies.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [isSuperAdmin, user?.id]);

  // 권한별 기본 필터: employee만 자기 부서 고정, dept_manager/admin은 전체
  useEffect(() => {
    if (!isAdmin && !isDeptManager && user?.department_id) {
      // employee: 자기 부서 고정
      setFilterDepartment(user.department_id);
    } else {
      // dept_manager/admin: 전체 (부서 콤보로 필터 가능)
      setFilterDepartment('all');
    }
  }, [user?.id, user?.department_id, isAdmin, isDeptManager]);

  useEffect(() => {
    loadAllEvents();
    // 회사/부서/사용자 변경 시 재조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedCompanyId, filterDepartment, isAdmin]);

  // 회사가 바뀌면 부서 필터를 '전체'로 초기화
  useEffect(() => {
    if (isAdmin) setFilterDepartment('all');
  }, [selectedCompanyId, isAdmin]);

  const loadAllEvents = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const allEvents: HREvent[] = [];

      // super_admin은 선택된 회사, 그 외는 자기 회사 컨텍스트
      const effectiveCompanyId = isSuperAdmin
        ? selectedCompanyId || undefined
        : user.company_id;

      // 1. 생일 이벤트 — 이사회 의견 반영하여 표시 제거 (2026-05-15)
      //    필요 시 settings에 birthday_enabled 플래그를 두고 토글하도록 확장 가능

      // 2. 연차/휴가 이벤트 로드 (승인된 것 + 대기 중인 것)
      const leaveFilters: any = { calendarMode: true };
      if (isSuperAdmin && selectedCompanyId) leaveFilters.company_id = selectedCompanyId;
      if (isAdmin && filterDepartment && filterDepartment !== 'all') {
        leaveFilters.department_id = filterDepartment;
      }
      const leaveResult = await window.electronAPI.leave.getAllRequests(user.id, leaveFilters);
      if (leaveResult.success && leaveResult.requests) {
        const leaveEvents: HREvent[] = leaveResult.requests
          .filter((r: any) => r.status !== 'rejected' && r.status !== 'cancelled')
          .map((r: any) => ({
            id: `leave-${r.id}`,
            date: r.start_date,
            endDate: r.end_date !== r.start_date ? r.end_date : undefined,
            type: mapLeaveType(r.leave_type),
            employeeId: r.user_id,
            employeeName: `[${r.department_name || '미배정'}] ${r.user_name || ''}`,
            departmentId: r.department_id || '',
            departmentName: r.department_name || '미배정',
            description: r.reason || '',
            status: r.status,
          }));
        allEvents.push(...leaveEvents);
      }

      setEvents(allEvents);
    } catch (e) {
      console.error('Failed to load HR events:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Dayjs): HREvent[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter((event) => {
      if (filterType !== 'all' && event.type !== filterType) return false;
      if (filterDepartment !== 'all' && event.departmentId !== filterDepartment) return false;

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
      case 'dept_approved':
        return <Tag color="processing">부서승인</Tag>;
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
    if (event.status === 'rejected') return false;
    const today = dayjs();
    if (event.endDate) {
      return today.isSame(event.date, 'day') || today.isSame(event.endDate, 'day') ||
             (today.isAfter(event.date, 'day') && today.isBefore(event.endDate, 'day'));
    }
    return event.date === today.format('YYYY-MM-DD');
  });

  // 부서 목록 로드 (선택된 회사 기준)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const loadDepartments = async () => {
      if (!user?.id) return;
      try {
        const companyFilter = isSuperAdmin
          ? selectedCompanyId || undefined
          : user.company_id;
        const result = await (window as any).electronAPI.departments.getAll(user.id, companyFilter);
        if (result.success && result.departments) {
          const deptList = [
            ...(canPickDept ? [{ id: 'all', name: '전체 부서' }] : []),
            ...result.departments.map((d: any) => ({ id: d.id, name: d.name })),
          ];
          setDepartments(deptList);
        }
      } catch (e) {
        setDepartments(canPickDept ? [{ id: 'all', name: '전체 부서' }] : []);
      }
    };
    loadDepartments();
  }, [user?.id, isSuperAdmin, selectedCompanyId, canPickDept]);

  return (
    <Spin spinning={loading}>
      <div>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            인사 캘린더
          </Title>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hr/leave')}>
              내 상태 (연차·출장·재택)
            </Button>
            {canPickCompany && (
              <Select
                value={selectedCompanyId || 'all'}
                onChange={(v) => {
                  if (v === 'all') {
                    setSelectedCompany(null, null);
                  } else {
                    const c = companies.find((x) => x.id === v);
                    setSelectedCompany(v, c?.name || null);
                  }
                }}
                style={{ width: 180 }}
                options={[
                  { value: 'all', label: '전체 회사' },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
            <Select
              value={filterDepartment}
              onChange={setFilterDepartment}
              style={{ width: 160 }}
              disabled={!canPickDept}
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
          destroyOnClose
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
    </Spin>
  );
};

export default HRCalendar;
