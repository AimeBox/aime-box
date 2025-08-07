import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from './BaseTool';
import { ToolParams } from '@langchain/core/tools';
import { t } from 'i18next';
import { z } from 'zod';
import { instanceManager } from '../instances';
import { ConsoleMessage, Page } from 'playwright';
import fs from 'fs';
import { getTmpPath } from '../utils/path';
import { BrowserInstance } from '../instances/BrowserInstance';
import { AnyIfEmpty } from 'react-redux';

export interface BrowserParameters extends ToolParams {
  instancId?: string;
  model?: string;
}

const getStagehand = async (instancId: string, model: string) => {
  const instance = await instanceManager.getBrowserInstance(instancId, model);
  if (!instance) {
    throw new Error('instance not found');
  }
  const browser_context = await instance.getEnhancedContext();
  return instance.stagehand;
};
export class BrowserGetTabs extends BaseTool {
  schema = z.object({});

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_get_current_state';

  description: string = 'Get the current browser tabs.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
      this.params.model,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const tabs = browser_context.pages();
    return tabs.map((tab, index) => ({
      tabId: index.toString(),
      url: tab.url(),
      title: tab.title(),
    }));
  }
}

export class BrowserNavigate extends BaseTool {
  schema = z.object({
    url: z.string().describe('The URL to navigate to.'),
    observe_info: z
      .object({
        console_level: z
          .enum(['error', 'warning', 'info', 'log'])
          .optional()
          .describe(
            'Optional: If set will return console log level, default is none',
          ),
        observe_prompt: z.string().optional().describe(''),
      })
      .optional()
      .describe(
        'It will return the console log level, and the prompt to observe the page after navigation.',
      ),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_navigate';

  description: string = 'Navigate to a URL.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const stagehand = await getStagehand(
      this.params.instancId,
      this.params.model,
    );
    const { page } = stagehand;

    const console_messages: any[] = [];

    const console_handler = async (message: ConsoleMessage) => {
      const args = await Promise.all(
        message.args().map((arg) => arg.jsonValue()),
      );
      console_messages.push({
        args: args,
        message: message.text(),
        type: message.type(),
        location: message.location(),
      });
    };

    page.on('console', console_handler);
    await page.goto(input.url);
    await page.waitForLoadState('networkidle');
    const actionlist = await page.observe(input.observe_info?.observe_prompt);
    page.off('console', console_handler);

    const console_output = console_messages
      ? `${JSON.stringify(console_messages, null, 2)}`
      : '(No console log)';
    return `Action: navigate
Current Tab URL: ${page.url()}
Status: completed
Date: ${new Date().toUTCString()}
Action: \n ${JSON.stringify(actionlist, null, 2)}
${input.observe_info?.console_level ? `Console: \n ${console_output}` : ''}`;
  }
}

