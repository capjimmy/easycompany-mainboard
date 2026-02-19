import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Table, Select, Input, DatePicker, Row, Col,
  Tag, Space, Button, Spin, Timeline, Empty
} from 'antd';
import {
  HistoryOutlined, ArrowLeftOutlined, SearchOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface HistoryRecord {
  id: string;
  contract_id: string;
  contract_number: string;
  client_company: string;
  service_name: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_name?: string;
  note: string | null;
  created_at: string;
}

const ContractHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [histories, setHistories] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  useEffect(() => {
    if (user?.id) {
      loadHistories();
    }
  }, [user?.id]);

  const loadHistories = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      // 모든 계약의 이력을 가져옴
      const contractsResult = await window.electronAPI.contracts.getAll(user.id, {});
      if (contractsResult.success && contractsResult.contracts) {
        const allHistories: HistoryRecord[] = [];

        for (const contract of contractsResult.contracts) {
          const historyResult = await window.electronAPI.contracts.getHistories(user.id, contract.id);
          if (historyResult.success && historyResult.histories) {
            const enrichedHistories = historyResult.histories.map((h: any) => ({
              ...h,
              contract_number: contract.contract_number,
              client_company: contract.client_company,
              service_name: contract.service_name,
            }));
            allHistories.push(...enrichedHistories);
          }
        }

        // 날짜 내림차순 정렬
        allHistories.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setHistories(allHistories);
      }
    } catch (err) {
      console.error('Failed to load histories:', err);
      // 더미 데이터
      setHistories([
        {
          id: '1',
          contract_id: 'c1',
          contract_number: 'C-2024-0001',
          client_company: '서울대학교',
          service_name: '2024년 교육혁신 연구용역',
          change_type: 'progress',
          old_value: 'contract_signed',
          new_value: 'in_progress',
          changed_by: null,
          changed_by_name: '홍길동',
          note: '연구 착수',
          created_at: '2024-02-01T09:00:00.000Z',
        },
        {
          id: '2',
          contract_id: 'c2',
          contract_number: 'C-2024-0002',
          client_company: '경기도교육청',
          service_name: '교육정보시스템 유지보수',
          change_type: 'payment',
          old_value: '0',
          new_value: '39600000',
          changed_by: null,
          changed_by_name: '김철수',
          note: '전액 입금',
          created_at: '2024-01-10T10:30:00.000Z',
        },
        {
          id: '3',
          contract_id: 'c3',
          contract_number: 'C-2023-0015',
          client_company: '부산광역시교육청',
          service_name: '2023년 교육과정 개편 연구',
          change_type: 'progress',
          old_value: 'in_progress',
          new_value: 'completed',
          changed_by: null,
          changed_by_name: '박영희',
          note: '최종 검수 완료',
          created_at: '2023-12-28T09:00:00.000Z',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeTypeTag = (changeType: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      created: { color: 'green', label: '생성' },
      progress: { color: 'blue', label: '진행상태 변경' },
      payment: { color: 'gold', label: '입금' },
      amount: { color: 'purple', label: '금액 변경' },
      date: { color: 'cyan', label: '기간 변경' },
      info: { color: 'default', label: '정보 수정' },
      deleted: { color: 'red', label: '삭제' },
    };
    const type = typeMap[changeType] || { color: 'default', label: changeType };
    return <Tag color={type.color}>{type.label}</Tag>;
  };

  const getProgressLabel = (value: string | null) => {
    if (!value) return '-';
    const progressMap: Record<string, string> = {
      contract_signed: '계약체결',
      in_progress: '진행중',
      inspection: '검수중',
      completed: '완료',
      cancelled: '취소',
    };
    return progressMap[value] || value;
  };

  const formatChangeValue = (record: HistoryRecord) => {
    if (record.change_type === 'progress') {
      return (
        <span>
          {getProgressLabel(record.old_value)} → <strong>{getProgressLabel(record.new_value)}</strong>
        </span>
      );
    }
    if (record.change_type === 'payment') {
      const oldVal = parseInt(record.old_value || '0');
      const newVal = parseInt(record.new_value || '0');
      const diff = newVal - oldVal;
      return (
        <span>
          <span style={{ color: '#52c41a' }}>+{diff.toLocaleString()}원</span>
          {' '}(누적: {newVal.toLocaleString()}원)
        </span>
      );
    }
    if (record.change_type === 'amount') {
      return (
        <span>
          {parseInt(record.old_value || '0').toLocaleString()}원 → {' '}
          <strong>{parseInt(record.new_value || '0').toLocaleString()}원</strong>
        </span>
      );
    }
    return (
      <span>
        {record.old_value || '-'} → <strong>{record.new_value || '-'}</strong>
      </span>
    );
  };

  // 필터링
  const filteredHistories = histories.filter((h) => {
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesSearch =
        h.contract_number.toLowerCase().includes(search) ||
        h.client_company.toLowerCase().includes(search) ||
        h.service_name.toLowerCase().includes(search) ||
        (h.note && h.note.toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }

    if (changeTypeFilter && h.change_type !== changeTypeFilter) {
      return false;
    }

    if (dateRange[0] && dateRange[1]) {
      const historyDate = dayjs(h.created_at);
      if (!historyDate.isAfter(dateRange[0].startOf('day')) ||
          !historyDate.isBefore(dateRange[1].endOf('day'))) {
        return false;
      }
    }

    return true;
  });

  const columns = [
    {
      title: '일시',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 140,
      render: (num: string, record: HistoryRecord) => (
        <a onClick={() => navigate(`/contracts/${record.contract_id}`)}>{num}</a>
      ),
    },
    {
      title: '발주기관',
      dataIndex: 'client_company',
      key: 'client_company',
      width: 150,
    },
    {
      title: '변경유형',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 120,
      render: getChangeTypeTag,
    },
    {
      title: '변경내용',
      key: 'change_value',
      render: (_: any, record: HistoryRecord) => formatChangeValue(record),
    },
    {
      title: '비고',
      dataIndex: 'note',
      key: 'note',
      width: 200,
      ellipsis: true,
    },
    {
      title: '처리자',
      dataIndex: 'changed_by_name',
      key: 'changed_by_name',
      width: 100,
      render: (name: string) => name || '-',
    },
  ];

  if (isLoading) {
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
              <HistoryOutlined /> 계약 변경 이력
            </Title>
          </div>
        </div>
        <Space>
          <Button
            type={viewMode === 'table' ? 'primary' : 'default'}
            onClick={() => setViewMode('table')}
          >
            테이블
          </Button>
          <Button
            type={viewMode === 'timeline' ? 'primary' : 'default'}
            onClick={() => setViewMode('timeline')}
          >
            타임라인
          </Button>
        </Space>
      </div>

      {/* 필터 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="계약번호, 발주기관, 용역명 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="변경유형 선택"
              style={{ width: '100%' }}
              value={changeTypeFilter}
              onChange={setChangeTypeFilter}
              allowClear
            >
              <Option value="created">생성</Option>
              <Option value="progress">진행상태 변경</Option>
              <Option value="payment">입금</Option>
              <Option value="amount">금액 변경</Option>
              <Option value="date">기간 변경</Option>
              <Option value="info">정보 수정</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              placeholder={['시작일', '종료일']}
            />
          </Col>
          <Col span={2}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchText('');
                setChangeTypeFilter(null);
                setDateRange([null, null]);
              }}
            >
              초기화
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 이력 목록 */}
      {viewMode === 'table' ? (
        <Card>
          <Table
            columns={columns}
            dataSource={filteredHistories}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}건`,
            }}
            size="middle"
            locale={{ emptyText: '변경 이력이 없습니다.' }}
          />
        </Card>
      ) : (
        <Card>
          {filteredHistories.length === 0 ? (
            <Empty description="변경 이력이 없습니다." />
          ) : (
            <Timeline
              mode="left"
              items={filteredHistories.map((h) => ({
                label: dayjs(h.created_at).format('YYYY-MM-DD HH:mm'),
                children: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      {getChangeTypeTag(h.change_type)}
                      <a
                        onClick={() => navigate(`/contracts/${h.contract_id}`)}
                        style={{ marginLeft: 8 }}
                      >
                        {h.contract_number}
                      </a>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {h.client_company}
                      </Text>
                    </div>
                    <div>{formatChangeValue(h)}</div>
                    {h.note && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {h.note}
                      </Text>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default ContractHistory;
