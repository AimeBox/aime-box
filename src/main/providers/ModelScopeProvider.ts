import { ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { OpenAI } from 'openai';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class ModelScopeProvider extends BaseProvider {
  name: string = ProviderType.MODELSCOPE;

  description: string;

  defaultApiBase: string = 'https://api-inference.modelscope.cn/v1';

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();

    this.openaiClient = new OpenAI({
      baseURL: this.provider.api_base,
      apiKey: this.provider.api_key,
      httpAgent: this.httpProxy,
    });
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const models = (await this.openaiClient.models.list()).data;
    return models
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models.find((z) => z.name == x.id)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async imageGeneration(input: {
    prompt: string;
    model: 'Qwen/Qwen-Image' | string;
    aspect_ratio: string;
    n?: number;
    prompt_optimizer: boolean;
  }): Promise<string[]> {
    const url = `${this.provider.api_base || this.defaultApiBase}/images/generations`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
        'X-ModelScope-Async-Mode': 'true',
      },
      body: JSON.stringify({
        model: input.model || 'Qwen/Qwen-Image',
        prompt: prompt,
      }),
    });
    if (!response.ok)
      throw new Error(`generation image fail: ${await response.text()}`);
    const data = await response.json();
    const { task_id } = data.data;
    return task_id;
  }
}
