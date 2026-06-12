import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Upload, Table, message, Modal, Space, Tag, Select, Input,
} from 'antd';
import {
  CloudUploadOutlined, DownloadOutlined, DeleteOutlined, FileTextOutlined,
  FileExcelOutlined, FilePdfOutlined, FileWordOutlined, FileUnknownOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

interface TemplateRow {
  name: string;
  fullPath: string;
  category: string;
  size: number;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'excel', label: '엑셀 양식', icon: <FileExcelOutlined style={{ color: '#52c41a' }} /> },
  { value: 'hwpx', label: '한글 양식', icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
  { value: 'word', label: 'Word 양식', icon: <FileWordOutlined style={{ color: '#2f54eb' }} /> },
  { value: 'reports', label: '보고서 양식', icon: <FilePdfOutlined style={{ color: '#fa541c' }} /> },
];

const iconByExt = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileExcelOutlined style={{ color: '#52c41a' }} />;
  if (['hwp', 'hwpx'].includes(ext || '')) return <FileTextOutlined style={{ color: '#1890ff' }} />;
  if (['docx', 'doc'].includes(ext || '')) return <FileWordOutlined style={{ color: '#2f54eb' }} />;
  if (['pdf'].includes(ext || '')) return <FilePdfOutlined style={{ color: '#fa541c' }} />;
  return <FileUnknownOutlined />;
};

const TemplateManager: React.FC = () => {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadCategory, setUploadCategory] = useState<string>('excel');
  const [searchText, setSearchText] = useState('');
  const canManage = user?.role === 'super_admin' || user?.role === 'company_admin';

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.templates.list();
      if (res.success) setTemplates(res.data || []);
      else message.error(res.error || '조회 실패');
    } catch (e: any) {
      message.error(e?.message || '오류');
    } finally { setLoading(false); }
  };

  const handleUpload = async (file: File) => {
    if (!canManage) { message.error('업로드 권한이 없습니다'); return false; }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const res = await (window as any).electronAPI.templates.upload(user!.id, uploadCategory, file.name, Array.from(bytes));
      if (res.success) {
        message.success(`${file.name} 업로드됨`);
        load();
      } else {
        message.error(res.error || '업로드 실패');
      }
    } catch (e: any) {
      message.error(e?.message || '업로드 오류');
    }
    return false;
  };

  const handleDownload = async (row: TemplateRow) => {
    try {
      const res = await (window as any).electronAPI.templates.download(user!.id, row.fullPath);
      if (res.success) {
        message.success(`다운로드 완료: ${res.savedTo || row.name}`);
      } else {
        message.error(res.error || '다운로드 실패');
      }
    } catch (e: any) {
      message.error(e?.message || '다운로드 오류');
    }
  };

  const handleDelete = (row: TemplateRow) => {
    if (!canManage) { message.error('삭제 권한이 없습니다'); return; }
    Modal.confirm({
      title: `${row.name} 양식 삭제`,
      content: '삭제 후 복구할 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      onOk: async () => {
        const res = await (window as any).electronAPI.templates.delete(user!.id, row.fullPath);
        if (res.success) {
          message.success('삭제됨');
          load();
        } else {
          message.error(res.error || '삭제 실패');
        }
      },
    });
  };

  const filtered = templates.filter(t =>
    !searchText || t.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <CloudUploadOutlined /> 양식 보관소
          </Title>
          <Text type="secondary">
            엑셀/한글/Word/PDF 양식을 공유 저장소에 보관합니다. (보안: 인증된 사용자만 다운로드 가능)
          </Text>
        </div>
        <Space>
          <Input.Search placeholder="이름 검색" value={searchText} onChange={(e) => setSearchText(e.target.value)}
            allowClear style={{ width: 200 }} />
          {canManage && (
            <>
              <Select value={uploadCategory} onChange={setUploadCategory} style={{ width: 140 }}>
                {CATEGORIES.map(c => (
                  <Option key={c.value} value={c.value}>{c.icon} {c.label}</Option>
                ))}
              </Select>
              <Upload
                showUploadList={false}
                beforeUpload={(file) => handleUpload(file)}
                multiple
              >
                <Button type="primary" icon={<CloudUploadOutlined />}>업로드</Button>
              </Upload>
            </>
          )}
        </Space>
      </div>

      <Card size="small">
        <Table
          dataSource={filtered}
          loading={loading}
          rowKey="fullPath"
          size="small"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: '',
              key: 'icon',
              width: 40,
              render: (_: any, r: TemplateRow) => iconByExt(r.name),
            },
            { title: '파일명', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
            {
              title: '분류',
              dataIndex: 'category',
              width: 120,
              filters: CATEGORIES.map(c => ({ text: c.label, value: c.value })),
              onFilter: (val, row: any) => row.category === val,
              render: (v: string) => {
                const c = CATEGORIES.find(x => x.value === v);
                return <Tag color={v === 'excel' ? 'green' : v === 'hwpx' ? 'blue' : v === 'word' ? 'geekblue' : 'orange'}>{c?.label || v}</Tag>;
              },
            },
            {
              title: '크기',
              dataIndex: 'size',
              width: 100,
              align: 'right' as const,
              render: (v: number) => {
                if (!v) return '-';
                if (v < 1024) return `${v} B`;
                if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`;
                return `${(v / (1024 * 1024)).toFixed(1)} MB`;
              },
            },
            {
              title: '수정일',
              dataIndex: 'updated_at',
              width: 140,
              render: (v: string) => v ? v.substring(0, 16).replace('T', ' ') : '-',
            },
            {
              title: '',
              key: 'action',
              width: 150,
              render: (_: any, r: TemplateRow) => (
                <Space>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>다운</Button>
                  {canManage && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default TemplateManager;
