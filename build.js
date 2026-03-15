const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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

  // Main process: esbuild 사용
  await esbuild.build({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/main/index.js',
    format: 'cjs',
    external: ['electron', 'electron-store'],
    loader: {
      '.ts': 'ts',
      '.json': 'json',
    },
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

  // Copy HWPX template files
  const templatesDir = path.join('resources', 'templates');
  const distTemplatesDir = path.join('dist', 'templates');
  if (fs.existsSync(templatesDir)) {
    if (!fs.existsSync(distTemplatesDir)) {
      fs.mkdirSync(distTemplatesDir, { recursive: true });
    }
    for (const file of fs.readdirSync(templatesDir)) {
      if (file.endsWith('.hwpx')) {
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
