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
import { MinimaxProvider } from '../providers/MinimaxProvider';
import { DeepSeekProvider } from '../providers/DeepSeekProvider';
import { OllamaProvider } from '../providers/OllamaProvider';
import { GoogleProvider } from '../providers/GoogleProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { GroqProvider } from '../providers/GroqProvider';
import { AzureOpenAIProvider } from '../providers/AzureOpenAIProvider';
import { TongyiProvider } from '../providers/TongyiProvider';
import { TogetherProvider } from '../providers/TogetherProvider';
import { MoonshotProvider } from '../providers/MoonshotProvider';

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
    llm = new OllamaProvider({ provider }).getChatModel(model.name, options);
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
    llm = new TongyiProvider({ provider }).getChatModel(model.name, options);
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
    llm = new GroqProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.ANTHROPIC) {
    llm = new AnthropicProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.GOOGLE) {
    llm = new GoogleProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.DEEPSEEK) {
    llm = new DeepSeekProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.TOGETHERAI) {
    llm = new TogetherProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.AZURE_OPENAI) {
    llm = new AzureOpenAIProvider({ provider }).getChatModel(
      model.name,
      options,
    );
  } else if (provider?.type === ProviderType.MINIMAX) {
    llm = new MinimaxProvider({ provider }).getChatModel(model.name, options);
  } else if (provider?.type === ProviderType.MOONSHOT) {
    llm = new MoonshotProvider({ provider }).getChatModel(model.name, options);
  } else {
    throw new Error(`provider "${providerName}" not support`);
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
