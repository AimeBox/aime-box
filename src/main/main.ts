import path, { join, normalize } from 'path';
import Electron, {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  protocol,
  net,
  Tray,
  Menu,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { dbManager } from './db';
import { chatManager } from './chat';
import { toolsManager } from './tools';
import { agentManager } from './agents';
import settingsManager from './settings';
import { kbManager } from './knowledgebase';

import providersManager from './providers';
import ipcListener from './ipc/ipcListener';
import isDev from 'electron-is-dev';
import '../i18n/index';
import { t } from 'i18next';
import { platform } from 'node:process';
import { pluginsManager } from './plugins/PluginsManager';
import { pathToFileURL } from 'url';
import { env } from '@huggingface/transformers';
import serverManager from './server/serverManager';
import { appManager } from './app/AppManager';
import promptsManager from './prompts';
import fs from 'fs';
import { exec } from 'node:child_process';
import { notificationManager } from './app/NotificationManager';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import tokenCounter from './utils/tokenCounter';
import { getChatModel } from './llm';
import { getAssetPath } from './utils/path';

dbManager
  .init()
  .then(async () => {
    await chatManager.init();
    await settingsManager.loadSettings();
    await kbManager.init();
    await toolsManager.init();
    await providersManager.getProviders();
    await agentManager.init();
    await pluginsManager.init();
    await serverManager.init();
    await appManager.init();
    await promptsManager.init();

    return true;
  })
  .catch((error) => {
    console.log(error);
    dialog.showErrorBox(
      '应用错误',
      `发生了一个错误: ${error.message}\n ${error.stack}`,
    );
  });

let tray: Tray | null = null;

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // dialog.showErrorBox(
  //   '应用错误',
  //   `发生了一个错误: ${error.message}\n ${error.stack}`,
  // );
  // 可以在这里记录错误日志或显示错误对话框
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  // dialog.showErrorBox('应用错误', `发生了一个错误: ${reason}`);

  // 处理未捕获的 Promise 拒绝
});

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;

    // autoUpdater.setFeedURL({
    //   provider: 'generic',
    //   url: `https://xxxxx.com/aimebox/download/${process.platform}`,
    //   updaterCacheDirName: 'aime-box-updater',
    // });

    autoUpdater.on('error', (err, msg) => {
      console.log(err, msg);
    });
    autoUpdater.on('checking-for-update', () => {
      console.log('checking-for-update');
    });
    autoUpdater.on('update-available', (info) => {
      console.log('update-available', info);
    });
    autoUpdater.on('download-progress', (info) => {
      console.log('download-progress', info);
    });
    autoUpdater.on('update-downloaded', (event) => {
      console.log('update-downloaded');
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Aime Box 新版本已上线!',
          message: '你现在想安装吗? 我们将为你关闭软件并马上升级!',
          buttons: ['安装并重新启动', '暂不更新'],
        })
        .then((res) => {
          if (res.response == 0) {
            console.log('checking-for-update');
            autoUpdater.quitAndInstall();
          }
          return null;
        })
        .catch((err) => {
          return null;
        });
    });

    autoUpdater.forceDevUpdateConfig = false;
    autoUpdater.checkForUpdatesAndNotify({
      title: 'Aime Box发现新版本',
      body: t(''),
    });
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

function registerPluginProtocol() {
  const name = 'plugin';
  if (protocol.isProtocolHandled(name)) return false;
  return protocol.handle(name, (request) => {
    const { hostname, pathname } = new URL(request.url);
    const url = pathToFileURL(
      join(
        path.join(app.getPath('userData'), 'plugins'),
        hostname,
        normalize(pathname),
      ),
    );
    return net.fetch(url.toString());
  });
}

function registerAuthProtocol() {
  const name = 'aimebox-auth';
  app.setAsDefaultProtocolClient(name);
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('Deep link URL:', url);

    // 从 URL 解析出 code
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    debugger;
    // 在这里调用 Supabase SDK
    //exchangeCodeForSession(code);
  });

  // if (protocol.isProtocolHandled(name)) return false;
  // return protocol.handle(name, (request) => {
  //   const { hostname, pathname } = new URL(request.url);

  //   return '';
  // });
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    // await installExtensions();
  }
  registerPluginProtocol();
  registerAuthProtocol();
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 808,
    minHeight: 808,
    icon: getAssetPath('icon.png'),
    autoHideMenuBar: process.platform === 'darwin' ? false : app.isPackaged,
    //transparent: process.platform === 'darwin',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault(); // 取消内部跳转
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url); // 在外部浏览器打开
    } else if (url.startsWith('file:///')) {
      event.preventDefault();
      let filePath = url.substring(8);
      filePath = decodeURI(filePath);
      if (platform == 'darwin') {
        if (!filePath.startsWith('/')) {
          filePath = `/${filePath}`;
        }
      }
      if (fs.statSync(filePath)?.isFile()) {
        shell.openPath(filePath);
      } else if (fs.statSync(filePath)?.isDirectory()) {
        if (platform == 'win32') {
          exec(`explorer "${filePath.replaceAll('/', '\\')}"`);
        } else {
          exec(`open "${filePath}"`);
        }
      } else {
        notificationManager.sendNotification('path error', 'error');
      }
    }
  });
  ipcListener(mainWindow);
  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    if (!tray) {
      let icon = Electron.nativeImage.createFromPath(getAssetPath('icon.png'));
      icon = icon.resize({ width: 16, height: 16 });
      tray = new Tray(icon);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示主界面',
          click: () => {
            mainWindow?.show();
          },
        },
        {
          label: t('common.quit'),
          click: () => {
            tray?.destroy();
            app.quit();
          },
        },
      ]);
      tray.setToolTip('Aime Box');
      tray.setContextMenu(contextMenu);

      tray.on('click', () => {
        mainWindow?.show();
      });
    }
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
    return true;
  })
  .catch(console.log);
