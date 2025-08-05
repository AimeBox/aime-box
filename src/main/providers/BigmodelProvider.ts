import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { ChatMinimax } from '@langchain/community/chat_models/minimax';
import { OpenAI } from 'openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ChatOpenAI } from '@langchain/openai';

export class BigmodelProvider extends BaseProvider {
  name: string = ProviderType.BIGMODEL;

  description: string;

  defaultApiBase: string = 'https://open.bigmodel.cn/api/paas/v4';

  constructor(params?: BaseProviderParams) {
    super(params);
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
    if (modelName.includes('glm-4.5')) {
      max_context_length = 128 * 1000;
    }
    llm.metadata = {
      max_context_length,
    };
    return llm;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    return [
      {
        name: 'glm-4.5',
        enable:
          this.provider.models?.find((z) => z.name == 'glm-4.5')?.enable ||
          false,
      },
      {
        name: 'glm-4.5-x',
        enable:
          this.provider.models?.find((z) => z.name == 'glm-4.5-x')?.enable ||
          false,
      },
      {
        name: 'glm-4.5-air',
        enable:
          this.provider.models?.find((z) => z.name == 'glm-4.5-air')?.enable ||
          false,
      },
      {
        name: 'glm-4.1v-thinking-flash',
        enable:
          this.provider.models?.find((z) => z.name == 'glm-4.1v-thinking-flash')
            ?.enable || false,
      },
    ];
  }
}
