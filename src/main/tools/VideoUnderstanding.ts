import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import fs, { promises as fsPromises, existsSync } from 'fs';
import settingsManager from '../settings';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { getProviderModel } from '../utils/providerUtil';
import { getChatModel } from '../llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isUrl } from '../utils/is';
import { t } from 'i18next';
import fg from 'fast-glob';
import path from 'path';
import { ProviderType } from '@/entity/Providers';
import providersManager from '../providers';

export interface VideoUnderstandingParameters extends ToolParams {
  providerId: string;
}

export class VideoUnderstanding extends BaseTool {
  schema = z.object({
    fileOrUrl: z.string().describe('video file path'),
    prompt: z.string().describe('system prompt').optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'providerId',
      component: 'ProviderSelect',
      label: t('common.model'),
      componentProps: {
        selectMode: 'providers',
        providerType: ProviderType.GOOGLE,
      },
    },
  ];

  name: string = 'video_understanding';

  description: string =
    'get me the video from the file or url with prompt and return the video understanding';

  providerId?: string;

  constructor(params?: VideoUnderstandingParameters) {
    super();
    this.providerId = params?.providerId;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { fileOrUrl, prompt } = input;
    const provider = await providersManager.getProvider(this.providerId);
    if ('videoUnderstanding' in provider) {
      const res = await provider?.videoUnderstanding({
        model: config.model,
        fileOrUrl,
        prompt,
      });
      return res;
    } else {
      return 'provider not support videoUnderstanding';
    }
  }
}
