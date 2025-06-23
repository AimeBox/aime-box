import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  execFile,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import { runCommand } from '../utils/exec';
import { BaseTool } from './BaseTool';
import { platform } from 'process';
import { t } from 'i18next';
import { FormSchema } from '@/types/form';
import { Agent, Browser, BrowserConfig } from 'browser-use-js';
import { getChatModel } from '../llm';
import { getProviderModel } from '../utils/providerUtil';
import fs from 'fs';
import { dialog } from 'electron';
import settingsManager from '../settings';
import os from 'os';
import path from 'path';
import InstancesManager from '@/renderer/pages/Settings/InstancesManager';
import { instanceManager } from '../instances';

export interface BrowserUseParameters extends ToolParams {
  model: string;
  plannerModel?: string;
  useVision: boolean;
  chromeInstancePath: string;
  userDataDir?: string;
}

export class BrowserUseTool extends BaseTool {
  schema = z.object({
    task: z.string(),
  });

  name: string = 'browser_use';

  description: string = `use browser to complete the task.`;

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
    {
      label: t('tools.useVision'),
      field: 'useVision',
      component: 'Switch',
      defaultValue: false,
    },
    {
      label: t('tools.plannerModel'),
      field: 'plannerModel',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
        allowClear: true,
      },
    },
    {
      label: t('tools.chromeInstancePath'),
      field: 'chromeInstancePath',
      component: 'Input',
    },
    {
      label: t('tools.userDataDir'),
      field: 'userDataDir',
      component: 'Input',
    },
  ];

  model: string;

  plannerModel?: string;

  useVision: boolean;

  chromeInstancePath?: string;

  userDataDir?: string;

  constructor(params?: BrowserUseParameters) {
    super();
    const {
      model,
      useVision = false,
      chromeInstancePath,
      userDataDir,
    } = params ?? {};
    this.model = model;
    this.useVision = useVision;
    this.chromeInstancePath = chromeInstancePath;
    this.userDataDir = userDataDir;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    if (!input.task) {
      return 'task is required';
    }

    const { provider, modelName } = getProviderModel(this.model);

    let plannerLlm;
    const llm = await getChatModel(provider, modelName, { temperature: 0 });
    if (this.plannerModel) {
      const { provider, modelName } = getProviderModel(this.plannerModel);
      plannerLlm = await getChatModel(provider, modelName, {
        temperature: 0,
      });
    }
    const instances = await instanceManager.getBrowserInstance();
    console.log(instances);
    const browser = new Browser({
      chromeInstancePath: this.chromeInstancePath,
      // userDataDir: this.userDataDir,
      proxy: {
        server: settingsManager.getPorxy(),
      },
      headless: false,
      extraChromiumArgs: [
        '--disable-blink-features=AutomationControlled',
        //`-user-data-dir=${this.userDataDir}`,
      ],
    } as BrowserConfig);

    try {
      const agent = new Agent({
        task: input.task,
        llm: llm,
        plannerLlm: plannerLlm,
        useVision: this.useVision,
        browser: browser,
      });

      const result = await agent.run();
      await browser.close();
      if (result.history.length > 0) {
        return result.history
          .map((x) => x.result.map((r) => r.extractedContent).join('\n'))
          .join('\n');
      } else {
        return 'error';
      }
    } catch (err) {
      await browser.close();
      console.log(err);
      return err.message;
    }
  }

  getChromeUserDataPath() {
    const homeDir = os.homedir();

    switch (process.platform) {
      case 'win32':
        return path.join(
          homeDir,
          'AppData',
          'Local',
          'Google',
          'Chrome',
          'User Data',
        );
      case 'darwin':
        return path.join(
          homeDir,
          'Library',
          'Application Support',
          'Google',
          'Chrome',
        );
      case 'linux':
        return path.join(homeDir, '.config', 'google-chrome');
      default:
        return null;
    }
  }
}
