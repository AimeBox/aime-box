import { t } from 'i18next';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { isUrl } from '../utils/is';
import { BrowserInstance } from '../instances/BrowserInstance';
import { instanceManager } from '../instances';
import { BrowserContext, Page, Response } from 'playwright';
import * as vm from 'vm';
import * as cheerio from 'cheerio';
import { z } from 'zod';

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
  instancId?: string;
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
    const instance = await instanceManager.getBrowserInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
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
      page.removeAllListeners();
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
            const sandbox = { info: undefined };
            vm.createContext(sandbox); // 创建隔离的沙箱环境
            vm.runInContext(`var info = ${text}`, sandbox);
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

    // page.close();
    console.log(note, comments);
    return { note, comments };
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const instance = await instanceManager.getBrowserInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
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
    const instance = await instanceManager.getBrowserInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const outputs = [];
    let page = get_xhs_page(browser_context);
    if (!page) page = await browser_context.newPage();
    await page.goto('https://www.xiaohongshu.com/explore');

    const login_btn = page.locator('#login-btn');
    const need_login = (await login_btn.count()) > 0;
    if (need_login) {
      return 'user is not logged in';
    }
    await page.locator("//span[text()='创作中心']").click();
    await page.locator("//a[text()='创作服务']").click();
    return 'success';
  }
}

export class RedNoteToolkit extends BaseToolKit {
  name: string = 'rednote_toolkit';

  configSchema?: FormSchema[] = [
    {
      label: t('tools.instancId'),
      field: 'instancId',
      component: 'InstanceSelect',
      componentProps: {
        allowClear: true,
      },
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
      new RedNotePublishTool(this.params),
    ];
  }
}
