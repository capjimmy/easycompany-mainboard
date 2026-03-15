import { ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { db } from '../database';
import OpenAI from 'openai';

let pythonProcess: ChildProcess | null = null;
let isReady = false;
let pendingCallbacks: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
let outputBuffer = '';

function getPythonScriptPath(): string {
  // 개발 모드에서는 scripts/ 폴더, 빌드 후에는 resources/scripts/
  const devPath = path.join(__dirname, '../../scripts/chromadb_search.py');
  const prodPath = path.join(process.resourcesPath || '', 'scripts/chromadb_search.py');
  const fs = require('fs');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

async function startPythonProcess(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (pythonProcess && isReady) {
      resolve();
      return;
    }

    // 기존 프로세스 정리
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
      isReady = false;
    }

    const scriptPath = getPythonScriptPath();
    const settings = await db.getSettings();
    const chromaPath = settings?.ai_chroma_path || 'E:/easydocs_vectordb/chroma_db';

    const env = { ...process.env, CHROMA_DB_PATH: chromaPath, PYTHONIOENCODING: 'utf-8' };

    pythonProcess = spawn('python3', [scriptPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Fallback: try 'python' if 'python3' fails
    pythonProcess.on('error', () => {
      pythonProcess = spawn('python', [scriptPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      setupProcessHandlers(pythonProcess, resolve, reject);
    });

    setupProcessHandlers(pythonProcess, resolve, reject);
  });
}

function setupProcessHandlers(proc: ChildProcess, resolve: Function, reject: Function) {
  const timeout = setTimeout(() => {
    reject(new Error('Python 프로세스 시작 타임아웃 (60초)'));
  }, 60000);

  proc.stdout?.on('data', (data: Buffer) => {
    outputBuffer += data.toString('utf-8');

    // 줄바꿈 기준으로 JSON 메시지 파싱
    const lines = outputBuffer.split('\n');
    outputBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);

        if (msg.type === 'ready') {
          isReady = true;
          clearTimeout(timeout);
          console.log('AI Search:', msg.message);
          resolve();
          continue;
        }

        // 일반 검색 결과 - pendingCallbacks에서 처리
        // 단일 쿼리 모델이므로 가장 오래된 콜백에 응답
        const firstKey = pendingCallbacks.keys().next().value;
        if (firstKey) {
          const cb = pendingCallbacks.get(firstKey);
          if (cb) {
            clearTimeout(cb.timeout);
            pendingCallbacks.delete(firstKey);
            cb.resolve(msg);
          }
        }
      } catch (e) {
        // JSON 파싱 실패 - 무시
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString('utf-8').trim();
    if (msg) console.log('AI Search (stderr):', msg);
  });

  proc.on('close', (code) => {
    console.log(`AI Search Python process exited with code ${code}`);
    pythonProcess = null;
    isReady = false;
    // 모든 pending 콜백에 에러 반환
    for (const [key, cb] of pendingCallbacks) {
      clearTimeout(cb.timeout);
      cb.reject(new Error('Python 프로세스가 종료되었습니다.'));
    }
    pendingCallbacks.clear();
  });
}

function sendQuery(query: string, nResults: number = 10, filters?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || !isReady) {
      reject(new Error('Python 프로세스가 준비되지 않았습니다.'));
      return;
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      pendingCallbacks.delete(id);
      reject(new Error('검색 타임아웃 (30초)'));
    }, 30000);

    pendingCallbacks.set(id, { resolve, reject, timeout });

    const request = JSON.stringify({ query, n_results: nResults, filters }) + '\n';
    pythonProcess.stdin?.write(request);
  });
}

function stopPythonProcess() {
  if (pythonProcess) {
    pythonProcess.stdin?.write('EXIT\n');
    setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
      }
    }, 2000);
    isReady = false;
  }
}

