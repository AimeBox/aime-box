import {
  app,
  ipcMain,
  nativeTheme,
  ProxyConfig,
  session,
  utilityProcess,
} from 'electron';
// import { getDatabase } from '../db';
import { Repository } from 'typeorm';
import * as http from 'http';
import * as https from 'https';
//import lack from 'lack-proxy';
import { HttpsProxyAgent } from 'https-proxy-agent';
//import AppDataSource from '../../data-source';
import Settings from '../../entity/Settings';
import { dbManager } from '../db';
import i18n from '../../i18n';
import LocalModels from './LocalModels.json';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NotificationMessage } from '@/types/notification';
import { notificationManager } from '../app/NotificationManager';
import transformers, { cat } from '@huggingface/transformers';
import * as huggingfaceHub from '@huggingface/hub';
import { filesize } from 'filesize';
import compressing from 'compressing';
import bz2 from 'unbzip2-stream';
import tar from 'tar';
import node7z from 'node-7z';
import axios from 'axios';
import nodeFetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import { getDefaultModelsPath, getModelsPath } from '../utils/path';
import { platform } from 'process';
import { exec } from 'child_process';
import serverManager from '../server/serverManager';
import { isBoolean, isUrl } from '../utils/is';
import {
  setGlobalDispatcher,
  ProxyAgent,
  getGlobalDispatcher,
  Agent,
} from 'undici';

import {
  getSystemProxySettings,
  SystemProxySettings,
} from '../utils/systemProxy';

export interface GlobalSettings {
  appName: string;
  theme: {
    mode: string;
  };
  proxyMode: 'system' | 'custom' | 'none';
  proxy: string | null;
  language: string;
  defaultEmbedding: string | null;
  defaultLLM: string | null;
  defaultAgent: string;
  defaultTitleLLM: string | null;
  defaultTTS: string | null;
  defaultSTT: string | null;
  defaultReranker: string | null;
  defaultVision: string | null;
  defaultWebSearchEngine: string | null;
  webSearchEngine: {
    zhipu: {
      apiKey: string | null;
    };
    searxng: {
      apiBase: string | null;
    };
    tavily: {
      apiKey: string | null;
    };
    serpapi: {
      apiKey: string | null;
    };
    brave: {
      apiKey: string | null;
    };
  };
  localModelPath: string | null;
  huggingfaceUrl: string | null;
  serverEnable: boolean;
  serverPort: number | null;
  showMcpWindows: boolean;
}

class SettingsManager {
  private readonly db: any;

  private readonly settingsRepository: Repository<Settings>;

  private settingsCache: GlobalSettings = {
    appName: '',
    theme: {
      mode: 'light',
    },
    proxyMode: 'system',
    proxy: 'system',
    language: 'zh-CN',
    defaultEmbedding: null,
    defaultLLM: null,
    defaultAgent: null,
    defaultTitleLLM: null,
    defaultTTS: null,
    defaultSTT: null,
    defaultReranker: null,
    defaultWebSearchEngine: null,
    defaultVision: null,
    webSearchEngine: {
      zhipu: { apiKey: null },
      searxng: { apiBase: null },
      tavily: { apiKey: null },
      serpapi: { apiKey: null },
      brave: { apiKey: null },
    },
    localModelPath: getDefaultModelsPath(),
    huggingfaceUrl: 'https://huggingface.co',
    serverEnable: false,
    serverPort: 4560,
    showMcpWindows: false,
  };

  downloadingModels: any[] = [];

  systemProxy: SystemProxySettings;

  constructor() {
    this.settingsRepository = dbManager.dataSource.getRepository(Settings);
    if (!ipcMain) return;
    ipcMain.on('settings:getSettings', async (event) => {
      event.returnValue = await this.getSettings();
    });
    ipcMain.on('settings:set', async (event, key: string, value: any) => {
      event.returnValue = await this.set(key, value);
    });
    ipcMain.on('getForm', async (event) => {
      const res = await this.settingsRepository.find();
      const obj = this.flattenObject(this.settingsCache);
      res.forEach((item) => {
        obj[item.id] = item.value;
      });

      event.returnValue = obj;
    });
    ipcMain.on('setForm', async (event, form: any) => {
      const res = await this.settingsRepository.find();
      for (let index = 0; index < Object.keys(form).length; index += 1) {
        const key = Object.keys(form)[index];
        const settingindex = res.findIndex((x) => x.id === key);
        if (settingindex < 0) {
          const entity = new Settings();
          entity.id = key;
          entity.value = form[key];
          res.push(entity);
        } else {
          res[settingindex].value = form[key];
        }
      }
      await this.settingsRepository.save(res);
      await this.loadSettings();
      event.returnValue = true;
    });
    ipcMain.on('settings:getLocalModels', async (event) => {
      event.returnValue = await this.getLocalModels();
    });
    ipcMain.on('settings:downloadModel', (event, task, model) => {
      this.downloadModel(task, model);
      event.returnValue = null;
    });
    ipcMain.handle('settings:deleteLocalModel', (event, task, model) =>
      this.deleteLocalModel(task, model),
    );
  }

