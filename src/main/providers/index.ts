/* eslint-disable max-classes-per-file */
import { Ollama } from 'ollama';
import { OpenAI } from 'openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  GenerateContentRequest,
  SafetySetting,
  Part as GenerativeAIPart,
  GoogleGenerativeAI,
} from '@google/generative-ai';
import { ipcMain } from 'electron';
import { Not, Raw, Repository } from 'typeorm';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import Groq from 'groq-sdk';
import { Providers, ProviderType } from '../../entity/Providers';

import settingsManager from '../settings';
import { dbManager } from '../db';
import { ChatAnthropic } from '@langchain/anthropic';
import Anthropic from '@anthropic-ai/sdk';
import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { ChatDeepSeek } from '@langchain/deepseek';
import { getProviderModel } from '../utils/providerUtil';
import { Transformers } from '../utils/transformers';
import { notificationManager } from '../app/NotificationManager';
import { ChatBaiduQianfan } from '@langchain/baidu-qianfan';
import { VolcanoEngineProvider } from './VolcanoEngineProvider';
import { ReplicateProvider } from './ReplicateProvider';
import { OllamaProvider } from './OllamaProvider';
import { MinimaxProvider } from './MinimaxProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { BaseProvider } from './BaseProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { isString } from '../utils/is';
import { OpenAIProvider } from './OpenAIProvider';
import { AzureOpenAIProvider } from './AzureOpenAIProvider';
import { OpenrouterProvider } from './OpenrouterProvider';
import { SiliconflowProvider } from './SiliconflowProvider';
import { BaseManager } from '../BaseManager';
import { channel } from '../ipc/IpcController';
import { GoogleProvider } from './GoogleProvider';
import { GroqProvider } from './GroqProvider';
import { TongyiProvider } from './TongyiProvider';
import { TogetherProvider } from './TogetherProvider';
import { ElevenLabsProvider } from './ElevenLabsProvider';

export interface ProviderInfo extends Providers {
  credits: {
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  };
}

export class ProvidersManager extends BaseManager {
  repository: Repository<Providers>;

  connectionsStore: Providers[] | undefined;

  constructor() {
    super();
    this.repository = dbManager.dataSource.getRepository(Providers);
  }

  public async init() {
    if (!ipcMain) return;
    // ipcMain.handle(
    //   'providers:getProviders',
    //   (event, refresh: boolean = false) => this.getProviders(refresh),
    // );
    // ipcMain.handle('providers:delete', (event, id: string) =>
    //   this.deleteProviders(id),
    // );
    // ipcMain.handle('providers:createOrUpdate', (event, input: Providers) =>
    //   this.createOrUpdateProvider(input),
    // );
    // ipcMain.handle('providers:getProviderType', (event) =>
    //   this.getProviderType(),
    // );
    // ipcMain.handle('providers:getModels', (event, id: string) =>
    //   this.getModels(id),
    // );

    //ipcMain.handle('providers:getLLMModels', (event) => this.getLLMModels());

    // ipcMain.handle('providers:getEmbeddingModels', (event) =>
    //   this.getEmbeddingModels(),
    // );
    // ipcMain.handle('providers:getRerankerModels', (event) =>
    //   this.getRerankerModels(),
    // );
    // ipcMain.handle('providers:getTTSModels', (event) => this.getTTSModels());
    // ipcMain.handle('providers:getSTTModels', (event) => this.getSTTModels());
    // ipcMain.handle('providers:getWebSearchProviders', (event) =>
    //   this.getWebSearchProviders(),
    // );
    // ipcMain.handle('providers:getImageGenerationProviders', (event) =>
    //   this.getImageGenerationProviders(),
    // );
    this.getProviders();
    ipcMain.handle(
      'providers:getDefaultLLM',
      (event) => settingsManager.getSettings()?.defaultLLM,
    );
    this.registerIpcChannels();
  }

  @channel('providers:getProviderType')
  public async getProviderType() {
    const list = [];
    Object.keys(ProviderType).forEach((key) => {
      list.push({ key: key, value: ProviderType[key], icon: null });
    });
    return list;
  }