export class BrowserAct extends BaseTool {
  schema = z.object({
    prompt: z.string().describe('The prompt to act on the page.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_action';

  description: string = 'Act on the page.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const stagehand = await getStagehand(
      this.params.instancId,
      this.params.model,
    );
    const { page } = stagehand;
    const act_res = await page.act(input.prompt);

    console.log(act_res);
    return `Browser act '${input.prompt}' is completed, This is after the action result: \n ${JSON.stringify(act_res, null, 2)}`;
  }
}

export class BrowserExtract extends BaseTool {
  schema = z.object({
    prompt: z.string().describe('The prompt to extract from the page.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_extract';

  description: string = 'Extract from the page.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const stagehand = await getStagehand(
      this.params.instancId,
      this.params.model,
    );
    const { page } = stagehand;
    const extract_res = await page.extract(input.prompt);
    console.log(extract_res);
    return `Browser extract '${input.prompt}' is completed, This is the extract result: \n ${JSON.stringify(extract_res, null, 2)}`;
  }
}
export class BrowserScript extends BaseTool {
  schema = z.object({
    prompt: z.string().describe('The prompt to extract from the page.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_script';

  description: string = 'Run a script on the page.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const stagehand = await getStagehand(
      this.params.instancId,
      this.params.model,
    );
    const { page } = stagehand;
    page.addInitScript;
    const extract_res = await page.extract(input.prompt);
    console.log(extract_res);
    return `Browser extract '${input.prompt}' is completed, This is the extract result: \n ${JSON.stringify(extract_res, null, 2)}`;
  }
}

export class BrowserRequest extends BaseTool {
  schema = z.object({
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .describe('The method to request.'),
    url: z.string().describe('The URL to request.'),
    body: z.string().describe('The body to request.'),
    headers: z
      .record(z.string(), z.string())
      .describe('The headers to request.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_request';

  description: string = 'Request a URL.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const stagehand = await getStagehand(
      this.params.instancId,
      this.params.model,
    );
  }
}

export class BrowserCloseTabs extends BaseTool {
  schema = z.object({
    url: z.string().describe('The URL to navigate to.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_close_tabs';

  description: string = 'Close all tabs.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
      this.params.model,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    return 'BrowserNavigate';
  }
}

export class BrowserClick extends BaseTool {
  schema = z.object({
    url: z.string().describe('The URL to navigate to.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_navigate';

  description: string = 'Navigate to a URL.';

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    return 'BrowserNavigate';
  }
}

export class BrowserGetCurrentState extends BaseTool {
  schema = z.object({});

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_get_current_state';

  description: string = 'Get the current state of the browser.';

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    return 'BrowserGetCurrentState';
  }
}

export class BrowserCapture extends BaseTool {
  schema = z.object({
    selector: z.string().optional(),
    tabId: z.string(),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_capture';

  description: string = 'Navigate to a URL.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page: Page = browser_context.pages()[input.tabId];
    if (input.selector) {
      const element = await page.$(input.selector);
      return element?.screenshot();
    }
    const buffer = await page.screenshot();
    const path = await fs.promises.writeFile(getTmpPath(), buffer);
    return `screenshot saved to: \n<file>${path}</file>`;
  }
}

export class BrowserBackOrForward extends BaseTool {
  schema = z.object({
    direction: z.enum(['back', 'forward']),
    tabId: z.string(),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_back_or_forward';

  description: string = 'Navigate to a URL.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page = browser_context.pages()[input.tabId];
    if (input.direction === 'back') {
      await page.goBack();
    } else {
      await page.goForward();
    }
    return 'BrowserNavigate';
  }
}

export class BrowserCloseTab extends BaseTool {
  schema = z.object({
    tabId: z.string(),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_close_tab';

  description: string = 'Navigate to a URL.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page = browser_context.pages()[parseInt(input.tabId, 10)];
    await page.close();
    return 'BrowserCloseTab';
  }
}

export class BrowserConsole extends BaseTool {
  schema = z.object({
    tabId: z.string(),
    level: z.enum(['error', 'warning', 'info', 'debug']).optional(),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_console';

  description: string = 'Get the console logs of the browser.';

  params: BrowserParameters;

  constructor(params: BrowserParameters) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    const page = browser_context.pages()[parseInt(input.tabId, 10)];
    await page.close();
    return 'BrowserCloseTab';
  }
}

export class BrowserToolkit extends BaseToolKit {
  name: string = 'browser_toolkit';

  configSchema?: FormSchema[] = [
    {
      label: t('tools.instancId'),
      field: 'instancId',
      component: 'InstanceSelect',
      componentProps: {
        allowClear: true,
      },
    },
    {
      label: t('common.model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
        allowClear: true,
      },
    },
  ];

  constructor(params?: BrowserParameters) {
    super(params);
  }

  getTools(): BaseTool[] {
    return [
      new BrowserNavigate(this.params),
      new BrowserGetTabs(this.params),
      new BrowserGetCurrentState(this.params),
      new BrowserCapture(this.params),
      new BrowserBackOrForward(this.params),
      new BrowserCloseTab(this.params),
      new BrowserConsole(this.params),
      new BrowserScript(this.params),
      new BrowserRequest(this.params),
      new BrowserAct(this.params),
      new BrowserExtract(this.params),
    ];
  }
}
