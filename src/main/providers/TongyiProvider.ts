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
import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';

export class TongyiProvider extends BaseProvider {
  name: string = ProviderType.TONGYI;

  description: string;

  defaultApiBase: string;

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatAlibabaTongyi({
      modelName: modelName,
      alibabaApiKey: this.provider.api_key,
      topP: options?.top_p,
      topK: options?.top_k,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return llm;
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new AlibabaTongyiEmbeddings({
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
    const url = `https://dashscope.aliyuncs.com/compatible-mode/v1/models`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data.data
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
    return ['text-embedding-v2', 'text-embedding-v1'];
  }
}
