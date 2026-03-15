import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select, DatePicker,
  message, Popconfirm, Tooltip, Modal, Form, Dropdown
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  CopyOutlined, FileTextOutlined, MoreOutlined, CheckCircleOutlined, FolderOpenOutlined,
  MailOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useQuoteStore } from '../../store/quoteStore';
import type { Quote, QuoteStatus } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'default' },
  submitted: { label: '제출완료', color: 'processing' },
  negotiating: { label: '협상중', color: 'warning' },
  approved: { label: '승인됨', color: 'success' },
  rejected: { label: '거절됨', color: 'error' },
  converted: { label: '계약전환', color: 'purple' },
};

const QuoteList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    quotes,
    isLoading,
    fetchQuotes,
    deleteQuote,
    updateStatus,
    duplicateQuote,
    convertToContract,
  } = useQuoteStore();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [convertForm] = Form.useForm();

  // 이메일 발송 상태
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailingQuote, setEmailingQuote] = useState<Quote | null>(null);
  const [emailForm] = Form.useForm();
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchQuotes(user.id);
    }
  }, [user?.id]);

  const handleSearch = () => {
    if (!user?.id) return;

    const filters: any = {};
    if (searchText) filters.search = searchText;
    if (statusFilter) filters.status = statusFilter;
    if (dateRange) {
      filters.startDate = dateRange[0].format('YYYY-MM-DD');
      filters.endDate = dateRange[1].format('YYYY-MM-DD');
    }

    fetchQuotes(user.id, filters);
  };

  const handleReset = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setDateRange(null);
    if (user?.id) {
      fetchQuotes(user.id, {});
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!user?.id) return;

    const result = await deleteQuote(user.id, quoteId);
    if (result.success) {
      message.success('견적서가 삭제되었습니다.');
    } else {
      message.error(result.error || '삭제에 실패했습니다.');
    }
  };

  const handleDuplicate = async (quoteId: string) => {
    if (!user?.id) return;

    const result = await duplicateQuote(user.id, quoteId);
    if (result.success) {
      message.success('견적서가 복제되었습니다.');
    } else {
      message.error(result.error || '복제에 실패했습니다.');
    }
  };

  const handleStatusChange = async (quoteId: string, status: QuoteStatus) => {
    if (!user?.id) return;

    const result = await updateStatus(user.id, quoteId, status);
    if (result.success) {
      message.success('상태가 변경되었습니다.');
    } else {
      message.error(result.error || '상태 변경에 실패했습니다.');
    }
  };

  const handleConvertClick = (quote: Quote) => {
    setConvertingQuote(quote);
    convertForm.resetFields();
    convertForm.setFieldsValue({
      contract_start_date: dayjs(),
      contract_type: 'service',
    });
    setConvertModalVisible(true);
  };

  const handleConvert = async (values: any) => {
    if (!user?.id || !convertingQuote) return;

    const contractData = {
      ...values,
      contract_start_date: values.contract_start_date?.format('YYYY-MM-DD'),
      contract_end_date: values.contract_end_date?.format('YYYY-MM-DD'),
    };

    const result = await convertToContract(user.id, convertingQuote.id, contractData);
    if (result.success) {
      message.success('계약으로 전환되었습니다.');
      setConvertModalVisible(false);
      navigate(`/contracts/${result.contractId}`);
    } else {
      message.error(result.error || '계약 전환에 실패했습니다.');
    }
  };

  const handleOpenOriginal = async (record: Quote) => {
    if (!(record as any).source_file_path) {
      message.warning('이 견적서에는 원본 파일 경로 정보가 없습니다.');
      return;
    }
    try {
      const result = await window.electronAPI.settings.openOriginalFile((record as any).source_file_path);
      if (!result.success) {
        message.error(result.error);
      }
    } catch (err) {
      message.error('원본 파일 열기에 실패했습니다.');
    }
  };

  const handleEmailClick = (quote: Quote) => {
    setEmailingQuote(quote);
    emailForm.setFieldsValue({
      to: (quote as any).recipient_email || '',
      subject: `[견적서] ${quote.service_name || ''} - ${quote.quote_number}`,
      body: `<p>안녕하세요,</p>
<p>${(quote as any).recipient_company || ''}  담당자님께,</p>
<p>요청하신 견적서를 발송드립니다.</p>
<br/>
<p>견적번호: ${quote.quote_number}</p>
<p>용역명: ${quote.service_name || ''}</p>
<p>총액(VAT포함): ${quote.grand_total?.toLocaleString()}원</p>
<br/>
<p>감사합니다.</p>`,
    });
    setEmailModalVisible(true);
  };

  const handleSendEmail = async (values: any) => {
    if (!user?.id) return;
    setSendingEmail(true);
    try {
      const result = await window.electronAPI.email.sendQuote(user.id, {
        to: values.to,
        subject: values.subject,
        body: values.body,
      });
      if (result.success) {
        message.success('이메일이 발송되었습니다.');
        setEmailModalVisible(false);
      } else {
        message.error(result.error || '이메일 발송에 실패했습니다.');
      }
    } catch (err) {
      message.error('이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExportExcel = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.export.quotes(user.id);
      if (result.success) {
        message.success(`엑셀 파일이 저장되었습니다: ${result.filePath}`);
      } else if (result.error !== '저장이 취소되었습니다.') {
        message.error(result.error || '내보내기에 실패했습니다.');
      }
    } catch (err) {
      message.error('엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const getActionMenu = (record: Quote): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'view',
        label: '상세보기',
        icon: <EyeOutlined />,
        onClick: () => navigate(`/quotes/${record.id}`),
      },
    ];

    // 원본열기 (source_file_path가 있을 때만)
    if ((record as any).source_file_path) {
      items.push({
        key: 'openOriginal',
        label: '원본열기',
        icon: <FolderOpenOutlined />,
        onClick: () => handleOpenOriginal(record),
      });
    }

    if (record.status === 'draft') {
      items.push(
        {
          key: 'edit',
          label: '수정',
          icon: <EditOutlined />,
          onClick: () => navigate(`/quotes/${record.id}/edit`),
        },
        {
          key: 'submit',
          label: '제출',
          icon: <CheckCircleOutlined />,
          onClick: () => handleStatusChange(record.id, 'submitted'),
        }
      );
    }

    if (record.status === 'submitted') {
      items.push(
        {
          key: 'approve',
          label: '승인',
          icon: <CheckCircleOutlined />,
          onClick: () => handleStatusChange(record.id, 'approved'),
        },
        {
          key: 'reject',
          label: '거절',
          onClick: () => handleStatusChange(record.id, 'rejected'),
        },
        {
          key: 'negotiate',
          label: '협상중으로 변경',
          onClick: () => handleStatusChange(record.id, 'negotiating'),
        }
      );
    }

    if (record.status === 'negotiating') {
      items.push(
        {
          key: 'approve',
          label: '승인',
          icon: <CheckCircleOutlined />,
          onClick: () => handleStatusChange(record.id, 'approved'),
        },
        {
          key: 'reject',
          label: '거절',
          onClick: () => handleStatusChange(record.id, 'rejected'),
        }
      );
    }

    if (record.status === 'approved') {
      items.push({
        key: 'convert',
        label: '계약 전환',
        icon: <FileTextOutlined />,
        onClick: () => handleConvertClick(record),
      });
    }

    if (record.status === 'rejected') {
      items.push({
        key: 'reopen',
        label: '재작성',
        onClick: () => handleStatusChange(record.id, 'draft'),
      });
    }

    items.push(
      { type: 'divider' },
      {
        key: 'email',
        label: '이메일 발송',
        icon: <MailOutlined />,
        onClick: () => handleEmailClick(record),
      },
      {
        key: 'duplicate',
        label: '복제',
        icon: <CopyOutlined />,
        onClick: () => handleDuplicate(record.id),
      }
    );

    if (record.status !== 'converted') {
      items.push({
        key: 'delete',
        label: '삭제',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(record.id),
      });
    }

    return items;
  };

  const columns = [
    {
      title: '견적번호',
      dataIndex: 'quote_number',
      key: 'quote_number',
      width: 130,
      render: (value: string, record: Quote) => (
        <a onClick={() => navigate(`/quotes/${record.id}`)}>{value}</a>
      ),
    },
    {
      title: '수신처',
      dataIndex: 'recipient_company',
      key: 'recipient_company',
      ellipsis: true,
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: '견적일자',
      dataIndex: 'quote_date',
      key: 'quote_date',
      width: 110,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '총액(VAT포함)',
      dataIndex: 'grand_total',
      key: 'grand_total',
      width: 140,
      align: 'right' as const,
      render: (value: number) => `${value.toLocaleString()}원`,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: QuoteStatus) => (
        <Tag color={STATUS_CONFIG[value]?.color}>
          {STATUS_CONFIG[value]?.label}
        </Tag>
      ),
    },
    {
      title: '작성자',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 100,
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      render: (_: any, record: Quote) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적관리</Title>
          <span style={{ color: '#888' }}>견적서를 작성하고 관리합니다.</span>
        </div>
        <Space>
          {(user?.role === 'super_admin' || user?.role === 'company_admin') && (
            <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
              엑셀 내보내기
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotes/new')}>
            견적서 작성
          </Button>
        </Space>
      </div>

      {/* 검색 필터 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="견적번호, 수신처, 용역명 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
          />
          <Select
            placeholder="상태"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 120 }}
          >
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <Option key={key} value={key}>
                {config.label}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button type="primary" onClick={handleSearch}>검색</Button>
          <Button onClick={handleReset}>초기화</Button>
        </Space>
      </Card>

      {/* 목록 */}
      <Card>
        <Table
          columns={columns}
          dataSource={quotes}
          rowKey="id"
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>

      {/* 계약 전환 모달 */}
      <Modal
        title="계약 전환"
        open={convertModalVisible}
        onCancel={() => setConvertModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        {convertingQuote && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>견적번호: </Text>{convertingQuote.quote_number}<br />
              <Text strong>수신처: </Text>{convertingQuote.recipient_company}<br />
              <Text strong>총액: </Text>{convertingQuote.grand_total.toLocaleString()}원
            </Card>

            <Form
              form={convertForm}
              layout="vertical"
              onFinish={handleConvert}
            >
              <Form.Item
                name="contract_type"
                label="계약 유형"
                rules={[{ required: true, message: '계약 유형을 선택해주세요.' }]}
              >
                <Select>
                  <Option value="service">용역계약</Option>
                  <Option value="research">연구용역</Option>
                  <Option value="consulting">컨설팅</Option>
                  <Option value="maintenance">유지보수</Option>
                  <Option value="other">기타</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="contract_start_date"
                label="계약 시작일"
                rules={[{ required: true, message: '계약 시작일을 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="contract_end_date"
                label="계약 종료일"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="contract_code" label="계약 코드">
                <Input placeholder="내부 관리용 코드 (선택)" />
              </Form.Item>

              <Form.Item name="notes" label="비고">
                <Input.TextArea rows={2} />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setConvertModalVisible(false)}>취소</Button>
                  <Button type="primary" htmlType="submit">계약 전환</Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* 이메일 발송 모달 */}
      <Modal
        title="견적서 이메일 발송"
        open={emailModalVisible}
        onCancel={() => setEmailModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        {emailingQuote && (
          <Form
            form={emailForm}
            layout="vertical"
            onFinish={handleSendEmail}
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="to"
              label="수신자 이메일"
              rules={[
                { required: true, message: '수신자 이메일을 입력해주세요.' },
                { type: 'email', message: '올바른 이메일 형식이 아닙니다.' },
              ]}
            >
              <Input placeholder="recipient@example.com" />
            </Form.Item>

            <Form.Item
              name="subject"
              label="제목"
              rules={[{ required: true, message: '제목을 입력해주세요.' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="body"
              label="본문"
              rules={[{ required: true, message: '본문을 입력해주세요.' }]}
            >
              <Input.TextArea rows={8} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setEmailModalVisible(false)}>취소</Button>
                <Button type="primary" htmlType="submit" loading={sendingEmail} icon={<MailOutlined />}>
                  발송
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default QuoteList;
