import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Space, Input, message, Modal, Form, Popconfirm,
  Select, DatePicker, InputNumber, TimePicker, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;
const { Option } = Select;

const VehicleLog: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = selectedCompanyId || user?.company_id;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  const [list, setList] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [logsRes, vehiclesRes] = await Promise.all([
        (window as any).electronAPI.vehicleLogs.getAll(user.id, { company_id: companyId }),
        (window as any).electronAPI.vehicles.getAll(user.id, { company_id: companyId }),
      ]);
      if (logsRes.success) setList(logsRes.data || []);
      if (vehiclesRes.success) setVehicles(vehiclesRes.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const vehicleMap = useMemo(() => {
    const m: Record<string, any> = {};
    vehicles.forEach((v) => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  const handleOpen = (record?: any) => {
    setEditing(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        log_date: record.log_date ? dayjs(record.log_date) : undefined,
        start_time: record.start_time ? dayjs(record.start_time, 'HH:mm') : undefined,
        end_time: record.end_time ? dayjs(record.end_time, 'HH:mm') : undefined,
      });
    } else {
      form.setFieldsValue({ log_date: dayjs(), driver_name: user?.name });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    // start_km/end_km이 있으면 distance_km 자동 계산
    const sKm = Number(values.start_km) || 0;
    const eKm = Number(values.end_km) || 0;
    const distance = sKm && eKm ? Math.max(0, eKm - sKm) : (Number(values.distance_km) || 0);
    const payload = {
      ...values,
      start_km: sKm || null,
      end_km: eKm || null,
      distance_km: distance,
      company_id: companyId,
      driver_id: user.id,
      driver_name: user.name,
      log_date: values.log_date?.format('YYYY-MM-DD'),
      start_time: values.start_time?.format('HH:mm'),
      end_time: values.end_time?.format('HH:mm'),
    };
    try {
      const res = editing
        ? await (window as any).electronAPI.vehicleLogs.update(user.id, editing.id, payload)
        : await (window as any).electronAPI.vehicleLogs.create(user.id, payload);
      if (res.success) {
        message.success(editing ? '수정되었습니다.' : '등록되었습니다.');
        setModalOpen(false);
        fetchData();
      } else message.error(res.error || '저장 실패');
    } catch (err: any) { message.error(err?.message || '저장 중 오류'); }
  };

  const handleDelete = async (id: string) => {
    const res = await (window as any).electronAPI.vehicleLogs.delete(user!.id, id);
    if (res.success) { message.success('삭제되었습니다.'); fetchData(); }
    else message.error(res.error || '삭제 실패');
  };

  const columns = [
    {
      title: '일자', dataIndex: 'log_date', key: 'log_date', width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
      sorter: (a: any, b: any) => (a.log_date || '').localeCompare(b.log_date || ''),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '차량', dataIndex: 'vehicle_id', key: 'vehicle_id', width: 140,
      render: (id: string) => vehicleMap[id]?.plate_number || '-',
    },
    { title: '운전자', dataIndex: 'driver_name', key: 'driver_name', width: 100 },
    { title: '출발지', dataIndex: 'departure', key: 'departure', width: 130 },
    { title: '도착지', dataIndex: 'destination', key: 'destination', width: 130 },
    {
      title: '시간', key: 'time', width: 130,
      render: (_: any, r: any) => `${r.start_time || ''} ~ ${r.end_time || ''}`,
    },
    { title: '목적', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '거리(km)', dataIndex: 'distance_km', key: 'distance_km', width: 90, align: 'right' as const,
      render: (v: number) => v ? Number(v).toLocaleString() : '-',
    },
    {
      title: '유류비', dataIndex: 'fuel_cost', key: 'fuel_cost', width: 110, align: 'right' as const,
      render: (v: number) => v ? `${Number(v).toLocaleString()}원` : '-',
    },
    {
      title: '작업', key: 'action', width: 100,
      render: (_: any, record: any) => (
        <Space size="small">
          {(record.driver_id === user?.id || isAdmin) && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)} />
              <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>운행일지</Title>
          <span style={{ color: '#888' }}>차량 운행 내역을 기록합니다. {isAdmin ? '(관리자: 전체 조회)' : '(본인 일지)'}</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>운행일지 작성</Button>
      </div>

      <Card>
        <ResizableTable columns={columns} dataSource={list} rowKey="id" loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `총 ${t}건` }} scroll={{ x: 1300 }} />
      </Card>

      <Modal title={editing ? '운행일지 수정' : '운행일지 작성'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose width={680}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vehicle_id" label="차량" rules={[{ required: true, message: '차량을 선택해주세요.' }]}>
                <Select placeholder="차량 선택" showSearch optionFilterProp="children">
                  {vehicles.map((v) => (
                    <Option key={v.id} value={v.id}>{v.plate_number} {v.model ? `(${v.model})` : ''}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="log_date" label="일자" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="departure" label="출발지" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="destination" label="도착지" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="출발시각">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="도착시각">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="목적" rules={[{ required: true }]}>
            <Input placeholder="예: 거래처 미팅" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_km" label="출발 km">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="예: 12340" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_km" label="도착 km">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="예: 12380" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                shouldUpdate={(prev, cur) => prev.start_km !== cur.start_km || prev.end_km !== cur.end_km}
                noStyle
              >
                {({ getFieldValue }) => {
                  const s = Number(getFieldValue('start_km')) || 0;
                  const e = Number(getFieldValue('end_km')) || 0;
                  const d = Math.max(0, e - s);
                  // distance_km 동기화 (저장 시 자동 계산)
                  return (
                    <Form.Item name="distance_km" label="주행거리(km, 자동)" initialValue={d}>
                      <InputNumber style={{ width: '100%' }} min={0} value={d} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="fuel_cost" label="유류비(원)">
            <InputNumber style={{ width: '100%' }} min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v!.replace(/,/g, '') as unknown as number} />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">{editing ? '수정' : '등록'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleLog;
