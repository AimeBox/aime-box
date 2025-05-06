import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import settingsManager from '../settings';

const getDataPath = () => {
  let userData;
  if (app.isPackaged) {
    userData = app.getPath('userData');
  } else {
    userData = app.getAppPath();
  }

  const dataPath = path.join(userData, 'data');
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
  let userData;
  if (app.isPackaged) {
    userData = app.getPath('userData');
  } else {
    userData = app.getAppPath();
  }
  const { localModelPath } = settingsManager.getSettings();
  const modelPath = localModelPath;

  if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(modelPath, { recursive: true });
  }
  return modelPath;
};

const getDefaultModelsPath = () => {
  let userData;
  if (app.isPackaged) {
    userData = app.getPath('userData');
  } else {
    userData = app.getAppPath();
  }
  const modelPath = path.join(userData, 'models');

  if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(modelPath, { recursive: true });
  }
  return modelPath;
};

export {
  getDataPath,
  getTmpPath,
  getModelsPath,
  getDefaultModelsPath,
  rootPath,
};
