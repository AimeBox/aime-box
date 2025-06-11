import { Tool, ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { z } from 'zod';

import {
  Browser,
  BrowserContext,
  chromium,
  firefox,
  webkit,
  Response,
  Page,
} from 'playwright';
import settingsManager from '../settings';
import iconv from 'iconv-lite';
import { execFileSync } from 'child_process';
import path from 'path';
import { app, BrowserWindow, dialog } from 'electron';

import * as cheerio from 'cheerio';

import * as vm from 'vm';
import { getDataPath } from '../utils/path';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { instanceManager } from '../instances';
import { BrowserInstance } from '../instances/BrowserInstance';
import { isUrl } from '../utils/is';

// const getUserDataPath = (...paths: string[]): string => {
//   return path.join(
//     app.isPackaged
//       ? path.join(process.resourcesPath, '.data/User Data')
//       : path.join(__dirname, '../../../../.data/User Data'),
//     ...paths,
//   );
// };

export interface SocialMediaSearchParameters extends ToolParams {
  chromeInstancePath: string;
}

interface XHSNoteItem {
  id: string;
  model_type: string;
  note_card: {
    corner_tag_info?: {
      type?: string;
      text?: string;
    }[];
    user: {
      avatar: string;
      user_id: string;
      nickname: string;
      nick_name: string;
    };
    interact_info: {
      collected_count?: string;
      comment_count?: string;
      liked?: boolean;
      liked_count?: string;
      shared_count?: string;
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
    display_title?: string;
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
    keyword: z.string().optional(),
    url: z.string().optional().describe('网址连接'),
    //count: z.number().default(10),
  });

  name: string = 'social_media_search';

  description: string = 'search social media post';

  userDataDir: string;

  httpProxy: string | undefined;

  outputFormat: 'json' | 'markdown' = 'json';

  configSchema?: FormSchema[] = [
    {
      label: t('tools.chromeInstancePath'),
      field: 'chromeInstancePath',
      component: 'Input',
    },
  ];

  chromeInstancePath?: string;

  constructor(params: SocialMediaSearchParameters) {
    super();
    const { chromeInstancePath } = params ?? {};
    this.userDataDir = path.join(getDataPath(), 'User Data');
    this.chromeInstancePath = chromeInstancePath;
  }

  async getBrowserContext(): Promise<BrowserContext> {
    const browser_context = await chromium.launchPersistentContext(
      this.userDataDir,
      {
        channel: 'msedge',
        headless: false,
        devtools: true,
        proxy: {
          server: this.httpProxy,
        },
        args: ['--disable-blink-features=AutomationControlled'],
      },
    ); // Or 'firefox' or 'webkit'.
    return browser_context;
    // chromium.launchPersistentContext()
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
        const res = await this.xhs_search(browser_context, input.keyword);
        return this.xhs_search_item_to_markdown(res);
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
      const res = await this.bilibili(browser_context, input.keyword);
      return JSON.stringify(res);
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
      res = await this.twitter(browser_context, input.keyword);
      //await browser_context.close();
    }

    return res;
    // } catch (e) {
    //   throw e;
    // }
  }

  async xhs_search_item_to_markdown(data: XHSNoteItem[]) {
    let text = '';

    for (const item of data) {
      // text += `<note>\n`;

      text += `### Url: \nhttps://www.xiaohongshu.com/explore/${item.id}?xsec_token=${item.xsec_token}\n`;
      // text += `### Author: \n${item.note_card.user.nickname}\n`;
      text += item?.note_card?.display_title
        ? `### Title:\n${item.note_card.display_title}\n`
        : '';
      text += `### Image\n![](${item.note_card.cover.url_pre})\n`;
      text += `### Type: ${item.note_card.type}\n`;
      text += `### Likes: ${item.note_card.interact_info.liked_count}\n`;
      if (item.note_card.interact_info.comment_count) {
        text += `### Comments: ${item.note_card.interact_info.comment_count} comments\n`;
      }
      if (item.note_card.interact_info.collected_count) {
        text += `### Collected: ${item.note_card.interact_info.collected_count} collected\n`;
      }
      if (item.note_card.interact_info.shared_count) {
        text += `### Shared: ${item.note_card.interact_info.shared_count} shared\n`;
      }
      text += `\n\n---\n`;
    }

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

  async xhs_search(
    browser_context: BrowserContext,
    keyword: string,
  ): Promise<XHSNoteItem[]> {
    const page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');

    const search_input = page.locator('#search-input');
    await search_input.focus();
    await search_input.fill(keyword);
    await page.keyboard.press('Enter');
    const notes_list: XHSNoteItem[] = [];
    const calwer = async (): Promise<XHSNoteItem[]> => {
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
              console.log(data);
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
    try {
      const list = await calwer();
      console.log(list);
      await browser_context.close();
      return list;
    } catch (err) {
      console.log(err);
      await browser_context.close();
      return [];
    }
  }

  async bilibili(browser_context: BrowserContext, keyword: string) {
    let page = await browser_context.newPage();
    await page.goto('https://www.bilibili.com/');
    const search_input = page.locator('.nav-search-input');
    await search_input.focus();
    await search_input.fill(keyword);
    let list;

    await page.keyboard.press('Enter');
    page = await browser_context.waitForEvent('page');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    const $ = cheerio.load(content);

    $('script').each((index, element) => {
      const scriptContent = $(element).html();
      const myVarMatch = scriptContent.match(/window.__pinia/);
      if (myVarMatch) {
        const text = scriptContent.substring(scriptContent.indexOf('=') + 1);
        let sandbox = { info: undefined };
        vm.createContext(sandbox); // 创建隔离的沙箱环境
        vm.runInContext('var info = ' + text, sandbox);
        const result = sandbox.info?.searchResponse?.searchAllResponse?.result;
        const data = result.find((x) => x.result_type == 'video')?.data;
        list = data.map((x) => {
          return {
            arcurl: x.arcurl,
            bvid: x.bvid,
            title: x.title,
            description: x.description,
            duration: x.duration,
            favorites: x.favorites,
            like: x.like,
            play: x.play,
            review: x.review,
            pubdate: x.pubdate,
            tag: x.tag,
          };
        });
      }
    });
    //const pages = browser_context.pages();
    return list;
  }

  async twitter(browser_context: BrowserContext, keyword: string) {
    const page = await browser_context.newPage();
    await page.goto('https://x.com/explore');
    await page.waitForLoadState();
    console.log(page.url());
    if (!page.url().startsWith('https://x.com/explore')) {
      await page.waitForURL('https://x.com/explore');
    }
    await page.locator("//input[@enterkeyhint='search']").fill(keyword);
    let data;
    page.on('response', async (response: Response) => {
      //console.log(response.url());
      const url = response.url();
      const status = response.status();
      const regx = /^https:\/\/x\.com\/i\/api\/graphql\/.*\/SearchTimeline\?.*/;
      const match = url.match(regx);
      if (match) {
        data = await response.json();
        console.log(data);
      }
    });
    await page.keyboard.press('Enter');
    await page.waitForResponse(async (response) => {
      if (data?.data && !data?.errors) {
        // const data = await response.json();
        // //console.log(data.data.comments);
        // comments = data.data.comments;
        return true;
      } else {
        return false;
      }
    });
    const instructions =
      data.data.search_by_raw_query.search_timeline.timeline.instructions;
    const entries = instructions[0].entries;
    const list = entries
      .filter((x) => x?.content?.itemContent && x?.entryId.startsWith('tweet-'))
      .map((x) => {
        const media: any[] | undefined =
          x?.content?.itemContent?.tweet_results?.result?.legacy?.entities
            ?.media;

        const photo_urls =
          media
            ?.filter((x) => x.type == 'photo')
            .map((x) => x.media_url_https) || [];
        const video_urls =
          media
            ?.filter((x) => x.type == 'video' && x?.video_info?.variants)
            .map(
              (x) =>
                x?.video_info?.variants.find(
                  (z) => z.content_type == 'video/mp4',
                )?.url,
            ) || [];

        return {
          text: x.content.itemContent.tweet_results?.result?.legacy?.full_text,
          favorite_count:
            x.content.itemContent.tweet_results.result.legacy?.favorite_count,
          quote_count:
            x.content.itemContent.tweet_results.result.legacy?.quote_count,
          reply_count:
            x.content.itemContent.tweet_results.result.legacy?.reply_count,
          bookmark_count:
            x.content.itemContent.tweet_results.result.legacy?.bookmark_count,
          view_count: x.content.itemContent.tweet_results.result?.views?.count,
          video_urls,
          photo_urls,
        };
      });
    console.log(list);
    await browser_context.close();
    return JSON.stringify(list);
  }
}

const xhs_note_to_markdown = (data: { note: any; comments: any }) => {
  let text = '<note>\n';

  text += `### 标题:${data.note.title}\n`;
  text += `### 内容\n${data.note.desc}\n`;

  if (data.note.interactInfo.likedCount) {
    text += `### 点赞: ${data.note.interactInfo.likedCount}\n`;
  }
  if (data.note.interactInfo.commentCount) {
    text += `### 评论: ${data.note.interactInfo.commentCount}\n`;
  }
  if (data.note.interactInfo.collectedCount) {
    text += `### 收藏: ${data.note.interactInfo.collectedCount}\n`;
  }
  if (data.note.interactInfo.shareCount) {
    text += `### 分享: ${data.note.interactInfo.shareCount}\n`;
  }
  if (data.note.tagList && data.note.tagList.length > 0) {
    text += `### 标签: ${data.note.tagList.map((x) => `#${x.name}`).join(' ')}\n`;
  }

  text += `### 图片\n${data.note.imageList.map((x) => `![](${x.urlDefault})`).join('\n')}\n`;
  if (data.note.video) {
    const stream = Object.values(data.note.video.media.stream);
    const item = stream.find((x: any[]) => x.length > 0);
    const video_url = item[0].backupUrls[0];
    text += `### 视频\n[](${video_url})\n`;
  }

  if (data.comments.length > 0) {
    text += `### 评论:\n`;
    for (const comment of data.comments) {
      text += `${comment.content}\n`;
    }
  }

  text += `\n</note>`;
  return text;
};

const get_xhs_page = (browser_context: BrowserContext): Page => {
  const page = browser_context
    .pages()
    .find((x) => x.url().startsWith('https://www.xiaohongshu.com'));
  return page;
};

export interface RedNoteParameters extends ToolParams {
  instancId: string;
}

export class RedNoteSearchTool extends BaseTool {
  schema = z.object({
    keywords: z.array(z.string()),
  });

  name: string = 'rednote_search';

  description: string = 'search social media post in rednote';

  instancId: string;

  constructor(params: RedNoteParameters) {
    super(params);
    this.instancId = params?.instancId;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const instance = await instanceManager.getInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const browser_instance = instance as BrowserInstance;
    const browser_context = browser_instance.browser_context;
    const outputs = [];
    let page = get_xhs_page(browser_context);
    if (!page) page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');

    const login_btn = page.locator('#login-btn');
    const need_login = (await login_btn.count()) > 0;
    if (need_login) {
      return 'user is not logged in';
    }
    for (const keyword of input.keywords) {
      const list = await this.xhs_search(page, keyword);
      const output = await this.xhs_search_item_to_markdown(list);
      outputs.push(output);
    }
    return outputs.join('\n');
  }

  async xhs_search(page: Page, keyword: string): Promise<XHSNoteItem[]> {
    const search_input = page.locator('#search-input');
    await search_input.focus();
    await search_input.fill(keyword);
    await page.keyboard.press('Enter');
    const notes_list: XHSNoteItem[] = [];
    const calwer = async (): Promise<XHSNoteItem[]> => {
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
              console.log(data);
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
    try {
      const list = await calwer();
      console.log(list);
      //await browser_context.close();
      return list;
    } catch (err) {
      console.log(err);
      //await browser_context.close();
      return [];
    }
  }

  async xhs_search_item_to_markdown(data: XHSNoteItem[]) {
    let text = '';

    for (const item of data) {
      // text += `<note>\n`;

      text += `### Url: \nhttps://www.xiaohongshu.com/explore/${item.id}?xsec_token=${item.xsec_token}\n`;
      // text += `### Author: \n${item.note_card.user.nickname}\n`;
      text += item?.note_card?.display_title
        ? `### Title:\n${item.note_card.display_title}\n`
        : '';
      text += `### Image\n![](${item.note_card.cover.url_pre})\n`;
      text += `### Type: ${item.note_card.type}\n`;
      text += `### Likes: ${item.note_card.interact_info.liked_count}\n`;
      if (item.note_card.interact_info.comment_count) {
        text += `### Comments: ${item.note_card.interact_info.comment_count} comments\n`;
      }
      if (item.note_card.interact_info.collected_count) {
        text += `### Collected: ${item.note_card.interact_info.collected_count} collected\n`;
      }
      if (item.note_card.interact_info.shared_count) {
        text += `### Shared: ${item.note_card.interact_info.shared_count} shared\n`;
      }
      text += `\n\n---\n`;
    }

    return text;
  }
}

export class RedNoteDetailTool extends BaseTool {
  schema = z.object({
    urls: z.array(z.string()),
  });

  name: string = 'rednote_detail';
  toolKitName?: string = 'rednote_toolkit';

  description: string =
    'get rednote post detail,input urls must be like https://www.xiaohongshu.com/explore/<post_id>?xsec_token=xxx';

  instancId: string;

  constructor(params: RedNoteParameters) {
    super(params);
    this.instancId = params?.instancId;
  }

  async xhs_post_detail(page: Page, url: string) {
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
        // https://edith.xiaohongshu.com/api/sns/web/v2/comment/page?note_id=683e6bbd000000002300cfca&cursor=&top_comment_id=&image_formats=jpg,webp,avif&xsec_token=ABybeSun74CtefSez-oXZh4fl4MHhgmo7-GIZHbo-nK4A%3D
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
    console.log(note, comments);
    return { note, comments };
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const instance = await instanceManager.getInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const browser_instance = instance as BrowserInstance;
    const browser_context = browser_instance.browser_context;
    const outputs = [];
    let page = get_xhs_page(browser_context);
    if (!page) page = await browser_context.newPage();

    for (const url of input.urls) {
      if (!isUrl(url)) {
        return `url is not valid: ${url}`;
      }
      if (!url.startsWith('https://www.xiaohongshu.com/explore/')) {
        return `url is not valid: ${url},must start with "https://www.xiaohongshu.com/explore/"`;
      }
      if (!url.includes('?xsec_token=')) {
        return `url is not valid: ${url},must include "xsec_token="`;
      }
    }

    for (const url of input.urls) {
      const res = await this.xhs_post_detail(page, url);
      const output = xhs_note_to_markdown(res);
      outputs.push(output);
    }

    return outputs.join('\n');
  }
}

export class RedNotePublishTool extends BaseTool {
  schema = z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    meida: z.union([
      z.object({ video: z.string() }),
      z.object({ images: z.array(z.string()) }),
    ]),
  });

  name: string = 'rednote_publish';
  toolKitName?: string = 'rednote_toolkit';

  description: string =
    'publish a rednote post, meida support one video or many images';

  instancId: string;

  constructor(params: RedNoteParameters) {
    super(params);
    this.instancId = params?.instancId;
  }

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class RedNoteToolkit extends BaseToolKit {
  name: string = 'rednote_toolkit';

  configSchema?: FormSchema[] = [
    {
      label: t('tools.instancId'),
      field: 'instancId',
      component: 'InstanceSelect',
    },
  ];

  params?: RedNoteParameters;
  //instancId: string;

  constructor(params: RedNoteParameters) {
    super();
    this.params = params;
  }

  getTools(): BaseTool[] {
    return [
      new RedNoteSearchTool(this.params),
      new RedNoteDetailTool(this.params),
    ];
  }
}
