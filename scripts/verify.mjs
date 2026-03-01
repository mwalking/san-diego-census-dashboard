import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runScript(scriptName) {
  console.log(`\n> npm run ${scriptName}`);
  const result = spawnSync('npm', ['run', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

runScript('format:check');
runScript('lint');

if (packageJson.scripts?.build) {
  runScript('build');
} else {
  console.log('\nNo build script found in package.json; skipping build step.');
}
