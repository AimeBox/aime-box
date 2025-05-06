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

export default function ipcListener(mainWindow: BrowserWindow) {}
