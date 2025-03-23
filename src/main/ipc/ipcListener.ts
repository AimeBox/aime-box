import { ChatInputAsset } from '../../types/chat';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Tray,
  Menu,
  clipboard,
  OpenDialogOptions,
  SaveDialogOptions,
  MessageBoxOptions,
  nativeTheme,
} from 'electron';
// import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import settingsManager from '../settings';
import { platform } from 'process';

export default function ipcListener(mainWindow: BrowserWindow) {
  ipcMain.handle(
    'app:showOpenDialog',
    async (
      event,
      arg: OpenDialogOptions = {
        properties: ['openFile', 'openDirectory', 'multiSelections'],
      },
    ): Promise<void> => {
      const res = await dialog.showOpenDialog(mainWindow as BrowserWindow, arg);

      if (!res || res.canceled || res.filePaths.length == 0) {
        return undefined;
      } else {
        const list = [] as ChatInputAsset[];
        for (let index = 0; index < res.filePaths.length; index++) {
          const file = res.filePaths[index];
          if (fs.statSync(file).isDirectory()) {
            list.push({
              path: file,
              name: path.basename(file),
              type: 'folder',
            } as ChatInputAsset);
          } else if (fs.statSync(file).isFile()) {
            const extension = path.extname(file);
            list.push({
              path: file,
              name: path.basename(file),
              type: 'file',
              ext: extension?.toLowerCase(),
            } as ChatInputAsset);
          }
        }
        return list;
      }
      //event.returnValue = res;
    },
  );
  ipcMain.on('app:info', (event) => {
    event.returnValue = {
      appPath: app.getAppPath(),
      userData: app.getPath('userData'),
      version: app.getVersion(),
      platform: platform,
      resourcesPath: process.resourcesPath,
      cwd: process.cwd(),
      execPath: process.execPath,
      type: process.type,
      systemVersion: process.getSystemVersion(),
      isPackaged: app.isPackaged,
    };
  });
  ipcMain.on(
    'app:showSaveDialog',
    async (event, arg: SaveDialogOptions = {}): Promise<void> => {
      const res = await dialog.showSaveDialog(mainWindow as BrowserWindow, arg);
      if (!res || res.canceled || !res.filePath) {
        event.returnValue = undefined;
      } else {
        event.returnValue = res.filePath;
      }
    },
  );
  ipcMain.on(
    'app:showMessageBox',
    async (event, options: MessageBoxOptions): Promise<void> => {
      const res = await dialog.showMessageBox(
        mainWindow as BrowserWindow,
        options,
      );
      if (res.checkboxChecked) {
        event.returnValue = res.response;
      } else {
        event.returnValue = undefined;
      }
    },
  );
  ipcMain.on(
    'app:setTheme',
    async (event, theme: 'system' | 'light' | 'dark'): Promise<void> => {
      nativeTheme.themeSource = theme;
    },
  );
  ipcMain.on(
    'app:showErrorBox',
    async (
      event,
      arg: {
        title: string;
        content: string;
      },
    ): Promise<void> => {
      dialog.showErrorBox(arg.title, arg.content);
      event.returnValue = null;
    },
  );
  ipcMain.handle('app:openPath', (event, path: string) => shell.openPath(path));
  ipcMain.handle('app:showItemInFolder', (event, fullPath: string) =>
    shell.showItemInFolder(fullPath),
  );
  ipcMain.handle('app:trashItem', (event, path: string) =>
    shell.trashItem(path),
  );
  ipcMain.on('app:clipboard', (event, text: string) => {
    clipboard.writeText(text);
    event.returnValue = null;
  });
}
