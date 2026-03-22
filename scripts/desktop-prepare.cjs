const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(projectRoot, '.desktop-runtime');
const cacheRoot = path.join(projectRoot, '.desktop-cache');
const stagedBackendRoot = path.join(runtimeRoot, 'backend');
const targetPlatform = process.env.METACELLS_DESKTOP_TARGET_PLATFORM || process.platform;
const targetArch = process.env.METACELLS_DESKTOP_TARGET_ARCH || process.arch;
const BACKEND_RUNTIME_DEPENDENCIES = [
  'exifr',
  'express',
  'fast-xml-parser',
  'image-size',
  'imapflow',
  'jszip',
  'mammoth',
  'pdf-parse',
  'turndown',
  'turndown-plugin-gfm',
  'xlsx',
];

function getSpawnEnv() {
  const env = { ...process.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: getSpawnEnv(),
      ...options,
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDirRobust(dirPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error && error.code === 'ENOTEMPTY' && attempt < 4) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        continue;
      }
      throw error;
    }
  }
}

function copyRootNodeModules(bundleRoot) {
  const rootNodeModules = path.join(projectRoot, 'node_modules');
  const bundleNodeModules = path.join(bundleRoot, 'node_modules');
  if (!fs.existsSync(rootNodeModules)) {
    throw new Error('Cannot stage runtime dependencies: root node_modules is missing');
  }
  fs.cpSync(rootNodeModules, bundleNodeModules, { recursive: true });
}

function isCrossTargetBuild() {
  return targetPlatform !== process.platform || targetArch !== process.arch;
}

function readProjectPackageJson() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function buildDesktopRuntimePackageJson() {
  const rootPackageJson = readProjectPackageJson();
  const rootDependencies = rootPackageJson.dependencies || {};
  const dependencies = {};

  BACKEND_RUNTIME_DEPENDENCIES.forEach((name) => {
    if (!rootDependencies[name]) {
      throw new Error(`Missing runtime dependency "${name}" in root package.json`);
    }
    dependencies[name] = rootDependencies[name];
  });

  return {
    name: `${rootPackageJson.name || 'metacells'}-desktop-runtime`,
    private: true,
    type: 'module',
    version: rootPackageJson.version || '0.0.0',
    main: 'server.js',
    dependencies,
  };
}

async function stageServerBundle() {
  ensureDir(stagedBackendRoot);
  const bundleRoot = path.join(stagedBackendRoot, 'bundle');
  ensureDir(bundleRoot);

  const filesToCopy = ['server.js'];
  for (const file of filesToCopy) {
    const src = path.join(projectRoot, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(bundleRoot, file));
    }
  }

  const runtimePackageJson = buildDesktopRuntimePackageJson();
  fs.writeFileSync(
    path.join(bundleRoot, 'package.json'),
    JSON.stringify(runtimePackageJson, null, 2),
  );

  const directoriesToCopy = ['server', 'lib', 'imports'];
  for (const directory of directoriesToCopy) {
    const sourceDir = path.join(projectRoot, directory);
    if (fs.existsSync(sourceDir)) {
      fs.cpSync(sourceDir, path.join(bundleRoot, directory), { recursive: true });
    }
  }

  const clientDistSrc = path.join(projectRoot, 'dist', 'client');
  if (!fs.existsSync(clientDistSrc)) {
    await run('npm', ['run', 'build'], { cwd: projectRoot });
  }
  if (!fs.existsSync(clientDistSrc)) {
    throw new Error('Missing dist/client after build; cannot stage desktop frontend');
  }
  fs.cpSync(clientDistSrc, path.join(bundleRoot, 'dist', 'client'), { recursive: true });

  const npmCacheDir = path.join(cacheRoot, 'npm-cache');
  ensureDir(npmCacheDir);
  const installArgs = ['install', '--omit=dev', '--cache', npmCacheDir];
  if (isCrossTargetBuild()) {
    installArgs.push('--ignore-scripts');
  }

  try {
    await run('npm', installArgs, { cwd: bundleRoot });
  } catch (error) {
    if (isCrossTargetBuild()) {
      throw new Error(
        `Cross-target dependency staging failed for ${targetPlatform}/${targetArch}: ${error.message}`,
      );
    }
    console.warn('[desktop:prepare] npm install failed, falling back to copied workspace node_modules');
    console.warn(error.message);
    copyRootNodeModules(bundleRoot);
  }
}

function writeManifest() {
  const manifestPath = path.join(runtimeRoot, 'manifest.json');
  const manifest = {
    createdAt: new Date().toISOString(),
    backend: {
      main: 'backend/bundle/server.js',
    },
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function main() {
  removeDirRobust(runtimeRoot);
  ensureDir(runtimeRoot);

  await stageServerBundle();
  writeManifest();
  console.log('[desktop:prepare] ready', {
    runtimeRoot,
    targetPlatform,
    targetArch,
  });
}

main().catch((error) => {
  console.error('[desktop:prepare] failed');
  console.error(error);
  process.exit(1);
});
