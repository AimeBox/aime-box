import { Instances } from '@/entity/Instances';
import { BaseInstance, BaseInstanceParams } from './BaseInstance';
import path from 'path';
import { getDataPath } from '../utils/path';
import { BrowserContext, chromium } from 'playwright';
import settingsManager from '../settings';
import { EventEmitter } from 'events';
import fs from 'fs';

export class BrowserInstance extends BaseInstance {
  browser_context: BrowserContext;

  private eventEmitter = new EventEmitter();

  constructor(params?: BaseInstanceParams) {
    super(params);
  }

  run = async () => {
    const httpProxy = settingsManager.getPorxy();
    if (
      this.instances?.config?.userDataPath ||
      this.instances?.config?.executablePath
    ) {
      const userDataDir = path.join(getDataPath(), 'User Data');
      this.browser_context = await chromium.launchPersistentContext(
        this.instances?.config?.userDataPath || userDataDir,
        {
          headless: false,
          proxy: httpProxy
            ? {
                server: `${httpProxy}`,
              }
            : undefined,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--enable-webgl',
          ],
          // channel: 'msedge',
          executablePath: this.instances?.config?.executablePath,
        },
      );
    } else if (this.instances?.config?.cdpUrl) {
      this.browser_context = await (
        await chromium.connectOverCDP(this.instances?.config?.cdpUrl)
      ).newContext();
    } else if (this.instances?.config?.wssUrl) {
      this.browser_context = await (
        await chromium.connect(this.instances?.config?.wssUrl)
      ).newContext();
    } else {
      const browser = await chromium.launch({
        headless: false,
        proxy: httpProxy
          ? {
              server: `${httpProxy}`,
            }
          : undefined,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--enable-webgl',
        ],
        channel: 'msedge',
      });
      this.browser_context = await browser.newContext();
    }
    this.browser_context.on('close', (page) => {
      this.eventEmitter.emit('close');
    });

    return this.browser_context;
  };

  stop = async () => {
    if (this.browser_context) {
      await this.browser_context.close();
      this.eventEmitter.emit('close');
    }
  };

  clear = async () => {
    if (this.instances?.config?.userDataPath) {
      await fs.promises.rmdir(this.instances?.config?.userDataPath, {
        recursive: true,
      });
    }
  };

  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.off(event, listener);
  }
}