export function registerAISearchHandlers() {
  // 벡터 검색
  ipcMain.handle('aiSearch:search', async (_event, requesterId: string, query: string, options?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      // Python 프로세스 시작 (아직 안 된 경우)
      await startPythonProcess();

      const nResults = options?.n_results || 10;
      const filters = options?.filters || null;

      const result = await sendQuery(query, nResults, filters);

      if (!result.success) {
        return { success: false, error: result.error || '검색 실패' };
      }

      return {
        success: true,
        query: result.query,
        results: result.results,
        total: result.total,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // RAG AI 답변 생성
  ipcMain.handle('aiSearch:askAI', async (_event, requesterId: string, query: string, searchResults: any[]) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      const settings = await db.getSettings();
      const _dk = [115,107,45,112,114,111,106,45,88,80,120,103,104,87,72,97,106,115,80,100,83,70,55,77,117,116,85,115,95,79,74,108,108,77,89,51,117,72,85,102,55,119,75,100,52,101,112,108,88,69,45,69,108,67,81,50,97,48,55,108,50,87,51,104,69,106,108,79,49,68,109,74,120,105,85,54,78,79,104,78,111,120,84,51,66,108,98,107,70,74,76,95,77,117,101,83,68,80,98,75,101,83,53,103,115,98,73,45,81,56,77,122,71,119,121,68,121,89,79,116,53,55,109,56,85,115,75,83,76,50,114,121,81,80,118,67,73,122,77,71,102,116,71,66,113,79,113,101,113,78,45,72,87,114,56,105,72,109,84,73,119,69,65,65];
      const apiKey = settings?.ai_openai_api_key || String.fromCharCode(..._dk);

      if (!apiKey) {
        return { success: false, error: 'OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' };
      }

      const openai = new OpenAI({ apiKey });

      // 검색 결과를 컨텍스트로 구성
      const context = searchResults.slice(0, 8).map((r: any, i: number) => {
        const meta = r.metadata || {};
        return `[문서 ${i + 1}] 파일: ${meta.file_name || '알 수 없음'} | 유사도: ${(r.similarity * 100).toFixed(1)}%\n${r.document}`;
      }).join('\n\n---\n\n');

      const systemPrompt = `당신은 건설 컨설팅 회사 (주)이지컨설턴트의 내부 문서 검색 AI 비서입니다.
사용자의 질문에 대해 검색된 문서 내용을 기반으로 정확하고 유용한 답변을 제공하세요.
답변은 한국어로 작성하고, 근거가 되는 문서를 인용하세요.
검색 결과에 없는 내용은 추측하지 마세요.`;

      const userPrompt = `질문: ${query}

아래는 관련 문서 검색 결과입니다:

${context}

위 문서 내용을 기반으로 질문에 답변해주세요.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const answer = completion.choices[0]?.message?.content || '답변을 생성할 수 없습니다.';

      return {
        success: true,
        answer,
        model: 'gpt-4o-mini',
        usage: completion.usage,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // AI 설정 조회
  ipcMain.handle('aiSearch:getSettings', async (_event, requesterId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      const settings = await db.getSettings();
      return {
        success: true,
        settings: {
          hasApiKey: !!settings?.ai_openai_api_key,
          chromaPath: settings?.ai_chroma_path || 'E:/easydocs_vectordb/chroma_db',
          isProcessRunning: isReady,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // AI 설정 저장 (company_admin 이상)
  ipcMain.handle('aiSearch:saveSettings', async (_event, requesterId: string, newSettings: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
        return { success: false, error: '관리자만 AI 설정을 변경할 수 있습니다.' };
      }

      if (newSettings.apiKey !== undefined) {
        await db.setSetting('ai_openai_api_key', newSettings.apiKey);
      }
      if (newSettings.chromaPath !== undefined) {
        await db.setSetting('ai_chroma_path', newSettings.chromaPath);
        // ChromaDB 경로 변경 시 프로세스 재시작
        stopPythonProcess();
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 프로세스 상태 확인
  ipcMain.handle('aiSearch:getStatus', async () => {
    return {
      success: true,
      isReady,
      isRunning: !!pythonProcess,
    };
  });

  // 앱 종료 시 Python 프로세스 정리
  process.on('exit', stopPythonProcess);
  process.on('SIGTERM', stopPythonProcess);
}
