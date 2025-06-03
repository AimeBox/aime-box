import { Providers } from '@/entity/Providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
export interface BaseProviderParams {
  provider: Providers;
}

export abstract class BaseProvider {
  abstract name: string;

  abstract description: string;

  abstract defaultApiBase?: string;

  provider: Providers;

  constructor(params?: BaseProviderParams) {
    this.provider = params?.provider;
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    throw new Error('Not implemented');
  }

  abstract getModelList(
    provider: Providers,
  ): Promise<{ name: string; enable: boolean }[]>;

  async getEmbeddingModels():Promise<string[]> {
    return [];
  }
}
