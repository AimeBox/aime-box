// import AppDataSource from '../../data-source';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from 'openai';
import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi';
import { ZhipuAIEmbeddings } from '@langchain/community/embeddings/zhipuai';
import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';

import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';

import { ChatAnthropic } from '@langchain/anthropic';

import { HttpsProxyAgent } from 'https-proxy-agent';

import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { Tool, ToolParams } from '@langchain/core/tools';

import { zodToJsonSchema } from 'zod-to-json-schema';
import { RunnableLambda } from '@langchain/core/runnables';
import { ChatGroqInput, ChatGroq as LangchainChatGroq } from '@langchain/groq';
import settingsManager from '../settings';

import providersManager from '../providers';
import { ProviderType, Providers } from '../../entity/Providers';
import { ChatOptions } from '../../entity/Chat';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { HuggingFaceTransformersEmbeddings } from './HuggingFaceTransformersEmbeddings';

export async function getEmbeddingModel(
  providerName: string,
  model?: string,
): Promise<Embeddings> {
  const provider = await (
    await providersManager.getProviders()
  ).find((x) => x.name === providerName);

  if (!model || providerName == 'local') {
    const emb = new HuggingFaceTransformersEmbeddings({
      modelName: model,
    });
    return emb;
  }
  const provider = await providersManager.getProvider(providerName);

  if (provider?.type === ProviderType.OLLAMA) {
    const emb = new OllamaEmbeddings({
      baseUrl: provider.api_base, // Default value
      model: model,
    });
    return emb;
  } else if (
    provider?.type === ProviderType.OPENAI ||
    provider?.type === ProviderType.AZURE_OPENAI
  ) {
    const emb = new OpenAIEmbeddings({
      model: model,
      apiKey: provider.api_key,
      configuration: {
        baseURL: provider.api_base,
        httpAgent: settingsManager.getHttpAgent(),
      },
    });
    return emb;
  } else if (provider?.type === ProviderType.TONGYI) {
    const emb = new AlibabaTongyiEmbeddings({ apiKey: provider.api_key });
    return emb;
  } else if (provider?.type === ProviderType.ZHIPU) {
    const emb = new ZhipuAIEmbeddings({ apiKey: provider.api_key });
    return emb;
  } else if (provider?.type === ProviderType.TOGETHERAI) {
    const emb = new TogetherAIEmbeddings({
      apiKey: provider.api_key,
      model: model,
    });
    return emb;
  } else if (provider?.type === ProviderType.SILICONFLOW) {
    const emb = new SiliconflowEmbeddings({
      modelName: model,
      apiKey: provider.api_key,
      baseURL: provider.api_base,
    });
    return emb;
  }
  throw new Error();
}

export async function getDefaultEmbeddingModel(): Promise<Embeddings> {
  const defaultEmbedding = settingsManager.getSettings()?.defaultEmbedding;

  if (defaultEmbedding) {
    const connectionName = defaultEmbedding.split('@')[1];
    const modelName = defaultEmbedding.split('@')[0];
    return await getEmbeddingModel(connectionName, modelName);
  } else {
    return null;
  }
}
