import { ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from '@google/genai';
import { ChatOptions } from '@/entity/Chat';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import fs from 'fs';
import { isUrl } from '../utils/is';

export class GoogleProvider extends BaseProvider {
  name: string = ProviderType.GOOGLE;

  description: string;

  defaultApiBase: string = 'https://generativelanguage.googleapis.com';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatGoogleGenerativeAI({
      temperature: options?.temperature,
      model: modelName,
      apiKey: this.provider.api_key,
      topK: options?.top_k,
      topP: options?.top_p,
      maxOutputTokens: options?.maxTokens,
      streaming: options?.streaming,
    });
    return llm;
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new GoogleGenerativeAIEmbeddings({
      modelName: modelName, // 768 dimensions
      apiKey: this.provider.api_key,
    });
    return emb;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const options = {
      method: 'GET',
      //agent: httpProxy,
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/v1beta/models?key=${this.provider.api_key}`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data.models
      .map((x) => {
        return {
          name: x.name.split('/')[1],
          enable:
            this.provider.models?.find((z) => z.name == x.name.split('/')[1])
              ?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const options = {
      method: 'GET',
      //agent: httpProxy,
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/v1beta/models?key=${this.provider.api_key}`;
    const res = await fetch(url, options);
    const data = await res.json();
    const emb_models = data
      .filter((x) => x.name.includes('embedding'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => x.name);
    return emb_models;
  }

  async videoUnderstanding(data: {
    model: string;
    fileOrUrl: string;
    prompt: string;
  }): Promise<string> {
    const ai = new GoogleGenAI({
      apiKey: this.provider.api_key,
    });
    if (isUrl(data.fileOrUrl)) {
      return 'not support url';
    } else {
      const base64VideoFile = fs.readFileSync(data.fileOrUrl, {
        encoding: 'base64',
      });

      const contents = [
        {
          inlineData: {
            mimeType: 'video/mp4',
            data: base64VideoFile,
          },
        },
        { text: data.prompt },
      ];
      const response = await ai.models.generateContent({
        model: data.model,
        contents: contents,
      });
      console.log(response.text);
      return response.text;
    }
  }
}
