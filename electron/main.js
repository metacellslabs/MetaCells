const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_URL = 'http://127.0.0.1:3400';

let backendState = null;
let mainWindow = null;

function getDesktopUrl() {
  return process.env.METACELLS_DESKTOP_URL || DEFAULT_URL;
}

function getBundledRuntimeRoot() {
  const runtimeRoot = path.join(process.resourcesPath, 'desktop-runtime');
  const manifestPath = path.join(runtimeRoot, 'manifest.json');

  if (!app.isPackaged || !fs.existsSync(manifestPath)) {
    return null;
  }

  return runtimeRoot;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPage(title, body, footer = '') {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #f7f7f5 0%, #ece9e0 100%);
        color: #1f2937;
      }
      main {
        width: min(700px, calc(100vw - 48px));
        padding: 28px 30px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.12);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 28px;
      }
      p {
        margin: 0 0 14px;
        line-height: 1.45;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
      pre {
        margin: 14px 0 0;
        padding: 14px;
        overflow: auto;
        border-radius: 12px;
        background: #111827;
        color: #f9fafb;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        white-space: pre-wrap;
      }
      .muted {
        color: #6b7280;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      ${body}
      ${footer ? `<pre>${escapeHtml(footer)}</pre>` : ''}
    </main>
  </body>
</html>`;
}

function showPage(window, title, body, footer = '') {
  window.loadURL(
    `data:text/html;charset=UTF-8,${encodeURIComponent(buildPage(title, body, footer))}`,
  );
}

function showStartupStatus(window, message, detail = '') {
  showPage(
    window,
    'Starting MetaCells',
    `<p>${escapeHtml(message)}</p><p class="muted">The bundled backend is starting inside the app.</p>`,
    detail,
  );
}

function showBackendError(window, url, errorText) {
  showPage(
    window,
    'MetaCells backend is not reachable',
    `<p>The desktop shell is trying to open <code>${escapeHtml(url)}</code>, but that server is not responding.</p>
<p>For this build, start the Meteor app first with <code>npm start</code>, launch Electron in development with <code>npm run desktop:dev</code>, or package a self-contained app with <code>npm run desktop:dist:mac</code>.</p>`,
    errorText,
  );
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      showBackendError(window, validatedURL || getDesktopUrl(), `${errorCode} ${errorDescription}`.trim());
    },
  );

  return window;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for tcp://127.0.0.1:${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };

    tryConnect();
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reachable = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      });
      request.on('error', () => resolve(false));
      request.setTimeout(1000, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (reachable) return;
    await wait(750);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function pipeLogs(logPath, child, name) {
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  if (child.stdout) child.stdout.pipe(stream);
  if (child.stderr) child.stderr.pipe(stream);
  child.on('exit', (code, signal) => {
    stream.write(`\n[${name}] exited code=${code} signal=${signal}\n`);
    stream.end();
  });
}

async function startBundledBackend(window, runtimeRoot) {
  const manifestPath = path.join(runtimeRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const userDataRoot = app.getPath('userData');
  const logsDir = path.join(userDataRoot, 'logs');
  const mongoDataDir = path.join(userDataRoot, 'mongo-data');

  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(mongoDataDir, { recursive: true });

  const mongoPort = await getFreePort();
  const appPort = await getFreePort();
  const mongoUrl = `mongodb://127.0.0.1:${mongoPort}/metacells`;
  const appUrl = `http://127.0.0.1:${appPort}`;

  showStartupStatus(window, 'Starting local database');
  const mongoBinary = path.join(runtimeRoot, manifest.mongo.binary);
  const mongoProcess = spawn(
    mongoBinary,
    ['--dbpath', mongoDataDir, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--nounixsocket'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  pipeLogs(path.join(logsDir, 'mongodb.log'), mongoProcess, 'mongod');
  await waitForPort(mongoPort, 30000);

  showStartupStatus(window, 'Starting bundled Meteor server', `MONGO_URL=${mongoUrl}\nROOT_URL=${appUrl}`);
  const nodeBinary = path.join(runtimeRoot, manifest.node.binary);
  const serverEntry = path.join(runtimeRoot, manifest.backend.main);
  const serverProcess = spawn(nodeBinary, [serverEntry], {
    cwd: path.dirname(serverEntry),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(appPort),
      ROOT_URL: appUrl,
      MONGO_URL: mongoUrl,
      BIND_IP: '127.0.0.1',
      METACELLS_ROLE: 'web',
      NODE_ENV: 'production',
    },
  });
  pipeLogs(path.join(logsDir, 'server.log'), serverProcess, 'meteor');

  backendState = {
    appUrl,
    mongoProcess,
    serverProcess,
  };

  await waitForHttp(appUrl, 60000);
  return appUrl;
}

function stopBundledBackend() {
  if (!backendState) return;
  const { serverProcess, mongoProcess } = backendState;
  backendState = null;

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
  if (mongoProcess && !mongoProcess.killed) {
    mongoProcess.kill('SIGTERM');
  }
}

async function resolveLaunchUrl(window) {
  const runtimeRoot = getBundledRuntimeRoot();
  if (runtimeRoot) {
    return startBundledBackend(window, runtimeRoot);
  }
  return getDesktopUrl();
}

app.whenReady().then(async () => {
  mainWindow = createWindow();
  showStartupStatus(mainWindow, 'Preparing application window');

  try {
    const targetUrl = await resolveLaunchUrl(mainWindow);
    await mainWindow.loadURL(targetUrl);
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } catch (error) {
    showBackendError(
      mainWindow,
      getDesktopUrl(),
      error && error.stack ? error.stack : String(error),
    );
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      try {
        const targetUrl = backendState?.appUrl || (await resolveLaunchUrl(mainWindow));
        await mainWindow.loadURL(targetUrl);
      } catch (error) {
        showBackendError(
          mainWindow,
          getDesktopUrl(),
          error && error.stack ? error.stack : String(error),
        );
      }
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBundledBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
