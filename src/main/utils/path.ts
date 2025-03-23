import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const getDataPath = () => {
  const userData = app.getPath('userData');
  const dataPath = path.join(userData, '.data');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
};

const getTmpPath = () => {
  const userData = app.getPath('userData');
  return path.join(userData, 'tmp');
};

const rootPath = app.isPackaged ? app.getAppPath() : __dirname;

const getModelsPath = () => {
  const userData = app.getPath('userData');
  const modelPath = path.join(userData, 'models');
  if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(modelPath, { recursive: true });
  }
  return modelPath;
};

export { getDataPath, getTmpPath, getModelsPath, rootPath };
