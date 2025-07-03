import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from '../BaseTool';
import { t } from 'i18next';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { instanceManager } from '../../instances';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import * as vm from 'vm';
import { Response } from 'playwright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { saveFile } from '@/main/utils/common';

export interface BilibiliParameters extends ToolParams {
  instancId?: string;
}

export class BilibiliSearchTool extends BaseTool {
  schema = z.object({
    keyword: z.string(),
  });

  name: string = 'bilibili_search';

  description: string = 'search bilibili video';

  instancId: string;

  constructor(params: BilibiliParameters) {
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
    let page = await browser_context.newPage();
    await page.goto('https://www.bilibili.com/');
    const search_input = page.locator('.nav-search-input');
    await search_input.focus();
    await search_input.fill(input.keyword);
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
        vm.runInContext(`var info = ${text}`, sandbox);
        const result = sandbox.info?.searchResponse?.searchAllResponse?.result;
        const data = result.find((x) => x.result_type == 'video')?.data;
        list = data.map((x) => {
          return {
            url: `https://www.bilibili.com/video/${x.bvid}`,
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
    return JSON.stringify(list);
  }
}

export class BilibiliDownloadTool extends BaseTool {
  schema = z.object({
    url: z.string(),
  });

  name: string = 'bilibili_download';

  description: string = 'download bilibili video';

  instancId: string;

  constructor(params: BilibiliParameters) {
    super(params);
    this.instancId = params?.instancId;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const instance = await instanceManager.getBrowserInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page = await browser_context.newPage();
    await page.goto('https://snapany.com/bilibili');
    await page.waitForLoadState('networkidle');
    await page.locator('(//input)[1]').fill(input.url);
    await page.locator('(//input)[1]').press('Enter');
    await page.waitForLoadState('networkidle');
    const calwer = async (): Promise<{ text: string; medias: any }> => {
      return new Promise((resovle, reject) => {
        page.once('response', async (response: Response) => {
          const url = new URL(response.url());
          const status = response.status();

          if (
            status == 200 &&
            response.request().method().toLowerCase() == 'post' &&
            url.pathname.endsWith('/v1/extract')
          ) {
            const data = await response.json();
            resovle(data as { text: string; medias: any });
          } else {
            reject(new Error('response failed'));
          }
        });
      });
    };
    try {
      const data = await calwer();
      await page.close();
      console.log(data);
      if (data.medias.length > 0) {
        const media = data.medias.find((x) => x.media_type == 'video');
        if (!media) return 'this url not find bilibili video';
        const { preview_url, resource_url } = media;
        //const ext = path.extname(resource_url);
        // 保存视频到本地
        const saveFilePath_Video = await saveFile(
          resource_url,
          `${uuidv4()}.mp4`,
          config,
        );
        // 保存封面到本地
        const saveFilePath_Image = await saveFile(
          resource_url,
          `${uuidv4()}.`,
          config,
        );

        return `video saved success.\n<file>${saveFilePath_Video}</file>`;
      } else {
        return 'this url is not a bilibili video';
      }
    } catch (err) {
      console.error(err);
      //await browser_context.close();
      throw err;
    }
  }
}

export class BilibiliProfileTool extends BaseTool {
  schema = z.object({
    user_id: z.string(),
  });

  name: string = 'bilibili_profile';

  description: string = 'get bilibili video profile';

  instancId: string;

  constructor(params: BilibiliParameters) {
    super(params);
    this.instancId = params?.instancId;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const instance = await instanceManager.getBrowserInstance(this.instancId);
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page = await browser_context.newPage();

    let data;
    page.once('response', async (response: Response) => {
      const url = new URL(response.url());
      const status = response.status();

      if (
        status == 200 &&
        response.request().method().toLowerCase() == 'get' &&
        url.pathname.endsWith('/search')
      ) {
        data = await response.json();
      }
    });
    await page.goto(`https://space.bilibili.com/${input.user_id}/upload/video`);
    const responsePromise = await page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith('/search') &&
        response.status() == 200 &&
        response.request().method().toLowerCase() == 'get'
      );
    });

    await page.waitForLoadState('networkidle');
    const res = await responsePromise.json();
    if (res.code != 0) {
      return 'response failed';
    }
    const list = res.data.list.vlist.map((x) => {
      const timestamp = x.created * 1000; // 示例时间戳

      const date = new Date(timestamp);
      const dateString = date.toISOString().split('T')[0];
      return {
        bvid: x.bvid,
        url: `https://www.bilibili.com/video/${x.bvid}`,
        title: x.title,

        description: x.description,
        comment: x.comment,
        play: x.play,
        review: x.review,
        created: dateString,
        length: x.length,
      };
    });

    console.log(list);
    return JSON.stringify(list);
  }
}

export class BilibiliToolkit extends BaseToolKit {
  name: string = 'bilibili_toolkit';

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

  //instancId: string;

  constructor(params: BilibiliParameters) {
    super(params);
  }

  getTools(): BaseTool[] {
    return [
      new BilibiliSearchTool(this.params),
      new BilibiliDownloadTool(this.params),
      new BilibiliProfileTool(this.params),
    ];
  }
}
