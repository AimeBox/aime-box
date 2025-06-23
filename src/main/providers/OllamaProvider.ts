import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { Ollama } from 'ollama';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { Embeddings } from '@langchain/core/embeddings';

export class OllamaProvider extends BaseProvider {
  name: string = ProviderType.OLLAMA;

  description: string;

  defaultApiBase: string = 'http://localhost:11434';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatOllama({
      baseUrl: this.provider.api_base, // Default value
      model: modelName, // Default value
      temperature: options?.temperature,
      topP: options?.top_p,
      topK: options?.top_k,
      streaming: options?.streaming,
      format: options?.format,
    });
    return llm;
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new OllamaEmbeddings({
      baseUrl: this.provider.api_base, // Default value
      model: modelName,
    });
    return emb;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const ollama = new Ollama({
      host: this.provider.api_base || this.defaultApiBase,
    });
    const list = await ollama.list();
    return list.models
      .map((x) => {
        return {
          name: x.name,
          enable:
            this.provider.models.find((z) => z.name == x.name)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const localOllama = new Ollama();
    const list = await localOllama.list();
    return list.models.map((x) => x.name).sort();
  }
}
