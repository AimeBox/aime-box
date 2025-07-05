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
import { v4 as uuidv4 } from 'uuid';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { BaseTool } from './BaseTool';
import { instanceManager } from '../instances';
import { FormSchema } from '@/types/form';

export interface WebLoaderParameters extends ToolParams {
  // headless: boolean;
  useJina: boolean;
}

export class WebLoader extends BaseTool {
  schema = z.object({ url: z.string() });

  name: string = 'web_loader';

  description: string = 'view web page';

  headless: boolean;

  useJina: boolean;

  configSchema: FormSchema[] = [
    {
      field: 'useJina',
      label: 'Use Jina',
      component: 'Switch',
    },
  ];

  constructor(params?: WebLoaderParameters) {
    super(params);
    // this.headless = params?.headless;
    this.useJina = params?.useJina;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<any> {
    try {
      if (!isUrl(input.url)) {
        return 'input value is not url';
      }
      const proxy = settingsManager.getProxy() || null;
      const httpProxy = settingsManager.getProxy();
      if (this.useJina) {
        const response = await fetch(`https://r.jina.ai/${input.url}`, {
          method: 'GET',
        });
        return await response.text();
      }

      const userDataDir = path.join(getDataPath(), 'User Data');
      let html = null;
      //try {
      const browser_context = await instanceManager.getBrowserInstance();
      const page = await browser_context.browser_context.newPage();
      try {
        await page.goto(input.url, { timeout: 5000 });
        await page.waitForLoadState('networkidle');
      } catch {}

      //await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
      // html = await page.content();
      const pdfDir = path.join(getDataPath(), 'tmp');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const pdfPath = path.join(getDataPath(), 'tmp', `${uuidv4()}.pdf`);
      //创建文件夹

      await page.emulateMedia({ media: 'screen' });
      // await page.pdf({
      //   path: pdfPath,
      //   printBackground: false,
      // });

      const pdfBuffer = await page.pdf({
        displayHeaderFooter: false,
        printBackground: false,
      });

      //const pdfPath = `./${Date.now()}.pdf`;
      //fs.writeFileSync(pdfPath, pdfBuffer);

      // 将Buffer转换为Blob对象
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const loader = new PDFLoader(blob);
      const docs = await loader.load();
      const text = docs.map((x) => x.pageContent).join('\n\n');

      const title = await page.title();
      await page.close();
      //await browser_context.close();

      return text;
    } catch (err) {
      return JSON.stringify(err);
    }
  }
}
