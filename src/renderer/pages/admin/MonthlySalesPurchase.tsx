import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Typography, Select, message } from 'antd';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;

interface MonthRow {
  key: string;
  label: string;
  isSubtotal?: boolean;
  salesSupply: number; salesVat: number; salesTotal: number;
  purchaseSupply: number; purchaseVat: number; purchaseTotal: number;
  diff: number;       // 매출-매입 차액 (공급가액 기준)
  vatDiff: number;    // 부가세 매출-매입
  expense: number;    // 일반경비
  profit: number;     // 순이익 = diff - expense
}

const won = (v: number) => `${Math.round(v || 0).toLocaleString()}원`;

const MonthlySalesPurchase: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  const [year, setYear] = useState<number>(dayjs().year());
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [invRes, expRes] = await Promise.all([
        window.electronAPI.taxInvoices.getAll(user.id, companyId ? { company_id: companyId } : undefined),
        window.electronAPI.expenses.getAll(user.id, companyId ? { company_id: companyId } : undefined),
      ]);
      if (invRes.success) setInvoices(invRes.invoices || invRes.data || []);
      if (expRes.success) setExpenses(expRes.data || expRes.settlements || []);
    } catch (err: any) {
      message.error(err?.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const rows: MonthRow[] = useMemo(() => {
    // 월별 누적
    const blank = () => ({
      salesSupply: 0, salesVat: 0, salesTotal: 0,
      purchaseSupply: 0, purchaseVat: 0, purchaseTotal: 0, expense: 0,
    });
    const months: Record<number, ReturnType<typeof blank>> = {};
    for (let m = 1; m <= 12; m++) months[m] = blank();

    for (const inv of invoices) {
      if (!inv.issue_date) continue;
      const d = dayjs(inv.issue_date);
      if (d.year() !== year) continue;
      const m = d.month() + 1;
      const supply = Number(inv.supply_amount) || 0;
      const vat = Number(inv.vat_amount) || 0;
      const total = Number(inv.total_amount) || (supply + vat);
      if (inv.direction === 'received') {
        months[m].purchaseSupply += supply; months[m].purchaseVat += vat; months[m].purchaseTotal += total;
      } else {
        months[m].salesSupply += supply; months[m].salesVat += vat; months[m].salesTotal += total;
      }
    }
    for (const e of expenses) {
      const dateStr = e.settlement_date || e.created_at;
      if (!dateStr) continue;
      const d = dayjs(dateStr);
      if (d.year() !== year) continue;
      if (e.status && !['approved', 'paid'].includes(e.status)) continue;
      const m = d.month() + 1;
      months[m].expense += Number(e.total_amount) || 0;
    }

    const mkRow = (key: string, label: string, src: ReturnType<typeof blank>, isSubtotal = false): MonthRow => {
      const diff = src.salesSupply - src.purchaseSupply;
      return {
        key, label, isSubtotal,
        salesSupply: src.salesSupply, salesVat: src.salesVat, salesTotal: src.salesTotal,
        purchaseSupply: src.purchaseSupply, purchaseVat: src.purchaseVat, purchaseTotal: src.purchaseTotal,
        diff, vatDiff: src.salesVat - src.purchaseVat,
        expense: src.expense, profit: diff - src.expense,
      };
    };
    const sumRange = (a: number, b: number) => {
      const acc = blank();
      for (let m = a; m <= b; m++) {
        acc.salesSupply += months[m].salesSupply; acc.salesVat += months[m].salesVat; acc.salesTotal += months[m].salesTotal;
        acc.purchaseSupply += months[m].purchaseSupply; acc.purchaseVat += months[m].purchaseVat; acc.purchaseTotal += months[m].purchaseTotal;
        acc.expense += months[m].expense;
      }
      return acc;
    };

    const out: MonthRow[] = [];
    const quarters = [[1, 3, '1/4분기'], [4, 6, '2/4분기'], [7, 9, '3/4분기'], [10, 12, '4/4분기']] as const;
    for (const [qa, qb, qlabel] of quarters) {
      for (let m = qa; m <= qb; m++) out.push(mkRow(`m${m}`, `${m}월`, months[m]));
      out.push(mkRow(`q${qa}`, qlabel, sumRange(qa, qb), true));
    }
    out.push(mkRow('total', '연간 합계', sumRange(1, 12), true));
    return out;
  }, [invoices, expenses, year]);

  const columns = [
    { title: '월', dataIndex: 'label', key: 'label', width: 90, fixed: 'left' as const,
      render: (v: string, r: MonthRow) => <span style={{ fontWeight: r.isSubtotal ? 700 : 400 }}>{v}</span> },
    { title: '매출금액', dataIndex: 'salesSupply', key: 'salesSupply', width: 120, align: 'right' as const, render: won },
    { title: '매출부가세', dataIndex: 'salesVat', key: 'salesVat', width: 110, align: 'right' as const, render: won },
    { title: '매출합계', dataIndex: 'salesTotal', key: 'salesTotal', width: 130, align: 'right' as const, render: (v: number) => <b style={{ color: '#1890ff' }}>{won(v)}</b> },
    { title: '매입금액', dataIndex: 'purchaseSupply', key: 'purchaseSupply', width: 120, align: 'right' as const, render: won },
    { title: '매입부가세', dataIndex: 'purchaseVat', key: 'purchaseVat', width: 110, align: 'right' as const, render: won },
    { title: '매입합계', dataIndex: 'purchaseTotal', key: 'purchaseTotal', width: 130, align: 'right' as const, render: (v: number) => <b style={{ color: '#fa8c16' }}>{won(v)}</b> },
    { title: '매출-매입차액', dataIndex: 'diff', key: 'diff', width: 130, align: 'right' as const, render: won },
    { title: '부가세(매출-매입)', dataIndex: 'vatDiff', key: 'vatDiff', width: 140, align: 'right' as const, render: won },
    { title: '일반경비', dataIndex: 'expense', key: 'expense', width: 120, align: 'right' as const, render: won },
    { title: '순이익', dataIndex: 'profit', key: 'profit', width: 130, align: 'right' as const,
      render: (v: number) => <b style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{won(v)}</b> },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>{year}년 월별 매출-매입현황</Title>
          <span style={{ color: '#888' }}>세금계산서(매출/매입)와 경비내역에서 자동 집계됩니다. 순이익 = (매출공급가액 − 매입공급가액) − 일반경비</span>
        </div>
        <Select value={year} onChange={setYear} style={{ width: 120 }}>
          {[0, 1, 2, 3].map((i) => {
            const y = dayjs().year() - i;
            return <Option key={y} value={y}>{y}년</Option>;
          })}
        </Select>
      </div>

      <Card>
        <ResizableTable
          columns={columns}
          dataSource={rows}
          rowKey="key"
          loading={loading}
          pagination={false}
          scroll={{ x: 1500 }}
          rowClassName={(r: MonthRow) => (r.isSubtotal ? 'subtotal-row' : '')}
          onRow={(r: MonthRow) => ({ style: r.isSubtotal ? { background: '#fafafa' } : {} })}
        />
      </Card>
    </div>
  );
};

export default MonthlySalesPurchase;
