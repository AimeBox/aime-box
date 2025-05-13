import { ChatOllama } from '@langchain/ollama';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';
import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { Tool, ToolParams } from '@langchain/core/tools';

import { zodToJsonSchema } from 'zod-to-json-schema';
import { RunnableLambda } from '@langchain/core/runnables';
import { ChatGroqInput, ChatGroq } from '@langchain/groq';
import settingsManager from '../settings';
import providersManager from '../providers';
import { ProviderType, Providers } from '../../entity/Providers';
import { ChatOptions } from '../../entity/Chat';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';
import { BaseTool } from '../tools/BaseTool';

export async function getChatModel(
  providerName: string,
  modelName: string,
  options: ChatOptions = { streaming: true },
  tools: BaseTool[] = [],
): Promise<BaseChatModel> {
  const provider = await (
    await providersManager.getProviders()
  ).find((x) => x.name === providerName);

  const model = provider?.models.find((x) => x.name === modelName);

  if (!model) {
    throw new Error(`model "${modelName}" not found`);
  }
  if (!model.enable) {
    throw new Error(`model "${modelName}" not enable`);
  }

  let llm;
  if (provider?.type === ProviderType.OLLAMA) {
    llm = new ChatOllama({
      baseUrl: provider.api_base, // Default value
      model: model.name, // Default value
      temperature: options?.temperature,
      topP: options?.top_p,
      topK: options?.top_k,
      streaming: options?.streaming,
      format: options?.format,
    });
  } else if (
    provider?.type === ProviderType.OPENAI ||
    provider?.type === ProviderType.OPENROUTER ||
    provider?.type === ProviderType.SILICONFLOW ||
    provider?.type === ProviderType.BAIDU ||
    provider?.type === ProviderType.LMSTUDIO
  ) {
    llm = new ChatOpenAI({
      apiKey: provider.api_key,
      modelName: model.name,
      configuration: {
        apiKey: provider.api_key,
        baseURL: provider.api_base,
        httpAgent: settingsManager.getHttpAgent(),
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
  } else if (provider?.type === ProviderType.TONGYI) {
    llm = new ChatAlibabaTongyi({
      modelName: model.name,
      alibabaApiKey: provider.api_key,
      topP: options?.top_p,
      topK: options?.top_k,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
  } else if (provider?.type === ProviderType.ZHIPU) {
    llm = new ChatZhipuAI({
      modelName: model.name,
      zhipuAIApiKey: provider.api_key,
      topP: options?.top_p,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
    });
  } else if (provider?.type === ProviderType.GROQ) {
    llm = new ChatGroq({
      modelName: model.name,
      apiKey: provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
    }) as ChatGroq;
    llm.client.httpAgent = settingsManager.getHttpAgent();
    llm.client.baseURL = provider.api_base;
  } else if (provider?.type === ProviderType.ANTHROPIC) {
    llm = new ChatAnthropic({
      temperature: options?.temperature,
      model: model.name,
      apiKey: provider.api_key,
      topK: options?.top_k,
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
    });
    llm.clientOptions.httpAgent = settingsManager.getHttpAgent();
  } else if (provider?.type === ProviderType.GOOGLE) {
    llm = new ChatGoogleGenerativeAI({
      temperature: options?.temperature,
      model: model.name,
      apiKey: provider.api_key,
      topK: options?.top_k,
      topP: options?.top_p,
      maxOutputTokens: options?.maxTokens,
      streaming: options?.streaming,
    });

    // .llm.client.httpAgent =
    //   settingsManager.getHttpAgent();
  } else if (provider?.type === ProviderType.DEEPSEEK) {
    llm = new ChatDeepSeek({
      model: model.name,
      apiKey: provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
    });
  } else if (provider?.type === ProviderType.TOGETHERAI) {
    llm = new ChatTogetherAI({
      model: model.name,
      apiKey: provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
      topP: options?.top_p,
    });
  } else if (provider?.type === ProviderType.AZURE) {
    llm = new AzureChatOpenAI({
      model: model.name,
      apiKey: provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
      topP: options?.top_p,
    });
  }
  if (tools.length > 0) {
    const llmWithTools = llm.bindTools(tools);
    return llmWithTools;
  } else {
    return llm;
  }
}

export async function getDefaultLLMModel(): Promise<BaseChatModel | null> {
  const defaultLLM = settingsManager.getSettings()?.defaultLLM;

  if (defaultLLM) {
    const connectionName = defaultLLM.split('@')[1];
    const modelName = defaultLLM.split('@')[0];

    const connections = await providersManager.getProviders(false);
    const connection = connections.find((x) => x.name == connectionName);
    if (!connection) return null;
    return await getChatModel(connectionName, modelName);
  } else {
    return null;
  }
}
