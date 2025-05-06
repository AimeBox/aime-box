import { NotificationMessage } from '@/types/notification';

import { app, BrowserWindow, ipcMain } from 'electron';

export class NotificationManager {
  mainWindow: BrowserWindow;

  constructor() {}

  public getMainWindow() {
    const windows = BrowserWindow.getAllWindows();

    const mainWindow = windows.length > 0 ? windows[0] : null;
    return mainWindow;
  }

  public sendNotification(
    title: string,
    icon: 'success' | 'error' | 'info' | 'warning' | 'loading',
    duration?: number | undefined,
  ) {
    this.getMainWindow().webContents.send('app:notification', {
      action: 'create',
      data: {
        title,
        type: 'notification',
        icon: icon,
        duration,
      },
    });
  }

  public create(data: NotificationMessage) {
    this.getMainWindow().webContents.send('app:notification', {
      action: 'create',
      data,
    });
  }

  public update(data: NotificationMessage) {
    this.getMainWindow().webContents.send('app:notification', {
      action: 'update',
      data,
    });
  }

  public delete(data: NotificationMessage) {
    this.getMainWindow().webContents.send('app:notification', {
      action: 'delete',
      data: data,
    });
  }

  public progress(
    id: string,
    title: string,
    percent: number,
    description?: string,
    closeEnable?: boolean,
    duration?: number,
    error?: string,
  ) {
    this.getMainWindow().webContents.send('app:notification', {
      action: 'update',
      data: {
        id,
        title,
        type: 'progress',
        percent,
        description,
        closeEnable: closeEnable,
        duration: duration,
        error: error,
      },
    });
  }
}

export const notificationManager = new NotificationManager();
