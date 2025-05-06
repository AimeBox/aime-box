import { BrowserWindow, ipcMain } from 'electron';
import settingsManager from '../settings';
import { toolsManager } from '../tools';
import { TextToSpeech } from '../tools/TextToSpeech';

export class AppManager {
  textToSpeech: TextToSpeech;

  offlineTts: any;

  constructor() {
    if (!ipcMain) return;
    ipcMain.on('app:tts', (event, text: string) => this.tts(text));
    ipcMain.handle('app:resetTTS', (event) => this.resetTTS());
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
      this.textToSpeech = new TextToSpeech({ model });
      const config = this.textToSpeech.getConfig(model);
      if (!this.offlineTts) {
        if (config) {
          this.offlineTts = await this.textToSpeech.createTts(config);
          console.log(`tts引擎已初始化 model = ${model}`);
        }
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
