import React, { useState, useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Space, Select, DatePicker, Button,
  Table, Tag, Spin, InputNumber, message, Modal, Divider,
} from 'antd';
import {
  DollarOutlined, RiseOutlined, FallOutlined, TeamOutlined, BankOutlined, SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const fmt = (n: number) => Math.round(n).toLocaleString() + '원';
const fmtPct = (n: number) => (n || 0).toFixed(1) + '%';

const ProfitDashboard: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const [year, setYear] = useState(dayjs().year());
  const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [overhead, setOverhead] = useState<Record<number, number>>({});
  const [overheadModalOpen, setOverheadModalOpen] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters: any = { year, month };
      if (isSuperAdmin && selectedCompanyId) filters.companyId = selectedCompanyId;
      const res = await (window as any).electronAPI.profitDashboard.getData(user.id, filters);
      if (res.success) setData(res.data);
      else message.error(res.error || '조회 실패');

      const ov = await (window as any).electronAPI.profitDashboard.getOverhead(user.id, year);
      if (ov.success) setOverhead(ov.data || {});
    } catch (err: any) {
      message.error(err?.message || '오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id, year, month, selectedCompanyId]);

  const saveOverhead = async (m: number, amount: number) => {
    if (!user?.id) return;
    const res = await (window as any).electronAPI.profitDashboard.setOverhead(user.id, year, m, amount);
    if (res.success) {
      message.success(`${m}월 일반관리비 저장`);
      setOverhead({ ...overhead, [m]: amount });
      load();
    } else {
      message.error(res.error || '저장 실패');
    }
  };

  const summary = data?.summary || { revenue: 0, expense: 0, labor: 0, overhead: 0, netProfit: 0, margin: 0, expenseBreakdown: {} };
  const byCompany = data?.byCompany || [];
  const byDepartment = data?.byDepartment || [];
  const monthlyTrend = data?.monthlyTrend || [];

  const profitColor = (n: number) => n >= 0 ? '#52c41a' : '#ff4d4f';

  return (
    <Spin spinning={loading}>
      <div className="fade-in" style={{ padding: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <DollarOutlined /> 순이익 계산 대시보드
          </Title>
          <Space>
            <Select value={year} onChange={setYear} style={{ width: 120 }}
              options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - i, label: `${dayjs().year() - i}년` }))} />
            <Select value={month || 'all'} onChange={(v) => setMonth(v === 'all' ? null : Number(v))} style={{ width: 120 }}
              options={[{ value: 'all', label: '연간' }, ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }))]} />
            <Button icon={<SettingOutlined />} onClick={() => setOverheadModalOpen(true)}>일반관리비 설정</Button>
          </Space>
        </div>

        {/* 핵심 KPI */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={5}>
            <Card>
              <Statistic title="매출 (실제 수금)" value={summary.revenue}
                formatter={(v: any) => fmt(Number(v))} prefix={<RiseOutlined style={{ color: '#3f8600' }} />} />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic title="매입" value={summary.expense}
                formatter={(v: any) => fmt(Number(v))} prefix={<FallOutlined style={{ color: '#cf1322' }} />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="인건비" value={summary.labor}
                formatter={(v: any) => fmt(Number(v))} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="일반관리비" value={summary.overhead}
                formatter={(v: any) => fmt(Number(v))} prefix={<BankOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #f6ffed 100%)' }}>
              <Statistic title={`순이익 (마진율 ${fmtPct(summary.margin)})`}
                value={summary.netProfit}
                formatter={(v: any) => fmt(Number(v))}
                valueStyle={{ color: profitColor(summary.netProfit), fontSize: 28, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>

        {/* 매입 세부 */}
        <Card title="매입 상세" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={5}><Statistic title="외주비" value={summary.expenseBreakdown?.outsourcing || 0} formatter={(v: any) => fmt(Number(v))} /></Col>
            <Col span={5}><Statistic title="경비정산" value={summary.expenseBreakdown?.settlement || 0} formatter={(v: any) => fmt(Number(v))} /></Col>
            <Col span={5}><Statistic title="지출결의서(매입)" value={summary.expenseBreakdown?.expenseRequestPurchase || 0} formatter={(v: any) => fmt(Number(v))} /></Col>
            <Col span={5}><Statistic title="지출결의서(일반)" value={summary.expenseBreakdown?.expenseRequestGeneral || 0} formatter={(v: any) => fmt(Number(v))} /></Col>
            <Col span={4}><Statistic title="매입세금계산서" value={summary.expenseBreakdown?.purchaseInvoice || 0} formatter={(v: any) => fmt(Number(v))} /></Col>
          </Row>
        </Card>

        {/* 회사별 (super_admin만) */}
        {isSuperAdmin && !selectedCompanyId && byCompany.length > 0 && (
          <Card title="회사별 순이익" style={{ marginBottom: 16 }}>
            <Table
              dataSource={byCompany}
              rowKey="company_id"
              pagination={false}
              size="small"
              columns={[
                { title: '회사', dataIndex: 'company_name', key: 'name' },
                { title: '매출', dataIndex: 'revenue', key: 'rev', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '매입', dataIndex: 'expense', key: 'exp', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '인건비', dataIndex: 'labor', key: 'lab', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '순이익', dataIndex: 'netProfit', key: 'np', align: 'right' as const,
                  render: (v: number) => <Text strong style={{ color: profitColor(v) }}>{fmt(v)}</Text> },
              ]}
            />
          </Card>
        )}

        {/* 부서별 */}
        <Card title="부서별 순이익" style={{ marginBottom: 16 }}>
          <Table
            dataSource={byDepartment}
            rowKey="dept_id"
            pagination={false}
            size="small"
            columns={[
              { title: '부서', dataIndex: 'dept_name', key: 'name' },
              { title: '매출', dataIndex: 'revenue', key: 'rev', align: 'right' as const, render: (v: number) => fmt(v) },
              { title: '매입', dataIndex: 'expense', key: 'exp', align: 'right' as const, render: (v: number) => fmt(v) },
              { title: '인건비', dataIndex: 'labor', key: 'lab', align: 'right' as const, render: (v: number) => fmt(v) },
              { title: '순이익', dataIndex: 'netProfit', key: 'np', align: 'right' as const,
                render: (v: number) => <Text strong style={{ color: profitColor(v) }}>{fmt(v)}</Text> },
            ]}
          />
        </Card>

        {/* 월별 추이 (연간 조회 시) */}
        {!month && monthlyTrend.length > 0 && (
          <Card title="월별 추이">
            <Table
              dataSource={monthlyTrend}
              rowKey="month"
              pagination={false}
              size="small"
              columns={[
                { title: '월', dataIndex: 'month', key: 'm', render: (v: number) => `${v}월` },
                { title: '매출', dataIndex: 'revenue', key: 'rev', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '매입', dataIndex: 'expense', key: 'exp', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '인건비', dataIndex: 'labor', key: 'lab', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '관리비', dataIndex: 'overhead', key: 'ov', align: 'right' as const, render: (v: number) => fmt(v) },
                { title: '순이익', dataIndex: 'netProfit', key: 'np', align: 'right' as const,
                  render: (v: number) => <Text strong style={{ color: profitColor(v) }}>{fmt(v)}</Text> },
              ]}
            />
          </Card>
        )}

        {/* 일반관리비 입력 모달 */}
        <Modal
          title={`${year}년 일반관리비 (임대료/관리비 등)`}
          open={overheadModalOpen}
          onCancel={() => setOverheadModalOpen(false)}
          footer={null}
          width={520}
        >
          <Text type="secondary">월별 고정 관리비를 입력하면 순이익에서 차감됩니다.</Text>
          <Divider />
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <Row key={m} gutter={8} style={{ marginBottom: 8 }}>
              <Col span={4}><Text>{m}월</Text></Col>
              <Col span={14}>
                <InputNumber
                  style={{ width: '100%' }}
                  value={overhead[m] || 0}
                  onChange={(v) => setOverhead({ ...overhead, [m]: Number(v || 0) })}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => v!.replace(/,/g, '') as unknown as number}
                />
              </Col>
              <Col span={6}>
                <Button block onClick={() => saveOverhead(m, overhead[m] || 0)}>저장</Button>
              </Col>
            </Row>
          ))}
        </Modal>
      </div>
    </Spin>
  );
};

export default ProfitDashboard;
