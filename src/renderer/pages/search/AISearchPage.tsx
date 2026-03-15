import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Typography, Input, Button, Space, Tag, Spin, Empty, Collapse,
  Row, Col, Select, Modal, Form, message, Tooltip, Divider
} from 'antd';
import {
  SearchOutlined, RobotOutlined, FileTextOutlined, SettingOutlined,
  SendOutlined, ClearOutlined, InfoCircleOutlined, LoadingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;
const { Option } = Select;

interface SearchResult {
  id: string;
  document: string;
  metadata: {
    file_name?: string;
    file_path?: string;
    category?: string;
    department?: string;
    file_type?: string;
    chunk_index?: number;
    [key: string]: any;
  };
  distance: number;
  similarity: number;
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

const AISearchPage: React.FC = () => {
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterFileType, setFilterFileType] = useState<string | undefined>();
  const [nResults, setNResults] = useState(10);

  // Settings
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [chromaPath, setChromaPath] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [processRunning, setProcessRunning] = useState(false);

  const searchInputRef = useRef<any>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.aiSearch.getSettings(user.id);
      if (result.success) {
        setHasApiKey(result.settings.hasApiKey);
        setChromaPath(result.settings.chromaPath);
        setProcessRunning(result.settings.isProcessRunning);
      }
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      message.warning('검색어를 입력해주세요.');
      return;
    }
    if (!user?.id) return;

    setIsSearching(true);
    setSearchResults([]);
    setAiAnswer('');
    setAiModel('');

    try {
      const filters: any = {};
      if (filterCategory) filters.category = filterCategory;
      if (filterFileType) filters.file_type = filterFileType;

      const result = await window.electronAPI.aiSearch.search(user.id, query, {
        n_results: nResults,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      if (result.success) {
        setSearchResults(result.results || []);
        setSearchTotal(result.total || 0);

        // Add to search history
        setSearchHistory(prev => {
          const filtered = prev.filter(h => h.query !== query);
          return [{ query, timestamp: Date.now() }, ...filtered].slice(0, 10);
        });

        // Auto-ask AI if we have results and API key
        if (result.results && result.results.length > 0 && hasApiKey) {
          askAI(result.results);
        }
      } else {
        message.error(result.error || '검색에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err.message || '검색 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const askAI = async (results?: SearchResult[]) => {
    if (!user?.id) return;
    const resultsToUse = results || searchResults;
    if (resultsToUse.length === 0) {
      message.warning('먼저 검색을 실행해주세요.');
      return;
    }

    setIsAskingAI(true);

    try {
      const result = await window.electronAPI.aiSearch.askAI(user.id, query, resultsToUse);

      if (result.success) {
        setAiAnswer(result.answer);
        setAiModel(result.model || '');
      } else {
        if (result.error?.includes('API 키')) {
          message.warning('OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        } else {
          message.error(result.error || 'AI 답변 생성에 실패했습니다.');
        }
      }
    } catch (err: any) {
      message.error(err.message || 'AI 답변 오류가 발생했습니다.');
    } finally {
      setIsAskingAI(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;

    try {
      const settings: any = {};
      if (apiKey) settings.apiKey = apiKey;
      if (chromaPath) settings.chromaPath = chromaPath;

      const result = await window.electronAPI.aiSearch.saveSettings(user.id, settings);
      if (result.success) {
        message.success('설정이 저장되었습니다.');
        setSettingsVisible(false);
        setApiKey('');
        loadSettings();
      } else {
        message.error(result.error || '설정 저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err.message || '설정 저장 오류');
    }
  };

  const clearResults = () => {
    setSearchResults([]);
    setAiAnswer('');
    setAiModel('');
    setSearchTotal(0);
    setQuery('');
  };

  const getCategoryColor = (category?: string): string => {
    const colors: Record<string, string> = {
      '견적서': 'blue',
      '계약서': 'green',
      '보고서': 'orange',
      '제안서': 'purple',
      '공문': 'cyan',
    };
    return colors[category || ''] || 'default';
  };

  const getFileTypeIcon = (fileType?: string): string => {
    const icons: Record<string, string> = {
      'pdf': 'PDF',
      'xlsx': 'XLSX',
      'docx': 'DOCX',
      'pptx': 'PPTX',
      'hwp': 'HWP',
    };
    return icons[fileType || ''] || fileType?.toUpperCase() || 'FILE';
  };

  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8 }} />
            AI 검색
          </Title>
          <Text type="secondary">벡터 데이터베이스 기반 의미 검색 + AI 답변</Text>
        </div>
        <Space>
          {isAdmin && (
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsVisible(true)}
            >
              설정
            </Button>
          )}
        </Space>
      </div>

      {/* Search Bar */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문서에서 찾고 싶은 내용을 자연어로 입력하세요. 예: '친환경 인증 컨설팅 관련 계약서'"
            autoSize={{ minRows: 1, maxRows: 3 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSearch();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={isSearching ? <LoadingOutlined /> : <SearchOutlined />}
            onClick={handleSearch}
            loading={isSearching}
            size="large"
            style={{ height: 'auto' }}
          >
            검색
          </Button>
        </div>

        {/* Filters */}
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>필터:</Text>
          <Select
            placeholder="카테고리"
            allowClear
            value={filterCategory}
            onChange={setFilterCategory}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="견적서">견적서</Option>
            <Option value="계약서">계약서</Option>
            <Option value="보고서">보고서</Option>
            <Option value="제안서">제안서</Option>
            <Option value="공문">공문</Option>
          </Select>
          <Select
            placeholder="파일유형"
            allowClear
            value={filterFileType}
            onChange={setFilterFileType}
            style={{ width: 100 }}
            size="small"
          >
            <Option value="pdf">PDF</Option>
            <Option value="xlsx">XLSX</Option>
            <Option value="docx">DOCX</Option>
            <Option value="hwp">HWP</Option>
          </Select>
          <Select
            value={nResults}
            onChange={setNResults}
            style={{ width: 100 }}
            size="small"
          >
            <Option value={5}>5건</Option>
            <Option value={10}>10건</Option>
            <Option value={20}>20건</Option>
            <Option value={30}>30건</Option>
          </Select>
          {(searchResults.length > 0 || aiAnswer) && (
            <Button size="small" icon={<ClearOutlined />} onClick={clearResults}>
              초기화
            </Button>
          )}
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && !searchResults.length && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>최근 검색: </Text>
            {searchHistory.slice(0, 5).map((h, i) => (
              <Tag
                key={i}
                style={{ cursor: 'pointer', marginTop: 4 }}
                onClick={() => {
                  setQuery(h.query);
                }}
              >
                {h.query}
              </Tag>
            ))}
          </div>
        )}
      </Card>

      {/* AI Answer */}
      {(aiAnswer || isAskingAI) && (
        <Card
          style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#1890ff' }} />
              <Text strong>AI 답변</Text>
              {aiModel && <Tag color="blue" style={{ fontSize: 11 }}>{aiModel}</Tag>}
            </Space>
          }
        >
          {isAskingAI ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">AI가 답변을 생성하고 있습니다...</Text>
              </div>
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {aiAnswer}
            </div>
          )}
        </Card>
      )}

      {/* Search Results */}
      {isSearching ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">문서를 검색하고 있습니다...</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                (첫 검색 시 모델 로딩으로 시간이 소요될 수 있습니다)
              </Text>
            </div>
          </div>
        </Card>
      ) : searchResults.length > 0 ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">
              검색 결과: {searchTotal}건
            </Text>
            {!aiAnswer && !isAskingAI && hasApiKey && (
              <Button
                type="link"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => askAI()}
                style={{ marginLeft: 8 }}
              >
                AI 답변 받기
              </Button>
            )}
          </div>

          <Collapse
            defaultActiveKey={searchResults.slice(0, 3).map((_, i) => i.toString())}
            style={{ background: 'transparent' }}
          >
            {searchResults.map((result, index) => (
              <Panel
                key={index.toString()}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Tag color={getCategoryColor(result.metadata?.category)}>
                      {result.metadata?.category || '기타'}
                    </Tag>
                    <Tag>{getFileTypeIcon(result.metadata?.file_type)}</Tag>
                    <Text strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.metadata?.file_name || '알 수 없는 파일'}
                    </Text>
                    <Tooltip title="유사도">
                      <Tag color={result.similarity > 0.7 ? 'green' : result.similarity > 0.5 ? 'orange' : 'default'}>
                        {(result.similarity * 100).toFixed(1)}%
                      </Tag>
                    </Tooltip>
                  </div>
                }
              >
                <div style={{ padding: '8px 0' }}>
                  {/* Document content */}
                  <div
                    style={{
                      background: '#fafafa',
                      padding: 12,
                      borderRadius: 6,
                      maxHeight: 300,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {result.document}
                  </div>

                  {/* Metadata */}
                  <div style={{ marginTop: 8 }}>
                    <Space wrap size={[8, 4]}>
                      {result.metadata?.file_path && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <FileTextOutlined /> {result.metadata.file_path}
                        </Text>
                      )}
                      {result.metadata?.chunk_index !== undefined && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          청크 #{result.metadata.chunk_index}
                        </Text>
                      )}
                    </Space>
                  </div>
                </div>
              </Panel>
            ))}
          </Collapse>
        </div>
      ) : query && !isSearching ? (
        <Card>
          <Empty description="검색 결과가 없습니다." />
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: 48 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <div>
              <Title level={5} type="secondary">AI 문서 검색</Title>
              <Text type="secondary">
                벡터 데이터베이스에 저장된 문서들을 의미 기반으로 검색합니다.
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                자연어로 질문하면 관련 문서를 찾아 AI가 답변을 생성합니다.
              </Text>
            </div>
          </div>
        </Card>
      )}

      {/* Settings Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>AI 검색 설정</span>
          </Space>
        }
        open={settingsVisible}
        onOk={handleSaveSettings}
        onCancel={() => { setSettingsVisible(false); setApiKey(''); }}
        okText="저장"
        cancelText="취소"
      >
        <Form layout="vertical">
          <Form.Item
            label="OpenAI API 키"
            help={hasApiKey ? '이미 설정됨 (변경하려면 새 키를 입력하세요)' : '아직 설정되지 않았습니다'}
          >
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? '새 API 키 입력 (변경 시)' : 'sk-...'}
            />
          </Form.Item>

          <Form.Item
            label="ChromaDB 경로"
            help={`현재: ${chromaPath || '기본 경로'}`}
          >
            <Input
              value={chromaPath}
              onChange={(e) => setChromaPath(e.target.value)}
              placeholder="벡터 DB 경로 (예: E:/easydocs_vectordb/chroma_db)"
            />
          </Form.Item>

          <Divider />

          <div>
            <Text type="secondary">
              <InfoCircleOutlined /> 검색 엔진 상태: {' '}
              {processRunning ? (
                <Tag color="green">실행 중</Tag>
              ) : (
                <Tag>대기 중 (첫 검색 시 자동 시작)</Tag>
              )}
            </Text>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AISearchPage;
