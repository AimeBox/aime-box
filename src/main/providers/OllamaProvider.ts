import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { Ollama } from 'ollama';
import type {
  ChatRequest as OllamaChatRequest,
  ChatResponse as OllamaChatResponse,
  Message as OllamaMessage,
  Tool as OllamaTool,
  ToolCall as OllamaToolCall,
} from 'ollama';
import {
  ChatOllamaInput,
  ChatOllama as LangchainChatOllama,
  OllamaEmbeddings,
  PullModelOptions,
} from '@langchain/ollama';
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
  BindToolsInput,
  LangSmithParams,
} from '@langchain/core/language_models/chat_models';

import { ChatOptions } from '@/entity/Chat';
import { Embeddings } from '@langchain/core/embeddings';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  MessageContentText,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
} from '@langchain/core/messages';
import { ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import {
  InteropZodType,
  isInteropZodSchema,
} from '@langchain/core/utils/types';
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from '@langchain/core/language_models/base';
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import {
  JsonOutputParser,
  StructuredOutputParser,
} from '@langchain/core/output_parsers';
import { v4 as uuidv4 } from 'uuid';
import { concat } from '@langchain/core/utils/stream';

export function convertOllamaMessagesToLangChain(
  messages: OllamaMessage,
  extra?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMetadata?: Record<string, any>;
    usageMetadata?: UsageMetadata;
  },
): AIMessageChunk {
  return new AIMessageChunk({
    content: messages.content ?? '',
    tool_call_chunks: messages.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: JSON.stringify(tc.function.arguments),
      type: 'tool_call_chunk',
      index: 0,
      id: uuidv4(),
    })),
    response_metadata: extra?.responseMetadata,
    usage_metadata: extra?.usageMetadata,
  });
}

export function convertToOllamaMessages(
  messages: BaseMessage[],
): OllamaMessage[] {
  return messages.flatMap((msg) => {
    if (['human', 'generic'].includes(msg._getType())) {
      return convertHumanGenericMessagesToOllama(msg);
    } else if (msg._getType() === 'ai') {
      return convertAMessagesToOllama(msg);
    } else if (msg._getType() === 'system') {
      return convertSystemMessageToOllama(msg);
    } else if (msg._getType() === 'tool') {
      return convertToolMessageToOllama(msg as ToolMessage);
    } else {
      throw new Error(`Unsupported message type: ${msg._getType()}`);
    }
  });
}

function convertAMessagesToOllama(messages: AIMessage): OllamaMessage[] {
  if (typeof messages.content === 'string') {
    return [
      {
        role: 'assistant',
        content: messages.content,
      },
    ];
  }

  const textFields = messages.content.filter(
    (c) => c.type === 'text' && typeof c.text === 'string',
  );
  const textMessages = (textFields as MessageContentText[]).map((c) => ({
    role: 'assistant',
    content: c.text,
  }));
  let toolCallMsgs: OllamaMessage | undefined;

  if (
    messages.content.find((c) => c.type === 'tool_use') &&
    messages.tool_calls?.length
  ) {
    // `tool_use` content types are accepted if the message has tool calls
    const toolCalls: OllamaToolCall[] | undefined = messages.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: tc.args,
        },
      }),
    );

    if (toolCalls) {
      toolCallMsgs = {
        role: 'assistant',
        tool_calls: toolCalls,
        content: '',
      };
    }
  } else if (
    messages.content.find((c) => c.type === 'tool_use') &&
    !messages.tool_calls?.length
  ) {
    throw new Error(
      "'tool_use' content type is not supported without tool calls.",
    );
  }

  return [...textMessages, ...(toolCallMsgs ? [toolCallMsgs] : [])];
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  return match ? match[1] : '';
}

