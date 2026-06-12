import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Table, Modal, Form, Input, InputNumber, Select,
  message, Tabs, Popconfirm, Tag, Tooltip, Empty, Tree
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined,
  PercentageOutlined, CalculatorOutlined, AppstoreOutlined,
  UploadOutlined, FileTextOutlined
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
  const canEditPreset = canEdit || user?.role === 'department_manager';
  const { selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;

  // 사전 항목 관리
  interface PresetSection {
    id: string;
    company_id: string;
    level: number;
    title: string;
    parent_id: string | null;
    sort_order: number;
    is_active: boolean;
    default_amount?: number;
  }
  const [presetSections, setPresetSections] = useState<PresetSection[]>([]);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetSection | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);
  const [presetLevel, setPresetLevel] = useState(1);
  const [presetForm] = Form.useForm();

  // 견적서 양식 템플릿
  const [quoteTemplatePath, setQuoteTemplatePath] = useState<string | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);

  // 데이터 로드
  useEffect(() => {
    if (companyId) {
      loadData();
    } else if (user?.role === 'super_admin') {
      // 슈퍼관리자가 회사를 선택하지 않은 경우 첫 번째 회사 사용
      window.electronAPI.companies.getAll(user.id).then((result: any) => {
        if (result.success && result.companies?.length > 0) {
          loadDataWithCompany(result.companies[0].id);
        }
      }).catch(() => {});
    }
  }, [companyId, user?.id]);

  const loadDataWithCompany = async (cid: string) => {
    if (!user?.id || !cid) return;
    setLoading(true);
    try {
      const [laborResult, expenseResult, presetResult, templatePathResult] = await Promise.all([
        window.electronAPI.laborGrades.getByCompany(user.id, cid),
        window.electronAPI.expenseCategories.getByCompany(user.id, cid),
        window.electronAPI.quotePresetSections.getByCompany(user.id, cid),
        window.electronAPI.settings.get('quote_template_path'),
      ]);
      if (laborResult.success) setLaborGrades(laborResult.laborGrades);
      if (expenseResult.success) setExpenseCategories(expenseResult.expenseCategories);
      if (presetResult.success) setPresetSections(presetResult.sections || []);
      if (templatePathResult.success) setQuoteTemplatePath(templatePathResult.value || null);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!user?.id || !companyId) return;

    setLoading(true);
    try {
      const [laborResult, expenseResult, presetResult, templatePathResult] = await Promise.all([
        window.electronAPI.laborGrades.getByCompany(user.id, companyId),
        window.electronAPI.expenseCategories.getByCompany(user.id, companyId),
        window.electronAPI.quotePresetSections.getByCompany(user.id, companyId),
        window.electronAPI.settings.get('quote_template_path'),
      ]);

      if (laborResult.success) {
        setLaborGrades(laborResult.laborGrades);
      }
      if (expenseResult.success) {
        setExpenseCategories(expenseResult.expenseCategories);
      }
      if (presetResult.success) {
        setPresetSections(presetResult.sections || []);
      }
      if (templatePathResult) {
        setQuoteTemplatePath(templatePathResult);
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

  // ========================================
  // 사전 항목 관련
  // ========================================

  const handlePresetAdd = (level: number, parentId: string | null = null) => {
    setEditingPreset(null);
    setPresetLevel(level);
    setPresetParentId(parentId);
    presetForm.resetFields();
    setPresetModalVisible(true);
  };

  const handlePresetEdit = (record: PresetSection) => {
    setEditingPreset(record);
    setPresetLevel(record.level);
    setPresetParentId(record.parent_id);
    presetForm.setFieldsValue({ title: record.title, default_amount: record.default_amount || null });
    setPresetModalVisible(true);
  };

  const handlePresetDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.quotePresetSections.delete(user.id, id);
      if (result.success) {
        message.success('항목이 삭제되었습니다.');
        loadData();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const handlePresetSubmit = async (values: any) => {
    if (!user?.id || !companyId) return;
    try {
      let result;
      if (editingPreset) {
        result = await window.electronAPI.quotePresetSections.update(user.id, editingPreset.id, {
          title: values.title,
          default_amount: values.default_amount,
        });
      } else {
        result = await window.electronAPI.quotePresetSections.create(user.id, {
          company_id: companyId,
          level: presetLevel,
          title: values.title,
          parent_id: presetParentId,
          default_amount: values.default_amount || null,
        });
      }
      if (result.success) {
        message.success(editingPreset ? '항목이 수정되었습니다.' : '항목이 추가되었습니다.');
        setPresetModalVisible(false);
        loadData();
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  const levelLabels: Record<number, { name: string; color: string }> = {
    1: { name: '대분류', color: 'blue' },
    2: { name: '세분류', color: 'cyan' },
    3: { name: '세세분류', color: 'default' },
  };

  const renderPresetTree = () => {
    const level1 = presetSections.filter(s => s.level === 1 && !s.parent_id).sort((a, b) => a.sort_order - b.sort_order);

    if (level1.length === 0) {
      return <Empty description="등록된 사전 항목이 없습니다." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return level1.map((cat, idx) => {
      const level2 = presetSections.filter(s => s.parent_id === cat.id && s.level === 2).sort((a, b) => a.sort_order - b.sort_order);

      return (
        <div key={cat.id} style={{ marginBottom: 12, border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag color="blue">{idx + 1}. 대분류</Tag>
            <Text strong style={{ flex: 1 }}>{cat.title}</Text>
            {canEditPreset && (
              <Space size="small">
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handlePresetAdd(2, cat.id)}>세분류</Button>
                <Tooltip title="수정"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handlePresetEdit(cat)} /></Tooltip>
                <Popconfirm title="이 항목과 하위 항목을 모두 삭제하시겠습니까?" onConfirm={() => handlePresetDelete(cat.id)} okText="삭제" cancelText="취소">
                  <Tooltip title="삭제"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                </Popconfirm>
              </Space>
            )}
          </div>

          {level2.map((sub, subIdx) => {
            const level3 = presetSections.filter(s => s.parent_id === sub.id && s.level === 3).sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div key={sub.id} style={{ marginLeft: 24, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag color="cyan">{idx + 1}-{subIdx + 1}. 세분류</Tag>
                  <Text style={{ flex: 1 }}>{sub.title}</Text>
                  {sub.default_amount ? <Tag color="orange">{sub.default_amount.toLocaleString()}원</Tag> : null}
                  {canEditPreset && (
                    <Space size="small">
                      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handlePresetAdd(3, sub.id)}>세세분류</Button>
                      <Tooltip title="수정"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handlePresetEdit(sub)} /></Tooltip>
                      <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handlePresetDelete(sub.id)} okText="삭제" cancelText="취소">
                        <Tooltip title="삭제"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                      </Popconfirm>
                    </Space>
                  )}
                </div>

                {level3.map((detail, detailIdx) => (
                  <div key={detail.id} style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag>{idx + 1}-{subIdx + 1}-{detailIdx + 1}</Tag>
                    <Text style={{ flex: 1 }}>{detail.title}</Text>
                    {detail.default_amount ? <Tag color="orange">{detail.default_amount.toLocaleString()}원</Tag> : null}
                    {canEditPreset && (
                      <Space size="small">
                        <Tooltip title="수정"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handlePresetEdit(detail)} /></Tooltip>
                        <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handlePresetDelete(detail.id)} okText="삭제" cancelText="취소">
                          <Tooltip title="삭제"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    });
  };

  // ========================================
  // 견적서 양식 관련
  // ========================================

  const handleQuoteTemplateUpload = async () => {
    if (!user?.id) return;
    setTemplateUploading(true);
    try {
      const result = await window.electronAPI.quotes.uploadTemplate(user.id);
      if (result.success) {
        message.success(`견적서 양식이 업로드되었습니다: ${result.fileName}`);
        setQuoteTemplatePath(result.templatePath);
      } else if (result.error !== 'canceled') {
        message.error(result.error || '업로드에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleQuoteTemplateRemove = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.quotes.removeTemplate(user.id);
      if (result.success) {
        message.success('견적서 양식이 삭제되었습니다.');
        setQuoteTemplatePath(null);
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

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
    {
      key: 'preset',
      label: (
        <span>
          <AppstoreOutlined />
          견적 항목 관리
        </span>
      ),
      children: (
        <Card
          extra={
            canEditPreset && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handlePresetAdd(1, null)}>
                대분류 추가
              </Button>
            )
          }
        >
          {renderPresetTree()}
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              * 사전 항목은 견적서 작성 시 "사전 항목 불러오기"로 빠르게 추가할 수 있습니다.
            </Text>
            <br />
            <Text type="secondary">
              * 대분류 / 세분류 / 세세분류 3단계 계층 구조로 관리됩니다.
            </Text>
          </div>
        </Card>
      ),
    },
    {
      key: 'quoteTemplate',
      label: (
        <span>
          <FileTextOutlined />
          견적서 양식
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>견적서 출력 양식</Title>
            <Text type="secondary">
              견적서 출력 시 사용할 양식 파일을 업로드합니다. (docx, xlsx, hwp 파일 지원)
            </Text>
          </div>

          {quoteTemplatePath ? (
            <div style={{ padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <FileTextOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <Text strong>현재 양식 파일:</Text>
                  <Text>{quoteTemplatePath.split(/[/\\]/).pop()}</Text>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>경로: {quoteTemplatePath}</Text>
                </Space>
                {canEdit && (
                  <Space style={{ marginTop: 8 }}>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={handleQuoteTemplateUpload}
                      loading={templateUploading}
                    >
                      양식 교체
                    </Button>
                    <Popconfirm
                      title="견적서 양식 삭제"
                      description="등록된 양식을 삭제하시겠습니까? 삭제 후에는 기본 형식으로 출력됩니다."
                      onConfirm={handleQuoteTemplateRemove}
                      okText="삭제"
                      cancelText="취소"
                    >
                      <Button danger icon={<DeleteOutlined />}>양식 삭제</Button>
                    </Popconfirm>
                  </Space>
                )}
              </Space>
            </div>
          ) : (
            <div style={{ padding: 24, background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, textAlign: 'center', marginBottom: 16 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="등록된 견적서 양식이 없습니다."
              />
              {canEdit && (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleQuoteTemplateUpload}
                  loading={templateUploading}
                  style={{ marginTop: 12 }}
                >
                  양식 파일 업로드
                </Button>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              * 양식 파일을 등록하면 견적서 출력 시 AI가 양식에 맞춰 데이터를 채워넣습니다.
            </Text>
            <br />
            <Text type="secondary">
              * 양식이 없으면 기본 견적서 형식으로 출력됩니다.
            </Text>
            <br />
            <Text type="secondary">
              * AI 출력 기능을 사용하려면 설정에서 OpenAI API 키가 등록되어 있어야 합니다.
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
        <Title level={4} style={{ margin: 0 }}>단가 설정</Title>
        <span style={{ color: '#888' }}>견적서 작성에 사용되는 단가표와 경비 항목을 관리합니다.</span>
      </div>

      {!canEdit && (
        <Card style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text>단가 설정을 수정하려면 회사 관리자 권한이 필요합니다.</Text>
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

      {/* 사전 항목 모달 */}
      <Modal
        title={editingPreset ? `${levelLabels[presetLevel]?.name || ''} 수정` : `${levelLabels[presetLevel]?.name || ''} 추가`}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={presetForm}
          layout="vertical"
          onFinish={handlePresetSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="항목명"
            rules={[{ required: true, message: '항목명을 입력해주세요.' }]}
          >
            <Input placeholder={`예: ${presetLevel === 1 ? '인건비' : presetLevel === 2 ? '책임연구원' : '현장조사'}`} />
          </Form.Item>

          {presetLevel >= 2 && (
            <Form.Item name="default_amount" label="기본 금액 (선택)">
              <InputNumber
                style={{ width: '100%' }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/,/g, '') as unknown as number}
                placeholder="금액을 미리 설정하면 불러오기 시 자동 입력됩니다"
                min={0}
                addonAfter="원"
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPresetModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingPreset ? '수정' : '추가'}
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