  @channel('providers:getModels')
  public async getModels(
    id: string,
  ): Promise<{ name: string; enable: boolean }[]> {
    const connection: Providers = (await this.getProviders(false)).find(
      (x) => x.id == id,
    );
    if (!connection) return [];
    connection.models = connection.models || [];
    const httpProxy = settingsManager.getHttpAgent();
    try {
      if (connection.type === ProviderType.OLLAMA) {
        const ollama = new OllamaProvider({ provider: connection });
        const list = await ollama.getModelList();
        return list;
      } else if (
        connection.type === ProviderType.OPENAI ||
        connection.type === ProviderType.LMSTUDIO
      ) {
        const openai = new OpenAI({
          baseURL: connection.api_base,
          apiKey: connection.api_key,
          httpAgent: httpProxy,
        });
        const models = (await openai.models.list()).data;
        return models
          .map((x) => {
            return {
              name: x.id,
              enable:
                connection.models.find((z) => z.name == x.id)?.enable || false,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      } else if (connection.type === ProviderType.BAIDU) {
        const models = [
          'ernie-4.5-turbo-128k',
          'ernie-4.5-turbo-32k',
          'ernie-4.0-8k',
          'ernie-4.0-8k-latest',
          'ernie-4.0-turbo-128k',
          'ernie-4.0-turbo-8k',
          'ernie-speed-128k',
          'ernie-speed-8k',
          'ernie-speed-pro-128k',
          'ernie-lite-8k',
          'ernie-lite-pro-128k',
        ];
        return models.map((x) => {
          return {
            name: x,
            enable:
              connection.models?.find((z) => z.name == x)?.enable || false,
          };
        });

        const options = {
          method: 'POST',
          agent: httpProxy,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
          body: JSON.stringify({}),
        };
        const url = `https://qianfan.baidubce.com/v2/model?Action=DescribeCustomModelSets`;
        const res = await fetch(url, options);
        const data = await res.json();
        return data.models.map((x) => {
          return {
            name: x.id,
            enable:
              connection.models?.find((z) => z.name == x.id)?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.TONGYI) {
        const tongyi = new TongyiProvider({ provider: connection });
        const list = await tongyi.getModelList();
        return list;
      } else if (connection.type === ProviderType.TOGETHERAI) {
        const togetherai = new TogetherProvider({ provider: connection });
        const list = await togetherai.getModelList();
        return list;
      } else if (connection.type === ProviderType.GROQ) {
        const groq = new GroqProvider({ provider: connection });
        const list = await groq.getModelList();
        return list;
      } else if (connection.type === ProviderType.ANTHROPIC) {
        const anthropic = new AnthropicProvider({ provider: connection });
        const list = await anthropic.getModelList();
        return list;
      } else if (connection.type === ProviderType.ZHIPU) {
        const models = [
          'GLM-4-0520',
          'GLM-4-Long',
          'GLM-4-AirX',
          'GLM-4-Air',
          'GLM-4-Flash',
          'GLM-4V',
          'GLM-4-AllTools',
          'GLM-4',
          'GLM-4-Plus',
          'CodeGeeX-4',
        ];
        return models.map((x) => {
          return {
            name: x,
            enable:
              connection.models?.find((z) => z.name == x)?.enable || false,
          };
        });
      } else if (connection?.type === ProviderType.GOOGLE) {
        const google = new GoogleProvider({ provider: connection });
        const list = await google.getModelList();
        return list;
      } else if (connection.type === ProviderType.OPENROUTER) {
        const openrouter = new OpenrouterProvider({ provider: connection });
        const list = await openrouter.getModelList();
        return list;
      } else if (connection.type === ProviderType.SILICONFLOW) {
        const siliconflow = new SiliconflowProvider({ provider: connection });
        const list = await siliconflow.getModelList();
        return list;
      } else if (connection.type === ProviderType.DEEPSEEK) {
        const deepSeek = new DeepSeekProvider({ provider: connection });
        const list = await deepSeek.getModelList();
        return list;
      } else if (connection.type === ProviderType.AZURE_OPENAI) {
        const ollama = new AzureOpenAIProvider({ provider: connection });
        const list = await ollama.getModelList();
        return list;
      } else if (connection?.type === ProviderType.VOLCANOENGINE) {
        const volcanoEngine = new VolcanoEngineProvider({
          provider: connection,
        });
        const list = await volcanoEngine.getModelList();
        return list;
      } else if (connection?.type === ProviderType.MINIMAX) {
        const minimax = new MinimaxProvider({ provider: connection });
        const list = await minimax.getModelList();
        return list;
      } else if (connection?.type === ProviderType.REPLICATE) {
        const replicate = new ReplicateProvider({ provider: connection });
        const list = await replicate.getModelList();
        return list;
      }
    } catch (e) {
      console.log(e);
      notificationManager.sendNotification('获取模型列表失败', 'error');
    }

    return [];
  }

  public async getProvider(
    provider: Providers | string,
  ): Promise<BaseProvider> {
    let providerObj: Providers;
    if (isString(provider)) {
      providerObj = await this.repository.findOneBy([
        { id: provider },
        { name: provider },
      ]);
    } else {
      providerObj = provider;
    }
    switch (providerObj.type) {
      case ProviderType.REPLICATE:
        return new ReplicateProvider({ provider: providerObj });
      case ProviderType.ANTHROPIC:
        return new AnthropicProvider({ provider: providerObj });
      case ProviderType.OLLAMA:
        return new OllamaProvider({ provider: providerObj });
      case ProviderType.OPENAI:
        return new OpenAIProvider({ provider: providerObj });
      case ProviderType.AZURE_OPENAI:
        return new AzureOpenAIProvider({ provider: providerObj });
      case ProviderType.DEEPSEEK:
        return new DeepSeekProvider({ provider: providerObj });
      case ProviderType.MINIMAX:
        return new MinimaxProvider({ provider: providerObj });
      case ProviderType.OPENROUTER:
        return new OpenrouterProvider({ provider: providerObj });
      case ProviderType.SILICONFLOW:
        return new SiliconflowProvider({ provider: providerObj });
      case ProviderType.TONGYI:
        return new TongyiProvider({ provider: providerObj });
      case ProviderType.TOGETHERAI:
        return new TogetherProvider({ provider: providerObj });
      case ProviderType.ELEVENLABS:
        return new ElevenLabsProvider({ provider: providerObj });
      default:
        return undefined;
    }
  }

  @channel('providers:getProviders')
  public async getProviders(refresh: boolean = false): Promise<Providers[]> {
    if (refresh) this.connectionsStore = undefined;
    if (this.connectionsStore === undefined) {
      const connections: Providers[] = [];
      // const settings = settingsManager.getSettings();
      // let httpProxy: HttpsProxyAgent | undefined = undefined;
      // if (settings?.proxy) {
      //   httpProxy = settingsManager.getHttpAgent();
      // }

      const all = await this.repository.find();
      for (let i = 0; i < all.length; i++) {
        const connection = all[i];
        const provider = await this.getProvider(connection);

        try {
          if (provider && 'getCredits' in provider) {
            const credits = await provider.getCredits();

            if (credits) {
              connection.credits = credits;
            }
          }
        } catch {}

        //connection.models = provider.;
        connections.push(connection);
      }

      this.connectionsStore = connections;
    }
    return this.connectionsStore;
  }

  @channel('providers:delete')
  public async deleteProviders(id: string) {
    const provider = await this.repository.findOneBy({ id });
    if (provider) {
      await this.repository.remove(provider);
      await this.getProviders(true);
    }
  }

  @channel('providers:createOrUpdate')
  public async createOrUpdateProvider(input: Providers) {
    const name = input.name?.trim().toLowerCase();
    if (name == 'local') {
      throw new Error('"local"无法使用');
    }

    if (input.id) {
      if (
        await this.repository.findOneBy([
          {
            name: Raw((alias) => `LOWER(${alias}) = :value`, {
              value: name.toLowerCase(),
            }),
            id: Not(input.id),
          },
        ])
      ) {
        throw new Error('模型名称已存在');
      }
      const provider = await this.repository.findOneBy({ id: input.id });
      provider.name = input.name.trim();
      provider.api_base = input.api_base;
      provider.api_key = input.api_key;
      provider.models = input.models;
      provider.config = input.config;
      await this.repository.save(provider);
    } else {
      if (
        await this.repository.findOneBy({
          name: Raw((alias) => `LOWER(${alias}) = :value`, {
            value: name.toLowerCase(),
          }),
        })
      ) {
        throw new Error('模型名称已存在');
      }
      input.name = input.name.trim();
      input.id = uuidv4();
      input.models = [];
      await this.repository.save(input);
    }

    await this.getProviders(true);
  }

  @channel('providers:getLLMModels')
  public async getLLMModels(): Promise<any[]> {
    return this.connectionsStore
      .map((x) => {
        return {
          ...x,
          models: x.models.filter((m) => m.enable).map((z) => z.name),
        };
      })
      .filter((x) => x.models.length > 0);
  }

  @channel('providers:getEmbeddingModels')
  public async getEmbeddingModels(): Promise<any[]> {
    const connections = await this.getProviders(false);
    const emb_list = [];
    const settings = settingsManager.getSettings();
    const httpProxy = settingsManager.getHttpAgent();
    emb_list.push({
      name: 'local',
      models: settingsManager
        .getLocalModels()
        ['embeddings'].filter((x) => x.exists)
        .map((x) => x.id),
    });
    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      try {
        if (connection?.type === ProviderType.OLLAMA) {
          try {
            const ollama = new OllamaProvider({ provider: connection });
            const list = await ollama.getEmbeddingModels();
            emb_list.push({
              name: connection.name,
              models: list,
            });
          } catch {}
        } else if (connection?.type === ProviderType.OPENAI) {
          try {
            const tongyi = new OpenAIProvider({ provider: connection });
            const list = await tongyi.getEmbeddingModels();
            emb_list.push({
              name: connection.name,
              models: list,
            });
          } catch {}
        } else if (connection?.type === ProviderType.TONGYI) {
          const tongyi = new TongyiProvider({ provider: connection });
          const list = await tongyi.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        } else if (connection?.type === ProviderType.ZHIPU) {
          emb_list.push({
            name: connection.name,
            models: ['embedding-2', 'text_embedding'],
          });
        } else if (connection?.type === ProviderType.SILICONFLOW) {
          const siliconflow = new SiliconflowProvider({ provider: connection });
          const list = await siliconflow.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        } else if (connection?.type === ProviderType.GOOGLE) {
          const google = new GoogleProvider({ provider: connection });
          const list = await google.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        } else if (connection?.type === ProviderType.LMSTUDIO) {
          const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              Authorization: `Bearer ${connection.api_key}`,
            },
          };
          const url = `${connection.api_base}/models`;
          try {
            const res = await fetch(url, options);
            const models = await res.json();

            emb_list.push({
              name: connection.name,
              models:
                models.data
                  ?.filter((x) => x.id.includes('embedding'))
                  .map((x) => x.id) ?? [],
            });
          } catch {}
        } else if (connection?.type === ProviderType.AZURE_OPENAI) {
          const azureOpenAI = new AzureOpenAIProvider({ provider: connection });
          const list = await azureOpenAI.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        } else if (connection?.type === ProviderType.REPLICATE) {
          const replicate = new ReplicateProvider({ provider: connection });
          const list = await replicate.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        } else if (connection?.type === ProviderType.TOGETHERAI) {
          const replicate = new TogetherProvider({ provider: connection });
          const list = await replicate.getEmbeddingModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        }
      } catch {
        continue;
      }
    }
    return emb_list;
  }

  @channel('providers:getRerankerModels')
  public async getRerankerModels(): Promise<any[]> {
    const connections = await this.getProviders(false);
    const emb_list = [];
    const settings = settingsManager.getSettings();
    const httpProxy = settingsManager.getHttpAgent();
    const rerankerModels = settingsManager.getLocalModels()['reranker'];
    emb_list.push({
      name: 'local',
      models: rerankerModels.filter((x) => x.exists).map((x) => x.id),
    });
    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      try {
        if (connection?.type === ProviderType.SILICONFLOW) {
          const siliconflow = new SiliconflowProvider({ provider: connection });
          const list = await siliconflow.getRerankerModels();
          emb_list.push({
            name: connection.name,
            models: list,
          });
        }
      } catch {
        continue;
      }
    }
    return emb_list;
  }

  @channel('providers:getTTSModels')
  public async getTTSModels(): Promise<any[]> {
    const connections = await this.getProviders(false);
    const emb_list = [];
    const settings = settingsManager.getSettings();
    const httpProxy = settingsManager.getHttpAgent();

    const localModels = settingsManager.getLocalModels();
    emb_list.push({
      name: 'local',
      models: localModels['tts'].filter((x) => x.exists).map((x) => x.id),
    });
    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      try {
        const p = await this.getProvider(connection);
        const models = await p?.getTTSModels();
        if (models && models.length > 0) {
          emb_list.push({
            name: connection.name,
            models: models ?? [],
          });
        }
      } catch {
        continue;
      }
    }
    return emb_list;
  }

  @channel('providers:getSTTModels')
  public async getSTTModels(): Promise<any[]> {
    const connections = await this.getProviders(false);
    const emb_list = [];
    const settings = settingsManager.getSettings();
    const httpProxy = settingsManager.getHttpAgent();
    // emb_list.push({
    //   name: 'local',
    //   models: [
    //     'whisper-large-v3',
    //     'whisper-small',
    //     'sense-voice-zh-en-ja-ko-yue',
    //     'zipformer-zh',
    //   ],
    // });
    const localModels = settingsManager.getLocalModels();
    emb_list.push({
      name: 'local',
      models: localModels['stt'].filter((x) => x.exists).map((x) => x.id),
    });

    for (let index = 0; index < connections.length; index++) {
      const provider = await this.getProvider(connections[index]);
      if (provider) {
        const models = await provider.getSTTModels();
        if (models && models.length > 0) {
          emb_list.push({
            name: connections[index].name,
            models: models,
          });
        }
      }
    }
    return emb_list;
  }

  @channel('providers:getWebSearchProviders')
  public async getWebSearchProviders(): Promise<any[]> {
    const list = [];
    list.push({
      name: 'searxng',
      models: ['basic'],
    });
    list.push({
      name: 'zhipu',
      models: ['web-search-pro'],
    });
    list.push({
      name: 'tavily',
      models: ['basic', 'advanced'],
    });
    list.push({
      name: 'duckduckgo',
      models: ['basic'],
    });
    list.push({
      name: 'serpapi',
      models: ['basic'],
    });

    return list;
  }

  @channel('providers:getImageGenerationProviders')
  async getImageGenerationProviders(): Promise<any[]> {
    const list = [];
    const providers = await this.getProviders(false);
    for (const provider of providers) {
      const _provider = await this.getProvider(provider);
      if (_provider) {
        const models = await _provider.getImageGenerationModels();
        if (models && models.length > 0) {
          list.push({
            name: provider.name,
            models: models,
          });
        }
      }
    }

    return list;
  }

  // public async getReranker(providerModel?: string | undefined) {
  //   const _providerModel =
  //     providerModel || settingsManager.getSettings()?.defaultReranker;

  //   const { modelName, provider } = getProviderModel(_providerModel);
  //   if (provider == 'local') {
  //     const res = await new Transformers({
  //       modelName: modelName,
  //     }).ranker(
  //       query,
  //       documents.map((x) => x[0].pageContent),
  //       { return_documents: true },
  //     );
  //     retuen res
  //   }
  // }
}
const providersManager = new ProvidersManager();
export default providersManager;
