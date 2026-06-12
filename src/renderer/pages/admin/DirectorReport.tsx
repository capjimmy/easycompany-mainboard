import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Row, Col, Select, Button, Space, Spin, message, Tabs,
  Table, Statistic, Tag,
} from 'antd';
import { FileExcelOutlined, DownloadOutlined, FundProjectionScreenOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const DirectorReport: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [year, setYear] = useState<number>(dayjs().year());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [profitByDept, setProfitByDept] = useState<any[]>([]);
  const [profitByCompany, setProfitByCompany] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await window.electronAPI.companies.getAll(user.id);
        if (res.success) {
          setCompanies(res.companies || []);
          // 슈퍼관리자는 선택된 회사가 있으면 그걸, 없으면 첫 회사
          // 회사관리자/부서관리자는 자기 회사 자동
          const initId = isSuperAdmin
            ? (selectedCompanyId || (res.companies?.[0]?.id))
            : user.company_id;
          if (initId) setCompanyId(initId);
        }
      } catch { /* ignore */ }
    })();
  }, [user?.id, selectedCompanyId, isSuperAdmin]);

  const load = async () => {
    if (!user?.id || !companyId) return;
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.reports.getDirectorReportData(user.id, { companyId, year });
      if (res.success) {
        setReport({ ...res.data, companyName: res.companyName });
      } else {
        message.error(res.error || '데이터 조회 실패');
        setReport(null);
      }
    } catch (err: any) {
      message.error(err?.message || '데이터 조회 중 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) load();
  }, [companyId, year]);

  // 부서별 순이익 데이터 로드
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const filters: any = { year };
        if (companyId) filters.companyId = companyId;
        const res = await (window as any).electronAPI.profitDashboard.getData(user.id, filters);
        if (res.success) {
          setProfitByDept(res.data?.byDepartment || []);
          setProfitByCompany(res.data?.byCompany || []);
        }
      } catch { /* ignore */ }
    })();
  }, [user?.id, companyId, year]);

  const handleExport = async () => {
    if (!user?.id || !companyId) {
      message.warning('회사를 먼저 선택해주세요.');
      return;
    }
    setGenerating(true);
    try {
      const res = await (window as any).electronAPI.reports.generateDirectorReport(user.id, { companyId, year });
      if (res.success) {
        message.success('엑셀 파일이 생성되었습니다.');
      } else {
        message.error(res.error || '엑셀 생성 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '엑셀 생성 중 오류');
    } finally {
      setGenerating(false);
    }
  };

  const yearOptions = useMemo(() => {
    const y = dayjs().year();
    return Array.from({ length: 6 }, (_, i) => y - 3 + i);
  }, []);

  const fmt = (v: number) => (v || 0).toLocaleString();

  // 연간 합계 계산
  const yearlyStats = useMemo(() => {
    if (!report) return null;
    let cCnt = 0, cAmt = 0, sCnt = 0, sAmt = 0, rec = 0, exp = 0;
    for (const md of (report.monthly || []) as any[]) {
      cCnt += md.contracts.totalCount;
      cAmt += md.contracts.totalAmount;
      sCnt += md.sales.totalCount;
      sAmt += md.sales.totalAmount;
      rec += md.profit.received;
      exp += md.profit.expense;
    }
    return { cCnt, cAmt, sCnt, sAmt, rec, exp, profitVsSales: sAmt - exp, profitVsRec: rec - exp };
  }, [report]);

  // 사업부 컬럼 동적
  const groups: string[] = report?.groups || [];

  // 월별 매트릭스 행 (계약/매출)
  const yearlyMatrix = useMemo(() => {
    if (!report) return [];
    return (report.monthly as any[]).map((md) => {
      const row: any = { month: `${md.month}월` };
      for (const g of groups) {
        const csec = md.contracts.sections.find((s: any) => s.group === g);
        const ssec = md.sales.sections.find((s: any) => s.group === g);
        row[`c_${g}_cnt`] = csec?.count || 0;
        row[`c_${g}_amt`] = csec?.amount || 0;
        row[`s_${g}_cnt`] = ssec?.count || 0;
        row[`s_${g}_amt`] = ssec?.amount || 0;
      }
      row.c_total_cnt = md.contracts.totalCount;
      row.c_total_amt = md.contracts.totalAmount;
      row.s_total_cnt = md.sales.totalCount;
      row.s_total_amt = md.sales.totalAmount;
      row.received = md.profit.received;
      row.expense = md.profit.expense;
      row.profit_sales = md.profit.profitVsSales;
      row.profit_rec = md.profit.profitVsReceived;
      return row;
    });
  }, [report, groups]);

  const renderMonthDetail = (md: any) => {
    return (
      <div>
        {/* 1. 계약/매출 현황 */}
        <Card size="small" title={`1. ${md.month}월 계약현황 및 매출현황`} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card size="small" type="inner" title="1) 계약현황">
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={12}><Statistic title="총 계약건수" value={md.contracts.totalCount} suffix="건" /></Col>
                  <Col span={12}><Statistic title="총 계약금액" value={md.contracts.totalAmount} suffix="원" valueStyle={{ color: '#1890ff' }} /></Col>
                </Row>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r, i) => `c-${md.month}-${i}`}
                  dataSource={md.contracts.sections}
                  columns={[
                    { title: '사업부', dataIndex: 'group', width: 110, render: (v: string) => <Tag color="blue">{v}</Tag> },
                    { title: '건수', dataIndex: 'count', width: 70, align: 'right', render: (v: number) => `${v}건` },
                    { title: '금액', dataIndex: 'amount', align: 'right', render: (v: number) => `${fmt(v)}원` },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" type="inner" title="2) 매출현황">
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={12}><Statistic title="총 매출건수" value={md.sales.totalCount} suffix="건" /></Col>
                  <Col span={12}><Statistic title="총 매출금액" value={md.sales.totalAmount} suffix="원" valueStyle={{ color: '#52c41a' }} /></Col>
                </Row>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r, i) => `s-${md.month}-${i}`}
                  dataSource={md.sales.sections}
                  columns={[
                    { title: '사업부', dataIndex: 'group', width: 110, render: (v: string) => <Tag color="green">{v}</Tag> },
                    { title: '건수', dataIndex: 'count', width: 70, align: 'right', render: (v: number) => `${v}건` },
                    { title: '금액', dataIndex: 'amount', align: 'right', render: (v: number) => `${fmt(v)}원` },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* 2. 순이익현황 */}
        <Card size="small" title={`2. ${md.month}월 순이익현황`}>
          <Row gutter={16}>
            <Col xs={12} sm={4}><Statistic title="총 매출" value={md.profit.totalSales} suffix="원" /></Col>
            <Col xs={12} sm={4}><Statistic title="수금액" value={md.profit.received} suffix="원" valueStyle={{ color: '#52c41a' }} /></Col>
            <Col xs={12} sm={4}><Statistic title="경비" value={md.profit.expense} suffix="원" valueStyle={{ color: '#fa8c16' }} /></Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="매출대비 순이익"
                value={md.profit.profitVsSales}
                suffix="원"
                valueStyle={{ color: md.profit.profitVsSales >= 0 ? '#1890ff' : '#ff4d4f' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="수금대비 순이익"
                value={md.profit.profitVsReceived}
                suffix="원"
                valueStyle={{ color: md.profit.profitVsReceived >= 0 ? '#1890ff' : '#ff4d4f' }}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 16 }}>
            <Text strong>사업부별 수금액</Text>
            <Table
              size="small"
              pagination={false}
              rowKey="group"
              dataSource={md.profit.receivedByGroup}
              style={{ marginTop: 8, maxWidth: 360 }}
              columns={[
                { title: '사업부', dataIndex: 'group' },
                { title: '수금액', dataIndex: 'amount', align: 'right', render: (v: number) => `${fmt(v)}원` },
              ]}
            />
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <FundProjectionScreenOutlined style={{ marginRight: 8 }} />
            원장님 보고서 (경영관리실 양식)
          </Title>
          <Text type="secondary">계약·매출·수금·경비·순이익을 월별 그리고 연간 요약으로 정리합니다.</Text>
        </div>
        <Space wrap>
          {isSuperAdmin && (
            <Select
              placeholder="회사"
              value={companyId}
              onChange={setCompanyId}
              style={{ width: 200 }}
              options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 110 }}
            options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
          />
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExport}
            loading={generating}
            disabled={!report}
          >
            엑셀 추출 (양식 그대로)
          </Button>
        </Space>
      </div>

      {!companyId && (
        <Card style={{ background: '#fffbe6', borderColor: '#ffe58f', marginBottom: 16 }}>
          <Text>⚠️ 회사를 선택해주세요.</Text>
        </Card>
      )}

      <Spin spinning={loading}>
        {report && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>{report.companyName} — {year}년 보고서</Text>
              <Tag color="purple" style={{ marginLeft: 8 }}>사업부 그룹: {groups.join(', ')}</Tag>
            </Card>

            {yearlyStats && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={6}>
                  <Card><Statistic title="연간 총 계약" value={yearlyStats.cCnt} suffix="건" /></Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card><Statistic title="연간 총 계약금액" value={yearlyStats.cAmt} suffix="원" valueStyle={{ color: '#1890ff' }} /></Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card><Statistic title="연간 총 매출" value={yearlyStats.sAmt} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="연간 추정 순이익 (매출 - 경비)"
                      value={yearlyStats.profitVsSales}
                      suffix="원"
                      valueStyle={{ color: yearlyStats.profitVsSales >= 0 ? '#1890ff' : '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              type="card"
              items={[
                {
                  key: 'summary',
                  label: '총매출현황 (연간)',
                  children: (
                    <Card>
                      <Title level={5}>1) 계약 / 매출 매트릭스</Title>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="month"
                        scroll={{ x: 1200 }}
                        dataSource={yearlyMatrix}
                        columns={[
                          { title: '월', dataIndex: 'month', width: 60, fixed: 'left' as const },
                          ...groups.flatMap((g) => [
                            { title: `${g} 계약건수`, dataIndex: `c_${g}_cnt`, width: 100, align: 'right' as const, render: (v: number) => `${v}` },
                            { title: `${g} 계약금액`, dataIndex: `c_${g}_amt`, width: 130, align: 'right' as const, render: (v: number) => fmt(v) },
                          ]),
                          { title: '총 계약건수', dataIndex: 'c_total_cnt', width: 100, align: 'right' as const },
                          { title: '총 계약금액', dataIndex: 'c_total_amt', width: 140, align: 'right' as const, render: (v: number) => <strong>{fmt(v)}</strong> },
                        ]}
                      />

                      <Title level={5} style={{ marginTop: 24 }}>2) 매출 매트릭스</Title>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="month"
                        scroll={{ x: 1200 }}
                        dataSource={yearlyMatrix}
                        columns={[
                          { title: '월', dataIndex: 'month', width: 60, fixed: 'left' as const },
                          ...groups.flatMap((g) => [
                            { title: `${g} 건수`, dataIndex: `s_${g}_cnt`, width: 90, align: 'right' as const },
                            { title: `${g} 금액`, dataIndex: `s_${g}_amt`, width: 130, align: 'right' as const, render: (v: number) => fmt(v) },
                          ]),
                          { title: '총 매출건수', dataIndex: 's_total_cnt', width: 100, align: 'right' as const },
                          { title: '총 매출금액', dataIndex: 's_total_amt', width: 140, align: 'right' as const, render: (v: number) => <strong style={{ color: '#52c41a' }}>{fmt(v)}</strong> },
                        ]}
                      />

                      <Title level={5} style={{ marginTop: 24 }}>3) 순이익 매트릭스</Title>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="month"
                        dataSource={yearlyMatrix}
                        columns={[
                          { title: '월', dataIndex: 'month', width: 80 },
                          { title: '총매출', dataIndex: 's_total_amt', align: 'right' as const, render: (v: number) => fmt(v) },
                          { title: '수금액', dataIndex: 'received', align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{fmt(v)}</span> },
                          { title: '경비', dataIndex: 'expense', align: 'right' as const, render: (v: number) => <span style={{ color: '#fa8c16' }}>{fmt(v)}</span> },
                          { title: '매출대비 순이익', dataIndex: 'profit_sales', align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#1890ff' : '#ff4d4f' }}>{fmt(v)}</span> },
                          { title: '수금대비 순이익', dataIndex: 'profit_rec', align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#1890ff' : '#ff4d4f' }}>{fmt(v)}</span> },
                        ]}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'profit',
                  label: '부서별 순이익',
                  children: (
                    <>
                      {profitByCompany.length > 0 && (
                        <Card style={{ marginBottom: 16 }}>
                          <Title level={5}>회사별 순이익</Title>
                          <Table
                            size="small"
                            pagination={false}
                            rowKey="company_id"
                            dataSource={profitByCompany}
                            columns={[
                              { title: '회사', dataIndex: 'company_name', key: 'name' },
                              { title: '매출', dataIndex: 'revenue', align: 'right' as const, render: (v: number) => fmt(v) },
                              { title: '매입', dataIndex: 'expense', align: 'right' as const, render: (v: number) => fmt(v) },
                              { title: '인건비', dataIndex: 'labor', align: 'right' as const, render: (v: number) => fmt(v) },
                              { title: '순이익', dataIndex: 'netProfit', align: 'right' as const,
                                render: (v: number) => <strong style={{ color: v >= 0 ? '#1890ff' : '#ff4d4f' }}>{fmt(v)}</strong> },
                            ]}
                          />
                        </Card>
                      )}
                      <Card>
                        <Title level={5}>부서별 순이익 (순이익 높은 순)</Title>
                        {profitByDept.length === 0 ? (
                          <Text type="secondary">부서별 데이터가 없습니다.</Text>
                        ) : (
                          <>
                            <Table
                              size="small"
                              pagination={false}
                              rowKey="dept_id"
                              dataSource={profitByDept}
                              columns={[
                                { title: '부서', dataIndex: 'dept_name', key: 'name' },
                                { title: '매출', dataIndex: 'revenue', align: 'right' as const, render: (v: number) => fmt(v) },
                                { title: '매입', dataIndex: 'expense', align: 'right' as const, render: (v: number) => fmt(v) },
                                { title: '인건비', dataIndex: 'labor', align: 'right' as const, render: (v: number) => fmt(v) },
                                { title: '순이익', dataIndex: 'netProfit', align: 'right' as const,
                                  render: (v: number) => <strong style={{ color: v >= 0 ? '#1890ff' : '#ff4d4f' }}>{fmt(v)}</strong> },
                                { title: '비중', key: 'pct', align: 'right' as const, render: (_: any, r: any) => {
                                  const total = profitByDept.reduce((s, d) => s + Math.abs(d.netProfit), 0);
                                  if (!total) return '-';
                                  const pct = (Math.abs(r.netProfit) / total) * 100;
                                  return `${pct.toFixed(1)}%`;
                                }},
                              ]}
                            />
                            <div style={{ marginTop: 24 }}>
                              <Title level={5}>부서별 순이익 차트</Title>
                              {profitByDept.map((d: any) => {
                                const max = Math.max(...profitByDept.map((x: any) => Math.abs(x.netProfit)), 1);
                                const widthPct = (Math.abs(d.netProfit) / max) * 100;
                                const isNeg = d.netProfit < 0;
                                return (
                                  <div key={d.dept_id} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                      <span><strong>{d.dept_name}</strong></span>
                                      <span style={{ color: isNeg ? '#ff4d4f' : '#1890ff', fontWeight: 600 }}>{fmt(d.netProfit)}</span>
                                    </div>
                                    <div style={{ height: 18, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${widthPct}%`,
                                        height: '100%',
                                        background: isNeg
                                          ? 'linear-gradient(90deg, #ff7875, #ff4d4f)'
                                          : 'linear-gradient(90deg, #69c0ff, #1890ff)',
                                        borderRadius: 3,
                                        transition: 'width 0.4s ease',
                                      }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </Card>
                    </>
                  ),
                },
                ...((report.monthly as any[]).map((md) => ({
                  key: `m${md.month}`,
                  label: `${md.month}월`,
                  children: renderMonthDetail(md),
                }))),
              ]}
            />
          </>
        )}
      </Spin>
    </div>
  );
};

export default DirectorReport;