  private flattenObject(obj: any, prefix: string = ''): any {
    return Object.keys(obj).reduce((acc, key) => {
      const prefixedKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const nested = this.flattenObject(obj[key], prefixedKey);
        Object.assign(acc, nested);
      } else {
        acc[prefixedKey] = obj[key];
      }
      return acc;
    }, {});
  }

  public updateObject(obj, keys, value) {
    let currentObj = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!currentObj[key]) {
        currentObj[key] = {};
      }
      currentObj = currentObj[key];
    }
    currentObj[keys[keys.length - 1]] = value;
  }

  public async loadSettings() {
    const res = await this.settingsRepository.find();
    const obj = this.settingsCache;

    res.forEach((item) => {
      // 获取当前值的类型信息
      const keys = item.id.split('.');

      let currentDefaultValue = obj;
      let valueSet = false;

      for (let i = 0; i < keys.length; i++) {
        if (currentDefaultValue[keys[i]] === undefined) break;
        if (i === keys.length - 1) {
          const defaultValue = currentDefaultValue[keys[i]];
          // 根据原始类型转换值
          if (defaultValue === null && item.value === null) {
            this.updateObject(obj, keys, null);
          } else if (typeof defaultValue === 'boolean') {
            this.updateObject(obj, keys, item.value === 'true');
          } else if (typeof defaultValue === 'number') {
            this.updateObject(obj, keys, Number(item.value));
          } else if (typeof defaultValue === 'object') {
            try {
              // 尝试将JSON字符串解析为对象
              const parsedValue = JSON.parse(item.value);
              this.updateObject(obj, keys, parsedValue);
            } catch (e) {
              // 如果解析失败，直接使用字符串值
              this.updateObject(obj, keys, item.value);
            }
          } else {
            this.updateObject(obj, keys, item.value);
          }
          valueSet = true;
        }
        currentDefaultValue = currentDefaultValue[keys[i]];
      }

      // 如果没有匹配到类型信息，则直接设置
      if (!valueSet) {
        this.updateObject(obj, keys, item.value);
      }
    });

    i18n.changeLanguage(obj.language);
    await this.updateProxy(obj.proxyMode, obj.proxy);
    nativeTheme.themeSource = obj.theme.mode as 'system' | 'light' | 'dark';
    if (obj.serverEnable) {
      await serverManager.start();
    } else {
      await serverManager.close();
    }
  }

  public async set(key: string, value: any) {
    const obj = this.flattenObject(this.settingsCache);
    if (Object.keys(obj).includes(key)) {
      let entity = await this.settingsRepository.findOne({
        where: { id: key },
      });
      if (!entity) {
        entity = new Settings();
        entity.id = key;
      }

      // 确保所有类型的值都存储为字符串
      if (value === null) {
        entity.value = null;
      } else if (typeof value === 'boolean') {
        entity.value = value.toString();
      } else if (typeof value === 'number') {
        entity.value = value.toString();
      } else if (typeof value === 'object') {
        entity.value = JSON.stringify(value);
      } else {
        entity.value = value;
      }

      await this.settingsRepository.save(entity);
      await this.loadSettings();
    }
  }

  public getSettings(): GlobalSettings | null {
    return this.settingsCache;
  }

  public async updateProxy(
    proxyMode: 'system' | 'custom' | 'none',
    proxy: string,
  ) {
    const sessions = [
      session.defaultSession,
      session.fromPartition('persist:webview'),
    ];
    this.systemProxy = await getSystemProxySettings();
    let proxyConfig: ProxyConfig;
    if (proxyMode === 'system') {
      proxyConfig = { mode: 'system' };
      setGlobalDispatcher(
        this.systemProxy.proxyEnable
          ? new ProxyAgent({
              uri: this.systemProxy.proxyServer,
            })
          : new Agent(),
      );
    } else if (proxyMode == 'custom' && isUrl(proxy)) {
      proxyConfig = { proxyRules: proxy };
      setGlobalDispatcher(
        new ProxyAgent({
          uri: proxy,
        }),
      );
    } else {
      proxyConfig = {};
      setGlobalDispatcher(new Agent());
    }
    if (proxy === 'system') {
      if (this.systemProxy.proxyEnable) {
        proxyConfig.proxyRules = this.systemProxy.proxyServer;
      }
    }
    await Promise.all(sessions.map((session) => session.setProxy(proxyConfig)));
  }

  public getHttpAgent(): HttpsProxyAgent | undefined {
    if (this.settingsCache.proxy && this.settingsCache.proxyMode == 'custom') {
      if (
        this.settingsCache?.proxy.startsWith('https://') ||
        this.settingsCache?.proxy.startsWith('http://')
      ) {
        return new HttpsProxyAgent(this.settingsCache?.proxy);
      }
    } else if (
      this.settingsCache.proxyMode == 'system' &&
      this.systemProxy.proxyEnable
    ) {
      return new HttpsProxyAgent(this.systemProxy.proxyServer);
    }
    return undefined;
  }

  public getProxy(): string {
    if (this.settingsCache.proxy) {
      return `${this.settingsCache.proxy}`;
    }
    return undefined;
  }

  public getLanguage(): string {
    return this.settingsCache.language;
  }

  public getLocalModels() {
    const out = {};
    Object.keys(LocalModels).forEach((item) => {
      out[item] = [];
      const models = LocalModels[item];
      models.forEach((model) => {
        const exists = fs.existsSync(
          path.join(this.settingsCache.localModelPath, item, model.id),
        );
        out[item].push({
          ...model,
          exists: exists,
        });
      });
    });
    return out;
  }

  public async deleteLocalModel(
    task: string,
    model: {
      id: string;
      repo: string;
      download: string;
      type: string;
    },
  ) {
    const dir = path.join(this.settingsCache.localModelPath, task, model.id);
    fs.rmSync(`${dir}`, { recursive: true });
  }

  private async getProxyFetch(): Promise<typeof fetch> {
    const agent = await this.getHttpAgent();
    if (!agent) {
      return nodeFetch as unknown as typeof fetch;
    }
    // 这里直接返回一个 async 函数，类型自动推断为 Promise<Response>
    return async (url: any, init?: RequestInit) => {
      return nodeFetch(url.toString(), { ...init, agent } as any);
    };
  }

  public async downloadModel(
    task: string,
    model: {
      id: string;
      repo: string;
      download: string;
      type: string;
    },
  ) {
    if (this.downloadingModels.includes(model.id)) return;
    const id = uuidv4();
    const dir = path.join(this.settingsCache.localModelPath, task, model.id);

    fs.mkdirSync(path.join(this.settingsCache.localModelPath, task), {
      recursive: true,
    });
    let downloadedLength = 0;
    let title;
    let totalSize;
    if (model.type == 'huggingface') {
      try {
        this.downloadingModels.push(model);
        const fileList = await huggingfaceHub.listFiles({
          repo: model.repo,
          hubUrl: this.settingsCache.huggingfaceUrl ?? undefined,
          recursive: true,
          fetch: await this.getProxyFetch(),
        });
        const list = [];
        for await (const value of fileList) {
          list.push(value);
        }
        totalSize = list.reduce((acc, file) => acc + file.size, 0);
        const readableSize = filesize(totalSize, { base: 10, round: 2 });
        console.log(`Total size: ${readableSize}`);
        title = `${model.id}[${readableSize}]`;

        notificationManager.progress(id, title, 0, '准备下载...', false);
        fs.mkdirSync(`${dir}.tmp`, { recursive: true });

        for (let index = 0; index < list.length; index++) {
          const item = list[index];
          if (item.type == 'directory') {
            fs.mkdirSync(path.join(`${dir}.tmp`, item.path), {
              recursive: true,
            });
          } else if (item.type == 'file') {
            const response: Response = await huggingfaceHub.downloadFile({
              repo: model.repo,
              path: item.path,
              hubUrl: this.settingsCache.huggingfaceUrl ?? undefined,
              fetch: await this.getProxyFetch(),
            });
            const outputPath = path.join(`${dir}.tmp`, item.path);
            const fileStream = fs.createWriteStream(outputPath);
            response.body.pipe(fileStream);

            if (!response.ok) throw new Error('下载失败');
            await new Promise<null>((resolve, reject) => {
              response.body.on('data', (chunk) => {
                downloadedLength += chunk.length;
                notificationManager.progress(
                  id,
                  title,
                  (downloadedLength / totalSize) * 100,
                  item.path,
                  false,
                );
                //fileStream.write(chunk);
              });
              response.body.on('end', () => {
                fileStream.end();
              });

              // 响应错误处理
              response.body.on('error', (err) => {
                fileStream.destroy();
                fs.unlink(outputPath, () => {});
                reject(err);
              });

              fileStream.on('finish', () => {
                resolve(null);
              });
            });
          }
        }
        fs.renameSync(`${dir}.tmp`, `${dir}`);
        notificationManager.progress(id, title, 100, '下载完成', true, 3);
      } catch (err) {
        notificationManager.progress(
          id,
          title,
          (downloadedLength / totalSize) * 100,
          '下载失败',
          true,
          undefined,
          'download fail',
        );

        // if (fs.existsSync(`${dir}.tmp`))
        //   fs.rmSync(`${dir}.tmp`, {
        //     recursive: true,
        //     force: true,
        //     maxRetries: 3,
        //     retryDelay: 100,
        //   });
      } finally {
        this.downloadingModels = this.downloadingModels.filter(
          (x) => x.id != model.id,
        );
      }
    } else if (model.type == 'github') {
      try {
        notificationManager.progress(id, model.id, 0, '准备下载...', false);
        const fetch = await this.getProxyFetch();
        const response = await fetch(model.download);
        const contentLength = response.headers.get('Content-Length').toString();
        totalSize = parseInt(contentLength);
        const contentDisposition = response.headers.get('content-disposition');
        let filename = model.id;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match) {
            filename = match[1].toString();
          }
        }

        const readableSize = filesize(totalSize, { base: 10, round: 2 });
        console.log(`Total size: ${readableSize}`);
        title = `${model.id}[${readableSize}]`;

        fs.mkdirSync(`${dir}.tmp`, { recursive: true });
        this.downloadingModels.push(model);

        const outputPath = path.join(`${dir}.tmp`, filename);
        const fileStream = fs.createWriteStream(outputPath);
        response.body.pipe(fileStream);

        if (!response.ok) throw new Error('下载失败');
        await new Promise<null>((resolve, reject) => {
          response.body.on('data', (chunk) => {
            downloadedLength += chunk.length;
            notificationManager.progress(
              id,
              title,
              (downloadedLength / totalSize) * 100,
              filename,
              false,
            );
            //fileStream.write(chunk);
          });
          response.body.on('end', () => {
            fileStream.end();
          });

          // 响应错误处理
          response.body.on('error', (err) => {
            fileStream.destroy();
            fs.unlink(outputPath, () => {});
            reject(err);
          });

          fileStream.on('finish', () => {
            resolve(null);
          });
        });
        notificationManager.progress(id, title, 100, '准备处理...');

        if (filename.endsWith('.tar.bz2')) {
          await new Promise<null>((resolve, reject) => {
            if (platform == 'darwin' || platform == 'linux') {
              exec(
                `tar -xvjf ${path.join(`${dir}.tmp`, filename)} -C ${path.join(`${dir}.tmp`, '..')}`,
                (error, stdout, stderr) => {
                  if (error) {
                    console.error(`执行出错: ${error}`);
                    reject(error);
                    return;
                  }
                  console.log(`stdout: ${stdout}`);
                  console.log('解压完成');
                  resolve(null);
                },
              );
            } else if (platform == 'win32') {
              fs.createReadStream(path.join(`${dir}.tmp`, filename))
                .pipe(bz2())
                .pipe(tar.x({ C: path.join(`${dir}.tmp`, '..') }))
                .on('error', (err) => {
                  reject(err);
                })
                .on('finish', () => {
                  resolve(null);
                });
            }
          });

          fs.rmSync(`${dir}.tmp`, { recursive: true });
        } else if (filename.endsWith('.7z')) {
          await new Promise<null>((resolve, reject) => {
            node7z
              .extractFull(
                path.join(`${dir}.tmp`, filename),
                path.join(`${dir}.tmp`, '..'),
                { $progress: false },
              )
              .on('end', () => {
                resolve(null);
              })
              .on('error', (err) => {
                reject(err);
              });
          });

          fs.rmSync(`${dir}.tmp`, { recursive: true });
        } else {
          fs.renameSync(`${dir}.tmp`, `${dir}`);
        }

        notificationManager.progress(id, title, 100, '下载完成', true, 3);
      } catch (err) {
        console.error(err);
        notificationManager.progress(
          id,
          title,
          (downloadedLength / totalSize) * 100,
          '下载失败',
          true,
          undefined,
          'download fail',
        );

        // if (fs.existsSync(`${dir}.tmp`))
        //   fs.rmSync(`${dir}.tmp`, {
        //     recursive: true,
        //     force: true,
        //     maxRetries: 3,
        //     retryDelay: 100,
        //   });
      } finally {
        this.downloadingModels = this.downloadingModels.filter(
          (x) => x.id != model.id,
        );
      }
    }
  }
}

const settingsManager = new SettingsManager();
export default settingsManager;
