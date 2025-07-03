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
import FormData from 'form-data';
import fetch from 'node-fetch';
import { SiliconflowEmbeddings } from '../embeddings/SiliconflowEmbeddings';
import { Embeddings } from '@langchain/core/embeddings';
import path from 'path';
import axios from 'axios';

export class SiliconflowProvider extends BaseProvider {
  name: string = ProviderType.SILICONFLOW;

  description: string;

  defaultApiBase: string = 'https://api.siliconflow.cn/v1';

  httpProxy: HttpsProxyAgent | undefined;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new SiliconflowEmbeddings({
      modelName: modelName,
      apiKey: this.provider.api_key,
      baseURL: this.provider.api_base,
    });
    return emb;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models?sub_type=chat`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data
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
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models?sub_type=embedding`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data?.map((x) => x.id) ?? [];
  }

  async getRerankerModels(): Promise<string[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models?sub_type=reranker`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data?.map((x) => x.id) ?? [];
  }

  async getTTSModels(): Promise<string[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models?sub_type=text-to-speech`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data?.map((x) => x.id) ?? [];
  }

  async getSTTModels(): Promise<string[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/models?sub_type=speech-to-text`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data?.map((x) => x.id) ?? [];
  }

  async transcriptions(modelName: string, filePath: string): Promise<string> {
    const form = new FormData();
    form.append('model', modelName);
    form.append('file', fs.createReadStream(filePath));

    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.provider.api_key}`,
        'Content-Type': 'multipart/form-data',
      },
      body: form,
    };
    const headers = form.getHeaders();
    headers.Authorization = `Bearer ${this.provider.api_key}`;
    const res2 = await axios.post(
      `${this.provider.api_base || this.defaultApiBase}/audio/transcriptions`,
      form,
      {
        headers,
      },
    );
    const res = await fetch(
      `${this.provider.api_base || this.defaultApiBase}/audio/transcriptions`,
      options,
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      throw new Error(`${res.statusText} ${text}`);
    }
    const data = await res.json();
    return data.text;
  }

  async speech(modelName: string, text: string): Promise<Buffer> {
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.provider.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: text,
        voice: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        response_format: 'wav',
        sample_rate: 32000,
        stream: false,
        speed: 1,
        gain: 0,
      }),
    };

    const response = await fetch(
      `${this.provider.api_base || this.defaultApiBase}/audio/speech`,
      options,
    );
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    const buffer = await response.buffer();
    return buffer;
  }

  async getCredits(): Promise<{
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  }> {
    try {
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${this.provider.api_key}`,
        },
      };
      const url = `${this.provider.api_base || this.defaultApiBase}/user/info`;
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      const json = await res.json();
      return {
        totalCredits: parseFloat(json.data.totalBalance),
        usedCredits:
          parseFloat(json.data.totalBalance) - parseFloat(json.data.balance),
        remainingCredits: parseFloat(json.data.balance),
      };
    } catch (err) {
      console.log(err);

      return undefined;
    }
  }
}
