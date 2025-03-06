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

export class ProvidersManager {
  repository: Repository<Providers>;

  connectionsStore: Providers[] | undefined;

  constructor() {
    this.repository = dbManager.dataSource.getRepository(Providers);
    if (!ipcMain) return;
    ipcMain.handle(
      'providers:getProviders',
      (event, refresh: boolean = false) => this.getProviders(refresh),
    );
    ipcMain.handle('providers:delete', (event, id: string) =>
      this.deleteProviders(id),
    );
    ipcMain.handle('providers:createOrUpdate', (event, input: Providers) =>
      this.createOrUpdateProvider(input),
    );
    ipcMain.handle('providers:getProviderType', (event) =>
      this.getProviderType(),
    );
    ipcMain.handle('providers:getModels', (event, id: string) =>
      this.getModels(id),
    );

    ipcMain.handle('providers:getLLMModels', (event) => this.getLLMModels());

    ipcMain.handle('providers:getEmbeddingModels', (event) =>
      this.getEmbeddingModels(),
    );
    ipcMain.handle('providers:getRerankerModels', (event) =>
      this.getRerankerModels(),
    );
    ipcMain.handle('providers:getTTSModels', (event) => this.getTTSModels());
    ipcMain.handle('providers:getSTTModels', (event) => this.getSTTModels());
    ipcMain.handle('providers:getWebSearchProviders', (event) =>
      this.getWebSearchProviders(),
    );
    ipcMain.handle(
      'providers:getDefaultLLM',
      (event) => settingsManager.getSettings()?.defaultLLM,
    );
  }

  public getProviderType = () => {
    const list = [];
    Object.keys(ProviderType).forEach((key) => {
      list.push({ key: key, value: ProviderType[key], icon: null });
    });
    return list;
  };

