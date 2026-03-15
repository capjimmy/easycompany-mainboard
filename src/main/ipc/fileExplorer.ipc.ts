import { ipcMain, shell, app as electronApp } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';

// 문서 경로는 반드시 설정에서 지정해야 함 (NAS/공유 폴더 권장)
function getFallbackVectorDbPath() {
  return path.join(electronApp.getPath('userData'), 'chroma_db');
}

async function getDocsPath(): Promise<string> {
  const docPath = (await db.getSetting('documentStoragePath')) || (await db.getSetting('docsBasePath'));
  if (!docPath) {
    throw new Error('문서 저장 경로가 설정되지 않았습니다. [설정 > 데이터]에서 문서 저장 경로(NAS/공유 폴더)를 지정해주세요.');
  }
  return docPath;
}

async function getVectorDbPath(): Promise<string> {
  return (await db.getSetting('vectorDbPath')) || getFallbackVectorDbPath();
}

// 파일 확장자에서 타입 추출
function getFileType(filePath: string): string {
  return path.extname(filePath).replace('.', '').toLowerCase();
}

// 파일 크기를 사람이 읽기 쉬운 형태로
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// 디렉토리 내용 읽기
function readDirectory(dirPath: string): any[] {
  try {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => !entry.name.startsWith('.') && entry.name !== '#recycle')
      .map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'folder' : getFileType(entry.name),
            size: entry.isDirectory() ? 0 : stats.size,
            isDirectory: entry.isDirectory(),
            modifiedAt: stats.mtime.toISOString(),
          };
        } catch {
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'folder' : getFileType(entry.name),
            size: 0,
            isDirectory: entry.isDirectory(),
            modifiedAt: new Date().toISOString(),
          };
        }
      })
      .sort((a, b) => {
        // 폴더 먼저, 그 다음 이름순
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  } catch (err: any) {
    console.error('Error reading directory:', err.message);
    return [];
  }
}

// 재귀적 파일 검색
function searchFiles(dirPath: string, keyword: string, results: any[] = [], maxResults: number = 100): any[] {
  if (results.length >= maxResults) return results;

  try {
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.name.startsWith('.') || entry.name === '#recycle' || entry.name === 'node_modules') continue;

      const fullPath = path.join(dirPath, entry.name);
      const lowerName = entry.name.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();

      if (entry.isDirectory()) {
        // 폴더명에 키워드가 포함되면 폴더 자체도 결과에 추가
        if (lowerName.includes(lowerKeyword)) {
          try {
            const stats = fs.statSync(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              type: 'folder',
              size: 0,
              isDirectory: true,
              modifiedAt: stats.mtime.toISOString(),
            });
          } catch {}
        }
        // 하위 폴더도 검색
        searchFiles(fullPath, keyword, results, maxResults);
      } else {
        // 파일명에 키워드가 포함되면 결과에 추가
        if (lowerName.includes(lowerKeyword)) {
          try {
            const stats = fs.statSync(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              type: getFileType(entry.name),
              size: stats.size,
              isDirectory: false,
              modifiedAt: stats.mtime.toISOString(),
            });
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('Error searching files:', err.message);
  }

  return results;
}

