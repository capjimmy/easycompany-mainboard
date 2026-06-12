import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Select, Space,
  Spin, message, Button, Table,
} from 'antd';
import { BarChartOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

type RowData = {
  month: string;
  contractCount: number;
  contractAmount: number;
  taxIssued: number;       // 매출(세금계산서 발행) 합계
  taxReceived: number;     // 매입(세금계산서 수취) 합계
  billingAmount: number;   // 청구 합계
  receiptAmount: number;   // 입금 합계
  expenseSupply: number;   // 경비 공급가액
  expenseVat: number;      // 경비 부가세
  expenseTotal: number;    // 경비 총액
};

const MonthlyComparison: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const companyId = selectedCompanyId || user?.company_id;

  const [year, setYear] = useState<number>(dayjs().year());
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user?.id) loadAll();
  }, [user?.id, selectedCompanyId, year]);

  const loadAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filter = companyId ? { company_id: companyId } : {};
      const [c, t, b, r, e, co] = await Promise.all([
        window.electronAPI.contracts.getAll(user.id, filter),
        window.electronAPI.taxInvoices.getAll(user.id, filter).catch(() => null),
        (window as any).electronAPI.billings.getAll(user.id, filter).catch(() => null),
        (window as any).electronAPI.paymentReceipts.getAll(user.id, filter).catch(() => null),
        window.electronAPI.expenses.getAll(user.id, filter).catch(() => null),
        isSuperAdmin ? window.electronAPI.companies.getAll(user.id) : Promise.resolve(null),
      ]);
      if (c?.success) setContracts(c.contracts || []);
      if (t?.success) setTaxInvoices(t.invoices || t.data || []);
      if (b?.success) setBillings(b.billings || b.data || []);
      if (r?.success) setReceipts(r.receipts || r.paymentReceipts || r.data || []);
      if (e?.success) setExpenses(e.data || []);
      if (co?.success) setCompanies(co.companies || []);
    } catch (err: any) {
      message.error(err?.message || '데이터 조회 중 오류');
    } finally {
      setLoading(false);
    }
  };

  const inYear = (dateStr?: string) => dateStr && dateStr.startsWith(String(year));

  // 회사 필터 적용
  const fc = useMemo(() => {
    if (!filterCompany) return contracts;
    return contracts.filter((c: any) => c.company_id === filterCompany);
  }, [contracts, filterCompany]);
  const ft = useMemo(() => {
    if (!filterCompany) return taxInvoices;
    return taxInvoices.filter((x: any) => x.company_id === filterCompany);
  }, [taxInvoices, filterCompany]);
  const fb = useMemo(() => {
    if (!filterCompany) return billings;
    return billings.filter((x: any) => x.company_id === filterCompany);
  }, [billings, filterCompany]);
  const fr = useMemo(() => {
    if (!filterCompany) return receipts;
    return receipts.filter((x: any) => x.company_id === filterCompany);
  }, [receipts, filterCompany]);
  const fe = useMemo(() => {
    if (!filterCompany) return expenses;
    return expenses.filter((x: any) => x.company_id === filterCompany);
  }, [expenses, filterCompany]);

  const rows: RowData[] = useMemo(() => {
    const out: RowData[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      // 계약 (계약체결일 또는 계약시작일 기준)
      const monthC = fc.filter((c: any) => {
        const d = c.contract_date || c.contract_start_date || c.created_at;
        return typeof d === 'string' && d.startsWith(ym);
      });
      // 세금계산서 (발행일 기준)
      const issued = ft.filter((x: any) => x.direction === 'issued' && x.issue_date?.startsWith(ym));
      const received = ft.filter((x: any) => x.direction === 'received' && x.issue_date?.startsWith(ym));
      // 청구 (billing_date 기준)
      const monthB = fb.filter((x: any) => x.billing_date?.startsWith(ym));
      // 입금 (received_date / payment_date 기준)
      const monthR = fr.filter((x: any) => {
        const d = x.received_date || x.payment_date || x.receipt_date;
        return typeof d === 'string' && d.startsWith(ym);
      });
      // 경비 — 정산일자 기준, 승인/지급된 것만
      const monthE = fe.filter((x: any) =>
        (x.settlement_date || '').startsWith(ym) &&
        (x.status === 'approved' || x.status === 'paid')
      );

      let expenseSupply = 0, expenseVat = 0, expenseTotal = 0;
      for (const e of monthE) {
        for (const it of (e.items || []) as any[]) {
          const amt = Number(it.amount) || 0;
          expenseTotal += amt;
          if (it.vat_included) {
            const s = Number(it.supply_amount) || Math.round(amt / 1.1);
            const v = Number(it.vat_amount) || (amt - s);
            expenseSupply += s;
            expenseVat += v;
          } else {
            expenseSupply += Number(it.supply_amount) || amt;
          }
        }
      }

      out.push({
        month: ym,
        contractCount: monthC.length,
        contractAmount: monthC.reduce((s: number, c: any) => s + (c.total_amount || 0), 0),
        taxIssued: issued.reduce((s: number, x: any) => s + (x.total_amount || 0), 0),
        taxReceived: received.reduce((s: number, x: any) => s + (x.total_amount || 0), 0),
        billingAmount: monthB.reduce((s: number, x: any) => s + (x.billing_amount || 0), 0),
        receiptAmount: monthR.reduce((s: number, x: any) => s + (x.amount || x.payment_amount || 0), 0),
        expenseSupply,
        expenseVat,
        expenseTotal,
      });
    }
    return out;
  }, [fc, ft, fb, fr, fe, year]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    contractCount: a.contractCount + r.contractCount,
    contractAmount: a.contractAmount + r.contractAmount,
    taxIssued: a.taxIssued + r.taxIssued,
    taxReceived: a.taxReceived + r.taxReceived,
    billingAmount: a.billingAmount + r.billingAmount,
    receiptAmount: a.receiptAmount + r.receiptAmount,
    expenseSupply: a.expenseSupply + r.expenseSupply,
    expenseVat: a.expenseVat + r.expenseVat,
    expenseTotal: a.expenseTotal + r.expenseTotal,
  }), {
    contractCount: 0, contractAmount: 0, taxIssued: 0, taxReceived: 0,
    billingAmount: 0, receiptAmount: 0, expenseSupply: 0, expenseVat: 0, expenseTotal: 0,
  }), [rows]);

  // 매출 - 매입 - 경비 = 손익(추정)
  const netProfit = totals.taxIssued - totals.taxReceived - totals.expenseTotal;

  const fmt = (v: number) => v.toLocaleString();

  const handleExport = async () => {
    if (!user?.id) return;
    try {
      const cols = [
        { title: '월', key: 'month' },
        { title: '계약 건수', key: 'contractCount' },
        { title: '계약금액', key: 'contractAmount' },
        { title: '세금계산서 매출', key: 'taxIssued' },
        { title: '세금계산서 매입', key: 'taxReceived' },
        { title: '청구', key: 'billingAmount' },
        { title: '입금', key: 'receiptAmount' },
        { title: '경비 공급가액', key: 'expenseSupply' },
        { title: '경비 부가세', key: 'expenseVat' },
        { title: '경비 합계', key: 'expenseTotal' },
      ];
      const result = await (window as any).electronAPI.export.financeGeneric(user.id, `월별비교_${year}`, cols, rows);
      if (result?.success) message.success('엑셀 저장 완료');
      else message.error(result?.error || '엑셀 저장 실패');
    } catch (err: any) {
      message.error(err?.message || '엑셀 저장 중 오류');
    }
  };

  const columns = [
    { title: '월', dataIndex: 'month', width: 100, render: (v: string) => dayjs(v).format('M월') },
    { title: '계약 건수', dataIndex: 'contractCount', width: 90, align: 'right' as const, render: (v: number) => `${v}건` },
    { title: '계약금액', dataIndex: 'contractAmount', align: 'right' as const, render: (v: number) => `${fmt(v)}원` },
    { title: '매출 (세계)', dataIndex: 'taxIssued', align: 'right' as const, render: (v: number) => <span style={{ color: '#1890ff', fontWeight: 600 }}>{fmt(v)}원</span> },
    { title: '매입 (세계)', dataIndex: 'taxReceived', align: 'right' as const, render: (v: number) => <span style={{ color: '#fa541c' }}>{fmt(v)}원</span> },
    { title: '청구', dataIndex: 'billingAmount', align: 'right' as const, render: (v: number) => `${fmt(v)}원` },
    { title: '입금', dataIndex: 'receiptAmount', align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{fmt(v)}원</span> },
    { title: '경비 공급가', dataIndex: 'expenseSupply', align: 'right' as const, render: (v: number) => `${fmt(v)}원` },
    { title: '경비 VAT', dataIndex: 'expenseVat', align: 'right' as const, render: (v: number) => <span style={{ color: '#fa8c16' }}>{fmt(v)}원</span> },
    { title: '경비 합계', dataIndex: 'expenseTotal', align: 'right' as const, render: (v: number) => `${fmt(v)}원` },
  ];

  const yearOptions = Array.from({ length: 6 }, (_, i) => dayjs().year() - 3 + i);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8 }} />
            월별 비교관리
          </Title>
          <Text type="secondary">계약·매출(세금계산서)·청구·입금·경비를 1년 단위 매트릭스로 비교</Text>
        </div>
        <Space wrap>
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 120 }}
            options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
          />
          {isSuperAdmin && companies.length > 0 && (
            <Select
              placeholder="회사"
              value={filterCompany}
              onChange={setFilterCompany}
              allowClear
              style={{ width: 180 }}
              options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>엑셀</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="계약 합계" value={totals.contractAmount} suffix="원" valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="매출 (세계)" value={totals.taxIssued} suffix="원" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="매입 (세계)" value={totals.taxReceived} suffix="원" valueStyle={{ color: '#fa541c' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="추정 손익 (매출 - 매입 - 경비)"
              value={netProfit}
              suffix="원"
              valueStyle={{ color: netProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Spin spinning={loading}>
          <ResizableTable
            columns={columns as any}
            dataSource={rows}
            rowKey="month"
            pagination={false}
            scroll={{ x: 1200 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0}>합계</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{totals.contractCount}건</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{fmt(totals.contractAmount)}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><span style={{ color: '#1890ff' }}>{fmt(totals.taxIssued)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><span style={{ color: '#fa541c' }}>{fmt(totals.taxReceived)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">{fmt(totals.billingAmount)}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right"><span style={{ color: '#52c41a' }}>{fmt(totals.receiptAmount)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">{fmt(totals.expenseSupply)}원</Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right"><span style={{ color: '#fa8c16' }}>{fmt(totals.expenseVat)}원</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">{fmt(totals.expenseTotal)}원</Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default MonthlyComparison;