  public getModels = async (
    id: string,
  ): Promise<{ name: string; enable: boolean }[]> => {
    const connection: Providers = (await this.getProviders(false)).find(
      (x) => x.id == id,
    );
    if (!connection) return [];
    connection.models = connection.models || [];
    const httpProxy = settingsManager.getHttpAgent();
    try {
      if (connection.type === ProviderType.OLLAMA) {
        const ollama = new Ollama({ host: connection.api_base });
        const list = await ollama.list();
        return list.models.map((x) => {
          return {
            name: x.name,
            enable:
              connection.models.find((z) => z.name == x.name)?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.OPENAI) {
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
      } else if (connection.type === ProviderType.TONGYI) {
        const models = [
          'qwen-turbo',
          'qwen-plus',
          'qwen-max',
          'qwen-max-0428',
          'qwen-max-longcontext',
          'qwen-vl-plus',
          'qwen-vl-max',
        ];
        return models.map((x) => {
          return {
            name: x,
            enable:
              connection.models?.find((z) => z.name == x)?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.GROQ) {
        const groq = new Groq({
          baseURL: connection.api_base,
          apiKey: connection.api_key,
          httpAgent: httpProxy,
        });
        const list = await groq.models.list();
        return list.data.map((x) => {
          return {
            name: x.id,
            enable:
              connection.models.find((z) => z.name == x.id)?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.ANTHROPIC) {
        const anthropic = new Anthropic({
          apiKey: connection.api_key,
          httpAgent: httpProxy,
        });

        const data = await anthropic.models.list();

        return data.data.map((x) => {
          return {
            name: x.id,
            enable:
              connection.models?.find((z) => z.name == x.id)?.enable || false,
          };
        });
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
        const options = {
          method: 'GET',
          agent: httpProxy,
        };
        const url = `${connection.api_base}/v1beta/models?key=${connection.api_key}`;
        const res = await fetch(url, options);
        const data = await res.json();
        return data.models.map((x) => {
          return {
            name: x.name.split('/')[1],
            enable:
              connection.models?.find((z) => z.name == x.name.split('/')[1])
                ?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.OPENROUTER) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
        };

        const url = 'https://openrouter.ai/api/v1/models';
        const res = await fetch(url, options);
        const models = await res.json();
        return models.data.map((x) => {
          return {
            name: x.id,
            enable:
              connection.models?.find((z) => z.name == x.id)?.enable || false,
          };
        });
      } else if (connection.type === ProviderType.SILICONFLOW) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
        };
        const url = 'https://api.siliconflow.cn/v1/models?sub_type=chat';
        const res = await fetch(url, options);
        const models = await res.json();
        return models.data
          .map((x) => {
            return {
              name: x.id,
              enable:
                connection.models?.find((z) => z.name == x.id)?.enable || false,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      } else if (connection.type === ProviderType.DEEPSEEK) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
        };

        const url = 'https://api.deepseek.com/models';
        const res = await fetch(url, options);
        const models = await res.json();
        return models.data.map((x) => {
          return {
            name: x.id,
            enable:
              connection.models?.find((z) => z.name == x.id)?.enable || false,
          };
        });
      }
    } catch (e) {
      console.log(e);
      notificationManager.sendNotification('获取模型列表失败', 'error', 3000);
    }

    return [];
  };

  public getProviders = async (
    refresh: boolean = false,
  ): Promise<Providers[]> => {
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
        connections.push(connection);
      }

      this.connectionsStore = connections;
    }
    return this.connectionsStore;
  };

  public deleteProviders = async (id: string) => {
    const provider = await this.repository.findOneBy({ id });
    if (provider) {
      await this.repository.remove(provider);
      await this.getProviders(true);
    }
  };

  public createOrUpdateProvider = async (input: Providers) => {
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
  };

  public getLLMModels = async (): Promise<any[]> => {
    return this.connectionsStore
      .map((x) => {
        return {
          ...x,
          models: x.models.filter((m) => m.enable).map((z) => z.name),
        };
      })
      .filter((x) => x.models.length > 0);
  };

  public getEmbeddingModels = async (): Promise<any[]> => {
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

      if (connection?.type === ProviderType.OLLAMA) {
        try {
          const localOllama = new Ollama();
          const list = await localOllama.list();

          if (list.models.length > 0) {
            emb_list.push({
              name: connection.name,
              type: ProviderType.OLLAMA,
              api_base: connection.api_base,
              api_key: connection.api_key,
              static: true,
              models: list.models.map((x) => x.name).sort(),
            });
          }
        } catch {}
      } else if (connection?.type === ProviderType.OPENAI) {
        try {
          const openai = new OpenAI({
            baseURL: connection.api_base,
            apiKey: connection.api_key,
            httpAgent: httpProxy,
          });

          const list = await openai.models.list();
          emb_list.push({
            name: connection.name,
            models: list.data
              .filter((x) => x.id.startsWith('text-'))
              .map((x) => x.id)
              .sort(),
          });
        } catch {}
      } else if (connection?.type === ProviderType.TONGYI) {
        emb_list.push({
          name: connection.name,
          models: ['text-embedding-v2', 'text-embedding-v1'],
        });
      } else if (connection?.type === ProviderType.ZHIPU) {
        emb_list.push({
          name: connection.name,
          models: ['embedding-2', 'text_embedding'],
        });
      } else if (connection?.type === ProviderType.SILICONFLOW) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
        };
        const url = 'https://api.siliconflow.cn/v1/models?sub_type=embedding';
        const res = await fetch(url, options);
        const models = await res.json();

        emb_list.push({
          name: connection.name,
          models: models.data?.map((x) => x.id) ?? [],
        });
      } else if (connection?.type === ProviderType.GOOGLE) {
        const options = {
          method: 'GET',
          // headers: {
          //   accept: 'application/json',
          //   'content-type': 'application/json',
          // },
          agent: httpProxy,
        };
        const url = `${connection.api_base}/v1beta/models?key=${connection.api_key}`;
        let models;
        try {
          const res = await fetch(url, options);
          models = await res.json();
          emb_list.push({
            name: connection.name,
            models: models.models
              .filter((x) => x.name.includes('embedding'))
              .map((x) => x.name.split('/')[1]),
          });
        } catch (e) {
          emb_list.push({
            name: connection.name,
            models: [],
          });
        }
      }
    }
    return emb_list;
  };

  public getRerankerModels = async (): Promise<any[]> => {
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

      if (connection?.type === ProviderType.SILICONFLOW) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
        };
        const url = 'https://api.siliconflow.cn/v1/models?sub_type=reranker';
        const res = await fetch(url, options);
        const models = await res.json();

        emb_list.push({
          name: connection.name,
          models: models.data?.map((x) => x.id)?.sort() ?? [],
        });
      }
    }
    return emb_list;
  };

  public getTTSModels = async (): Promise<any[]> => {
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

      if (connection?.type === ProviderType.SILICONFLOW) {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${connection.api_key}`,
          },
        };
        const url = 'https://api.siliconflow.cn/v1/models?type=audio';
        const res = await fetch(url, options);
        const models = await res.json();

        emb_list.push({
          name: connection.name,
          models: models.data?.map((x) => x.id)?.sort() ?? [],
        });
      }
    }
    return emb_list;
  };

  public getSTTModels = async (): Promise<any[]> => {
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
      const connection = connections[index];
      if (connection.type == ProviderType.OPENAI) {
        emb_list.push({
          name: connection.name,
          models: ['whisper-1'],
        });
      }
    }
    return emb_list;
  };

  public getWebSearchProviders = async (): Promise<any[]> => {
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
  };

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
