import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Typography, Button, Progress, Tag, Space, Modal, Form, Input, Select,
  Slider, message, Empty, Tooltip, Popconfirm, Row, Col, InputNumber, DatePicker,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CaretRightOutlined, CaretDownOutlined,
  UserOutlined, CheckCircleOutlined, ClockCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Subtask {
  id: string;
  contract_id: string;
  parent_id: string | null;
  level: number;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  progress_rate: number;
  sort_order: number;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

interface ContractSubtasksProps {
  contractId: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: '대분류',
  2: '세부',
  3: '세세부',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#1890ff',
  2: '#52c41a',
  3: '#faad14',
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '대기', color: 'default', icon: <MinusCircleOutlined /> },
  in_progress: { label: '진행중', color: 'processing', icon: <ClockCircleOutlined /> },
  completed: { label: '완료', color: 'success', icon: <CheckCircleOutlined /> },
};

const ContractSubtasks: React.FC<ContractSubtasksProps> = ({ contractId }) => {
  const { user } = useAuthStore();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addLevel, setAddLevel] = useState<number>(1);
  const [users, setUsers] = useState<any[]>([]);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 사용자 목록 로드
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) return;
      try {
        const result = await window.electronAPI.users.getAll(user.id);
        if (result.success && result.users) {
          setUsers(result.users.filter((u: any) => u.is_active));
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, [user?.id]);

  // 세부작업 로드
  const loadSubtasks = useCallback(async () => {
    if (!user?.id || !contractId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.subtasks.getByContract(user.id, contractId);
      if (result.success) {
        setSubtasks(result.subtasks || []);
      }
    } catch (err) {
      console.error('Failed to load subtasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, contractId]);

  useEffect(() => {
    loadSubtasks();
  }, [loadSubtasks]);

  // 트리 구조 구성
  const getChildren = (parentId: string | null, level: number): Subtask[] => {
    return subtasks
      .filter((s) => s.parent_id === parentId && s.level === level)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const topLevelItems = getChildren(null, 1);

  // 전체 진행률 계산
  const overallProgress = topLevelItems.length > 0
    ? Math.round(topLevelItems.reduce((sum, s) => sum + (s.progress_rate || 0), 0) / topLevelItems.length)
    : 0;

  // 확장/축소 토글
  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 세부작업 추가
  const handleAdd = (parentId: string | null, level: number) => {
    setAddParentId(parentId);
    setAddLevel(level);
    addForm.resetFields();
    setShowAddModal(true);
  };

  const handleAddSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      const selectedUser = users.find((u) => u.id === values.assignee_id);
      const result = await window.electronAPI.subtasks.create(user.id, {
        contractId,
        parentId: addParentId,
        level: addLevel,
        title: values.title,
        description: values.description,
        assigneeId: values.assignee_id,
        assigneeName: selectedUser?.name || null,
        startDate: values.start_date?.format('YYYY-MM-DD'),
        endDate: values.end_date?.format('YYYY-MM-DD'),
      });
      if (result.success) {
        message.success('세부작업이 추가되었습니다.');
        setShowAddModal(false);
        loadSubtasks();
        // 부모가 있으면 자동 확장
        if (addParentId) {
          setExpandedKeys((prev) => new Set([...prev, addParentId!]));
        }
      } else {
        message.error(result.error || '추가 실패');
      }
    } catch (err) {
      message.error('세부작업 추가 중 오류가 발생했습니다.');
    }
  };

  // 세부작업 수정 모달
  const handleEdit = (subtask: Subtask) => {
    setEditingSubtask(subtask);
    editForm.setFieldsValue({
      title: subtask.title,
      description: subtask.description,
      assignee_id: subtask.assignee_id,
      progress_rate: subtask.progress_rate,
      start_date: subtask.start_date ? dayjs(subtask.start_date) : null,
      end_date: subtask.end_date ? dayjs(subtask.end_date) : null,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!user?.id || !editingSubtask) return;
    try {
      const selectedUser = users.find((u) => u.id === values.assignee_id);
      const result = await window.electronAPI.subtasks.update(user.id, editingSubtask.id, {
        title: values.title,
        description: values.description,
        assignee_id: values.assignee_id || null,
        assignee_name: selectedUser?.name || null,
        progress_rate: values.progress_rate,
        start_date: values.start_date?.format('YYYY-MM-DD') || null,
        end_date: values.end_date?.format('YYYY-MM-DD') || null,
      });
      if (result.success) {
        message.success('세부작업이 수정되었습니다.');
        setShowEditModal(false);
        setEditingSubtask(null);
        loadSubtasks();
      } else {
        message.error(result.error || '수정 실패');
      }
    } catch (err) {
      message.error('세부작업 수정 중 오류가 발생했습니다.');
    }
  };

  // 인라인 진행률 변경
  const handleProgressChange = async (subtaskId: string, value: number) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.subtasks.update(user.id, subtaskId, {
        progress_rate: value,
      });
      if (result.success) {
        loadSubtasks();
      }
    } catch (err) {
      console.error('Progress update failed:', err);
    }
  };

  // 세부작업 삭제
  const handleDelete = async (subtaskId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.subtasks.delete(user.id, subtaskId);
      if (result.success) {
        message.success('세부작업이 삭제되었습니다.');
        loadSubtasks();
      } else {
        message.error(result.error || '삭제 실패');
      }
    } catch (err) {
      message.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 하위 아이템이 있는지 확인
  const hasChildren = (id: string): boolean => {
    return subtasks.some((s) => s.parent_id === id);
  };

  // 서브태스크 행 렌더링
  const renderSubtaskRow = (subtask: Subtask, indent: number = 0) => {
    const isExpanded = expandedKeys.has(subtask.id);
    const childItems = subtasks
      .filter((s) => s.parent_id === subtask.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const hasChild = childItems.length > 0;
    const canAddChild = subtask.level < 3;
    const statusInfo = STATUS_MAP[subtask.status] || STATUS_MAP.pending;

    return (
      <React.Fragment key={subtask.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: 12 + indent * 24,
            borderBottom: '1px solid #f0f0f0',
            background: subtask.level === 1 ? '#fafafa' : 'white',
            transition: 'background 0.2s',
          }}
          className="subtask-row"
        >
          {/* 확장/축소 버튼 */}
          <div style={{ width: 24, flexShrink: 0 }}>
            {hasChild ? (
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                onClick={() => toggleExpand(subtask.id)}
                style={{ padding: 0, width: 20, height: 20 }}
              />
            ) : (
              <span style={{ display: 'inline-block', width: 20 }} />
            )}
          </div>

          {/* 레벨 태그 */}
          <Tag
            color={LEVEL_COLORS[subtask.level]}
            style={{ marginRight: 8, fontSize: 11, flexShrink: 0 }}
          >
            {LEVEL_LABELS[subtask.level]}
          </Tag>

          {/* 제목 */}
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <Text strong={subtask.level === 1} ellipsis style={{ fontSize: subtask.level === 1 ? 14 : 13 }}>
              {subtask.title}
            </Text>
            {subtask.description && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                  {subtask.description}
                </Text>
              </div>
            )}
          </div>

          {/* 담당자 */}
          <div style={{ width: 80, flexShrink: 0, textAlign: 'center', marginRight: 8 }}>
            {subtask.assignee_name ? (
              <Tooltip title={subtask.assignee_name}>
                <Tag icon={<UserOutlined />} style={{ fontSize: 11 }}>
                  {subtask.assignee_name.length > 4
                    ? subtask.assignee_name.slice(0, 4) + '..'
                    : subtask.assignee_name}
                </Tag>
              </Tooltip>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>-</Text>
            )}
          </div>

          {/* 기간 */}
          <div style={{ width: 130, flexShrink: 0, textAlign: 'center', marginRight: 8 }}>
            {subtask.start_date || subtask.end_date ? (
              <Text style={{ fontSize: 11 }} type="secondary">
                {subtask.start_date ? dayjs(subtask.start_date).format('MM/DD') : ''}
                {subtask.start_date && subtask.end_date ? ' ~ ' : ''}
                {subtask.end_date ? dayjs(subtask.end_date).format('MM/DD') : ''}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>-</Text>
            )}
          </div>

          {/* 상태 */}
          <div style={{ width: 70, flexShrink: 0, textAlign: 'center', marginRight: 8 }}>
            <Tag color={statusInfo.color} icon={statusInfo.icon} style={{ fontSize: 11 }}>
              {statusInfo.label}
            </Tag>
          </div>

          {/* 진행률 */}
          <div style={{ width: 140, flexShrink: 0, marginRight: 8 }}>
            <Progress
              percent={subtask.progress_rate}
              size="small"
              status={subtask.progress_rate >= 100 ? 'success' : 'active'}
              strokeColor={subtask.progress_rate >= 100 ? '#52c41a' : subtask.progress_rate > 0 ? '#1890ff' : '#d9d9d9'}
            />
          </div>

          {/* 액션 버튼 */}
          <div style={{ flexShrink: 0 }}>
            <Space size={2}>
              {canAddChild && (
                <Tooltip title={`${LEVEL_LABELS[subtask.level + 1]} 추가`}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleAdd(subtask.id, subtask.level + 1)}
                  />
                </Tooltip>
              )}
              <Tooltip title="수정">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(subtask)}
                />
              </Tooltip>
              <Popconfirm
                title="이 세부작업을 삭제하시겠습니까?"
                description={hasChild ? '하위 작업도 함께 삭제됩니다.' : undefined}
                onConfirm={() => handleDelete(subtask.id)}
                okText="삭제"
                cancelText="취소"
              >
                <Tooltip title="삭제">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          </div>
        </div>

        {/* 자식 재귀 렌더링 */}
        {isExpanded && childItems.map((child) => renderSubtaskRow(child, indent + 1))}
      </React.Fragment>
    );
  };

  return (
    <div>
      {/* 전체 진행률 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row align="middle" gutter={16}>
          <Col span={4}>
            <Text strong>전체 진행률</Text>
          </Col>
          <Col span={16}>
            <Progress
              percent={overallProgress}
              status={overallProgress >= 100 ? 'success' : 'active'}
              strokeWidth={12}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 18, color: '#1890ff' }}>{overallProgress}%</Text>
          </Col>
        </Row>
      </Card>

      {/* 세부작업 목록 */}
      <Card
        size="small"
        title={
          <Space>
            <span>세부작업 목록</span>
            <Tag>{subtasks.length}개</Tag>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAdd(null, 1)}
          >
            대분류 추가
          </Button>
        }
        bodyStyle={{ padding: 0 }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            background: '#f5f5f5',
            borderBottom: '1px solid #e8e8e8',
            fontSize: 12,
            fontWeight: 500,
            color: '#666',
          }}
        >
          <div style={{ width: 24, flexShrink: 0 }} />
          <div style={{ width: 52, flexShrink: 0 }}>구분</div>
          <div style={{ flex: 1 }}>작업명</div>
          <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>담당자</div>
          <div style={{ width: 130, flexShrink: 0, textAlign: 'center' }}>기간</div>
          <div style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>상태</div>
          <div style={{ width: 140, flexShrink: 0, textAlign: 'center' }}>진행률</div>
          <div style={{ width: 88, flexShrink: 0 }} />
        </div>

        {/* 데이터 */}
        {topLevelItems.length === 0 ? (
          <div style={{ padding: 24 }}>
            <Empty
              description="등록된 세부작업이 없습니다"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleAdd(null, 1)}
              >
                대분류 추가
              </Button>
            </Empty>
          </div>
        ) : (
          topLevelItems.map((item) => renderSubtaskRow(item))
        )}
      </Card>

      {/* 추가 모달 */}
      <Modal
        title={`${LEVEL_LABELS[addLevel]} 추가`}
        open={showAddModal}
        onCancel={() => setShowAddModal(false)}
        onOk={() => addForm.submit()}
        okText="추가"
        cancelText="취소"
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddSubmit}>
          <Form.Item
            name="title"
            label="작업명"
            rules={[{ required: true, message: '작업명을 입력해주세요.' }]}
          >
            <Input placeholder={`${LEVEL_LABELS[addLevel]} 작업명`} />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="작업 설명 (선택)" />
          </Form.Item>
          <Form.Item name="assignee_id" label="담당자">
            <Select placeholder="담당자 선택" allowClear showSearch optionFilterProp="children">
              {users.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.name} ({u.rank || u.position || u.role})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="시작일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="종료일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        title={editingSubtask ? `${LEVEL_LABELS[editingSubtask.level]} 수정` : '수정'}
        open={showEditModal}
        onCancel={() => { setShowEditModal(false); setEditingSubtask(null); }}
        onOk={() => editForm.submit()}
        okText="저장"
        cancelText="취소"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="title"
            label="작업명"
            rules={[{ required: true, message: '작업명을 입력해주세요.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="assignee_id" label="담당자">
            <Select placeholder="담당자 선택" allowClear showSearch optionFilterProp="children">
              {users.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.name} ({u.rank || u.position || u.role})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="progress_rate" label="진행률 (%)">
            <Slider
              min={0}
              max={100}
              step={5}
              marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="시작일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="종료일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ContractSubtasks;