function convertHumanGenericMessagesToOllama(
  message: HumanMessage,
): OllamaMessage[] {
  if (typeof message.content === 'string') {
    return [
      {
        role: 'user',
        content: message.content,
      },
    ];
  }
  return message.content.map((c) => {
    if (c.type === 'text') {
      return {
        role: 'user',
        content: c.text,
      };
    } else if (c.type === 'image_url') {
      if (typeof c.image_url === 'string') {
        return {
          role: 'user',
          content: '',
          images: [extractBase64FromDataUrl(c.image_url)],
        };
      } else if (c.image_url.url && typeof c.image_url.url === 'string') {
        return {
          role: 'user',
          content: '',
          images: [extractBase64FromDataUrl(c.image_url.url)],
        };
      }
    }
    throw new Error(`Unsupported content type: ${c.type}`);
  });
}

function convertSystemMessageToOllama(message: SystemMessage): OllamaMessage[] {
  if (typeof message.content === 'string') {
    return [
      {
        role: 'system',
        content: message.content,
      },
    ];
  } else if (
    message.content.every(
      (c) => c.type === 'text' && typeof c.text === 'string',
    )
  ) {
    return (message.content as MessageContentText[]).map((c) => ({
      role: 'system',
      content: c.text,
    }));
  } else {
    throw new Error(
      `Unsupported content type(s): ${message.content
        .map((c) => c.type)
        .join(', ')}`,
    );
  }
}

function convertToolMessageToOllama(message: ToolMessage): OllamaMessage[] {
  if (typeof message.content !== 'string') {
    throw new Error('Non string tool message content is not supported');
  }
  return [
    {
      role: 'tool',
      content: message.content,
    },
  ];
}

export interface ChatOllamaCallOptions extends BaseChatModelCallOptions {
  /**
   * An array of strings to stop on.
   */
  think?: boolean;
  stop?: string[];
  tools?: BindToolsInput[];
  format?: string | Record<string, any>;
}

