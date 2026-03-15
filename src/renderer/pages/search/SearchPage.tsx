import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Input, Table, Tag, Space, Select, Row, Col,
  Statistic, Empty, Spin
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, DollarOutlined, TeamOutlined,
  FolderOpenOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

interface SearchResult {
  type: 'contract' | 'quote' | 'outsourcing' | 'file';
  id: string;
  title: string;
  subtitle: string;
  description: string;
  amount: number | null;
  status: string | null;
  date: string | null;
  url: string;
  filePath?: string;
}

const typeConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  contract: { color: 'blue', label: '계약서', icon: <FileTextOutlined /> },
  quote: { color: 'green', label: '견적서', icon: <DollarOutlined /> },
  outsourcing: { color: 'orange', label: '외주', icon: <TeamOutlined /> },
  file: { color: 'purple', label: '문서', icon: <FolderOpenOutlined /> },
};

const statusLabels: Record<string, { color: string; label: string }> = {
  contract_signed: { color: 'blue', label: '계약체결' },
  in_progress: { color: 'processing', label: '진행중' },
  completed: { color: 'green', label: '완료' },
  cancelled: { color: 'red', label: '취소' },
  draft: { color: 'default', label: '초안' },
  submitted: { color: 'cyan', label: '제출' },
  approved: { color: 'green', label: '승인' },
  rejected: { color: 'red', label: '반려' },
  converted: { color: 'geekblue', label: '전환완료' },
  pending: { color: 'default', label: '대기' },
  inspection: { color: 'orange', label: '검수중' },
};

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!user?.id || !searchQuery.trim()) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const result = await window.electronAPI.search.global(user.id, searchQuery.trim());
      if (result.success) {
        setResults(result.results || []);
        setTotalCount(result.total || 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      doSearch(value);
    } else {
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
    }
  };

  const filteredResults = typeFilter
    ? results.filter(r => r.type === typeFilter)
    : results;

  // 타입별 카운트
  const typeCounts = {
    contract: results.filter(r => r.type === 'contract').length,
    quote: results.filter(r => r.type === 'quote').length,
    outsourcing: results.filter(r => r.type === 'outsourcing').length,
    file: results.filter(r => r.type === 'file').length,
  };

  const columns = [
    {
      title: '유형',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type: string) => {
        const config = typeConfig[type];
        return config ? (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        ) : type;
      },
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: SearchResult) => (
        <div>
          <a onClick={() => navigate(record.url)} style={{ fontWeight: 500 }}>
            {highlightText(title, query)}
          </a>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {highlightText(record.subtitle, query)}
            </Text>
          </div>
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {highlightText(record.description.slice(0, 80), query)}
                {record.description.length > 80 ? '...' : ''}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (amount: number | null) =>
        amount != null ? `${amount.toLocaleString()}원` : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string | null) => {
        if (!status) return '-';
        const s = statusLabels[status];
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag>{status}</Tag>;
      },
    },
    {
      title: '날짜',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 16 }}>
          <SearchOutlined style={{ marginRight: 8 }} />
          통합검색
        </Title>
        <Input.Search
          placeholder="계약서, 견적서, 외주업체, 문서 검색..."
          size="large"
          enterButton="검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={handleSearch}
          allowClear
          style={{ maxWidth: 600 }}
        />
      </div>

      {hasSearched && (
        <>
          {/* 검색 결과 통계 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card
                size="small"
                hoverable
                onClick={() => setTypeFilter(typeFilter === 'contract' ? null : 'contract')}
                style={{ borderColor: typeFilter === 'contract' ? '#1890ff' : undefined }}
              >
                <Statistic
                  title="계약서"
                  value={typeCounts.contract}
                  suffix="건"
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                hoverable
                onClick={() => setTypeFilter(typeFilter === 'quote' ? null : 'quote')}
                style={{ borderColor: typeFilter === 'quote' ? '#52c41a' : undefined }}
              >
                <Statistic
                  title="견적서"
                  value={typeCounts.quote}
                  suffix="건"
                  prefix={<DollarOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                hoverable
                onClick={() => setTypeFilter(typeFilter === 'outsourcing' ? null : 'outsourcing')}
                style={{ borderColor: typeFilter === 'outsourcing' ? '#fa8c16' : undefined }}
              >
                <Statistic
                  title="외주"
                  value={typeCounts.outsourcing}
                  suffix="건"
                  prefix={<TeamOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                hoverable
                onClick={() => setTypeFilter(typeFilter === 'file' ? null : 'file')}
                style={{ borderColor: typeFilter === 'file' ? '#722ed1' : undefined }}
              >
                <Statistic
                  title="문서"
                  value={typeCounts.file}
                  suffix="건"
                  prefix={<FolderOpenOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 필터 */}
          {typeFilter && (
            <div style={{ marginBottom: 12 }}>
              <Space>
                <FilterOutlined />
                <Text>필터:</Text>
                <Tag
                  color={typeConfig[typeFilter]?.color}
                  closable
                  onClose={() => setTypeFilter(null)}
                >
                  {typeConfig[typeFilter]?.label}
                </Tag>
              </Space>
            </div>
          )}

          {/* 결과 테이블 */}
          <Card>
            {isSearching ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>검색 중...</div>
              </div>
            ) : filteredResults.length === 0 ? (
              <Empty description={`"${query}"에 대한 검색 결과가 없습니다.`} />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredResults}
                rowKey={(record) => `${record.type}-${record.id}`}
                pagination={{
                  pageSize: 20,
                  showTotal: (total) => `총 ${total}건`,
                  showSizeChanger: true,
                }}
                size="middle"
              />
            )}
          </Card>
        </>
      )}

      {!hasSearched && (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <SearchOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <Title level={5} type="secondary">검색어를 입력하세요</Title>
          <Text type="secondary">
            계약서, 견적서, 외주업체, 첨부문서를 통합 검색합니다.
          </Text>
        </Card>
      )}
    </div>
  );
};

// 검색어 하이라이트 헬퍼
function highlightText(text: string, query: string): React.ReactNode {
  if (!text || !query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} style={{ background: '#ffd666', padding: 0 }}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default SearchPage;