export function registerFileExplorerHandlers() {
  // 문서 경로 설정 가져오기
  ipcMain.handle('fileExplorer:getPaths', async () => {
    return {
      success: true,
      docsPath: await getDocsPath(),
      vectorDbPath: await getVectorDbPath(),
    };
  });

  // 문서 경로 설정 변경
  ipcMain.handle('fileExplorer:setPaths', async (_event, paths: { docsPath?: string; vectorDbPath?: string }) => {
    try {
      if (paths.docsPath) {
        await db.setSetting('docsBasePath', paths.docsPath);
      }
      if (paths.vectorDbPath) {
        await db.setSetting('vectorDbPath', paths.vectorDbPath);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 사용자 접근 가능 폴더 확인
  async function getAccessibleFolders(requesterId?: string): Promise<string[] | null> {
    if (!requesterId) return null;
    const user = await db.getUserById(requesterId);
    if (!user) return [];
    // super_admin은 전체 접근
    if (user.role === 'super_admin') return null;
    return user.accessible_folders || [];
  }

  // 경로가 접근 가능한지 확인
  function isPathAccessible(filePath: string, accessibleFolders: string[] | null): boolean {
    if (accessibleFolders === null) return true; // 제한 없음
    if (accessibleFolders.length === 0) return true; // 폴더 미설정이면 전체 허용
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return accessibleFolders.some(folder => {
      const normalizedFolder = folder.replace(/\\/g, '/').toLowerCase();
      return normalizedPath.startsWith(normalizedFolder);
    });
  }

  // 디렉토리 탐색
  ipcMain.handle('fileExplorer:browse', async (_event, dirPath?: string, requesterId?: string) => {
    try {
      const targetPath = dirPath || await getDocsPath();
      const accessibleFolders = await getAccessibleFolders(requesterId);

      // 탐색하려는 경로 자체가 접근 불가하면 차단
      if (accessibleFolders && accessibleFolders.length > 0 && !isPathAccessible(targetPath, accessibleFolders)) {
        return { success: false, error: '접근 권한이 없는 폴더입니다.', files: [] };
      }

      const files = readDirectory(targetPath);
      // 하위 항목도 접근 가능한 것만 필터
      const filteredFiles = accessibleFolders && accessibleFolders.length > 0
        ? files.filter((f: any) => isPathAccessible(f.path, accessibleFolders))
        : files;

      return {
        success: true,
        currentPath: targetPath,
        basePath: await getDocsPath(),
        files: filteredFiles,
        accessibleFolders: accessibleFolders,
      };
    } catch (err: any) {
      return { success: false, error: err.message, files: [] };
    }
  });

  // 파일 검색
  ipcMain.handle('fileExplorer:search', async (_event, keyword: string, basePath?: string, requesterId?: string) => {
    try {
      const targetPath = basePath || await getDocsPath();
      const accessibleFolders = await getAccessibleFolders(requesterId);
      const results = searchFiles(targetPath, keyword, [], 100);

      // 접근 가능한 파일만 필터
      const filteredResults = accessibleFolders && accessibleFolders.length > 0
        ? results.filter((f: any) => isPathAccessible(f.path, accessibleFolders))
        : results;

      return {
        success: true,
        keyword,
        results: filteredResults,
        total: filteredResults.length,
      };
    } catch (err: any) {
      return { success: false, error: err.message, results: [] };
    }
  });

  // 파일 열기 (기본 프로그램으로)
  ipcMain.handle('fileExplorer:openFile', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 파일이 위치한 폴더 열기
  ipcMain.handle('fileExplorer:openFolder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 첨부 문서 관리
  // ========================================

  // 문서 첨부
  ipcMain.handle('attachedDocs:add', async (_event, data: {
    parentType: 'quote' | 'contract';
    parentId: string;
    filePath: string;
    category: string;
    description?: string;
    attachedBy: string;
  }) => {
    try {
      const stats = fs.statSync(data.filePath);
      const doc = {
        id: uuidv4(),
        parent_type: data.parentType,
        parent_id: data.parentId,
        file_name: path.basename(data.filePath),
        file_path: data.filePath,
        file_type: getFileType(data.filePath),
        file_size: stats.size,
        category: data.category,
        description: data.description || '',
        attached_by: data.attachedBy,
        attached_at: new Date().toISOString(),
      };
      await db.addAttachedDocument(doc);
      return { success: true, document: doc };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 첨부 문서 목록 조회
  ipcMain.handle('attachedDocs:getByParent', async (_event, parentType: string, parentId: string) => {
    try {
      const docs = await db.getAttachedDocumentsByParent(parentType, parentId);
      // 각 문서의 파일 존재 여부 확인
      const docsWithStatus = docs.map((doc: any) => ({
        ...doc,
        fileExists: fs.existsSync(doc.file_path),
        fileSizeFormatted: formatFileSize(doc.file_size),
      }));
      return { success: true, documents: docsWithStatus };
    } catch (err: any) {
      return { success: false, error: err.message, documents: [] };
    }
  });

  // 첨부 문서 삭제 (파일 자체는 삭제하지 않음)
  ipcMain.handle('attachedDocs:remove', async (_event, docId: string) => {
    try {
      await db.deleteAttachedDocument(docId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 첨부 문서 카테고리 수정
  ipcMain.handle('attachedDocs:updateCategory', async (_event, docId: string, category: string) => {
    try {
      await db.updateAttachedDocument(docId, { category });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 첨부 문서 열기
  ipcMain.handle('attachedDocs:openFile', async (_event, docId: string) => {
    try {
      const doc = await db.getAttachedDocumentById(docId);
      if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
      if (!fs.existsSync(doc.file_path)) return { success: false, error: '파일이 존재하지 않습니다.' };
      await shell.openPath(doc.file_path);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
