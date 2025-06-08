import { ipcMain } from 'electron';

export abstract class BaseManager {
  constructor() {}

  registerIpcChannels() {
    if (!ipcMain) return;
    const channels = (this as any)._ipcChannels || [];
    channels.forEach((item: { channel: string; method: string }) => {
      ipcMain.handle(item.channel, (event, ...args) => {
        return this[item.method](...args);
      });
    });
  }
}
