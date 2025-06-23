import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { Ollama } from 'ollama';
import { ChatOllama } from '@langchain/ollama';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { OpenAI } from 'openai';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';
import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';

export class TogetherProvider extends BaseProvider {
  name: string = ProviderType.TOGETHERAI;

  description: string;

  defaultApiBase: string = 'https://api.together.xyz/v1';

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatTogetherAI({
      model: modelName,
      apiKey: this.provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
      topP: options?.top_p,
    });
    return llm;
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new TogetherAIEmbeddings({
      apiKey: this.provider.api_key,
      modelName: modelName,
    });
    return emb;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const options = {
      method: 'GET',
      agent: settingsManager.getHttpAgent(),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
      // body: JSON.stringify({}),
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data
      .filter((x) => x.type == 'chat')
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models?.find((z) => z.name == x.id)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const options = {
      method: 'GET',
      agent: settingsManager.getHttpAgent(),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
      // body: JSON.stringify({}),
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data
      .filter((x) => x.type == 'embedding')
      .map((x) => x.id)
      .sort((a, b) => a.localeCompare(b));
  }
}
