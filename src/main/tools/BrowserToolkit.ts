import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from './BaseTool';
import { ToolParams } from '@langchain/core/tools';
import { t } from 'i18next';
import { z } from 'zod';
import { instanceManager } from '../instances';
import { Page } from 'playwright';
import fs from 'fs';
import { getTmpPath } from '../utils/path';

export interface BrowserParameters extends ToolParams {
  instancId?: string;
}

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
    tabId: z
      .string()
      .optional()
      .describe('Optional: If empty will create a new tab.'),
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
    const instance = await instanceManager.getBrowserInstance(
      this.params.instancId,
    );
    if (!instance) {
      throw new Error('instance not found');
    }
    const { browser_context } = instance;
    let page;
    if (input.tabId) {
      page = browser_context.pages()[input.tabId];
    } else {
      page = await browser_context.newPage();
    }

    await page.goto(input.url);
    await page.waitForLoadState('networkidle');
    return 'BrowserNavigate';
  }
}

export class BrowserCloseTabs extends BaseTool {
  schema = z.object({
    url: z.string().describe('The URL to navigate to.'),
  });

  toolKitName?: string = 'browser_toolkit';

  name: string = 'browser_navigate';

  description: string = 'Navigate to a URL.';

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    getIn;
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

  name: string = 'browser_navigate';

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
  ];

  constructor(params?: BrowserParameters) {
    super(params);
  }

  getTools(): BaseTool[] {
    return [];
  }
}
