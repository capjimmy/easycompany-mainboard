import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Modal, Form, Input, Select,
  message, Popconfirm, Tooltip, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

declare global {
  interface Window {
    electronAPI: any;
  }
}

interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

const getFileIcon = (fileType: string) => {
  switch (fileType?.toLowerCase()) {
    case 'docx':
    case 'doc':
      return <FileWordOutlined style={{ color: '#2b579a' }} />;
    case 'xlsx':
    case 'xls':
      return <FileExcelOutlined style={{ color: '#217346' }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#d63031' }} />;
    default:
      return <FileOutlined style={{ color: '#666' }} />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const DocumentTemplates: React.FC = () => {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [form] = Form.useForm();

  // 권한 확인 (부서장 이상)
  const canManage = user?.role === 'super_admin' ||
    user?.role === 'company_admin' ||
    user?.role === 'department_manager';

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
      loadDepartments();
    }
  }, [user?.id]);

  const loadTemplates = async () => {
    if (!user?.id || !user.company_id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.documentTemplates.getByCompany(user.id, user.company_id);
      if (result.success) {
        // 부서명 추가
        const templatesWithDept = result.templates.map((t: any) => {
          const dept = departments.find((d: any) => d.id === t.department_id);
          return {
            ...t,
            department_name: dept?.name || '전사 공용',
          };
        });
        setTemplates(templatesWithDept);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!user?.id || !user.company_id) return;

    try {
      const result = await window.electronAPI.departments.getAll(user.id, user.company_id);
      if (result.success) {
        setDepartments(result.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  // 부서 목록 로드 후 템플릿 다시 로드
  useEffect(() => {
    if (departments.length > 0 && user?.id) {
      loadTemplates();
    }
  }, [departments]);

  const handleAddTemplate = async () => {
    if (!user?.id || !user.company_id) return;

    const values = form.getFieldsValue();

    try {
      const result = await window.electronAPI.documentTemplates.create(user.id, {
        company_id: user.company_id,
        department_id: values.department_id || null,
        name: values.name,
        description: values.description,
      });

      if (result.success) {
        message.success('템플릿이 등록되었습니다.');
        setModalVisible(false);
        form.resetFields();
        loadTemplates();
      } else {
        message.error(result.error || '템플릿 등록에 실패했습니다.');
      }
    } catch (err) {
      message.error('템플릿 등록 중 오류가 발생했습니다.');
    }
  };

  const handleEditTemplate = async () => {
    if (!user?.id || !editingTemplate) return;

    const values = form.getFieldsValue();

    try {
      const result = await window.electronAPI.documentTemplates.update(
        user.id,
        editingTemplate.id,
        {
          name: values.name,
          description: values.description,
        }
      );

      if (result.success) {
        message.success('템플릿이 수정되었습니다.');
        setModalVisible(false);
        setEditingTemplate(null);
        form.resetFields();
        loadTemplates();
      } else {
        message.error(result.error || '템플릿 수정에 실패했습니다.');
      }
    } catch (err) {
      message.error('템플릿 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.documentTemplates.delete(user.id, templateId);
      if (result.success) {
        message.success('템플릿이 삭제되었습니다.');
        loadTemplates();
      } else {
        message.error(result.error || '템플릿 삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('템플릿 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenFolder = async () => {
    if (!user?.id) return;

    try {
      await window.electronAPI.documents.openFolder(user.id, 'templates');
    } catch (err) {
      message.error('폴더를 여는 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      department_id: template.department_id,
    });
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingTemplate(null);
    form.resetFields();
    // 부서장인 경우 자신의 부서로 기본 설정
    if (user?.role === 'department_manager' && user.department_id) {
      form.setFieldsValue({ department_id: user.department_id });
    }
    setModalVisible(true);
  };

  const columns = [
    {
      title: '템플릿명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DocumentTemplate) => (
        <Space>
          {getFileIcon(record.file_type)}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '파일명',
      dataIndex: 'original_filename',
      key: 'original_filename',
      render: (filename: string, record: DocumentTemplate) => (
        <Space>
          <Text type="secondary">{filename}</Text>
          <Tag>{formatFileSize(record.file_size)}</Tag>
        </Space>
      ),
    },
    {
      title: '부서',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (dept: string) => (
        <Tag color={dept === '전사 공용' ? 'blue' : 'default'}>
          {dept || '전사 공용'}
        </Tag>
      ),
    },
    {
      title: '등록일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_: any, record: DocumentTemplate) => (
        <Space size="small">
          <Tooltip title="수정">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="이 템플릿을 삭제하시겠습니까?"
            onConfirm={() => handleDeleteTemplate(record.id)}
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
      ),
    },
  ];

  if (!canManage) {
    return (
      <div className="fade-in">
        <Card>
          <Empty description="템플릿 관리 권한이 없습니다." />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>문서 템플릿 관리</Title>
          <Text type="secondary">
            계약서에서 생성할 문서 템플릿을 관리합니다.
          </Text>
        </div>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={handleOpenFolder}>
            폴더 열기
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={openAddModal}>
            템플릿 등록
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          loading={loading}
          dataSource={templates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                description="등록된 템플릿이 없습니다."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" icon={<UploadOutlined />} onClick={openAddModal}>
                  첫 템플릿 등록하기
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* 템플릿 등록/수정 모달 */}
      <Modal
        title={editingTemplate ? '템플릿 수정' : '템플릿 등록'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        onOk={editingTemplate ? handleEditTemplate : handleAddTemplate}
        okText={editingTemplate ? '수정' : '등록'}
        cancelText="취소"
      >
        <Form form={form} layout="vertical">
          {!editingTemplate && (
            <div style={{
              padding: 16,
              backgroundColor: '#f5f5f5',
              borderRadius: 8,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <UploadOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
              <div>
                <Text type="secondary">
                  등록 버튼을 누르면 파일 선택 창이 열립니다.
                </Text>
              </div>
            </div>
          )}

          <Form.Item
            name="name"
            label="템플릿명"
            rules={[{ required: true, message: '템플릿명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 용역계약서, 착수보고서" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="템플릿에 대한 설명" />
          </Form.Item>

          {!editingTemplate && (
            <Form.Item name="department_id" label="부서">
              <Select
                placeholder="전사 공용"
                allowClear
                disabled={user?.role === 'department_manager'}
              >
                <Select.Option value="">전사 공용</Select.Option>
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {editingTemplate && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                파일: {editingTemplate.original_filename} ({formatFileSize(editingTemplate.file_size)})
              </Text>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DocumentTemplates;
