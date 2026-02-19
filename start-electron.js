// Start electron without ELECTRON_RUN_AS_NODE
const { spawn } = require('child_process');
const path = require('path');

// Get electron path
const electronPath = require('electron');

// Remove ELECTRON_RUN_AS_NODE from environment
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('Starting Electron...');
console.log('Electron path:', electronPath);

const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: env
});

child.on('close', (code) => {
  console.log(`Electron exited with code ${code}`);
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});
