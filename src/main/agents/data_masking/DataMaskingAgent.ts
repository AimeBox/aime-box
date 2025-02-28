import {
  SystemMessage,
  AIMessage,
  HumanMessage,
  BaseMessage,
} from '@langchain/core/messages';
import {
  BaseCheckpointSaver,
  END,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { ChatOptions } from '../../../entity/Chat';
import { getChatModel } from '../../llm';
import { dbManager } from '../../db';
import { z, ZodObject } from 'zod';
import fs from 'fs';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { ImageLoader } from '../../loaders/ImageLoader';
import path from 'path';
import { getEmbeddingModel, getDefaultEmbeddingModel } from '../../embeddings';
import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
  TokenTextSplitter,
} from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { LLMGraphTransformer } from '@langchain/community/experimental/graph_transformers/llm';
import { ChatResponse } from '@/main/chat/ChatResponse';
import { BaseAgent } from '../BaseAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolRunnableConfig } from '@langchain/core/tools';
import settingsManager from '@/main/settings';
import { getProviderModel } from '@/main/utils/providerUtil';
import { Document } from '@langchain/core/documents';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { CallOptions } from '@langchain/langgraph/dist/pregel/types';
import { RunnableConfig } from '@langchain/core/runnables';
import { isArray, isString } from '@/main/utils/is';
import { Embeddings } from '@langchain/core/embeddings';
import { FormSchema } from '@/types/form';
import { getLoaderFromExt } from '@/main/loaders';
import { t } from 'i18next';

export class DataMaskingAgent extends BaseAgent {
  name: string = 'DataMasking';

  description: string = '对输入的文字或文件文件夹路径进行提取用户需要的信息';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    source: z.array(z.string()).describe('FilePaths Or Directories'),
    task: z.string().describe('Extract Task'),
    savePath: z.optional(z.string()).describe('Save Path'),
  });

  configSchema: FormSchema[] = [
    {
      label: t('字段分析模型'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
  ];

  config: any = {
    model: '',
  };

  textSplitter: TextSplitter;

  llm: BaseChatModel;

  constructor(options: {
    provider: string;
    model: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(arg, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }

  async stream(
    input: z.infer<typeof this.schema> | string,
    options?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    const { provider, modelName } =
      getProviderModel(this.config.model) ??
      getProviderModel(settingsManager.getSettings().defaultLLM);
    const that = this;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 20,
    });
    this.llm = await getChatModel(provider, modelName);

    async function* generateStream() {}

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
