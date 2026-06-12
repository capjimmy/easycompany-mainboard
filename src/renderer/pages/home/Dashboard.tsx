import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Space, Tag, Spin, DatePicker, Progress, Table, Tabs, List, Button, Empty } from 'antd';
import {
  FileTextOutlined,
  DollarOutlined,
  SyncOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  FundOutlined,
  PieChartOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface MonthlyData {
  month: string;
  계약금액: number;
  수금액: number;
  미수금: number;
  건수: number;
}

const progressLabels: Record<string, { color: string; label: string }> = {
  contract_signed: { color: 'blue', label: '계약체결' },
  in_progress: { color: 'processing', label: '진행중' },
  completed: { color: 'green', label: '완료' },
  cancelled: { color: 'red', label: '취소' },
  inspection: { color: 'orange', label: '검수중' },
  on_hold: { color: 'warning', label: '보류' },
};

const Dashboard: React.FC = () => {
  const { user, selectedCompanyId, selectedCompanyName } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<any[]>([]);
  const [outsourcings, setOutsourcings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats'>('overview');
  // 부서별/회사별 매출 기준 — 'contract' = 계약체결일, 'taxInvoice' = 세금계산서 발행일
  const [revenueBasis, setRevenueBasis] = useState<'contract' | 'taxInvoice'>('contract');

  // 통계 탭 데이터
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<any[]>([]);
  const [expenseSettlements, setExpenseSettlements] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // 기간 필터 - 기본: 올해 1월 1일 ~ 12월 31일
  const currentYear = dayjs().year();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(`${currentYear}-01-01`),
    dayjs(`${currentYear}-12-31`),
  ]);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, selectedCompanyId]);

  useEffect(() => {
    if (user?.id && isSuperAdmin && companies.length === 0) {
      loadCompanies();
    }
  }, [user?.id]);

  const loadCompanies = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.companies.getAll(user.id);
      if (result.success) {
        setCompanies(result.companies || []);
      }
    } catch (_) {}
  };

  const loadStatsData = async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const companyFilter = isSuperAdmin && selectedCompanyId ? { company_id: selectedCompanyId } : {};
      const [recRes, payRes, prRes, expRes] = await Promise.all([
        window.electronAPI.receivables.getAll(user.id, companyFilter).catch(() => null),
        window.electronAPI.payables.getAll(user.id, companyFilter).catch(() => null),
        window.electronAPI.paymentReceipts.getAll(user.id, companyFilter).catch(() => null),
        window.electronAPI.expenses.getAll(user.id, companyFilter).catch(() => null),
      ]);
      if (recRes?.success) setReceivables(recRes.receivables || []);
      if (payRes?.success) setPayables(payRes.payables || []);
      if (prRes?.success) setPaymentReceipts(prRes.receipts || prRes.paymentReceipts || []);
      if (expRes?.success) setExpenseSettlements(expRes.settlements || []);
    } catch (_) {}
    setStatsLoading(false);
  };

  useEffect(() => {
    if (user?.id && activeTab === 'stats') {
      loadStatsData();
    }
  }, [user?.id, selectedCompanyId, activeTab]);

  // 통계 탭: 기간(월/년) 그룹별 집계 — dateRange 필터 반영
  const periodStats = useMemo(() => {
    const fmt = statsPeriod === 'monthly' ? 'YYYY-MM' : 'YYYY';
    const map: Record<string, {
      period: string;
      미수금: number;
      미지급금: number;
      입금액: number;
      프로젝트금액: number;
      지출: number;
      경비: number;
    }> = {};

    const inRange = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = dayjs(dateStr);
      if (!d.isValid()) return false;
      if (dateRange[0] && d.isBefore(dateRange[0].startOf('day'))) return false;
      if (dateRange[1] && d.isAfter(dateRange[1].endOf('day'))) return false;
      return true;
    };

    const ensure = (key: string) => {
      if (!map[key]) {
        map[key] = { period: key, 미수금: 0, 미지급금: 0, 입금액: 0, 프로젝트금액: 0, 지출: 0, 경비: 0 };
      }
      return map[key];
    };

    receivables.forEach((r: any) => {
      const d = r.due_date || r.created_at || r.invoice_date;
      if (!inRange(d)) return;
      const key = dayjs(d).format(fmt);
      ensure(key).미수금 += r.outstanding_amount || 0;
    });

    payables.forEach((p: any) => {
      const d = p.due_date || p.created_at || p.invoice_date;
      if (!inRange(d)) return;
      const key = dayjs(d).format(fmt);
      ensure(key).미지급금 += p.outstanding_amount || 0;
    });

    paymentReceipts.forEach((dItem: any) => {
      const d = dItem.received_date || dItem.payment_date || dItem.created_at;
      if (!inRange(d)) return;
      const key = dayjs(d).format(fmt);
      ensure(key).입금액 += dItem.amount || 0;
    });

    contracts
      .filter((c: any) => ['contract_signed', 'in_progress', 'inspection', 'on_hold'].includes(c.progress))
      .forEach((c: any) => {
        const d = c.contract_date || c.contract_start_date || c.created_at;
        if (!inRange(d)) return;
        const key = dayjs(d).format(fmt);
        ensure(key).프로젝트금액 += c.total_amount || 0;
      });

    expenseSettlements.forEach((e: any) => {
      const d = e.expense_date || e.settlement_date || e.created_at;
      if (!inRange(d)) return;
      const key = dayjs(d).format(fmt);
      const amt = e.total_amount || 0;
      ensure(key).지출 += amt;
      ensure(key).경비 += amt;
    });

    return Object.values(map).sort((a, b) => b.period.localeCompare(a.period));
  }, [statsPeriod, receivables, payables, paymentReceipts, expenseSettlements, contracts, dateRange]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const companyFilter = isSuperAdmin && selectedCompanyId ? { company_id: selectedCompanyId } : {};
      const [contractResult, quoteResult, deptResult, tiResult, outResult] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, companyFilter),
        window.electronAPI.quotes.getAll(user.id, companyFilter),
        (window as any).electronAPI.departments.getAll(user.id).catch(() => null),
        window.electronAPI.taxInvoices.getAll(user.id, companyFilter).catch(() => null),
        (window as any).electronAPI.outsourcings.getAll(user.id, companyFilter).catch(() => null),
      ]);
      if (contractResult.success) setContracts(contractResult.contracts || []);
      if (quoteResult.success) setQuotes(quoteResult.quotes || []);
      if (deptResult?.success) setDepartments(deptResult.departments || []);
      if (tiResult?.success) setTaxInvoices(tiResult.invoices || tiResult.data || []);
      if (outResult?.success) setOutsourcings(outResult.outsourcings || []);
    } catch (err) {
      console.error('Dashboard data load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 기간 필터 적용된 계약
  const filteredContracts = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return contracts;
    const start = dateRange[0].startOf('day');
    const end = dateRange[1].endOf('day');
    return contracts.filter((c: any) => {
      const d = dayjs(c.contract_date || c.contract_start_date || c.created_at);
      return !d.isBefore(start) && !d.isAfter(end);
    });
  }, [contracts, dateRange]);

  const filteredQuotes = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return quotes;
    const start = dateRange[0].startOf('day');
    const end = dateRange[1].endOf('day');
    return quotes.filter((q: any) => {
      const d = dayjs(q.quote_date || q.created_at);
      return !d.isBefore(start) && !d.isAfter(end);
    });
  }, [quotes, dateRange]);

  // 통계
  const stats = useMemo(() => {
    const fc = filteredContracts;
    return {
      totalContracts: fc.length,
      inProgressCount: fc.filter((c: any) => c.progress === 'in_progress').length,
      completedCount: fc.filter((c: any) => c.progress === 'completed').length,
      contractSignedCount: fc.filter((c: any) => c.progress === 'contract_signed').length,
      cancelledCount: fc.filter((c: any) => c.progress === 'cancelled').length,
      inspectionCount: fc.filter((c: any) => c.progress === 'inspection').length,
      onHoldCount: fc.filter((c: any) => c.progress === 'on_hold').length,
      totalContractAmount: fc.reduce((sum: number, c: any) => sum + (c.total_amount || 0), 0),
      totalReceivedAmount: fc.reduce((sum: number, c: any) => sum + (c.received_amount || 0), 0),
      totalRemainingAmount: fc.reduce((sum: number, c: any) => sum + (c.remaining_amount || 0), 0),
      totalQuotes: filteredQuotes.length,
    };
  }, [filteredContracts, filteredQuotes]);

  const collectionRate = stats.totalContractAmount > 0
    ? Math.round((stats.totalReceivedAmount / stats.totalContractAmount) * 100)
    : 0;

  // 세금계산서(매출=발행분) 기간 필터 — monthlyData/departmentData보다 먼저 선언
  const filteredIssuedInvoices = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return [];
    const start = dateRange[0].startOf('day');
    const end = dateRange[1].endOf('day');
    return taxInvoices.filter((inv: any) => {
      if (inv.direction !== 'issued') return false;
      const d = dayjs(inv.issue_date);
      return d.isValid() && !d.isBefore(start) && !d.isAfter(end);
    });
  }, [taxInvoices, dateRange]);

  // 월별 데이터 (기준 전환: 계약체결일 / 세금계산서 발행일)
  const monthlyData = useMemo(() => {
    const data: MonthlyData[] = [];
    if (!dateRange[0] || !dateRange[1]) return data;

    const startMonth = dateRange[0].startOf('month');
    const endMonth = dateRange[1].endOf('month');
    let current = startMonth;

    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
      const monthStart = current.startOf('month');
      const monthEnd = current.endOf('month');

      let row: MonthlyData;
      if (revenueBasis === 'contract') {
        const items = filteredContracts.filter((c: any) => {
          const d = dayjs(c.contract_date || c.contract_start_date || c.created_at);
          return d.isAfter(monthStart.subtract(1, 'day')) && d.isBefore(monthEnd.add(1, 'day'));
        });
        row = {
          month: current.format('YYYY-MM'),
          계약금액: items.reduce((s: number, c: any) => s + (c.total_amount || 0), 0),
          수금액: items.reduce((s: number, c: any) => s + (c.received_amount || 0), 0),
          미수금: items.reduce((s: number, c: any) => s + (c.remaining_amount || 0), 0),
          건수: items.length,
        };
      } else {
        const items = filteredIssuedInvoices.filter((inv: any) => {
          const d = dayjs(inv.issue_date);
          return d.isAfter(monthStart.subtract(1, 'day')) && d.isBefore(monthEnd.add(1, 'day'));
        });
        const paid = items.filter((inv: any) => ['confirmed', 'paid'].includes(inv.status));
        const unpaid = items.filter((inv: any) => !['confirmed', 'paid'].includes(inv.status));
        row = {
          month: current.format('YYYY-MM'),
          계약금액: items.reduce((s: number, i: any) => s + (i.total_amount || 0), 0),
          수금액: paid.reduce((s: number, i: any) => s + (i.total_amount || 0), 0),
          미수금: unpaid.reduce((s: number, i: any) => s + (i.total_amount || 0), 0),
          건수: items.length,
        };
      }

      data.push(row);
      current = current.add(1, 'month');
    }
    return data;
  }, [revenueBasis, filteredContracts, filteredIssuedInvoices, dateRange]);

  // 부서별 집계 (선택된 기준에 따름)
  const departmentData = useMemo(() => {
    const deptMap = new Map<string, any>();
    for (const d of departments) {
      deptMap.set(d.id, d);
    }
    const companyMap = new Map<string, any>();
    for (const c of companies) {
      companyMap.set(c.id, c);
    }

    const acc = new Map<string, {
      key: string;
      department: string;
      company: string;
      건수: number;
      계약금액: number;
      수금액: number;
      미수금: number;
    }>();
    const ensure = (deptId: string | null, companyId: string | null) => {
      const k = `${companyId || 'no-co'}::${deptId || 'no-dept'}`;
      if (!acc.has(k)) {
        const dept = deptId ? deptMap.get(deptId) : null;
        const co = companyId ? companyMap.get(companyId) : null;
        acc.set(k, {
          key: k,
          department: dept?.name || '(부서 미지정)',
          company: co?.name || co?.company_name || '-',
          건수: 0,
          계약금액: 0,
          수금액: 0,
          미수금: 0,
        });
      }
      return acc.get(k)!;
    };

    if (revenueBasis === 'contract') {
      for (const c of filteredContracts) {
        const row = ensure(c.department_id || null, c.company_id || null);
        row.건수 += 1;
        row.계약금액 += c.total_amount || 0;
        row.수금액 += c.received_amount || 0;
        row.미수금 += c.remaining_amount || 0;
      }
    } else {
      // 세금계산서(매출=발행) 기준 — contract와 조인하여 부서 매핑
      const contractById = new Map<string, any>();
      for (const c of contracts) contractById.set(c.id, c);
      for (const inv of filteredIssuedInvoices) {
        const c = inv.contract_id ? contractById.get(inv.contract_id) : null;
        const deptId = c?.department_id || null;
        const companyId = inv.company_id || c?.company_id || null;
        const row = ensure(deptId, companyId);
        row.건수 += 1;
        row.계약금액 += inv.total_amount || 0;
        // 세금계산서 기준일 때 수금액=확인/입금완료 상태 합계로 표기
        if (['confirmed', 'paid'].includes(inv.status)) {
          row.수금액 += inv.total_amount || 0;
        } else {
          row.미수금 += inv.total_amount || 0;
        }
      }
    }
    const rows = Array.from(acc.values())
      .filter((r) => r.건수 > 0)
      .sort((a, b) => b.계약금액 - a.계약금액);

    // 외주 그룹 (revenueBasis 무관) — outsourcings 테이블 합계
    if (outsourcings.length > 0) {
      const outTotal = outsourcings.reduce((s: number, o: any) => s + (Number(o.total_amount) || Number(o.outsourcing_amount) || 0), 0);
      const outPaid = outsourcings.reduce((s: number, o: any) => s + (Number(o.paid_amount) || 0), 0);
      const outRem = outsourcings.reduce((s: number, o: any) => s + (Number(o.remaining_amount) || Math.max(0, (Number(o.total_amount) || 0) - (Number(o.paid_amount) || 0))), 0);
      rows.push({
        key: 'outsourcing-group',
        department: '외주',
        company: '-',
        건수: outsourcings.length,
        계약금액: outTotal,
        수금액: outPaid,
        미수금: outRem,
      });
    }
    return rows;
  }, [revenueBasis, filteredContracts, filteredIssuedInvoices, contracts, departments, companies, outsourcings]);

  // 회사별 데이터 (슈퍼관리자 전체 보기)
  const companyData = useMemo(() => {
    if (!isSuperAdmin || selectedCompanyId || companies.length === 0) return [];
    return companies.map((comp: any) => {
      const compContracts = filteredContracts.filter((c: any) => c.company_id === comp.id);
      const totalAmount = compContracts.reduce((s: number, c: any) => s + (c.total_amount || 0), 0);
      const receivedAmount = compContracts.reduce((s: number, c: any) => s + (c.received_amount || 0), 0);
      return {
        name: comp.company_name || comp.name,
        건수: compContracts.length,
        계약금액: totalAmount,
        수금액: receivedAmount,
        수금율: totalAmount > 0 ? Math.round((receivedAmount / totalAmount) * 100) : 0,
      };
    }).filter((d: any) => d.건수 > 0);
  }, [isSuperAdmin, selectedCompanyId, companies, filteredContracts]);

  // 진행상태별 분포
  const statusData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    filteredContracts.forEach((c: any) => {
      const label = progressLabels[c.progress]?.label || c.progress;
      statusMap[label] = (statusMap[label] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  }, [filteredContracts]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString();
  };

  const canViewFinance = user?.role === 'super_admin' || user?.role === 'company_admin' ||
    user?.permissions?.['receivables']?.view;

  // 빠른 기간 선택
  const handleQuickRange = (type: string) => {
    const now = dayjs();
    switch (type) {
      case 'thisMonth':
        setDateRange([now.startOf('month'), now.endOf('month')]);
        break;
      case 'thisQuarter':
        setDateRange([now.startOf('quarter'), now.endOf('quarter')]);
        break;
      case 'thisYear':
        setDateRange([dayjs(`${now.year()}-01-01`), dayjs(`${now.year()}-12-31`)]);
        break;
      case 'lastYear':
        setDateRange([dayjs(`${now.year() - 1}-01-01`), dayjs(`${now.year() - 1}-12-31`)]);
        break;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 헤더 + 기간 필터 */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <FundOutlined style={{ marginRight: 8 }} />
            대시보드
          </Title>
          <Text type="secondary">
            안녕하세요, {user?.name || '사용자'}님
            {isSuperAdmin && selectedCompanyId && (
              <Tag color="blue" icon={<BankOutlined />} style={{ marginLeft: 8 }}>
                {selectedCompanyName}
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
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
            allowClear={false}
            size="small"
          />
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'overview' | 'stats')}
        items={[
          { key: 'overview', label: '현황' },
          { key: 'stats', label: '통계' },
        ]}
      />

      {activeTab === 'stats' && (
        <Spin spinning={statsLoading}>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Tag
                color={statsPeriod === 'monthly' ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setStatsPeriod('monthly')}
              >
                월별
              </Tag>
              <Tag
                color={statsPeriod === 'yearly' ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setStatsPeriod('yearly')}
              >
                연도별
              </Tag>
            </Space>
          </div>

          <Card size="small" title={statsPeriod === 'monthly' ? '월별 통계' : '연도별 통계'}>
            <Table
              dataSource={periodStats}
              rowKey="period"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
              columns={[
                { title: '기간', dataIndex: 'period', width: 120 },
                { title: '미수금', dataIndex: '미수금', align: 'right', render: (v: number) => `${formatCurrency(v)}원` },
                { title: '미지급금', dataIndex: '미지급금', align: 'right', render: (v: number) => `${formatCurrency(v)}원` },
                { title: '입금액', dataIndex: '입금액', align: 'right', render: (v: number) => <span style={{ color: '#52c41a' }}>{formatCurrency(v)}원</span> },
                { title: '프로젝트(활성계약) 금액', dataIndex: '프로젝트금액', align: 'right', render: (v: number) => <span style={{ color: '#1890ff' }}>{formatCurrency(v)}원</span> },
                { title: '지출 합계', dataIndex: '지출', align: 'right', render: (v: number) => `${formatCurrency(v)}원` },
                { title: '경비 합계', dataIndex: '경비', align: 'right', render: (v: number) => <span style={{ color: '#fa8c16' }}>{formatCurrency(v)}원</span> },
              ]}
              summary={() => {
                const totals = periodStats.reduce(
                  (acc, r) => ({
                    미수금: acc.미수금 + r.미수금,
                    미지급금: acc.미지급금 + r.미지급금,
                    입금액: acc.입금액 + r.입금액,
                    프로젝트금액: acc.프로젝트금액 + r.프로젝트금액,
                    지출: acc.지출 + r.지출,
                    경비: acc.경비 + r.경비,
                  }),
                  { 미수금: 0, 미지급금: 0, 입금액: 0, 프로젝트금액: 0, 지출: 0, 경비: 0 }
                );
                return (
                  <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                    <Table.Summary.Cell index={0}>합계</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{formatCurrency(totals.미수금)}원</Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">{formatCurrency(totals.미지급금)}원</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">{formatCurrency(totals.입금액)}원</Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">{formatCurrency(totals.프로젝트금액)}원</Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">{formatCurrency(totals.지출)}원</Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">{formatCurrency(totals.경비)}원</Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </Spin>
      )}

      {activeTab === 'overview' && (<>

      {/* 빠른 액션 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Button block icon={<PlusOutlined />} type="primary" ghost onClick={() => navigate('/quotes/new')}>견적 등록</Button></Col>
        <Col xs={12} sm={6}><Button block icon={<PlusOutlined />} type="primary" ghost onClick={() => navigate('/contracts')}>계약 등록</Button></Col>
        <Col xs={12} sm={6}><Button block icon={<DollarOutlined />} type="primary" ghost onClick={() => navigate('/finance/expense-request')}>지출결의서</Button></Col>
        <Col xs={12} sm={6}><Button block icon={<CalendarOutlined />} type="primary" ghost onClick={() => navigate('/calendar/contracts')}>계약 캘린더</Button></Col>
      </Row>

      {/* KPI 카드 — 8개 한눈에 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={6} xl={3}>
          <Card className="dashboard-card" hoverable onClick={() => navigate('/contracts')} size="small">
            <Statistic title="총 계약" value={stats.totalContracts} suffix="건"
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6} xl={3}>
          <Card className="dashboard-card" hoverable size="small">
            <Statistic title="진행 중" value={stats.inProgressCount} suffix="건"
              prefix={<SyncOutlined spin style={{ color: '#1890ff' }} />} valueStyle={{ fontSize: 22, color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6} xl={3}>
          <Card className="dashboard-card" hoverable size="small">
            <Statistic title="완료" value={stats.completedCount} suffix="건"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ fontSize: 22, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6} xl={3}>
          <Card className="dashboard-card" hoverable onClick={() => navigate('/quotes')} size="small">
            <Statistic title="견적" value={stats.totalQuotes} suffix="건"
              prefix={<AuditOutlined style={{ color: '#722ed1' }} />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        {canViewFinance && (
          <>
            <Col xs={12} sm={8} lg={6} xl={3}>
              <Card className="dashboard-card" hoverable size="small">
                <Statistic title="총 계약금액" value={stats.totalContractAmount}
                  prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
                  formatter={() => formatCurrency(stats.totalContractAmount)} valueStyle={{ fontSize: 18 }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6} xl={3}>
              <Card className="dashboard-card" hoverable onClick={() => navigate('/finance/receivables')} size="small">
                <Statistic title="미수금" value={stats.totalRemainingAmount}
                  prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  formatter={() => formatCurrency(stats.totalRemainingAmount)} valueStyle={{ fontSize: 18, color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6} xl={3}>
              <Card className="dashboard-card" hoverable size="small">
                <Statistic title="수금액" value={stats.totalReceivedAmount}
                  prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                  formatter={() => formatCurrency(stats.totalReceivedAmount)} valueStyle={{ fontSize: 18, color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6} xl={3}>
              <Card className="dashboard-card" hoverable size="small">
                <Statistic title="수금율" value={collectionRate} suffix="%"
                  valueStyle={{ fontSize: 22, color: collectionRate >= 80 ? '#52c41a' : collectionRate >= 50 ? '#fa8c16' : '#ff4d4f' }} />
                <Progress percent={collectionRate} size="small" showInfo={false}
                  strokeColor={collectionRate >= 80 ? '#52c41a' : collectionRate >= 50 ? '#fa8c16' : '#ff4d4f'}
                  style={{ marginTop: 4 }} />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* 프로젝트 진행 + 마감 임박 — 회의록: "프로젝트에 대한 정보들" 한눈에 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<><ProjectOutlined /> 진행 중인 프로젝트 (TOP 5)</>}
            extra={<Button type="link" onClick={() => navigate('/contracts')}>전체보기</Button>}
            size="small" styles={{ body: { padding: 12 } }}>
            {(() => {
              const inProg = filteredContracts
                .filter((c: any) => c.progress === 'in_progress' || c.progress === 'contract_signed')
                .sort((a: any, b: any) => (b.total_amount || 0) - (a.total_amount || 0))
                .slice(0, 5);
              if (inProg.length === 0) return <Empty description="진행 중 프로젝트 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
              return (
                <List size="small" dataSource={inProg} renderItem={(c: any) => {
                  const pct = (c.total_amount || 0) > 0 ? Math.round(((c.received_amount || 0) / c.total_amount) * 100) : 0;
                  return (
                    <List.Item style={{ cursor: 'pointer', padding: '8px 0' }} onClick={() => navigate(`/contracts/${c.id}`)}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text strong style={{ fontSize: 13 }} ellipsis>{c.service_name || c.contract_number}</Text>
                          <Tag color={progressLabels[c.progress]?.color || 'default'} style={{ marginRight: 0 }}>
                            {progressLabels[c.progress]?.label || c.progress}
                          </Tag>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                          <span>{c.client_company || '-'}</span>
                          <span>{formatCurrency(c.total_amount || 0)}원 · 수금 {pct}%</span>
                        </div>
                        <Progress percent={pct} size="small" showInfo={false}
                          strokeColor={pct >= 80 ? '#52c41a' : pct >= 50 ? '#fa8c16' : '#1890ff'} />
                      </div>
                    </List.Item>
                  );
                }} />
              );
            })()}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><ClockCircleOutlined /> 마감 임박 계약 (30일 이내)</>}
            extra={<Button type="link" onClick={() => navigate('/calendar/contracts')}>캘린더 보기</Button>}
            size="small" styles={{ body: { padding: 12 } }}>
            {(() => {
              const now = dayjs();
              const limit = now.add(30, 'day');
              const upcoming = filteredContracts
                .filter((c: any) => c.contract_end_date && c.progress !== 'completed' && c.progress !== 'cancelled')
                .map((c: any) => ({ ...c, _end: dayjs(c.contract_end_date) }))
                .filter((c: any) => c._end.isValid() && !c._end.isBefore(now) && !c._end.isAfter(limit))
                .sort((a: any, b: any) => a._end.valueOf() - b._end.valueOf())
                .slice(0, 5);
              if (upcoming.length === 0) return <Empty description="30일 이내 마감 계약 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
              return (
                <List size="small" dataSource={upcoming} renderItem={(c: any) => {
                  const daysLeft = c._end.diff(now, 'day');
                  const urgent = daysLeft <= 7;
                  return (
                    <List.Item style={{ cursor: 'pointer', padding: '8px 0' }} onClick={() => navigate(`/contracts/${c.id}`)}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ fontSize: 13 }} ellipsis>{c.service_name || c.contract_number}</Text>
                          <div style={{ fontSize: 11, color: '#888' }}>{c.client_company || '-'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Tag color={urgent ? 'red' : 'orange'} style={{ marginRight: 0 }}>
                            {daysLeft === 0 ? '오늘 마감' : `${daysLeft}일 남음`}
                          </Tag>
                          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{c._end.format('MM-DD')}</div>
                        </div>
                      </div>
                    </List.Item>
                  );
                }} />
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* 매출 기준 전환 토글 (월별/회사별/부서별 표 모두에 영향) */}
      {canViewFinance && (
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>매출 기준:</Text>
            <Tag
              color={revenueBasis === 'contract' ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setRevenueBasis('contract')}
            >
              계약 체결일
            </Tag>
            <Tag
              color={revenueBasis === 'taxInvoice' ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setRevenueBasis('taxInvoice')}
            >
              세금계산서 발행일
            </Tag>
          </Space>
        </div>
      )}

      {/* 월별 현황 테이블 */}
      {canViewFinance && monthlyData.length > 0 && (
        <Card
          title={<Space><CalendarOutlined /><span>월별 현황 ({revenueBasis === 'contract' ? '계약 기준' : '세금계산서 기준'})</span></Space>}
          style={{ marginBottom: 20 }}
          size="small"
        >
          <Table
            dataSource={monthlyData}
            rowKey="month"
            size="small"
            pagination={false}
            scroll={{ x: 600 }}
            columns={[
              {
                title: '월',
                dataIndex: 'month',
                width: 100,
                render: (v: string) => dayjs(v).format('YYYY년 M월'),
              },
              {
                title: '건수',
                dataIndex: '건수',
                width: 70,
                align: 'right',
                render: (v: number) => `${v}건`,
              },
              {
                title: '계약금액',
                dataIndex: '계약금액',
                align: 'right',
                render: (v: number) => `${formatCurrency(v)}원`,
              },
              {
                title: '수금액',
                dataIndex: '수금액',
                align: 'right',
                render: (v: number) => <span style={{ color: '#52c41a' }}>{formatCurrency(v)}원</span>,
              },
              {
                title: '미수금',
                dataIndex: '미수금',
                align: 'right',
                render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatCurrency(v)}원</span>,
              },
              {
                title: '수금율',
                width: 120,
                render: (_: any, record: MonthlyData) => {
                  const rate = record.계약금액 > 0 ? Math.round((record.수금액 / record.계약금액) * 100) : 0;
                  return <Progress percent={rate} size="small" />;
                },
              },
            ]}
            summary={() => {
              const totalAmt = monthlyData.reduce((s, d) => s + d.계약금액, 0);
              const totalRec = monthlyData.reduce((s, d) => s + d.수금액, 0);
              const totalRem = monthlyData.reduce((s, d) => s + d.미수금, 0);
              const totalCnt = monthlyData.reduce((s, d) => s + d.건수, 0);
              const totalRate = totalAmt > 0 ? Math.round((totalRec / totalAmt) * 100) : 0;
              return (
                <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                  <Table.Summary.Cell index={0}>합계</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{totalCnt}건</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{formatCurrency(totalAmt)}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><span style={{ color: '#52c41a' }}>{formatCurrency(totalRec)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><span style={{ color: totalRem > 0 ? '#ff4d4f' : '#52c41a' }}>{formatCurrency(totalRem)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><Progress percent={totalRate} size="small" /></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* 부서별 현황 (회사 × 부서 × 매출) */}
      {canViewFinance && departmentData.length > 0 && (
        <Card
          title={<Space><PieChartOutlined /><span>부서별 현황 ({revenueBasis === 'contract' ? '계약 기준' : '세금계산서 기준'})</span></Space>}
          style={{ marginBottom: 20 }}
          size="small"
        >
          <Table
            dataSource={departmentData}
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ x: 700 }}
            columns={[
              ...(isSuperAdmin && !selectedCompanyId
                ? [{ title: '회사', dataIndex: 'company', key: 'company', width: 140 }]
                : []),
              { title: '부서', dataIndex: 'department', key: 'department', width: 160 },
              { title: '건수', dataIndex: '건수', width: 80, align: 'right' as const, render: (v: number) => `${v}건` },
              { title: '계약금액', dataIndex: '계약금액', align: 'right' as const, render: (v: number) => `${formatCurrency(v)}원` },
              { title: '수금액', dataIndex: '수금액', align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{formatCurrency(v)}원</span> },
              { title: '미수금', dataIndex: '미수금', align: 'right' as const, render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatCurrency(v)}원</span> },
              {
                title: '수금율',
                width: 120,
                render: (_: any, r: any) => {
                  const rate = r.계약금액 > 0 ? Math.round((r.수금액 / r.계약금액) * 100) : 0;
                  return <Progress percent={rate} size="small" />;
                },
              },
            ]}
            summary={() => {
              const t = departmentData.reduce(
                (a, r) => ({
                  건수: a.건수 + r.건수,
                  계약금액: a.계약금액 + r.계약금액,
                  수금액: a.수금액 + r.수금액,
                  미수금: a.미수금 + r.미수금,
                }),
                { 건수: 0, 계약금액: 0, 수금액: 0, 미수금: 0 }
              );
              const totalRate = t.계약금액 > 0 ? Math.round((t.수금액 / t.계약금액) * 100) : 0;
              const offset = isSuperAdmin && !selectedCompanyId ? 1 : 0;
              return (
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0} colSpan={1 + offset}>합계</Table.Summary.Cell>
                  <Table.Summary.Cell index={1 + offset} align="right">{t.건수}건</Table.Summary.Cell>
                  <Table.Summary.Cell index={2 + offset} align="right">{formatCurrency(t.계약금액)}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={3 + offset} align="right"><span style={{ color: '#52c41a' }}>{formatCurrency(t.수금액)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4 + offset} align="right"><span style={{ color: t.미수금 > 0 ? '#ff4d4f' : '#52c41a' }}>{formatCurrency(t.미수금)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={5 + offset}><Progress percent={totalRate} size="small" /></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* 슈퍼관리자 전체: 회사별 현황 */}
      {isSuperAdmin && !selectedCompanyId && companyData.length > 0 && (
        <Card
          title={<Space><BankOutlined /><span>회사별 현황</span></Space>}
          style={{ marginBottom: 20 }}
          size="small"
        >
          <Table
            dataSource={companyData}
            rowKey="name"
            size="small"
            pagination={false}
            columns={[
              { title: '회사', dataIndex: 'name', width: 160 },
              { title: '계약 건수', dataIndex: '건수', width: 90, align: 'right', render: (v: number) => `${v}건` },
              { title: '계약금액', dataIndex: '계약금액', align: 'right', render: (v: number) => `${formatCurrency(v)}원` },
              { title: '수금액', dataIndex: '수금액', align: 'right', render: (v: number) => <span style={{ color: '#52c41a' }}>{formatCurrency(v)}원</span> },
              {
                title: '수금율',
                dataIndex: '수금율',
                width: 120,
                render: (v: number) => <Progress percent={v} size="small" />,
              },
            ]}
          />
        </Card>
      )}

      {/* 진행상태별 분포 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><PieChartOutlined /><span>진행상태 분포</span></Space>}
            size="small"
          >
            {statusData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>데이터가 없습니다.</div>
            ) : (
              <div>
                {statusData.map((item) => {
                  const percent = stats.totalContracts > 0 ? Math.round((item.value / stats.totalContracts) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    '계약체결': '#1890ff', '진행중': '#fa8c16', '완료': '#52c41a',
                    '취소': '#ff4d4f', '검수중': '#faad14', '보류': '#d9d9d9',
                  };
                  return (
                    <div key={item.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>{item.name}</Text>
                        <Text strong>{item.value}건 ({percent}%)</Text>
                      </div>
                      <Progress
                        percent={percent}
                        showInfo={false}
                        strokeColor={colorMap[item.name] || '#1890ff'}
                        size="small"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Space><SyncOutlined /><span>최근 진행 프로젝트</span></Space>}
            size="small"
            extra={<a onClick={() => navigate('/project/dashboard')}>전체보기</a>}
          >
            {filteredContracts.filter((c: any) => c.progress === 'in_progress' || c.progress === 'inspection').length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>진행중인 프로젝트가 없습니다.</div>
            ) : (
              filteredContracts
                .filter((c: any) => c.progress === 'in_progress' || c.progress === 'inspection')
                .slice(0, 6)
                .map((c: any) => (
                  <div
                    key={c.id}
                    style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                    onClick={() => navigate(`/contracts/${c.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ fontSize: 13 }}>{c.service_name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{c.client_company} | {c.manager_name || '-'}</Text>
                      </div>
                      <div style={{ width: 100, flexShrink: 0, marginLeft: 12 }}>
                        <Progress percent={c.progress_rate || 0} size="small" />
                      </div>
                    </div>
                  </div>
                ))
            )}
          </Card>
        </Col>
      </Row>
      </>)}
    </div>
  );
};

export default Dashboard;
