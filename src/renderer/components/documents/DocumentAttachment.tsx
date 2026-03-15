import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Input, Space, Tag, Modal, Select, Empty,
  message, Tooltip, Breadcrumb, Typography, Row, Col, Spin
} from 'antd';
import {
  PaperClipOutlined, SearchOutlined, FolderOpenOutlined, FileOutlined,
  DeleteOutlined, EyeOutlined, FolderOutlined, ArrowLeftOutlined,
  FilePdfOutlined, FileWordOutlined, FileExcelOutlined, FileImageOutlined,
  HomeOutlined, LinkOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

const DOCUMENT_CATEGORIES = [
  { value: 'contract', label: '계약서' },
  { value: 'task_instruction', label: '과업지시서' },
  { value: 'quotation', label: '견적서' },
  { value: 'terms', label: '약관/특별약관' },
  { value: 'deliverable', label: '성과품' },
  { value: 'reference', label: '참고자료' },
  { value: 'bid', label: '입찰안내서' },
  { value: 'progress', label: '업무경과' },
  { value: 'other', label: '기타' },
];

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />,
  doc: <FileWordOutlined style={{ color: '#1890ff', fontSize: 16 }} />,
  docx: <FileWordOutlined style={{ color: '#1890ff', fontSize: 16 }} />,
  xls: <FileExcelOutlined style={{ color: '#52c41a', fontSize: 16 }} />,
  xlsx: <FileExcelOutlined style={{ color: '#52c41a', fontSize: 16 }} />,
  hwp: <FileOutlined style={{ color: '#722ed1', fontSize: 16 }} />,
  png: <FileImageOutlined style={{ color: '#fa8c16', fontSize: 16 }} />,
  jpg: <FileImageOutlined style={{ color: '#fa8c16', fontSize: 16 }} />,
  jpeg: <FileImageOutlined style={{ color: '#fa8c16', fontSize: 16 }} />,
  folder: <FolderOutlined style={{ color: '#faad14', fontSize: 16 }} />,
};

function getFileIcon(type: string) {
  return FILE_ICONS[type] || <FileOutlined style={{ fontSize: 16 }} />;
}

function getCategoryLabel(value: string): string {
  return DOCUMENT_CATEGORIES.find(c => c.value === value)?.label || '기타';
}

function getCategoryColor(value: string): string {
  const colors: Record<string, string> = {
    contract: 'blue',
    task_instruction: 'purple',
    quotation: 'green',
    terms: 'orange',
    deliverable: 'cyan',
    reference: 'geekblue',
    bid: 'magenta',
    progress: 'gold',
    other: 'default',
  };
  return colors[value] || 'default';
}

interface DocumentAttachmentProps {
  parentType: 'quote' | 'contract';
  parentId: string;
  userId: string;
  serviceName?: string;  // 프로젝트명 (자동 검색용)
}

