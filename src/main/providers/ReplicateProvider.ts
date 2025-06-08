import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import Replicate from 'replicate';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { Replicate as LangChainReplicate } from '@langchain/community/llms/replicate';
import { ChatOptions } from '@/entity/Chat';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export class ReplicateProvider extends BaseProvider {
  name: string = ProviderType.REPLICATE;

  description: string;

  defaultApiBase: string = 'https://api.replicate.com/v1';

  replicate: Replicate;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.replicate = new Replicate({
      auth:
        this.provider.api_key || getEnvironmentVariable('REPLICATE_API_TOKEN'),
      baseUrl: this.provider.api_base || this.defaultApiBase,
    });
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    // const model = new LangChainReplicate({
    //   model: modelName,
    //   apiKey:
    //     this.provider.api_key || getEnvironmentVariable('REPLICATE_API_TOKEN'),
    // });
    // return model;
    return undefined;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    // const collections = await replicate.collections.list();
    // console.log(collections);
    const collection = await this.replicate.collections.get('language-models');
    // console.log(collection);
    // const models = await replicate.models.list();
    // const modelList = await replicate.request(models.next,{method:'GET'});
    // modelList.json().then(console.log);
    return collection.models
      .map((x) => {
        return {
          name: `${x.owner}/${x.name}`,
          enable:
            this.provider.models?.find((z) => z.name == `${x.owner}/${x.name}`)
              ?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const collection = await this.replicate.collections.get('embedding-models');
    return collection.models
      .map((x) => {
        return `${x.owner}/${x.name}`;
      })
      .sort((a, b) => a.localeCompare(b));
  }

  async getImageGenerationModels(): Promise<string[]> {
    const collection = await this.replicate.collections.get('text-to-image');
    return collection.models
      .map((x) => {
        return `${x.owner}/${x.name}`;
      })
      .sort((a, b) => a.localeCompare(b));
  }
}
