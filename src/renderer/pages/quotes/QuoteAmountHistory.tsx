import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Space, Typography, Empty, Spin } from 'antd';
import { HistoryOutlined, ArrowRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface AmountHistory {
  id: string;
  quote_id: string;
  changed_by: string;
  changed_by_name: string;
  previous_labor_total: number;
  new_labor_total: number;
  previous_expense_total: number;
  new_expense_total: number;
  previous_total: number;
  new_total: number;
  change_reason: string | null;
  created_at: string;
}

interface QuoteAmountHistoryProps {
  quoteId: string;
  userId: string;
}

const formatAmount = (val: number) => `${(val || 0).toLocaleString()}원`;

const AmountChange: React.FC<{ prev: number; next: number; label?: string }> = ({ prev, next, label }) => {
  const diff = next - prev;
  const isIncrease = diff > 0;
  const isDecrease = diff < 0;

  return (
    <div style={{ marginBottom: 4 }}>
      {label && <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>{label}:</Text>}
      <Text delete style={{ color: '#999', fontSize: 12 }}>{formatAmount(prev)}</Text>
      <ArrowRightOutlined style={{ margin: '0 6px', fontSize: 10, color: '#999' }} />
      <Text strong style={{ fontSize: 13 }}>{formatAmount(next)}</Text>
      {diff !== 0 && (
        <Tag
          color={isIncrease ? 'red' : 'green'}
          style={{ marginLeft: 6, fontSize: 11 }}
        >
          {isIncrease ? '+' : ''}{formatAmount(diff)}
        </Tag>
      )}
    </div>
  );
};

const QuoteAmountHistory: React.FC<QuoteAmountHistoryProps> = ({ quoteId, userId }) => {
  const [histories, setHistories] = useState<AmountHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.quotes.getAmountHistories(userId, quoteId);
      if (result.success) {
        setHistories(result.histories || []);
      }
    } catch (err) {
      console.error('Failed to fetch quote amount histories:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, quoteId]);

  useEffect(() => {
    fetchHistories();
  }, [fetchHistories]);

  const columns = [
    {
      title: '변경일시',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '변경자',
      dataIndex: 'changed_by_name',
      key: 'changed_by_name',
      width: 100,
    },
    {
      title: '인건비 변경',
      key: 'labor_change',
      width: 280,
      render: (_: any, record: AmountHistory) => (
        <AmountChange prev={record.previous_labor_total} next={record.new_labor_total} />
      ),
    },
    {
      title: '경비 변경',
      key: 'expense_change',
      width: 280,
      render: (_: any, record: AmountHistory) => (
        <AmountChange prev={record.previous_expense_total} next={record.new_expense_total} />
      ),
    },
    {
      title: '총액 변경 (VAT 포함)',
      key: 'total_change',
      width: 300,
      render: (_: any, record: AmountHistory) => (
        <AmountChange prev={record.previous_total} next={record.new_total} />
      ),
    },
    {
      title: '사유',
      dataIndex: 'change_reason',
      key: 'change_reason',
      render: (val: string | null) => val || '-',
    },
  ];

  if (loading) {
    return (
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>금액 변경 이력</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined />
          <span>금액 변경 이력</span>
          <Tag>{histories.length}건</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {histories.length === 0 ? (
        <Empty description="금액 변경 이력이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          columns={columns}
          dataSource={histories}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 1200 }}
        />
      )}
    </Card>
  );
};

export default QuoteAmountHistory;
