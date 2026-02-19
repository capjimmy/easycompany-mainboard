import React, { useEffect, useState } from 'react';
import {
  Popover, Button, List, Typography, Tag, Space, Statistic, Divider, Empty, Spin,
  Row, Col, Card
} from 'antd';
import {
  BulbOutlined, FileTextOutlined, RiseOutlined, FallOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Text, Title } = Typography;

declare global {
  interface Window {
    electronAPI: any;
  }
}

// 추천 견적 타입
interface QuoteRecommendation {
  id: string;
  quote_number: string;
  recipient_company: string;
  service_name: string;
  labor_total: number;
  expense_total: number;
  grand_total: number;
  quote_date: string;
  status: string;
}

// 추천 계약 타입
interface ContractRecommendation {
  id: string;
  contract_number: string;
  client_company: string;
  service_name: string;
  contract_amount: number;
  total_amount: number;
  contract_start_date: string;
  contract_end_date: string;
  progress: string;
}

interface RecommendationStats {
  count: number;
  avgGrandTotal?: number;
  avgTotalAmount?: number;
  avgLaborTotal?: number;
  avgExpenseTotal?: number;
  avgContractAmount?: number;
  minGrandTotal?: number;
  maxGrandTotal?: number;
  minTotalAmount?: number;
  maxTotalAmount?: number;
}

interface RecommendationPopoverProps {
  type: 'quote' | 'contract';
  clientCompany?: string;
  serviceName?: string;
  onSelect?: (item: QuoteRecommendation | ContractRecommendation) => void;
  disabled?: boolean;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString() + '원';
};

const statusLabels: Record<string, { text: string; color: string }> = {
  // 견적서 상태
  draft: { text: '작성중', color: 'default' },
  submitted: { text: '제출됨', color: 'processing' },
  negotiating: { text: '협상중', color: 'warning' },
  approved: { text: '승인됨', color: 'success' },
  rejected: { text: '거절됨', color: 'error' },
  converted: { text: '계약전환', color: 'purple' },
  // 계약서 상태
  contract_signed: { text: '계약체결', color: 'blue' },
  in_progress: { text: '진행중', color: 'processing' },
  inspection: { text: '검수중', color: 'warning' },
  completed: { text: '완료', color: 'success' },
  cancelled: { text: '취소', color: 'error' },
};

const RecommendationPopover: React.FC<RecommendationPopoverProps> = ({
  type,
  clientCompany,
  serviceName,
  onSelect,
  disabled,
}) => {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<(QuoteRecommendation | ContractRecommendation)[]>([]);
  const [stats, setStats] = useState<RecommendationStats | null>(null);

  // 데이터 로드
  const loadRecommendations = async () => {
    if (!user?.id) return;

    // 검색 조건이 없으면 로드하지 않음
    if (!clientCompany && !serviceName) {
      setRecommendations([]);
      setStats(null);
      return;
    }

    setLoading(true);
    try {
      const searchParams = { clientCompany, serviceName };

      let result;
      if (type === 'quote') {
        result = await window.electronAPI.quotes.getRecommendations(user.id, searchParams);
      } else {
        result = await window.electronAPI.contracts.getRecommendations(user.id, searchParams);
      }

      if (result.success) {
        setRecommendations(result.recommendations || []);
        setStats(result.stats || null);
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadRecommendations();
    }
  }, [open, clientCompany, serviceName]);

  const handleOpenChange = (visible: boolean) => {
    setOpen(visible);
  };

  const handleSelect = (item: QuoteRecommendation | ContractRecommendation) => {
    if (onSelect) {
      onSelect(item);
    }
    setOpen(false);
  };

  // 팝오버 내용
  const content = (
    <div style={{ width: 480, maxHeight: 500, overflow: 'auto' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">추천 데이터를 불러오는 중...</Text>
          </div>
        </div>
      ) : recommendations.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text>유사한 {type === 'quote' ? '견적서' : '계약서'}가 없습니다.</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                거래처명이나 용역명을 입력하면 관련 데이터를 찾습니다.
              </Text>
            </div>
          }
        />
      ) : (
        <>
          {/* 통계 요약 */}
          {stats && stats.count > 0 && (
            <>
              <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="유사 건수"
                      value={stats.count}
                      suffix="건"
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="평균 금액"
                      value={type === 'quote' ? stats.avgGrandTotal : stats.avgTotalAmount}
                      formatter={(val) => formatCurrency(Number(val))}
                      valueStyle={{ fontSize: 18, color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="금액 범위"
                      value={`${formatCurrency(type === 'quote' ? stats.minGrandTotal || 0 : stats.minTotalAmount || 0)} ~ ${formatCurrency(type === 'quote' ? stats.maxGrandTotal || 0 : stats.maxTotalAmount || 0)}`}
                      valueStyle={{ fontSize: 12 }}
                    />
                  </Col>
                </Row>
              </Card>
            </>
          )}

          {/* 추천 목록 */}
          <List
            size="small"
            dataSource={recommendations}
            renderItem={(item) => {
              const isQuote = type === 'quote';
              const quoteItem = item as QuoteRecommendation;
              const contractItem = item as ContractRecommendation;

              return (
                <List.Item
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #f0f0f0',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleSelect(item)}
                  className="recommendation-item"
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Space>
                        <FileTextOutlined style={{ color: '#1890ff' }} />
                        <Text strong>
                          {isQuote ? quoteItem.quote_number : contractItem.contract_number}
                        </Text>
                        <Tag color={statusLabels[isQuote ? quoteItem.status : contractItem.progress]?.color || 'default'}>
                          {statusLabels[isQuote ? quoteItem.status : contractItem.progress]?.text || (isQuote ? quoteItem.status : contractItem.progress)}
                        </Tag>
                      </Space>
                      <Text type="success" strong style={{ fontSize: 14 }}>
                        {formatCurrency(isQuote ? quoteItem.grand_total : contractItem.total_amount)}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {isQuote ? quoteItem.recipient_company : contractItem.client_company}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                        | {isQuote ? quoteItem.service_name : contractItem.service_name}
                      </Text>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {isQuote
                          ? dayjs(quoteItem.quote_date).format('YYYY-MM-DD')
                          : `${dayjs(contractItem.contract_start_date).format('YYYY-MM-DD')} ~ ${contractItem.contract_end_date ? dayjs(contractItem.contract_end_date).format('YYYY-MM-DD') : '진행중'}`
                        }
                      </Text>
                      {isQuote && (
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                          | 인건비 {formatCurrency(quoteItem.labor_total)} / 경비 {formatCurrency(quoteItem.expense_total)}
                        </Text>
                      )}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={
        <Space>
          <BulbOutlined style={{ color: '#faad14' }} />
          <span>추천 {type === 'quote' ? '견적' : '계약'}</span>
          {clientCompany && (
            <Tag color="blue">{clientCompany}</Tag>
          )}
        </Space>
      }
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomLeft"
    >
      <Button
        type="dashed"
        icon={<BulbOutlined />}
        disabled={disabled || (!clientCompany && !serviceName)}
        style={{ marginLeft: 8 }}
      >
        추천 {type === 'quote' ? '견적' : '계약'}
      </Button>
    </Popover>
  );
};

export default RecommendationPopover;
