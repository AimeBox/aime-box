import { Providers } from '@/entity/Providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAI } from 'openai';
import { Embeddings } from '@langchain/core/embeddings';

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
    const llm = new ChatOpenAI({
      apiKey: this.provider.api_key,
      modelName: modelName,
      configuration: {
        apiKey: this.provider.api_key,
        baseURL: this.provider.api_base,
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
    return llm;
  }

  getEmbeddings(modelName: string): Embeddings {
    return undefined;
  }

  async speech(modelName: string, text: string, config?: any): Promise<Buffer> {
    return undefined;
  }

  async transcriptions(
    modelName: string,
    filePath: string,
    config?: any,
  ): Promise<string> {
    return undefined;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const openai = new OpenAI({
      baseURL: this.provider.api_base,
      apiKey: this.provider.api_key,
    });
    const models = (await openai.models.list()).data;
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

  async getEmbeddingModels(): Promise<string[]> {
    return [];
  }

  async getImageGenerationModels(): Promise<string[]> {
    return [];
  }

  async getSTTModels(): Promise<string[]> {
    return undefined;
  }

  async getTTSModels(): Promise<string[]> {
    return undefined;
  }

  async getCredits(): Promise<{
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  }> {
    return undefined;
  }
}
