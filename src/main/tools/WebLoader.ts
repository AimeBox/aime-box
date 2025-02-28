import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import settingsManager from '../settings';
import { getDataPath } from '../utils/path';
import { chromium } from 'playwright';

export interface WebLoaderParameters extends ToolParams {
  headless: boolean;
  useJina: boolean;
}

export class WebLoader extends Tool {
  static lc_name() {
    return 'WebLoader';
  }

  name: string;

  description: string;

  headless: boolean;

  useJina: boolean;

  constructor(params?: WebLoaderParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'web_loader',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'view web page',
    });
    Object.defineProperty(this, 'headless', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: true,
    });
    Object.defineProperty(this, 'useJina', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false,
    });
    this.headless = params?.headless;
    this.useJina = params?.useJina;
    // Object.defineProperty(this, 'headless', {
    //   enumerable: true,
    //   configurable: true,
    //   writable: true,
    //   value: z.object({
    //     input: z.string().brand<'FileInfo'>(),
    //   }),
    // });
  }

  async _call(url: string, runManager, config): Promise<any> {
    try {
      if (!isUrl(url)) {
        return 'input value is not url';
      }
      const proxy = settingsManager.getPorxy() || null;
      const httpProxy = settingsManager.getPorxy();
      if (this.useJina) {
        const response = await fetch(`https://r.jina.ai/${url}`, {
          method: 'GET',
        });
        return await response.text();
      }

      const userDataDir = path.join(getDataPath(), 'User Data');
      let html = null;
      //try {
      const browser_context = await chromium.launchPersistentContext(
        userDataDir,
        {
          channel: 'msedge',
          headless: false,

          proxy: httpProxy
            ? {
                server: `${httpProxy}`,
              }
            : undefined,
          args: ['--disable-blink-features=AutomationControlled'],
        },
      );
      const page = await browser_context.newPage();
      try {
        await page.goto(url, { timeout: 5000 });
      } catch {}

      //await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
      html = await page.content();
      const title = await page.title();
      await page.close();
      await browser_context.close();

      // const text = convert(res);

      // return {
      //   title,
      //   content: text,
      //   url,
      // };

      const response = await fetch('http://0.0.0.0:8300/tools/parse/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url, html: html }),
      });
      if (!response.ok) {
        throw new Error(`Network response was not ok ${response.statusText}`);
      }
      const b = await response.json();
      // console.log(b);
      // const loader = new PlaywrightWebBaseLoader(url, {
      //   launchOptions: { headless: this.headless, proxy: { server: proxy } },
      // });
      // const doc = await loader.load();

      return b;
    } catch (err) {
      return JSON.stringify(err);
    }
  }
}
