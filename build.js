const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// .env.local 파싱하여 process.env에 주입 (main process에만 사용됨)
const envLocal = path.join(__dirname, '.env.local');
const envVars = {};
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) envVars[m[1]] = m[2].trim();
  }
}

async function build() {
  // dist 폴더 생성
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  if (!fs.existsSync('dist/main')) {
    fs.mkdirSync('dist/main', { recursive: true });
  }
  if (!fs.existsSync('dist/preload')) {
    fs.mkdirSync('dist/preload', { recursive: true });
  }
  if (!fs.existsSync('dist/renderer')) {
    fs.mkdirSync('dist/renderer', { recursive: true });
  }

  console.log('Building main process...');

  // Main process: esbuild 사용 — .env.local 키들을 process.env 값으로 주입
  // ⚠️ renderer/preload에는 SERVICE_ROLE_KEY 절대 노출 안 됨 (이 빌드는 main만)
  const mainDefine = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (envVars[k]) mainDefine[`process.env.${k}`] = JSON.stringify(envVars[k]);
  }
  await esbuild.build({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/main/index.js',
    format: 'cjs',
    external: ['electron', 'electron-store', 'pdf-parse', 'mammoth'],
    loader: {
      '.ts': 'ts',
      '.json': 'json',
    },
    define: mainDefine,
    sourcemap: true,
  });

  console.log('Building preload...');

  // Preload: esbuild 사용 (sandbox 환경용 iife 포맷)
  await esbuild.build({
    entryPoints: ['src/preload/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'chrome110',
    outfile: 'dist/preload/index.js',
    format: 'iife',
    external: ['electron'],
    loader: {
      '.ts': 'ts',
    },
    sourcemap: true,
    define: {
      'process.platform': '"win32"',
    },
  });

  console.log('Building renderer...');

  // Renderer: esbuild 사용 (React 번들링 필요)
  await esbuild.build({
    entryPoints: ['src/renderer/index.tsx'],
    bundle: true,
    platform: 'browser',
    target: 'chrome110',
    outfile: 'dist/renderer/index.js',
    format: 'iife',
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.css': 'css',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    sourcemap: true,
  });

  // Copy HTML
  fs.copyFileSync('src/renderer/index.html', 'dist/renderer/index.html');

  // Copy logo image for PDF generator
  if (fs.existsSync('build/image2.png')) {
    fs.copyFileSync('build/image2.png', path.join('dist', 'logo.png'));
    fs.copyFileSync('build/image2.png', path.join('dist', 'main', 'logo.png'));
    console.log('Logo image copied to dist/');
  }

  // Copy HWPX template files
  const templatesDir = path.join('resources', 'templates');
  const distTemplatesDir = path.join('dist', 'templates');
  if (fs.existsSync(templatesDir)) {
    if (!fs.existsSync(distTemplatesDir)) {
      fs.mkdirSync(distTemplatesDir, { recursive: true });
    }
    for (const file of fs.readdirSync(templatesDir)) {
      if (file.endsWith('.hwpx') || file.endsWith('.xlsx') || file.endsWith('.docx')) {
        fs.copyFileSync(path.join(templatesDir, file), path.join(distTemplatesDir, file));
      }
    }
  }

  console.log('Build completed!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
