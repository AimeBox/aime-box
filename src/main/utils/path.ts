import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const getDataPath = () => {
  return app?.isPackaged
    ? path.join(process.resourcesPath, '..', '.data')
    : path.join(__dirname, '../../.data');
};

const getTmpPath = () => {
  return app?.isPackaged
    ? path.join(process.resourcesPath, '..', '.data', 'tmp')
    : path.join(__dirname, '../../.data', 'tmp');
};

const rootPath = app.isPackaged ? app.getAppPath() : __dirname;

const getModelsPath = () => {
  return app?.isPackaged
    ? path.join(process.resourcesPath, '..', 'models')
    : path.join(__dirname, '../../models');
};

export { getDataPath, getTmpPath, getModelsPath, rootPath };
