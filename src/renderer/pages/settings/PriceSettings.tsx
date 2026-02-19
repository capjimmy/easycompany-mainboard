import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Table, Modal, Form, Input, InputNumber, Select,
  message, Tabs, Popconfirm, Tag, Tooltip, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined,
  PercentageOutlined, CalculatorOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import type { LaborGrade, ExpenseCategory } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;

const PriceSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // 인건비 등급
  const [laborGrades, setLaborGrades] = useState<LaborGrade[]>([]);
  const [laborModalVisible, setLaborModalVisible] = useState(false);
  const [editingLaborGrade, setEditingLaborGrade] = useState<LaborGrade | null>(null);
  const [laborForm] = Form.useForm();

  // 경비 항목
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState<ExpenseCategory | null>(null);
  const [expenseForm] = Form.useForm();

  // 권한 확인 (company_admin 이상)
  const canEdit = user?.role === 'super_admin' || user?.role === 'company_admin';
  const companyId = user?.company_id;

  // 데이터 로드
  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  const loadData = async () => {
    if (!user?.id || !companyId) return;

    setLoading(true);
    try {
      const [laborResult, expenseResult] = await Promise.all([
        window.electronAPI.laborGrades.getByCompany(user.id, companyId),
        window.electronAPI.expenseCategories.getByCompany(user.id, companyId),
      ]);

      if (laborResult.success) {
        setLaborGrades(laborResult.laborGrades);
      }
      if (expenseResult.success) {
        setExpenseCategories(expenseResult.expenseCategories);
      }
    } catch (err) {
      message.error('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // 인건비 등급 관련
  // ========================================

  const handleLaborAdd = () => {
    setEditingLaborGrade(null);
    laborForm.resetFields();
    setLaborModalVisible(true);
  };

  const handleLaborEdit = (record: LaborGrade) => {
    setEditingLaborGrade(record);
    laborForm.setFieldsValue({
      name: record.name,
      monthly_rate: record.monthly_rate,
      daily_rate: record.daily_rate,
      description: record.description,
    });
    setLaborModalVisible(true);
  };

  const handleLaborDelete = async (id: string) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.laborGrades.delete(user.id, id);
      if (result.success) {
        message.success('인건비 등급이 삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const handleLaborSubmit = async (values: any) => {
    if (!user?.id || !companyId) return;

    try {
      let result;
      if (editingLaborGrade) {
        result = await window.electronAPI.laborGrades.update(user.id, editingLaborGrade.id, values);
      } else {
        result = await window.electronAPI.laborGrades.create(user.id, {
          ...values,
          company_id: companyId,
        });
      }

      if (result.success) {
        message.success(editingLaborGrade ? '인건비 등급이 수정되었습니다.' : '인건비 등급이 추가되었습니다.');
        setLaborModalVisible(false);
        loadData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const laborColumns = [
    {
      title: '순서',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '등급명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '월 단가',
      dataIndex: 'monthly_rate',
      key: 'monthly_rate',
      render: (value: number) => `${value.toLocaleString()}원`,
    },
    {
      title: '일 단가',
      dataIndex: 'daily_rate',
      key: 'daily_rate',
      render: (value: number | null) => value ? `${value.toLocaleString()}원` : '-',
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value || '-',
    },
    ...(canEdit ? [{
      title: '작업',
      key: 'action',
      width: 120,
      render: (_: any, record: LaborGrade) => (
        <Space>
          <Tooltip title="수정">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleLaborEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="인건비 등급 삭제"
            description="이 등급을 삭제하시겠습니까?"
            onConfirm={() => handleLaborDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Tooltip title="삭제">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  // ========================================
  // 경비 항목 관련
  // ========================================

  const handleExpenseAdd = () => {
    setEditingExpenseCategory(null);
    expenseForm.resetFields();
    expenseForm.setFieldsValue({ calculation_type: 'manual' });
    setExpenseModalVisible(true);
  };

  const handleExpenseEdit = (record: ExpenseCategory) => {
    setEditingExpenseCategory(record);
    expenseForm.setFieldsValue({
      name: record.name,
      calculation_type: record.calculation_type,
      base_field: record.base_field,
      default_rate: record.default_rate ? record.default_rate * 100 : null,
    });
    setExpenseModalVisible(true);
  };

  const handleExpenseDelete = async (id: string) => {
    if (!user?.id) return;

    try {
      const result = await window.electronAPI.expenseCategories.delete(user.id, id);
      if (result.success) {
        message.success('경비 항목이 삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const handleExpenseSubmit = async (values: any) => {
    if (!user?.id || !companyId) return;

    const submitData = {
      ...values,
      company_id: companyId,
      default_rate: values.default_rate ? values.default_rate / 100 : null,
    };

    try {
      let result;
      if (editingExpenseCategory) {
        result = await window.electronAPI.expenseCategories.update(user.id, editingExpenseCategory.id, submitData);
      } else {
        result = await window.electronAPI.expenseCategories.create(user.id, submitData);
      }

      if (result.success) {
        message.success(editingExpenseCategory ? '경비 항목이 수정되었습니다.' : '경비 항목이 추가되었습니다.');
        setExpenseModalVisible(false);
        loadData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const calculationType = Form.useWatch('calculation_type', expenseForm);

  const expenseColumns = [
    {
      title: '순서',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '항목명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '계산 방식',
      dataIndex: 'calculation_type',
      key: 'calculation_type',
      render: (value: string) => {
        const types: Record<string, { label: string; color: string }> = {
          manual: { label: '수동 입력', color: 'default' },
          percentage: { label: '비율 계산', color: 'blue' },
          fixed: { label: '고정금액', color: 'green' },
        };
        return <Tag color={types[value]?.color}>{types[value]?.label}</Tag>;
      },
    },
    {
      title: '기준/비율',
      key: 'rate_info',
      render: (_: any, record: ExpenseCategory) => {
        if (record.calculation_type === 'percentage') {
          return (
            <span>
              인건비 x {(record.default_rate! * 100).toFixed(0)}%
            </span>
          );
        }
        return '-';
      },
    },
    ...(canEdit ? [{
      title: '작업',
      key: 'action',
      width: 120,
      render: (_: any, record: ExpenseCategory) => (
        <Space>
          <Tooltip title="수정">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleExpenseEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="경비 항목 삭제"
            description="이 항목을 삭제하시겠습니까?"
            onConfirm={() => handleExpenseDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Tooltip title="삭제">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const tabItems = [
    {
      key: 'labor',
      label: (
        <span>
          <DollarOutlined />
          인건비 등급 (단가표)
        </span>
      ),
      children: (
        <Card
          extra={
            canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleLaborAdd}>
                등급 추가
              </Button>
            )
          }
        >
          <Table
            columns={laborColumns}
            dataSource={laborGrades}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: <Empty description="등록된 인건비 등급이 없습니다." />,
            }}
          />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              * 인건비 등급은 견적서 작성 시 인건비 계산에 사용됩니다.
            </Text>
          </div>
        </Card>
      ),
    },
    {
      key: 'expense',
      label: (
        <span>
          <CalculatorOutlined />
          경비 항목
        </span>
      ),
      children: (
        <Card
          extra={
            canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleExpenseAdd}>
                항목 추가
              </Button>
            )
          }
        >
          <Table
            columns={expenseColumns}
            dataSource={expenseCategories}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: <Empty description="등록된 경비 항목이 없습니다." />,
            }}
          />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              * 경비 항목은 견적서 작성 시 경비 계산에 사용됩니다.
            </Text>
            <br />
            <Text type="secondary">
              * 비율 계산: 인건비 총액에 비율을 곱하여 자동 계산됩니다.
            </Text>
          </div>
        </Card>
      ),
    },
  ];

  if (!companyId) {
    return (
      <div className="fade-in">
        <Card>
          <Empty description="소속 회사가 없습니다." />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>양식 설정</Title>
        <span style={{ color: '#888' }}>견적서 작성에 사용되는 단가표와 경비 항목을 관리합니다.</span>
      </div>

      {!canEdit && (
        <Card style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text>양식 설정을 수정하려면 회사 관리자 권한이 필요합니다.</Text>
        </Card>
      )}

      <Tabs defaultActiveKey="labor" items={tabItems} />

      {/* 인건비 등급 모달 */}
      <Modal
        title={editingLaborGrade ? '인건비 등급 수정' : '인건비 등급 추가'}
        open={laborModalVisible}
        onCancel={() => setLaborModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={laborForm}
          layout="vertical"
          onFinish={handleLaborSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="등급명"
            rules={[{ required: true, message: '등급명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 책임연구원" />
          </Form.Item>

          <Form.Item
            name="monthly_rate"
            label="월 단가 (원)"
            rules={[{ required: true, message: '월 단가를 입력해주세요.' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
              placeholder="예: 3,300,000"
              min={0}
            />
          </Form.Item>

          <Form.Item name="daily_rate" label="일 단가 (원, 선택)">
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
              placeholder="일 단가가 필요한 경우 입력"
              min={0}
            />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={2} placeholder="등급에 대한 설명" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setLaborModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingLaborGrade ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 경비 항목 모달 */}
      <Modal
        title={editingExpenseCategory ? '경비 항목 수정' : '경비 항목 추가'}
        open={expenseModalVisible}
        onCancel={() => setExpenseModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={expenseForm}
          layout="vertical"
          onFinish={handleExpenseSubmit}
          style={{ marginTop: 16 }}
          initialValues={{ calculation_type: 'manual' }}
        >
          <Form.Item
            name="name"
            label="항목명"
            rules={[{ required: true, message: '항목명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 사무용품비" />
          </Form.Item>

          <Form.Item
            name="calculation_type"
            label="계산 방식"
            rules={[{ required: true, message: '계산 방식을 선택해주세요.' }]}
          >
            <Select>
              <Option value="manual">수동 입력 (직접 금액 입력)</Option>
              <Option value="percentage">비율 계산 (인건비 x 비율)</Option>
              <Option value="fixed">고정 금액</Option>
            </Select>
          </Form.Item>

          {calculationType === 'percentage' && (
            <>
              <Form.Item name="base_field" label="기준 항목" initialValue="labor_total">
                <Select disabled>
                  <Option value="labor_total">인건비 총액</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="default_rate"
                label="기본 비율 (%)"
                rules={[{ required: true, message: '비율을 입력해주세요.' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="예: 10"
                  min={0}
                  max={100}
                  addonAfter="%"
                />
              </Form.Item>
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setExpenseModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingExpenseCategory ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PriceSettings;
