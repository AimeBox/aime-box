import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import settingsManager from '../settings';
import { isArray, isString } from './is';

const getDataPath = () => {
  let userData;
  if (app.isPackaged) {
    userData = app.getPath('userData');
  } else {
    userData = app.getAppPath();
  }
  userData = app.getPath('userData');

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

const getAssetPath = (...paths: string[]): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', ...paths);
  } else {
    return path.join(app.getAppPath(), 'assets', ...paths);
  }
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

const getWorkspacePath = (
  inputPath: string | string[],
  config: any,
): string[] | string => {
  const { workspace } = config.configurable;
  if (!workspace) return inputPath;

  if (isArray(inputPath)) {
    return inputPath.map((x) =>
      path.isAbsolute(x) ? x : path.join(workspace, x),
    );
  } else if (isString(inputPath)) {
    return path.isAbsolute(inputPath)
      ? inputPath
      : path.join(workspace, inputPath);
  }
  throw new Error('InputPath Error');
};

export {
  getDataPath,
  getTmpPath,
  getModelsPath,
  getDefaultModelsPath,
  getAssetPath,
  rootPath,
};
