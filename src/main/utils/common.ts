import fs, { createWriteStream } from 'fs';
import path from 'path';
import { getTmpPath } from './path';
import { v4 as uuidv4 } from 'uuid';
import { RunnableConfig } from '@langchain/core/runnables';
import { isString, isUrl } from './is';

export const removeEmptyValues = (
  obj: Record<string, any>,
): Record<string, any> => {
  const result = { ...obj };

  Object.keys(result).forEach((key) => {
    const value = result[key];

    // 检查值是否为 null、undefined 或空字符串
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      delete result[key];
    }
    // 如果值是对象，递归清理
    else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeEmptyValues(value);
      // 如果清理后对象为空，则删除该属性
      if (Object.keys(result[key]).length === 0) {
        delete result[key];
      }
    }
  });

  return result;
};

export const downloadFile = async (
  url: string,
  savePath: string,
): Promise<string> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer);

    // 如果未指定保存路径，生成一个临时路径
    let finalSavePath = savePath;
    if (!finalSavePath) {
      finalSavePath = path.join(
        getTmpPath(),
        `${uuidv4()}${path.extname(url) || ''}`,
      );
    }

    return new Promise((resolve, reject) => {
      const writer = createWriteStream(finalSavePath);
      writer.on('error', (err) => {
        reject(err);
      });
      writer.on('finish', () => {
        resolve(finalSavePath);
      });
      writer.write(data);
      writer.end();
    });
  } catch (error) {
    console.error('文件下载错误:', error);
    throw error;
  }
};

export const base64ToFile = async (
  base64: string,
  savePath: string,
): Promise<string> => {
  const buffer = Buffer.from(base64, 'base64');
  const writer = createWriteStream(savePath);
  writer.write(buffer);
  writer.end();
  return savePath;
};

export const imageToBase64 = async (filePath: string): Promise<string> => {
  const data = await fs.promises.readFile(filePath);
  return data.toString('base64');
};

export const saveFile = async (
  data: string | Buffer,
  filePath: string,
  config?: RunnableConfig,
): Promise<string> => {
  const workspace = config?.configurable?.workspace;
  let _filePath = filePath;
  if (!path.isAbsolute(_filePath)) {
    _filePath = workspace
      ? path.join(workspace, filePath)
      : path.join(getTmpPath(), filePath);
  }
  if (isString(data) && isUrl(data)) {
    return await downloadFile(data, _filePath);
  } else if (data instanceof Buffer) {
    await fs.promises.writeFile(_filePath, data);
    return _filePath;
  } else {
    throw new Error('not support');
  }
};

export const truncateText = (
  text: string,
  maxLength: number = 1000,
): string => {
  if (text.length <= maxLength) {
    return text; // 如果原文本小于最大长度，则直接返回
  }

  // 计算前后部分的字符数
  const halfLength = Math.floor((maxLength - 100) / 2); // 保留前后各一半，留出省略的"..."

  // 获取前后字符和省略的部分
  const front = text.slice(0, halfLength);
  const back = text.slice(-halfLength);

  return `${front}\n...[truncated]...\n${back}`;
};
