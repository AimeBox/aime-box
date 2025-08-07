import { Instances } from '@/entity/Instances';
import { BaseInstance, BaseInstanceParams } from './BaseInstance';
import path from 'path';
import { getDataPath } from '../utils/path';
import { BrowserContext, chromium } from 'playwright';
import settingsManager from '../settings';
import { EventEmitter } from 'events';
import fs from 'fs';
import {
  CreateChatCompletionOptions,
  LLMClient,
  LLMResponse,
  Stagehand,
} from '@browserbasehq/stagehand';

import { Providers } from '@/entity/Providers';
import { getProviderModel } from '../utils/providerUtil';
import providersManager from '../providers';
import { getChatModel } from '../llm';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

class MyLLMClient extends LLMClient {
  async createChatCompletion<T = LLMResponse>(
    options: CreateChatCompletionOptions,
  ): Promise<T> {
    const {
      messages,
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
      image,
      response_model,
      tools,
      tool_choice,
      maxTokens,
      requestId,
    } = options.options;

    const { provider: providerName, modelName } = await getProviderModel(
      this.modelName,
    );

    const chatModel = await getChatModel(providerName, modelName, {
      temperature,
      top_p,
      maxTokens,
    });
    const provider = await (
      await providersManager.getProviders()
    ).find((x) => x.name === providerName);

    console.log('--------');
    console.log(messages.map((x) => x.content).join('\n\n'));

    const langchainMessages = messages.map((x) => {
      if (x.role === 'system') {
        return new SystemMessage(x.content);
      } else if (x.role === 'user') {
        return new HumanMessage(x.content);
      } else if (x.role === 'assistant') {
        return new AIMessage(x.content);
      }
    });

    let chatModelWithTools;
    let isStructuredOutput = false;
    if (tools && tools.length > 0) {
      const _tools = tools.map((x) => {
        return {
          type: 'function',
          function: x,
        };
      });
      chatModelWithTools = chatModel.bindTools(_tools);
    } else if (response_model) {
      isStructuredOutput = true;
      chatModelWithTools = chatModel.withStructuredOutput(
        response_model.schema,
        {
          includeRaw: true,
          name: response_model.name,
          method: 'jsonMode',
        },
      );
    }
    try {
      if (isStructuredOutput) {
        const jsonZod = zodToJsonSchema(response_model.schema);
        console.log('--------');
        console.log(jsonZod);
        langchainMessages[0].content += `

Please return following JSON Schema format:
${JSON.stringify(jsonZod, null, 2)}`;
      }
      const res = await (chatModelWithTools || chatModel).invoke(
        langchainMessages,
        { tool_choice },
      );

      if (isStructuredOutput) {
        return res.parsed;
      }
      const { response_metadata, tool_calls } = res;
      return {
        id: res.id as string,
        object: 'response',
        created: Math.floor(Date.now() / 1000),
        model: response_metadata.model_name,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: res.content,
              tool_calls: tool_calls,
            },
            finish_reason: response_metadata.finish_reason,
          },
        ],
        usage: {
          prompt_tokens: res.usage_metadata.input_tokens,
          completion_tokens: res.usage_metadata.output_tokens,
          total_tokens: res.usage_metadata.total_tokens,
        },
      } as T;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  constructor(modelName: string, userProvidedInstructions?: string) {
    super(modelName as any, userProvidedInstructions);
  }
}

export class BrowserInstance extends BaseInstance {
  browser_context: BrowserContext;

  stagehand?: Stagehand;

  runWithLLM: boolean = false;

  private eventEmitter = new EventEmitter();

  constructor(params?: BaseInstanceParams) {
    super(params);
  }

  run = async (modelProvider?: string) => {
    const httpProxy = settingsManager.getProxy();

    if (modelProvider) {
      if (!this.stagehand) {
        await this.stop();
      }
      const { provider: providerName, modelName } =
        await getProviderModel(modelProvider);
      const provider = await providersManager.getProvider(providerName);

      const llmClient = new MyLLMClient(modelProvider);

      const stagehand = new Stagehand({
        env: 'LOCAL',
        modelName: modelName as any,
        modelClientOptions: {
          apiKey: provider.provider.api_key,
          baseURL: provider.provider.api_base,
        },
        llmClient,
        localBrowserLaunchOptions: {
          userDataDir: this.instances?.config?.userDataPath,
          proxy: httpProxy
            ? {
                server: `${httpProxy}`,
              }
            : undefined,
          executablePath: this.instances?.config?.executablePath,
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--enable-webgl',
          ],
        },
      });

      await stagehand.init();

      const { context } = stagehand;
      this.browser_context = context;
      this.stagehand = stagehand;
    } else {
      if (
        this.instances?.config?.userDataPath ||
        this.instances?.config?.executablePath
      ) {
        const userDataDir = path.join(getDataPath(), 'User Data');
        this.browser_context = await chromium.launchPersistentContext(
          this.instances?.config?.userDataPath || userDataDir,
          {
            headless: false,
            proxy: httpProxy
              ? {
                  server: `${httpProxy}`,
                }
              : undefined,
            args: [
              '--disable-blink-features=AutomationControlled',
              '--enable-webgl',
            ],
            // channel: 'msedge',
            executablePath: this.instances?.config?.executablePath,
          },
        );
      } else if (this.instances?.config?.cdpUrl) {
        this.browser_context = await (
          await chromium.connectOverCDP(this.instances?.config?.cdpUrl)
        ).newContext();
      } else if (this.instances?.config?.wssUrl) {
        this.browser_context = await (
          await chromium.connect(this.instances?.config?.wssUrl)
        ).newContext();
      } else {
        const browser = await chromium.launch({
          headless: false,
          proxy: httpProxy
            ? {
                server: `${httpProxy}`,
              }
            : undefined,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--enable-webgl',
          ],
          channel: 'msedge',
        });
        this.browser_context = await browser.newContext();
      }
      this.runWithLLM = false;
    }

    this.browser_context.on('close', (page) => {
      this.eventEmitter.emit('close');
    });

    return this.browser_context;
  };

  getEnhancedContext = (modelProvider?: string) => {
    if (this.stagehand) {
      return this.stagehand.context;
    }
    return null;
  };

  stop = async () => {
    if (this.browser_context) {
      await this.browser_context.close();
      const b = this.browser_context.browser();
      if (b) {
        await b.close();
      }
      this.eventEmitter.emit('close');
    }
    this.stagehand = undefined;
  };

  clear = async () => {
    if (this.instances?.config?.userDataPath) {
      await fs.promises.rmdir(this.instances?.config?.userDataPath, {
        recursive: true,
      });
    }
  };

  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.off(event, listener);
  }
}