const DocumentAttachment: React.FC<DocumentAttachmentProps> = ({
  parentType,
  parentId,
  userId,
  serviceName,
}) => {
  const [attachedDocs, setAttachedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [basePath, setBasePath] = useState('');
  const [browseFiles, setBrowseFiles] = useState<any[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('other');

  // 첨부 문서 목록 로드
  const loadAttachedDocs = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.attachedDocs.getByParent(parentType, parentId);
      if (result.success) {
        setAttachedDocs(result.documents || []);
      }
    } catch (err) {
      console.error('Failed to load attached docs:', err);
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId]);

  useEffect(() => {
    loadAttachedDocs();
  }, [loadAttachedDocs]);

  // 파일 탐색기 열기
  const openBrowser = async (dirPath?: string) => {
    setShowBrowser(true);
    setBrowseLoading(true);
    setSearchResults([]);
    setIsSearching(false);
    try {
      const result = await window.electronAPI.fileExplorer.browse(dirPath, userId);
      if (result.success) {
        setCurrentPath(result.currentPath);
        setBasePath(result.basePath);
        setBrowseFiles(result.files || []);
      } else {
        message.error(result.error || '폴더를 열 수 없습니다.');
      }
    } catch (err) {
      message.error('파일 탐색에 실패했습니다.');
    } finally {
      setBrowseLoading(false);
    }
  };

  // 폴더 이동
  const navigateToFolder = (dirPath: string) => {
    openBrowser(dirPath);
  };

  // 상위 폴더로
  const navigateUp = () => {
    const parentDir = currentPath.replace(/[/\\][^/\\]+$/, '');
    if (parentDir && parentDir !== currentPath) {
      openBrowser(parentDir);
    }
  };

  // 파일 검색
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    setBrowseLoading(true);
    try {
      const result = await window.electronAPI.fileExplorer.search(searchKeyword, undefined, userId);
      if (result.success) {
        setSearchResults(result.results || []);
      }
    } catch (err) {
      message.error('검색에 실패했습니다.');
    } finally {
      setBrowseLoading(false);
    }
  };

  // 프로젝트명으로 자동 검색
  const handleAutoSearch = async () => {
    if (!serviceName) {
      message.info('용역명을 먼저 입력해주세요.');
      return;
    }
    setSearchKeyword(serviceName);
    setIsSearching(true);
    setBrowseLoading(true);
    setShowBrowser(true);
    try {
      const result = await window.electronAPI.fileExplorer.search(serviceName, undefined, userId);
      if (result.success) {
        setSearchResults(result.results || []);
      }
    } catch (err) {
      message.error('검색에 실패했습니다.');
    } finally {
      setBrowseLoading(false);
    }
  };

  // 파일 첨부
  const attachFile = async (filePath: string) => {
    try {
      const result = await window.electronAPI.attachedDocs.add({
        parentType,
        parentId,
        filePath,
        category: selectedCategory,
        attachedBy: userId,
      });
      if (result.success) {
        message.success('문서가 첨부되었습니다.');
        loadAttachedDocs();
      } else {
        message.error(result.error || '첨부에 실패했습니다.');
      }
    } catch (err) {
      message.error('첨부에 실패했습니다.');
    }
  };

  // 첨부 해제
  const detachFile = async (docId: string) => {
    try {
      const result = await window.electronAPI.attachedDocs.remove(docId);
      if (result.success) {
        message.success('첨부가 해제되었습니다.');
        loadAttachedDocs();
      }
    } catch (err) {
      message.error('삭제에 실패했습니다.');
    }
  };

  // 파일 열기
  const openFile = async (docId: string) => {
    try {
      const result = await window.electronAPI.attachedDocs.openFile(docId);
      if (!result.success) {
        message.error(result.error || '파일을 열 수 없습니다.');
      }
    } catch (err) {
      message.error('파일 열기에 실패했습니다.');
    }
  };

  // 카테고리 변경
  const updateCategory = async (docId: string, category: string) => {
    try {
      await window.electronAPI.attachedDocs.updateCategory(docId, category);
      loadAttachedDocs();
    } catch (err) {
      message.error('카테고리 변경에 실패했습니다.');
    }
  };

  // 첨부 문서 테이블 컬럼
  const attachedColumns = [
    {
      title: '구분',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (category: string, record: any) => (
        <Select
          size="small"
          value={category}
          onChange={(val) => updateCategory(record.id, val)}
          style={{ width: 100 }}
        >
          {DOCUMENT_CATEGORIES.map(cat => (
            <Option key={cat.value} value={cat.value}>{cat.label}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '파일명',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (name: string, record: any) => (
        <Space>
          {getFileIcon(record.file_type)}
          <Tooltip title={record.file_path}>
            <Text
              style={{
                cursor: 'pointer',
                color: record.fileExists ? undefined : '#ff4d4f',
              }}
              onClick={() => openFile(record.id)}
            >
              {name}
            </Text>
          </Tooltip>
          {!record.fileExists && <Tag color="error">파일 없음</Tag>}
        </Space>
      ),
    },
    {
      title: '크기',
      dataIndex: 'fileSizeFormatted',
      key: 'size',
      width: 90,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="파일 열기">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openFile(record.id)}
            />
          </Tooltip>
          <Tooltip title="첨부 해제">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => detachFile(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 탐색기 파일 목록
  const displayFiles = isSearching ? searchResults : browseFiles;

  // Breadcrumb 생성
  const getBreadcrumbs = () => {
    if (!currentPath || !basePath) return [];
    const relativePath = currentPath.replace(basePath, '').replace(/^[/\\]/, '');
    const parts = relativePath ? relativePath.split(/[/\\]/) : [];
    return [{ name: '문서 저장소', path: basePath }, ...parts.map((part, i) => ({
      name: part,
      path: basePath + '\\' + parts.slice(0, i + 1).join('\\'),
    }))];
  };

  return (
    <div>
      {/* 첨부된 문서 목록 */}
      <div style={{ marginBottom: 12 }}>
        <Space>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => openBrowser()}
          >
            파일 탐색
          </Button>
          <Button
            icon={<SearchOutlined />}
            onClick={handleAutoSearch}
            disabled={!serviceName}
          >
            관련 문서 검색
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            첨부된 문서: {attachedDocs.length}건
          </Text>
        </Space>
      </div>

      {attachedDocs.length > 0 ? (
        <Table
          columns={attachedColumns}
          dataSource={attachedDocs}
          rowKey="id"
          pagination={false}
          size="small"
          loading={loading}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="첨부된 문서가 없습니다. 파일 탐색 또는 관련 문서 검색을 통해 첨부하세요."
          style={{ padding: '16px 0' }}
        />
      )}

      {/* 파일 탐색 모달 */}
      <Modal
        title={
          <Space>
            <FolderOpenOutlined />
            <span>문서 첨부 - 파일 탐색</span>
          </Space>
        }
        open={showBrowser}
        onCancel={() => setShowBrowser(false)}
        width={900}
        footer={null}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {/* 검색 바 */}
        <div style={{ marginBottom: 12 }}>
          <Row gutter={8}>
            <Col flex="auto">
              <Input
                placeholder="파일명으로 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                allowClear
                onClear={() => {
                  setIsSearching(false);
                  setSearchResults([]);
                }}
              />
            </Col>
            <Col>
              <Button type="primary" onClick={handleSearch}>
                검색
              </Button>
            </Col>
            <Col>
              <Select
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: 120 }}
              >
                {DOCUMENT_CATEGORIES.map(cat => (
                  <Option key={cat.value} value={cat.value}>{cat.label}</Option>
                ))}
              </Select>
            </Col>
          </Row>
        </div>

        {/* Breadcrumb 네비게이션 */}
        {!isSearching && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={navigateUp}
              disabled={currentPath === basePath}
            />
            <Breadcrumb
              items={getBreadcrumbs().map(item => ({
                title: (
                  <a onClick={() => navigateToFolder(item.path)}>{item.name}</a>
                ),
              }))}
            />
          </div>
        )}

        {isSearching && (
          <div style={{ marginBottom: 8 }}>
            <Tag color="blue">검색: "{searchKeyword}" - {searchResults.length}건</Tag>
            <Button
              size="small"
              type="link"
              onClick={() => {
                setIsSearching(false);
                setSearchResults([]);
                openBrowser();
              }}
            >
              탐색 모드로 돌아가기
            </Button>
          </div>
        )}

        {/* 파일 목록 */}
        {browseLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Table
            dataSource={displayFiles}
            rowKey="path"
            pagination={displayFiles.length > 20 ? { pageSize: 20 } : false}
            size="small"
            columns={[
              {
                title: '이름',
                dataIndex: 'name',
                key: 'name',
                render: (name: string, record: any) => (
                  <Space>
                    {getFileIcon(record.isDirectory ? 'folder' : record.type)}
                    {record.isDirectory ? (
                      <a onClick={() => navigateToFolder(record.path)}>{name}</a>
                    ) : (
                      <Text>{name}</Text>
                    )}
                  </Space>
                ),
              },
              {
                title: '유형',
                dataIndex: 'type',
                key: 'type',
                width: 80,
                render: (type: string) => (
                  <Tag>{type === 'folder' ? '폴더' : type.toUpperCase()}</Tag>
                ),
              },
              {
                title: '크기',
                dataIndex: 'size',
                key: 'size',
                width: 90,
                render: (size: number, record: any) =>
                  record.isDirectory ? '-' : formatSize(size),
              },
              {
                title: '',
                key: 'action',
                width: 100,
                render: (_: any, record: any) =>
                  record.isDirectory ? null : (
                    <Space>
                      <Tooltip title={`${getCategoryLabel(selectedCategory)}로 첨부`}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={() => attachFile(record.path)}
                        >
                          첨부
                        </Button>
                      </Tooltip>
                    </Space>
                  ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default DocumentAttachment;
