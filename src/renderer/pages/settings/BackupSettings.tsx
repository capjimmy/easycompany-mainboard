import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Typography,
  List,
  Tag,
  Progress,
  Alert,
  Divider,
  Modal,
  Switch,
  InputNumber,
  Form,
} from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;

interface BackupRecord {
  id: string;
  filename: string;
  size: string;
  created_at: string;
  type: 'manual' | 'auto';
  status: 'completed' | 'failed';
}

const BackupSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backupInterval, setBackupInterval] = useState(7);

  // 백업 목록 조회 (더미 데이터)
  const fetchBackups = async () => {
    setLoading(true);
    // TODO: API 연동 시 실제 데이터로 교체
    const dummyData: BackupRecord[] = [
      {
        id: '1',
        filename: 'backup_2024-12-01_103045.json',
        size: '2.3 MB',
        created_at: '2024-12-01 10:30:45',
        type: 'auto',
        status: 'completed',
      },
      {
        id: '2',
        filename: 'backup_2024-11-24_093012.json',
        size: '2.1 MB',
        created_at: '2024-11-24 09:30:12',
        type: 'auto',
        status: 'completed',
      },
      {
        id: '3',
        filename: 'backup_2024-11-20_143520.json',
        size: '2.0 MB',
        created_at: '2024-11-20 14:35:20',
        type: 'manual',
        status: 'completed',
      },
    ];
    setBackups(dummyData);
    setLoading(false);
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleExport = async () => {
    if (!user) return;

    setExporting(true);
    try {
      const result = await window.api.settings.exportData(user.id);
      if (result.success) {
        message.success('백업이 완료되었습니다.');
        fetchBackups();
      } else if (result.canceled) {
        message.info('백업이 취소되었습니다.');
      } else {
        message.error(result.error || '백업에 실패했습니다.');
      }
    } catch (error) {
      message.error('백업 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!user) return;

    Modal.confirm({
      title: '데이터 복원',
      content: (
        <div>
          <Paragraph>
            백업 파일에서 데이터를 복원합니다. 현재 데이터가 백업 파일의 데이터로 교체됩니다.
          </Paragraph>
          <Alert
            type="warning"
            message="주의: 이 작업은 되돌릴 수 없습니다. 복원 전 현재 데이터를 백업하시기 바랍니다."
          />
        </div>
      ),
      okText: '복원',
      cancelText: '취소',
      onOk: async () => {
        setImporting(true);
        try {
          const result = await window.api.settings.importData(user.id);
          if (result.success) {
            message.success('데이터가 복원되었습니다. 앱을 재시작합니다.');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else if (result.canceled) {
            message.info('복원이 취소되었습니다.');
          } else {
            message.error(result.error || '복원에 실패했습니다.');
          }
        } catch (error) {
          message.error('복원 중 오류가 발생했습니다.');
        } finally {
          setImporting(false);
        }
      },
    });
  };

  const canManageBackup = user?.role === 'super_admin' || user?.role === 'company_admin';

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>백업 관리</Title>
        <Space>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
          >
            자동 백업 설정
          </Button>
        </Space>
      </div>

      {/* 백업/복원 액션 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <div>
            <Title level={5}>데이터 백업</Title>
            <Text type="secondary">현재 모든 데이터를 JSON 파일로 내보냅니다.</Text>
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={exporting}
                onClick={handleExport}
                disabled={!canManageBackup}
              >
                백업 시작
              </Button>
            </div>
          </div>

          <Divider type="vertical" style={{ height: 80 }} />

          <div>
            <Title level={5}>데이터 복원</Title>
            <Text type="secondary">백업 파일에서 데이터를 복원합니다.</Text>
            <div style={{ marginTop: 16 }}>
              <Button
                icon={<CloudDownloadOutlined />}
                loading={importing}
                onClick={handleImport}
                disabled={user?.role !== 'super_admin'}
              >
                복원
              </Button>
            </div>
          </div>
        </Space>

        {!canManageBackup && (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            message="백업 및 복원은 관리자만 수행할 수 있습니다."
          />
        )}
      </Card>

      {/* 백업 이력 */}
      <Card title={<Space><HistoryOutlined /> 백업 이력</Space>}>
        <List
          loading={loading}
          dataSource={backups}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="link"
                  icon={<CloudDownloadOutlined />}
                  disabled
                >
                  다운로드
                </Button>,
                <Button
                  key="delete"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  disabled
                >
                  삭제
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  item.status === 'completed' ? (
                    <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                  ) : (
                    <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />
                  )
                }
                title={
                  <Space>
                    {item.filename}
                    <Tag color={item.type === 'auto' ? 'blue' : 'green'}>
                      {item.type === 'auto' ? '자동' : '수동'}
                    </Tag>
                  </Space>
                }
                description={
                  <Space>
                    <Text type="secondary">{item.created_at}</Text>
                    <Text type="secondary">|</Text>
                    <Text type="secondary">{item.size}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '백업 이력이 없습니다.' }}
        />
      </Card>

      {/* 자동 백업 설정 모달 */}
      <Modal
        title="자동 백업 설정"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsVisible(false)}>
            취소
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={() => {
              message.success('설정이 저장되었습니다.');
              setSettingsVisible(false);
            }}
          >
            저장
          </Button>,
        ]}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="자동 백업 활성화">
            <Switch
              checked={autoBackupEnabled}
              onChange={setAutoBackupEnabled}
            />
          </Form.Item>

          <Form.Item label="백업 주기 (일)">
            <InputNumber
              min={1}
              max={30}
              value={backupInterval}
              onChange={(v) => setBackupInterval(v || 7)}
              disabled={!autoBackupEnabled}
              addonAfter="일마다"
            />
          </Form.Item>

          <Alert
            type="info"
            message={`현재 설정: ${autoBackupEnabled ? `${backupInterval}일마다 자동 백업` : '자동 백업 비활성화'}`}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default BackupSettings;
