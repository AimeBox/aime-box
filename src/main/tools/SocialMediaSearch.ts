import { Tool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';

import {
  Browser,
  BrowserContext,
  chromium,
  firefox,
  webkit,
  Response,
} from 'playwright';
import settingsManager from '../settings';
import iconv from 'iconv-lite';
import { execFileSync } from 'child_process';
import path from 'path';
import { app, BrowserWindow, dialog } from 'electron';

import * as cheerio from 'cheerio';

import * as vm from 'vm';
import { getDataPath } from '../utils/path';
import { BaseTool } from './BaseTool';

// const getUserDataPath = (...paths: string[]): string => {
//   return path.join(
//     app.isPackaged
//       ? path.join(process.resourcesPath, '.data/User Data')
//       : path.join(__dirname, '../../../../.data/User Data'),
//     ...paths,
//   );
// };

interface XHSNoteItem {
  id: string;
  model_type: string;
  note_card: {
    user: {
      avatar: string;
      user_id: string;
      nickname: string;
      nick_name: string;
    };
    interact_info: {
      liked: boolean;
      liked_count: string;
    };
    cover: {
      height: number;
      width: number;
      url_default: string;
      url_pre: string;
    };
    image_list: Array<{
      width: number;
      height: number;
      info_list: Array<{
        image_scene: string;
        url: string;
      }>;
    }>;
    type: string;
    display_title: string;
  };
  xsec_token: string;
}

export class SocialMediaSearch extends BaseTool {
  schema = z.object({
    platform: z
      .enum(['xhs', 'bilibili', 'douyin', 'kuaishou', 'tiktok', 'twitter'])
      .describe(
        'xhs: 小红书 ,bilibili: 哔哩哔哩,douyin: 抖音, kuaishou: 快搜, tiktok: Tiktok, twitter: 推特',
      ),
    keyword: z.optional(z.string()).describe('搜索关键字'),
    url: z.optional(z.string()).describe('网址连接'),
    //count: z.number().default(10),
  });

  static lc_name() {
    return 'social-media-search';
  }

  name: string = 'social-media-search';

  description: string = 'search social media post';

  userDataDir: string;

  httpProxy: string | undefined;

  outputFormat: 'json' | 'markdown' = 'json';

  constructor() {
    super();
    this.userDataDir = path.join(getDataPath(), 'User Data');
  }

  async getBrowserContext(): Promise<BrowserContext> {
    // const browser_context = await chromium.launchPersistentContext(
    //   this.userDataDir,
    //   {
    //     channel: 'msedge',
    //     headless: false,
    //     devtools: true,
    //     proxy: this.httpProxy
    //       ? {
    //           server: `${this.httpProxy}`,
    //         }
    //       : undefined,
    //     args: ['--disable-blink-features=AutomationControlled'],
    //   },
    // ); // Or 'firefox' or 'webkit'.
    const msbrowser = await chromium.connectOverCDP('http://localhost:9222');
    const defaultContext = msbrowser.contexts()[0];
    return defaultContext;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<any> {
    this.httpProxy = settingsManager.getPorxy();

    let res = null;
    //try {

    if (input.platform === 'xhs') {
      if (input.url) {
        const browser_context = await this.getBrowserContext();
        res = await this.xhs_post_detail(browser_context, input.url);
        res = await this.xhs_note_to_markdown(res);
        await browser_context.close();
      } else {
        const need_login = await this.xhs_check_login();
        if (need_login) {
          const allWindows = BrowserWindow.getAllWindows();
          const res = await dialog.showMessageBoxSync(allWindows[0], {
            type: 'question',
            title: '请登陆小红书',
            message: `需要登陆小红书才可以继续操作`,
            buttons: ['登陆', '取消'],
          });
          if (res != 0) {
            return { error: 'need login' };
          }
          await this.xhs_try_login();
        }
        const browser_context = await this.getBrowserContext();
        await this.xhs_search(browser_context, input.keyword);
      }
    } else if (input.platform === 'bilibili') {
      const browser_context = await chromium.launchPersistentContext(
        this.userDataDir,
        {
          channel: 'msedge',
          headless: false,
          proxy: this.httpProxy
            ? {
                server: `${this.httpProxy}`,
              }
            : undefined,
          args: ['--disable-blink-features=AutomationControlled'],
        },
      );
      await this.bilibili(browser_context, input.keyword);
    } else if (input.platform === 'twitter') {
      const browser_context = await chromium.launchPersistentContext(
        this.userDataDir,
        {
          channel: 'msedge',
          headless: false,

          proxy: this.httpProxy
            ? {
                server: `${this.httpProxy}`,
              }
            : undefined,
          args: ['--disable-blink-features=AutomationControlled'],
        },
      );
      await this.twitter(browser_context, input.keyword);
      await browser_context.close();
    }

    return res;
    // } catch (e) {
    //   throw e;
    // }
  }

  async xhs_note_to_markdown(data: { note: any; comments: any }) {
    let text = '<note>\n';

    text += `### 标题:${data.note.title}\n`;
    text += `### 内容\n${data.note.desc}\n`;
    text += `### 图片\n${data.note.imageList.map((x) => `![](${x.urlDefault})`).join('\n')}\n`;
    if (data.note.video) {
      const stream = Object.values(data.note.video.media.stream);
      const item = stream.find((x: any[]) => x.length > 0);
      const video_url = item[0].backupUrls[0];
      text += `### 视频\n[${video_url}](${video_url})\n`;
    }

    // text += `### 标签\n${data.note.tagList.map((x) => `#${x.name}`).join(' ')}`;

    text += `\n</note>`;
    return text;
  }

  async xhs_check_login() {
    // const browser_context = await chromium.launchPersistentContext(
    //   this.userDataDir,
    //   {
    //     channel: 'msedge',
    //     headless: false,
    //     proxy: this.httpProxy
    //       ? {
    //           server: `${this.httpProxy}`,
    //         }
    //       : undefined,
    //     args: ['--disable-blink-features=AutomationControlled'],
    //   },
    // );
    const browser_context = await this.getBrowserContext();
    const page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');
    await page.waitForTimeout(2000);
    const login_btn = page.locator('#login-btn');
    const need_login = (await login_btn.count()) > 0;
    await browser_context.close();
    if (need_login) return true;
    return false;
  }

  async xhs_try_login() {
    const browser_context = await chromium.launchPersistentContext(
      this.userDataDir,
      {
        channel: 'msedge',
        headless: false,
        proxy: this.httpProxy
          ? {
              server: `${this.httpProxy}`,
            }
          : undefined,
        args: ['--disable-blink-features=AutomationControlled'],
      },
    );
    const page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');
    await page.waitForResponse(
      'https://edith.xiaohongshu.com/api/sns/web/v2/user/me',
    );
    await browser_context.close();
  }

  async xhs_search(browser_context: BrowserContext, keyword: string) {
    const page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');

    const search_input = page.locator('#search-input');
    await search_input.focus();
    await search_input.fill(keyword);
    await page.keyboard.press('Enter');
    const notes_list = [];
    const calwer = async () => {
      return new Promise((resovle, reject) => {
        page.on('response', async (response: Response) => {
          const url = new URL(response.url());
          const status = response.status();
          let md = '';
          if (
            status == 200 &&
            response.request().method().toLowerCase() == 'post'
          ) {
            const headers = response.headers();
            if (headers['content-type'].includes('/json')) {
              const data = await response.json();

              if (data.success && data.data && data.data.items) {
                for (let index = 0; index < data.data.items.length; index++) {
                  const item: XHSNoteItem = data.data.items[index];
                  if (item.model_type == 'note') {
                    notes_list.push(item);
                  }
                }
                resovle(notes_list);
              }
            }
          }
        });
      });
    };
    const list = await calwer();
    console.log(list);
    await browser_context.close();
    return '';
  }

  async xhs_post_detail(browser_context: BrowserContext, url: string) {
    const page = await browser_context.newPage();
    let note = null;
    let comments = null;
    page.on('response', async (response: Response) => {
      //console.log(response.url());
      const url = new URL(response.url());
      const status = response.status();
      // if (url.href.includes('comment/page?')) {
      //   const data = await response.json();
      //   console.log(data);
      // }

      if (url.href.includes('/explore/')) {
        const data = await response.text();

        const $ = cheerio.load(data);

        $('script').each((index, element) => {
          const scriptContent = $(element).html();
          const myVarMatch = scriptContent.match(/window.__INITIAL_STATE__/);
          if (myVarMatch) {
            const text = scriptContent.substring(
              scriptContent.indexOf('=') + 1,
            );
            let sandbox = { info: undefined };
            vm.createContext(sandbox); // 创建隔离的沙箱环境
            vm.runInContext('var info = ' + text, sandbox);
            note = sandbox.info.note;
            note = note.noteDetailMap[note.currentNoteId].note;
            console.log('note:', note);
          }
        });
        //console.log(data);
      } else if (url.href.includes('comment/page?')) {
        const data = await response.json();
        //console.log(data.data.comments);
        comments = data.data.comments;
      }
    });
    await page.goto(url);
    await page.waitForResponse(async (response) => {
      if (note && comments) {
        // const data = await response.json();
        // //console.log(data.data.comments);
        // comments = data.data.comments;
        return true;
      } else {
        return false;
      }
    });

    page.close();
    console.log(note);
    return { note, comments };
  }

  async bilibili(browser_context: BrowserContext, keyword: string) {
    const page = await browser_context.newPage();
    await page.goto('https://www.bilibili.com/');
    const search_input = page.locator('.nav-search-input');
    await search_input.focus();
    await search_input.fill(keyword);
    await page.keyboard.press('Enter');
    const pagePromise = browser_context.waitForEvent('page');
    // await page.getByRole('button').click();
    const page_2 = await pagePromise;
    const title = await page_2.title();
    //const pages = browser_context.pages();
    return '';
  }

  async twitter(browser_context: BrowserContext, keyword: string) {
    const page = await browser_context.newPage();
    await page.goto('https://twitter.com/login');

    return '';
  }
}
