const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

function getPrepareEnv(builderArgs) {
  const env = { ...process.env };

  if (builderArgs.includes('--win')) {
    env.METACELLS_DESKTOP_TARGET_PLATFORM = 'win32';
  } else if (builderArgs.includes('--linux')) {
    env.METACELLS_DESKTOP_TARGET_PLATFORM = 'linux';
  } else if (builderArgs.includes('--mac')) {
    env.METACELLS_DESKTOP_TARGET_PLATFORM = 'darwin';
  }

  if (builderArgs.includes('--arm64')) {
    env.METACELLS_DESKTOP_TARGET_ARCH = 'arm64';
  } else if (builderArgs.includes('--x64')) {
    env.METACELLS_DESKTOP_TARGET_ARCH = 'x64';
  }

  return env;
}

function normalizeBuilderArgs(builderArgs) {
  const normalizedArgs = [...builderArgs];
  const isWindowsBuild = normalizedArgs.includes('--win');
  const hasExplicitArch = normalizedArgs.includes('--x64') || normalizedArgs.includes('--arm64');

  // On Apple Silicon hosts, electron-builder may default Windows builds to arm64.
  // MongoDB 8.2.1 does not provide a matching Windows ARM64 binary, so default to x64
  // unless the caller explicitly asks for a different architecture.
  if (isWindowsBuild && !hasExplicitArch) {
    normalizedArgs.push('--x64');
  }

  return normalizedArgs;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: options.env || process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const builderCli = require.resolve('electron-builder/out/cli/cli.js');
  const builderArgs = normalizeBuilderArgs(process.argv.slice(2));

  await run(
    process.execPath,
    [path.join(projectRoot, 'scripts', 'desktop-prepare.cjs')],
    { env: getPrepareEnv(builderArgs) },
  );
  await run(process.execPath, [builderCli, ...builderArgs]);
}

main().catch((error) => {
  console.error('[desktop:package] failed');
  console.error(error);
  process.exit(1);
});
