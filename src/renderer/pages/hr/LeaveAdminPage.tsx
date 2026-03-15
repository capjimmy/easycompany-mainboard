import React, { useState, useEffect } from 'react';
import {
  Table, Button, Tag, Space, Typography, message, Card, Select, Modal, Input,
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '연차',
  half_am: '오전반차',
  half_pm: '오후반차',
  sick: '병가',
  special: '특별휴가',
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '대기' },
  dept_approved: { color: 'warning', label: '부서승인' },
  approved: { color: 'success', label: '최종승인' },
  rejected: { color: 'error', label: '반려' },
};

const LeaveAdminPage: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; leaveId: string | null }>({ open: false, leaveId: null });
  const [rejectReason, setRejectReason] = useState('');

  const isDeptManager = user?.role === 'department_manager';
  const isCompanyAdmin = user?.role === 'company_admin' || user?.role === 'super_admin';

  const fetchRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const result = await (window as any).electronAPI.leave.getAllRequests(user.id, filters);
      if (result.success) {
        setRequests(result.requests || []);
      } else {
        message.error(result.error || '조회 실패');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user?.id, statusFilter]);

  const handleApprove = async (leaveId: string) => {
    try {
      const result = await (window as any).electronAPI.leave.approve(user!.id, leaveId);
      if (result.success) {
        message.success('승인 완료');
        fetchRequests();
      } else {
        message.error(result.error || '승인 실패');
      }
    } catch (err) {
      message.error('승인 중 오류 발생');
    }
  };

  const handleReject = async () => {
    if (!rejectModal.leaveId) return;
    try {
      const result = await (window as any).electronAPI.leave.reject(user!.id, rejectModal.leaveId, rejectReason);
      if (result.success) {
        message.success('반려 완료');
        setRejectModal({ open: false, leaveId: null });
        setRejectReason('');
        fetchRequests();
      } else {
        message.error(result.error || '반려 실패');
      }
    } catch (err) {
      message.error('반려 중 오류 발생');
    }
  };

  /**
   * Determine which actions are available for a given record based on the user's role.
   * - department_manager: can approve/reject only 'pending' requests (step 1)
   * - company_admin/super_admin: can approve/reject 'pending' (direct) or 'dept_approved' (step 2)
   */
  const canActOn = (record: any): boolean => {
    if (isDeptManager) {
      return record.status === 'pending';
    }
    if (isCompanyAdmin) {
      return record.status === 'pending' || record.status === 'dept_approved';
    }
    return false;
  };

  const getApproveLabel = (record: any): string => {
    if (isDeptManager && record.status === 'pending') {
      return '부서승인';
    }
    if (isCompanyAdmin && record.status === 'pending') {
      return '직접승인';
    }
    if (isCompanyAdmin && record.status === 'dept_approved') {
      return '최종승인';
    }
    return '승인';
  };

  const columns = [
    {
      title: '신청자',
      key: 'user_info',
      width: 150,
      render: (_: any, record: any) => (
        <span>{record.user_name} {record.user_rank ? `(${record.user_rank})` : ''}</span>
      ),
    },
    {
      title: '부서',
      dataIndex: 'user_department',
      key: 'user_department',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '유형',
      dataIndex: 'leave_type',
      key: 'leave_type',
      width: 100,
      render: (v: string) => LEAVE_TYPE_LABELS[v] || v,
    },
    {
      title: '시작일',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
    },
    {
      title: '종료일',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
    },
    {
      title: '일수',
      dataIndex: 'days',
      key: 'days',
      width: 70,
      render: (v: number) => `${v}일`,
    },
    {
      title: '사유',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string, record: any) => {
        const s = STATUS_MAP[v] || { color: 'default', label: v };
        return (
          <Space direction="vertical" size={0}>
            <Tag color={s.color}>{s.label}</Tag>
            {v === 'dept_approved' && record.dept_approver_name && (
              <span style={{ fontSize: 11, color: '#888' }}>부서: {record.dept_approver_name}</span>
            )}
          </Space>
        );
      },
    },
    {
      title: '신청일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '처리',
      key: 'actions',
      width: 180,
      render: (_: any, record: any) => {
        if (!canActOn(record)) {
          const approverName = record.approver_name || record.dept_approver_name || '-';
          return <span style={{ color: '#999' }}>{approverName}</span>;
        }
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
            >
              {getApproveLabel(record)}
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectModal({ open: true, leaveId: record.id })}
            >
              반려
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>연차 승인 관리</Title>
        <Select
          placeholder="상태 필터"
          allowClear
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: 'pending', label: '대기' },
            { value: 'dept_approved', label: '부서승인' },
            { value: 'approved', label: '최종승인' },
            { value: 'rejected', label: '반려' },
          ]}
        />
      </div>

      <Card style={{ marginTop: 16 }}>
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: '신청 내역이 없습니다.' }}
        />
      </Card>

      <Modal
        title="반려 사유"
        open={rejectModal.open}
        onCancel={() => { setRejectModal({ open: false, leaveId: null }); setRejectReason(''); }}
        onOk={handleReject}
        okText="반려"
        okButtonProps={{ danger: true }}
        cancelText="취소"
      >
        <TextArea
          rows={3}
          placeholder="반려 사유를 입력해주세요 (선택사항)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default LeaveAdminPage;
