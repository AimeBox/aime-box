import { ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAI } from 'openai';
import { ChatOptions } from '@/entity/Chat';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export class MoonshotProvider extends BaseProvider {
  name: string = ProviderType.MOONSHOT;

  description: string;

  defaultApiBase: string = 'https://api.moonshot.cn/v1';

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatOpenAI({
      apiKey: this.provider.api_key,
      modelName: modelName,
      configuration: {
        apiKey: this.provider.api_key,
        baseURL: this.provider.api_base || this.defaultApiBase,
        // httpAgent: settingsManager.getHttpAgent(),
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
    let max_context_length = 64 * 1000;

    if (modelName.includes('kimi-k2')) {
      max_context_length = 128 * 1000;
    } else if (modelName.includes('8k')) {
      max_context_length = 8 * 1000;
    } else if (modelName.includes('32k')) {
      max_context_length = 32 * 1000;
    } else if (modelName.includes('128k')) {
      max_context_length = 128 * 1000;
    }

    llm.metadata = {
      max_context_length: max_context_length,
    };
    return llm;
  }

  async getCredits(): Promise<{
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  }> {
    const options = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };

    const res = await fetch(
      `https://api.moonshot.cn/v1/users/me/balance`,
      options,
    );
    if (!res.ok) return undefined;

    const data = await res.json();
    if (data.code != 0) return undefined;
    return {
      totalCredits: undefined,
      usedCredits: undefined,
      remainingCredits: parseFloat(data.data.available_balance),
    };
  }
}
