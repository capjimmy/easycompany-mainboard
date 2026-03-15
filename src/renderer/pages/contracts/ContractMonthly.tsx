import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Table, Select, Row, Col, Statistic, Tag, Space, Button, Spin
} from 'antd';
import {
  BarChartOutlined, ArrowLeftOutlined, DollarOutlined, FileTextOutlined,
  CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

interface MonthlyStats {
  month: number;
  contractCount: number;
  totalAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  completedCount: number;
  inProgressCount: number;
}

interface ContractSummary {
  id: string;
  contract_number: string;
  client_company: string;
  service_name: string;
  contract_amount: number;
  total_amount: number;
  received_amount: number;
  remaining_amount: number;
  progress: string;
  contract_start_date: string;
  contract_end_date: string;
}

const ContractMonthly: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

  useEffect(() => {
    if (user?.id) {
      loadMonthlyStats();
    }
  }, [user?.id, selectedYear]);

  useEffect(() => {
    if (user?.id && selectedMonth !== null) {
      loadMonthContracts();
    }
  }, [user?.id, selectedMonth]);

  const loadMonthlyStats = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      const result = await window.electronAPI.contracts.getMonthlyStats(user.id, selectedYear);
      if (result.success) {
        setMonthlyStats(result.stats || []);
      }
    } catch (err) {
      console.error('Failed to load monthly stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthContracts = async () => {
    if (!user?.id || selectedMonth === null) return;
    setIsLoading(true);

    try {
      const result = await window.electronAPI.contracts.getAll(user.id, {
        year: selectedYear,
        month: selectedMonth,
      });
      if (result.success) {
        setContracts(result.contracts || []);
      }
    } catch (err) {
      console.error('Failed to load month contracts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressTag = (progress: string) => {
    const progressMap: Record<string, { color: string; label: string }> = {
      contract_signed: { color: 'blue', label: '계약체결' },
      in_progress: { color: 'processing', label: '진행중' },
      inspection: { color: 'orange', label: '검수중' },
      completed: { color: 'green', label: '완료' },
      cancelled: { color: 'red', label: '취소' },
    };
    const status = progressMap[progress] || { color: 'default', label: progress };
    return <Tag color={status.color}>{status.label}</Tag>;
  };

  // monthlyStats가 배열인지 확인
  const statsArray = Array.isArray(monthlyStats) ? monthlyStats : [];
  const totalYearAmount = statsArray.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const totalYearReceived = statsArray.reduce((sum, m) => sum + (m.receivedAmount || 0), 0);
  const totalYearRemaining = statsArray.reduce((sum, m) => sum + (m.remainingAmount || 0), 0);
  const totalContracts = statsArray.reduce((sum, m) => sum + (m.contractCount || 0), 0);

  const statsColumns = [
    {
      title: '월',
      dataIndex: 'month',
      key: 'month',
      render: (month: number) => (
        <Button
          type="link"
          onClick={() => setSelectedMonth(month)}
          style={{ fontWeight: selectedMonth === month ? 'bold' : 'normal' }}
        >
          {month}월
        </Button>
      ),
    },
    {
      title: '계약 건수',
      dataIndex: 'contractCount',
      key: 'contractCount',
      align: 'right' as const,
      render: (count: number) => `${count}건`,
    },
    {
      title: '계약 총액',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amount: number) => `${amount.toLocaleString()}원`,
    },
    {
      title: '입금액',
      dataIndex: 'receivedAmount',
      key: 'receivedAmount',
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: '#52c41a' }}>{amount.toLocaleString()}원</span>
      ),
    },
    {
      title: '미수금',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#000' }}>
          {amount.toLocaleString()}원
        </span>
      ),
    },
    {
      title: '완료',
      dataIndex: 'completedCount',
      key: 'completedCount',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="green">{count}</Tag>
      ),
    },
    {
      title: '진행중',
      dataIndex: 'inProgressCount',
      key: 'inProgressCount',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="blue">{count}</Tag>
      ),
    },
  ];

  const contractColumns = [
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      render: (num: string, record: ContractSummary) => (
        <a onClick={() => navigate(`/contracts/${record.id}`)}>{num}</a>
      ),
    },
    {
      title: '발주기관',
      dataIndex: 'client_company',
      key: 'client_company',
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: '계약금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (amount: number) => `${amount?.toLocaleString()}원`,
    },
    {
      title: '입금액',
      dataIndex: 'received_amount',
      key: 'received_amount',
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: '#52c41a' }}>{amount?.toLocaleString()}원</span>
      ),
    },
    {
      title: '미수금',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#000' }}>
          {amount?.toLocaleString()}원
        </span>
      ),
    },
    {
      title: '진행상태',
      dataIndex: 'progress',
      key: 'progress',
      render: getProgressTag,
    },
  ];

  if (isLoading && statsArray.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <BarChartOutlined /> 월별 현황
            </Title>
          </div>
        </div>
        <Select
          value={selectedYear}
          onChange={setSelectedYear}
          style={{ width: 120 }}
        >
          {years.map((year) => (
            <Option key={year} value={year}>{year}년</Option>
          ))}
        </Select>
      </div>

      {/* 연간 요약 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="연간 계약 건수"
              value={totalContracts}
              suffix="건"
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="연간 계약 총액"
              value={totalYearAmount}
              suffix="원"
              prefix={<DollarOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="연간 입금액"
              value={totalYearReceived}
              suffix="원"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="연간 미수금"
              value={totalYearRemaining}
              suffix="원"
              valueStyle={{ color: totalYearRemaining > 0 ? '#ff4d4f' : '#000' }}
              prefix={<ClockCircleOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* 월별 테이블 */}
      <Card title={`${selectedYear}년 월별 현황`} style={{ marginBottom: 24 }}>
        <Table
          columns={statsColumns}
          dataSource={statsArray}
          rowKey="month"
          pagination={false}
          size="middle"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><strong>합계</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong>{totalContracts}건</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <strong>{totalYearAmount.toLocaleString()}원</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <strong style={{ color: '#52c41a' }}>{totalYearReceived.toLocaleString()}원</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <strong style={{ color: totalYearRemaining > 0 ? '#ff4d4f' : '#000' }}>
                    {totalYearRemaining.toLocaleString()}원
                  </strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={2} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* 선택된 월의 계약 목록 */}
      {selectedMonth !== null && (
        <Card
          title={`${selectedYear}년 ${selectedMonth}월 계약 목록`}
          extra={
            <Button type="link" onClick={() => setSelectedMonth(null)}>
              닫기
            </Button>
          }
        >
          <Table
            columns={contractColumns}
            dataSource={contracts}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: '해당 월에 계약이 없습니다.' }}
          />
        </Card>
      )}
    </div>
  );
};

export default ContractMonthly;
