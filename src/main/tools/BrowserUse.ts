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

export interface BrowserUseParameters extends ToolParams {
  model: string;
  plannerModel?: string;
  useVision: boolean;
  chromeInstancePath: string;
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
      label: t('useVision'),
      field: 'useVision',
      component: 'Switch',
      defaultValue: false,
    },
    {
      label: t('common.plannerModel'),
      field: 'plannerModel',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
        allowClear: true,
      },
    },
    {
      label: t('chromeInstancePath'),
      field: 'chromeInstancePath',
      component: 'Input',
    },
  ];

  model: string;

  plannerModel?: string;

  useVision: boolean;

  chromeInstancePath?: string;

  constructor(params?: BrowserUseParameters) {
    super();
    const { model, useVision = false, chromeInstancePath } = params ?? {};
    this.model = model;
    this.useVision = useVision;
    this.chromeInstancePath = chromeInstancePath;
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
    let browser;
    if (this.chromeInstancePath && fs.existsSync(this.chromeInstancePath)) {
      browser = new Browser({
        chromeInstancePath: this.chromeInstancePath,
      } as BrowserConfig);
    }
    const agent = new Agent({
      task: input.task,
      llm: llm,
      plannerLlm: plannerLlm,
      useVision: this.useVision,
      browser: browser,
    });
    const result = await agent.run();
    return result.history
      .map((x) => x.result.map((r) => r.extractedContent).join('\n'))
      .join('\n');
  }
}
