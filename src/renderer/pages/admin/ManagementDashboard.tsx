import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Space, Tag, Spin, DatePicker, message,
  Select, Tabs, Progress, Table,
} from 'antd';
import {
  CarOutlined, DollarOutlined, TeamOutlined, BarChartOutlined,
  FundOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ManagementDashboard: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const companyId = selectedCompanyId || user?.company_id;

  const [loading, setLoading] = useState(false);
  const [vehicleLogs, setVehicleLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [outsourcings, setOutsourcings] = useState<any[]>([]);

  // 기본 기간: 올해 1월~12월
  const currentYear = dayjs().year();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(`${currentYear}-01-01`),
    dayjs(`${currentYear}-12-31`),
  ]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, selectedCompanyId]);

  const load = async () => {
    if (!user?.id) return;
    // 슈퍼관리자가 회사 미선택 시 데이터 비움 (선택된 회사만 표시)
    if (!companyId) {
      setVehicleLogs([]); setVehicles([]); setUsers([]); setDepartments([]);
      setExpenses([]); setLeaves([]); setOutsourcings([]);
      return;
    }
    setLoading(true);
    try {
      const filter = { company_id: companyId };
      const [logs, vh, us, dp, ex, lv, os] = await Promise.all([
        (window as any).electronAPI.vehicleLogs.getAll(user.id, filter).catch(() => null),
        (window as any).electronAPI.vehicles.getAll(user.id, filter).catch(() => null),
        window.electronAPI.users.getAll(user.id).catch(() => null),
        (window as any).electronAPI.departments.getAll(user.id, companyId).catch(() => null),
        window.electronAPI.expenses.getAll(user.id, filter).catch(() => null),
        (window as any).electronAPI.leave.getAllRequests(user.id, {}).catch(() => null),
        (window as any).electronAPI.outsourcings.getAll(user.id, filter).catch(() => null),
      ]);
      setVehicleLogs(logs?.data || logs?.logs || []);
      setVehicles(vh?.data || vh?.vehicles || []);
      // users는 회사별로 필터 (선택된 회사 소속만)
      const allUsers = us?.users || [];
      setUsers(allUsers.filter((u: any) => u.company_id === companyId));
      setDepartments(dp?.departments || []);
      setExpenses(ex?.data || []);
      setLeaves(lv?.requests || []);
      setOutsourcings(os?.outsourcings || []);
    } catch (err: any) {
      message.error(err?.message || '데이터 조회 중 오류');
    } finally {
      setLoading(false);
    }
  };

  // 회사 격리 + 기간 필터링된 vehicleLogs
  const filteredLogs = useMemo(() => {
    let list = vehicleLogs;
    if (companyId) list = list.filter((l: any) => l.company_id === companyId);
    if (dateRange[0] && dateRange[1]) {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      list = list.filter((l: any) => l.log_date && l.log_date >= start && l.log_date <= end);
    }
    return list;
  }, [vehicleLogs, companyId, dateRange]);

  const vehicleMap = useMemo(() => {
    const m: Record<string, any> = {};
    vehicles.forEach((v: any) => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  // 운행일지 KPI
  const vehicleKpi = useMemo(() => {
    const totalCount = filteredLogs.length;
    let totalKm = 0;
    const drivers = new Set<string>();
    const vehiclesUsed = new Set<string>();
    for (const l of filteredLogs) {
      const km = (Number(l.end_km) || 0) - (Number(l.start_km) || 0);
      if (km > 0) totalKm += km;
      if (l.driver_id) drivers.add(l.driver_id);
      else if (l.driver_name) drivers.add(l.driver_name);
      if (l.vehicle_id) vehiclesUsed.add(l.vehicle_id);
    }
    return {
      totalCount,
      totalKm,
      avgKm: totalCount > 0 ? Math.round(totalKm / totalCount) : 0,
      driverCount: drivers.size,
      vehicleCount: vehiclesUsed.size,
    };
  }, [filteredLogs]);

  // 차량별 운행 통계
  const byVehicle = useMemo(() => {
    const m = new Map<string, { vehicle: string; plate: string; count: number; km: number }>();
    for (const l of filteredLogs) {
      const v = l.vehicle_id ? vehicleMap[l.vehicle_id] : null;
      const key = l.vehicle_id || 'unknown';
      const plate = v?.plate_number || '(미지정)';
      const model = v?.model || v?.vehicle_type || '';
      if (!m.has(key)) m.set(key, { vehicle: `${plate}${model ? ` (${model})` : ''}`, plate, count: 0, km: 0 });
      const row = m.get(key)!;
      row.count += 1;
      const km = (Number(l.end_km) || 0) - (Number(l.start_km) || 0);
      if (km > 0) row.km += km;
    }
    return Array.from(m.values()).sort((a, b) => b.km - a.km);
  }, [filteredLogs, vehicleMap]);

  // 운전자별 운행 통계
  const byDriver = useMemo(() => {
    const m = new Map<string, { driver: string; count: number; km: number }>();
    for (const l of filteredLogs) {
      const key = l.driver_id || l.driver_name || 'unknown';
      const name = l.driver_name || '(미지정)';
      if (!m.has(key)) m.set(key, { driver: name, count: 0, km: 0 });
      const row = m.get(key)!;
      row.count += 1;
      const km = (Number(l.end_km) || 0) - (Number(l.start_km) || 0);
      if (km > 0) row.km += km;
    }
    return Array.from(m.values()).sort((a, b) => b.km - a.km);
  }, [filteredLogs]);

  // 월별 운행 트렌드
  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; count: number; km: number }>();
    for (let i = 0; i < 12; i++) {
      const month = dayjs(`${currentYear}-01-01`).add(i, 'month').format('YYYY-MM');
      m.set(month, { month, count: 0, km: 0 });
    }
    for (const l of filteredLogs) {
      const mo = l.log_date ? String(l.log_date).slice(0, 7) : null;
      if (!mo || !m.has(mo)) continue;
      const row = m.get(mo)!;
      row.count += 1;
      const km = (Number(l.end_km) || 0) - (Number(l.start_km) || 0);
      if (km > 0) row.km += km;
    }
    return Array.from(m.values());
  }, [filteredLogs, currentYear]);

  // 경영관리부 직원 (있으면 강조)
  const mgmtDept = useMemo(() => {
    return departments.find((d: any) =>
      typeof d.name === 'string' && (d.name.includes('경영관리') || d.name.includes('경영지원'))
    );
  }, [departments]);

  const mgmtDeptMembers = useMemo(() => {
    if (!mgmtDept) return [];
    return users.filter((u: any) => u.department_id === mgmtDept.id && u.is_active);
  }, [users, mgmtDept]);

  // 이번 달 보조 카드
  const monthKey = dayjs().format('YYYY-MM');
  const thisMonthExpense = useMemo(() => {
    const list = expenses.filter((e: any) => {
      if (companyId && e.company_id !== companyId) return false;
      if (!(e.settlement_date || '').startsWith(monthKey)) return false;
      return e.status === 'approved' || e.status === 'paid';
    });
    return {
      count: list.length,
      total: list.reduce((s: number, e: any) => s + (e.total_amount || 0), 0),
    };
  }, [expenses, companyId, monthKey]);

  const thisMonthLeave = useMemo(() => {
    const ANNUAL_TYPES = ['annual', 'half_am', 'half_pm'];
    const list = leaves.filter((l: any) => l.status === 'approved' && (l.start_date || '').startsWith(monthKey));
    const annualUsed = list
      .filter((l: any) => ANNUAL_TYPES.includes(l.leave_type))
      .reduce((s: number, l: any) => s + (Number(l.days) || 0), 0);
    return {
      requests: list.length,
      annualDays: annualUsed,
    };
  }, [leaves, monthKey]);

  const thisMonthOutsourcing = useMemo(() => {
    const list = outsourcings.filter((o: any) => {
      if (companyId && o.company_id !== companyId) return false;
      const d = o.start_date || o.created_at;
      return typeof d === 'string' && d.startsWith(monthKey);
    });
    return {
      count: list.length,
      total: list.reduce((s: number, o: any) => s + (Number(o.outsourcing_amount) || Number(o.outsource_amount) || 0), 0),
    };
  }, [outsourcings, companyId, monthKey]);

  const fmt = (v: number) => v.toLocaleString();

  const handleQuickRange = (type: string) => {
    const now = dayjs();
    if (type === 'thisMonth') setDateRange([now.startOf('month'), now.endOf('month')]);
    else if (type === 'thisQuarter') {
      const q = Math.floor(now.month() / 3);
      const start = dayjs(`${now.year()}-${q * 3 + 1}-01`);
      setDateRange([start, start.add(3, 'month').subtract(1, 'day')]);
    }
    else if (type === 'thisYear') setDateRange([dayjs(`${now.year()}-01-01`), dayjs(`${now.year()}-12-31`)]);
    else if (type === 'lastYear') setDateRange([dayjs(`${now.year() - 1}-01-01`), dayjs(`${now.year() - 1}-12-31`)]);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <FundOutlined style={{ marginRight: 8 }} />
            경영관리부 대시보드
          </Title>
          <Text type="secondary">
            운행일지 · 경비 · 연차 · 외주 통합 현황
            {mgmtDept && (
              <Tag color="purple" style={{ marginLeft: 8 }}>
                {mgmtDept.name} · {mgmtDeptMembers.length}명
              </Tag>
            )}
          </Text>
        </div>
        <Space wrap>
          <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('thisMonth')}>이번달</Tag>
          <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('thisQuarter')}>이번분기</Tag>
          <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('thisYear')}>올해</Tag>
          <Tag style={{ cursor: 'pointer' }} onClick={() => handleQuickRange('lastYear')}>작년</Tag>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
            }}
            format="YYYY-MM-DD"
            allowClear={false}
            size="small"
          />
        </Space>
      </div>

      {!companyId && (
        <Card style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text style={{ fontSize: 13 }}>
            ⚠️ 회사를 먼저 선택해주세요. 좌측 상단 회사 전환에서 조회할 회사를 선택하면 데이터가 표시됩니다.
          </Text>
        </Card>
      )}

      <Spin spinning={loading}>
        {/* 이번 달 보조 KPI */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card><Statistic title={`${monthKey} 경비 (승인)`} value={thisMonthExpense.total} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title={`${monthKey} 연차 사용`} value={thisMonthLeave.annualDays} suffix="일" valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title={`${monthKey} 외주 발생`} value={thisMonthOutsourcing.total} suffix="원" valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="활성 직원" value={users.filter((u: any) => u.is_active).length} suffix="명" prefix={<TeamOutlined />} /></Card>
          </Col>
        </Row>

        <Tabs
          defaultActiveKey="vehicle"
          items={[
            {
              key: 'vehicle',
              label: <span><CarOutlined /> 운행일지 통계</span>,
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={12} sm={6}>
                      <Card><Statistic title="총 운행 건수" value={vehicleKpi.totalCount} suffix="건" prefix={<CarOutlined />} /></Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card><Statistic title="총 주행거리" value={vehicleKpi.totalKm} suffix="km" valueStyle={{ color: '#1890ff' }} /></Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card><Statistic title="평균 주행거리" value={vehicleKpi.avgKm} suffix="km/건" /></Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card><Statistic title="운전자 / 차량" value={`${vehicleKpi.driverCount} / ${vehicleKpi.vehicleCount}`} /></Card>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card size="small" title={<Space><CarOutlined /> 차량별 운행</Space>}>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey={(r: any) => r.plate}
                          dataSource={byVehicle}
                          columns={[
                            { title: '차량', dataIndex: 'vehicle', ellipsis: true },
                            { title: '건수', dataIndex: 'count', width: 80, align: 'right', render: (v: number) => `${v}건` },
                            { title: '주행거리', dataIndex: 'km', width: 110, align: 'right', render: (v: number) => `${fmt(v)} km` },
                          ]}
                          locale={{ emptyText: '데이터가 없습니다.' }}
                          scroll={{ y: 280 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card size="small" title={<Space><TeamOutlined /> 운전자별 운행</Space>}>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="driver"
                          dataSource={byDriver}
                          columns={[
                            { title: '운전자', dataIndex: 'driver', ellipsis: true },
                            { title: '건수', dataIndex: 'count', width: 80, align: 'right', render: (v: number) => `${v}건` },
                            { title: '주행거리', dataIndex: 'km', width: 110, align: 'right', render: (v: number) => `${fmt(v)} km` },
                          ]}
                          locale={{ emptyText: '데이터가 없습니다.' }}
                          scroll={{ y: 280 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card size="small" title={<Space><CalendarOutlined /> 월별 운행 트렌드 ({currentYear}년)</Space>} style={{ marginTop: 16 }}>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="month"
                      dataSource={byMonth}
                      columns={[
                        { title: '월', dataIndex: 'month', width: 100, render: (v: string) => dayjs(v).format('M월') },
                        { title: '건수', dataIndex: 'count', width: 100, align: 'right', render: (v: number) => `${v}건` },
                        { title: '주행거리', dataIndex: 'km', align: 'right', render: (v: number) => `${fmt(v)} km` },
                        {
                          title: '상대 분포',
                          render: (_: any, r: any) => {
                            const maxKm = Math.max(1, ...byMonth.map((x) => x.km));
                            const pct = Math.round((r.km / maxKm) * 100);
                            return <Progress percent={pct} size="small" showInfo={false} />;
                          },
                        },
                      ]}
                    />
                  </Card>
                </>
              ),
            },
            {
              key: 'expense',
              label: <span><DollarOutlined /> 경비 / 연차 / 외주 요약</span>,
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small" title="경비 (이번 달 승인분)">
                      <Statistic value={thisMonthExpense.total} suffix="원" valueStyle={{ color: '#52c41a' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{thisMonthExpense.count}건</Text>
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" title="연차 (이번 달 승인)">
                      <Statistic value={thisMonthLeave.annualDays} suffix="일" valueStyle={{ color: '#1890ff' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{thisMonthLeave.requests}건 (병가/출장/재택 제외)</Text>
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" title="외주 (이번 달 발생)">
                      <Statistic value={thisMonthOutsourcing.total} suffix="원" valueStyle={{ color: '#fa8c16' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{thisMonthOutsourcing.count}건</Text>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            ...(mgmtDept ? [{
              key: 'members',
              label: <span><TeamOutlined /> 경영관리부 인원</span>,
              children: (
                <Card size="small">
                  <ResizableTable
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={mgmtDeptMembers}
                    columns={[
                      { title: '사번', dataIndex: 'employee_number', width: 100, render: (v: string) => v || '-' },
                      { title: '이름', dataIndex: 'name', width: 120 },
                      { title: '직급', dataIndex: 'rank', width: 100, render: (v: string) => v || '-' },
                      { title: '직책', dataIndex: 'position', width: 120, render: (v: string) => v || '-' },
                      { title: '입사일', dataIndex: 'hire_date', width: 120, render: (v: string) => v || '-' },
                      { title: '연락처', dataIndex: 'phone', width: 140, render: (v: string, r: any) => v || r.direct_phone || '-' },
                      { title: '이메일', dataIndex: 'email', ellipsis: true, render: (v: string) => v || '-' },
                    ] as any}
                  />
                </Card>
              ),
            }] : []),
          ]}
        />
      </Spin>
    </div>
  );
};

export default ManagementDashboard;