export class ChatOllama
  extends BaseChatModel<ChatOllamaCallOptions, AIMessageChunk>
  implements ChatOllamaInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return 'ChatOllama';
  }

  model = 'llama3';

  numa?: boolean;

  numCtx?: number;

  numBatch?: number;

  numGpu?: number;

  mainGpu?: number;

  lowVram?: boolean;

  f16Kv?: boolean;

  logitsAll?: boolean;

  vocabOnly?: boolean;

  useMmap?: boolean;

  useMlock?: boolean;

  embeddingOnly?: boolean;

  numThread?: number;

  numKeep?: number;

  seed?: number;

  numPredict?: number;

  topK?: number;

  topP?: number;

  tfsZ?: number;

  typicalP?: number;

  repeatLastN?: number;

  temperature?: number;

  repeatPenalty?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  mirostat?: number;

  mirostatTau?: number;

  mirostatEta?: number;

  penalizeNewline?: boolean;

  streaming?: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: string | Record<string, any>;

  keepAlive?: string | number;

  client: Ollama;

  checkOrPullModel = false;

  baseUrl = 'http://127.0.0.1:11434';

  constructor(fields?: ChatOllamaInput) {
    super(fields ?? {});

    this.client = new Ollama({
      fetch: fields?.fetch,
      host: fields?.baseUrl,
      headers: fields?.headers,
    });
    this.baseUrl = fields?.baseUrl ?? this.baseUrl;

    this.model = fields?.model ?? this.model;
    this.numa = fields?.numa;
    this.numCtx = fields?.numCtx;
    this.numBatch = fields?.numBatch;
    this.numGpu = fields?.numGpu;
    this.mainGpu = fields?.mainGpu;
    this.lowVram = fields?.lowVram;
    this.f16Kv = fields?.f16Kv;
    this.logitsAll = fields?.logitsAll;
    this.vocabOnly = fields?.vocabOnly;
    this.useMmap = fields?.useMmap;
    this.useMlock = fields?.useMlock;
    this.embeddingOnly = fields?.embeddingOnly;
    this.numThread = fields?.numThread;
    this.numKeep = fields?.numKeep;
    this.seed = fields?.seed;
    this.numPredict = fields?.numPredict;
    this.topK = fields?.topK;
    this.topP = fields?.topP;
    this.tfsZ = fields?.tfsZ;
    this.typicalP = fields?.typicalP;
    this.repeatLastN = fields?.repeatLastN;
    this.temperature = fields?.temperature;
    this.repeatPenalty = fields?.repeatPenalty;
    this.presencePenalty = fields?.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty;
    this.mirostat = fields?.mirostat;
    this.mirostatTau = fields?.mirostatTau;
    this.mirostatEta = fields?.mirostatEta;
    this.penalizeNewline = fields?.penalizeNewline;
    this.streaming = fields?.streaming;
    this.format = fields?.format;
    this.keepAlive = fields?.keepAlive;
    this.checkOrPullModel = fields?.checkOrPullModel ?? this.checkOrPullModel;
  }

  // Replace
  _llmType() {
    return 'ollama';
  }

  /**
   * Download a model onto the local machine.
   *
   * @param {string} model The name of the model to download.
   * @param {PullModelOptions | undefined} options Options for pulling the model.
   * @returns {Promise<void>}
   */
  async pull(model: string, options?: PullModelOptions): Promise<void> {
    const { stream, insecure, logProgress } = {
      stream: true,
      ...options,
    };

    if (stream) {
      for await (const chunk of await this.client.pull({
        model,
        insecure,
        stream,
      })) {
        if (logProgress) {
          console.log(chunk);
        }
      }
    } else {
      const response = await this.client.pull({ model, insecure });
      if (logProgress) {
        console.log(response);
      }
    }
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this['ParsedCallOptions']>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOllamaCallOptions> {
    return this.withConfig({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    });
  }

  getLsParams(options: this['ParsedCallOptions']): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: 'ollama',
      ls_model_name: this.model,
      ls_model_type: 'chat',
      ls_temperature: params.options?.temperature ?? undefined,
      ls_max_tokens: params.options?.num_predict ?? undefined,
      ls_stop: options.stop,
    };
  }

  invocationParams(
    options?: this['ParsedCallOptions'],
  ): Omit<OllamaChatRequest, 'messages'> {
    if (options?.tool_choice) {
      throw new Error('Tool choice is not supported for ChatOllama.');
    }

    return {
      model: this.model,
      format: options?.format ?? this.format,
      keep_alive: this.keepAlive,
      think: options?.think == undefined ? true : options?.think,
      options: {
        numa: this.numa,
        num_ctx: this.numCtx,
        num_batch: this.numBatch,
        num_gpu: this.numGpu,
        main_gpu: this.mainGpu,
        low_vram: this.lowVram,
        f16_kv: this.f16Kv,
        logits_all: this.logitsAll,
        vocab_only: this.vocabOnly,
        use_mmap: this.useMmap,
        use_mlock: this.useMlock,
        embedding_only: this.embeddingOnly,
        num_thread: this.numThread,
        num_keep: this.numKeep,
        seed: this.seed,
        num_predict: this.numPredict,
        top_k: this.topK,
        top_p: this.topP,
        tfs_z: this.tfsZ,
        typical_p: this.typicalP,
        repeat_last_n: this.repeatLastN,
        temperature: this.temperature,
        repeat_penalty: this.repeatPenalty,
        presence_penalty: this.presencePenalty,
        frequency_penalty: this.frequencyPenalty,
        mirostat: this.mirostat,
        mirostat_tau: this.mirostatTau,
        mirostat_eta: this.mirostatEta,
        penalize_newline: this.penalizeNewline,
        stop: options?.stop,
      },
      tools: options?.tools?.length
        ? (options.tools.map((tool) =>
            convertToOpenAITool(tool),
          ) as OllamaTool[])
        : undefined,
    };
  }

  /**
   * Check if a model exists on the local machine.
   *
   * @param {string} model The name of the model to check.
   * @returns {Promise<boolean>} Whether or not the model exists.
   */
  private async checkModelExistsOnMachine(model: string): Promise<boolean> {
    const { models } = await this.client.list();
    return !!models.find(
      (m: { name: string }) => m.name === model || m.name === `${model}:latest`,
    );
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager,
    )) {
      if (!finalChunk) {
        finalChunk = chunk.message;
      } else {
        finalChunk = concat(finalChunk, chunk.message);
      }
    }

    // Convert from AIMessageChunk to AIMessage since `generate` expects AIMessage.
    const nonChunkMessage = new AIMessage({
      id: finalChunk?.id,
      content: finalChunk?.content ?? '',
      tool_calls: finalChunk?.tool_calls,
      response_metadata: finalChunk?.response_metadata,
      usage_metadata: finalChunk?.usage_metadata,
    });
    return {
      generations: [
        {
          text:
            typeof nonChunkMessage.content === 'string'
              ? nonChunkMessage.content
              : '',
          message: nonChunkMessage,
        },
      ],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

    const params = this.invocationParams(options);
    // TODO: remove cast after SDK adds support for tool calls
    const ollamaMessages = convertToOllamaMessages(messages) as OllamaMessage[];

    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    const stream = await this.client.chat({
      ...params,
      think: false,
      messages: ollamaMessages,
      stream: true,
    });

    let lastMetadata: Omit<OllamaChatResponse, 'message'> | undefined;

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        this.client.abort();
      }
      const { message: responseMessage, ...rest } = chunk;
      usageMetadata.input_tokens += rest.prompt_eval_count ?? 0;
      usageMetadata.output_tokens += rest.eval_count ?? 0;
      usageMetadata.total_tokens =
        usageMetadata.input_tokens + usageMetadata.output_tokens;
      lastMetadata = rest;

      yield new ChatGenerationChunk({
        text: responseMessage.content ?? '',
        message: convertOllamaMessagesToLangChain(responseMessage),
      });
      await runManager?.handleLLMNewToken(responseMessage.content ?? '');
    }

    // Yield the `response_metadata` as the final chunk.
    yield new ChatGenerationChunk({
      text: '',
      message: new AIMessageChunk({
        content: '',
        response_metadata: lastMetadata,
        usage_metadata: usageMetadata,
      }),
    });
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>,
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  // eslint-disable-next-line no-dupe-class-members
  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>,
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  // eslint-disable-next-line no-dupe-class-members
  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>,
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      >;

  // eslint-disable-next-line no-dupe-class-members
  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>,
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    if (config?.method === undefined || config?.method === 'jsonSchema') {
      const outputSchemaIsZod = isInteropZodSchema(outputSchema);
      const jsonSchema = outputSchemaIsZod
        ? toJsonSchema(outputSchema)
        : outputSchema;
      const llm = this.bindTools([
        {
          type: 'function' as const,
          function: {
            name: 'extract',
            description: jsonSchema.description,
            parameters: jsonSchema,
          },
        },
      ]).withConfig({
        format: 'json',
        ls_structured_output_format: {
          kwargs: { method: 'jsonSchema' },
          schema: toJsonSchema(outputSchema),
        },
      });
      const outputParser = outputSchemaIsZod
        ? StructuredOutputParser.fromZodSchema(outputSchema)
        : new JsonOutputParser<RunOutput>();

      if (!config?.includeRaw) {
        return llm.pipe(outputParser) as Runnable<
          BaseLanguageModelInput,
          RunOutput
        >;
      }

      const parserAssign = RunnablePassthrough.assign({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed: (input: any, config) => outputParser.invoke(input.raw, config),
      });
      const parserNone = RunnablePassthrough.assign({
        parsed: () => null,
      });
      const parsedWithFallback = parserAssign.withFallbacks({
        fallbacks: [parserNone],
      });
      return RunnableSequence.from<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      >([
        {
          raw: llm,
        },
        parsedWithFallback,
      ]);
    } else {
      // TODO: Fix this type in core
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return super.withStructuredOutput<RunOutput>(outputSchema, config as any);
    }
  }
}

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
      numCtx: options?.maxTokens,
      format: options?.format,
    });
    llm.invoke([], { think: false });
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
