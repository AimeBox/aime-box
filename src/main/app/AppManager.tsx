import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
  MessageBoxOptions,
  SaveDialogOptions,
  OpenDialogOptions,
} from 'electron';
import settingsManager from '../settings';
import { TextToSpeech } from '../tools/TextToSpeech';
import * as fs from 'fs/promises';
import { ChatInputAttachment } from '@/types/chat';
import path from 'path';
import { platform } from 'process';
import { getDataPath } from '../utils/path';
import { isArray } from '../utils/is';

export class AppManager {
  textToSpeech: TextToSpeech;

  offlineTts: any;

  constructor() {
    if (!ipcMain) return;
    ipcMain.on('app:tts', (event, text: string) => this.tts(text));
    ipcMain.handle('app:resetTTS', (event) => this.resetTTS());
    ipcMain.on('app:startDrag', (event, filePath: string) => {
      event.sender.startDrag({
        file: filePath,
        icon: path.join(app.getAppPath(), 'assets/file-drag.png'),
      });
    });
    ipcMain.handle('app:getPathInfo', async (event, paths: string[]) => {
      if(!isArray(paths)){
        throw new Error('Input paths error');
        
      }
      const result: ChatInputAttachment[] = [];
      for (const _path of paths) {
        const stats = await fs.stat(_path);
        result.push({
          path: _path,
          name: path.basename(_path),
          type: stats.isDirectory() ? 'folder' : 'file',
          ext: path.extname(_path),
        });
      }
      return result;
    });
    ipcMain.handle('app:clipboard', (event, text: string) => {
      clipboard.writeText(text);
    });
    ipcMain.handle('app:trashItem', (event, path: string) =>
      shell.trashItem(path),
    );
    ipcMain.handle(
      'app:setTheme',
      async (event, theme: 'system' | 'light' | 'dark'): Promise<void> => {
        nativeTheme.themeSource = theme;
      },
    );
    ipcMain.handle(
      'app:showErrorBox',
      async (
        event,
        arg: {
          title: string;
          content: string;
        },
      ): Promise<void> => {
        dialog.showErrorBox(arg.title, arg.content);
      },
    );
    ipcMain.handle('app:openPath', (event, path: string) =>
      shell.openPath(path),
    );
    ipcMain.handle('app:showItemInFolder', (event, fullPath: string) =>
      shell.showItemInFolder(fullPath),
    );
    ipcMain.handle(
      'app:showOpenDialog',
      async (
        event,
        arg: OpenDialogOptions = {
          properties: ['openFile', 'openDirectory', 'multiSelections'],
        },
      ): Promise<ChatInputAttachment[] | undefined> => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        const res = await dialog.showOpenDialog(
          mainWindow as BrowserWindow,
          arg,
        );

        if (!res || res.canceled || res.filePaths.length == 0) {
          return undefined;
        } else {
          const list = [] as ChatInputAttachment[];
          for (let index = 0; index < res.filePaths.length; index++) {
            const file = res.filePaths[index];
            if ((await fs.stat(file)).isDirectory()) {
              list.push({
                path: file,
                name: path.basename(file),
                type: 'folder',
              } as ChatInputAttachment);
            } else if ((await fs.stat(file)).isFile()) {
              const extension = path.extname(file);
              list.push({
                path: file,
                name: path.basename(file),
                type: 'file',
                ext: extension?.toLowerCase(),
              } as ChatInputAttachment);
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
        dataPath: getDataPath(),
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
        const mainWindow = BrowserWindow.getAllWindows()[0];
        const res = await dialog.showSaveDialog(
          mainWindow as BrowserWindow,
          arg,
        );
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
        const mainWindow = BrowserWindow.getAllWindows()[0];
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
  }

  public async init() {
    const defaultTTS = settingsManager.getSettings()?.defaultTTS;
    if (defaultTTS) {
      const model = defaultTTS.split('@')[0];
      if (!this.textToSpeech || this.textToSpeech.model != model)
        this.textToSpeech = new TextToSpeech({ model });

      const config = this.textToSpeech.getConfig(model);
      if (!this.offlineTts) {
        if (config) {
          try {
            this.offlineTts = await this.textToSpeech.createTts(config);
            console.log(`tts引擎已初始化 model = ${model}`);
          } catch (error) {
            console.log(error);
          }
        }
      }
    }
  }

  public async resetTTS() {
    this.offlineTts = null;
    this.textToSpeech = null;
    const defaultTTS = settingsManager.getSettings()?.defaultTTS;
    if (defaultTTS) {
      const model = defaultTTS.split('@')[0];
      this.textToSpeech = new TextToSpeech({ model: defaultTTS });
      try {
        const config = this.textToSpeech.getConfig(model);
        if (!this.offlineTts) {
          if (config) {
            this.offlineTts = await this.textToSpeech.createTts(config);
            console.log(`tts引擎已初始化 model = ${model}`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  public async tts(text: string) {
    if (!text || !this.offlineTts) return;
    const audio = this.offlineTts?.generate({
      text: text,
      sid: 0,
      speed: 1.0,
      enableExternalBuffer: false,
    });
    if (audio.sampleRate) {
      await this.textToSpeech.play(audio);
    }
  }

  public async sendAllWindowsEvent(event: string, data: any) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send(event, data);
    });
  }

  public async sendEvent(event: string, data: any) {
    const windows = BrowserWindow.getAllWindows();
    windows[0].webContents.send(event, data);
  }
}

export const appManager = new AppManager();
