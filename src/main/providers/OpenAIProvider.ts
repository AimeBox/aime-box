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

export class OpenAIProvider extends BaseProvider {
  name: string = ProviderType.OPENAI;

  description: string;

  defaultApiBase: string = 'https://api.openai.com/v1';

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

  getEmbeddings(modelName: string): Embeddings {
    const emb = new OpenAIEmbeddings({
      model: modelName,
      apiKey: this.provider.api_key,
      configuration: {
        baseURL: this.provider.api_base,
        httpAgent: settingsManager.getHttpAgent(),
      },
    });
    return emb;
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

  async getEmbeddingModels(): Promise<string[]> {
    const list = await this.openaiClient.models.list();
    return list.data
      .filter((x) => x.id.startsWith('text-'))
      .map((x) => x.id)
      .sort();
  }

  async transcriptions(modelName: string, filePath: string): Promise<string> {
    const res = await this.openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: modelName,
    });
    return res.text;
  }

  async speech(modelName: string, text: string): Promise<Buffer> {
    const wav = await this.openaiClient.audio.speech.create({
      model: modelName,
      voice: 'coral',
      input: text,
      instructions: 'Speak in a cheerful and positive tone.',
      response_format: 'wav',
    });

    const buffer = Buffer.from(await wav.arrayBuffer());
    return buffer;
  }

  async getSTTModels(): Promise<string[]> {
    const models = (await this.openaiClient.models.list()).data;
    return models
      .filter((x) => x.id.startsWith('whisper-') || x.id.includes('transcribe'))
      .map((x) => x.id)
      .sort();
  }

  async getTTSModels(): Promise<string[]> {
    const models = (await this.openaiClient.models.list()).data;
    return models
      .filter((x) => x.id.startsWith('tts'))
      .map((x) => x.id)
      .sort();
  }
}
