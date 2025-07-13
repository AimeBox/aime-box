import {
  SystemMessage,
  AIMessage,
  HumanMessage,
  BaseMessage,
  ToolMessage,
  ToolMessageChunk,
} from '@langchain/core/messages';
import {
  BaseCheckpointSaver,
  END,
  START,
  StateGraph,
  MessagesAnnotation,
  BaseStore,
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
import { AgentMessageEvent, BaseAgent } from '../BaseAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import {
  StructuredTool,
  tool,
  ToolRunnableConfig,
} from '@langchain/core/tools';
import settingsManager from '@/main/settings';
import { getProviderModel } from '@/main/utils/providerUtil';
import { Document } from '@langchain/core/documents';

import { IterableReadableStream } from '@langchain/core/utils/stream';
import { RunnableConfig } from '@langchain/core/runnables';
import { isArray, isString, isUrl } from '@/main/utils/is';
import { Embeddings } from '@langchain/core/embeddings';
import { FormSchema } from '@/types/form';
import { getLoaderFromExt } from '@/main/loaders';
import { t } from 'i18next';
import { BaseTool } from '@/main/tools/BaseTool';
import { WebLoader } from '@/main/tools/WebLoader';
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { notificationManager } from '@/main/app/NotificationManager';
import { v4 as uuidv4 } from 'uuid';
import { NotificationMessage } from '@/types/notification';
import ExcelJS from 'exceljs';
import { ExtractAgentSystemPrompt } from './prompt';
import { removeThinkTags } from '@/main/utils/messages';

const fieldZod = z
  .array(
    z.object({
      name: z
        .string()
        .describe(
          'field name to display,be consistent with user input language',
        ),
      field: z
        .string()
        .describe('field name must english lower case, eg: abc_def'),
      description: z.string().optional().describe('field description'),
      type: z
        .enum([
          'string',
          'number',
          'date',
          'time',
          'boolean',
          'email',
          'tel',
          'bigint',
          'enum',
          'array',
        ])
        .describe('field type'),
      enumValues: z
        .array(z.string())
        .optional()
        .describe('field type is enum value'),
    }),
  )
  .describe('field information');

export class ExtractTool extends BaseTool {
  schema = z.object({
    pathOrUrl: z
      .string()
      .describe('file or directory path or website url to extract'),
    fields: fieldZod,
    savePath: z
      .string()
      .optional()
      .describe('File Save Path(.xlsx), Empty if not mentioned by the user'),
  });

  name: string = 'extract_tool';

  description: string =
    'Extract structured content from the given fields and files';

  model: BaseChatModel;

  allFieldInLLM: boolean;

  allDocInLLM: boolean;

  textSplitter: TextSplitter;

  embedding: Embeddings;

  messages?: BaseMessage[];

  mode: 'all_segment' | 'extract_segment' | 'all_in' = 'extract_segment';

  constructor(params?: {
    model: BaseChatModel;
    allFieldInLLM: boolean;
    allDocInLLM: boolean;
    embedding: Embeddings;
    messages?: BaseMessage[];
    mode: 'all_segment' | 'extract_segment' | 'all_in';
  }) {
    super({});
    this.model = params?.model;
    this.allFieldInLLM = params?.allFieldInLLM ?? false;
    this.allDocInLLM = params?.allDocInLLM ?? false;
    this.mode = params?.mode ?? 'extract_segment';
    this.embedding = params?.embedding;
    this.messages = params?.messages ?? [];
  }

  getFiles = async (sources: string[]) => {
    const supportedFileExt = [
      '.pdf',
      '.docx',
      '.doc',
      '.txt',
      '.jpg',
      '.png',
      '.jpeg',
    ];
    const pendingFiles = [];
    const { readdir } = await import('node:fs/promises');
    for (let index = 0; index < sources.length; index++) {
      const pathOrText = sources[index];
      if (fs.statSync(pathOrText).isDirectory()) {
        const files = await readdir(pathOrText, { recursive: true });
        for (let index2 = 0; index2 < files.length; index2++) {
          const file = files[index2];
          const ext = path.extname(path.join(pathOrText, file)).toLowerCase();
          if (supportedFileExt.includes(ext)) {
            pendingFiles.push(path.join(pathOrText, file));
          }
        }
      } else if (fs.statSync(pathOrText).isFile()) {
        if (
          supportedFileExt.includes(
            path.extname(pathOrText).toLocaleLowerCase(),
          )
        ) {
          pendingFiles.push(pathOrText);
        }
      }
    }
    return pendingFiles;
  };

  async extractCheck(
    result: string,
    content: string,
    field: {
      name?: string;
      field: string;
      type: string;
      description?: string | undefined;
      enumValues?: string[] | undefined;
    },
  ): Promise<boolean> {
    const prompt_check = ChatPromptTemplate.fromMessages([
      [
        'human',
        '### 背景\n在一段大文本中根据用户想抽取的字段信息,已抽取了一些信息,判断抽取的信息是否满足用户想抽取字段的要求### 任务\n检测抽取结果是否满足抽取字段描述的条件\n### 来源文本块\n<content>\n{content}\n</content>\n### 抽取字段:\n{field}\n\n### 抽取结果\n{result}\n\n### 输出\n只需输出`false`或`true`,不要任何解析或说明',
      ],
    ]);
    const checkDataSchema = z
      .object({
        [field.field]: z.boolean(),
      })
      .describe('抽取的信息是否满足');
    const checkChain = prompt_check.pipe(this.model);
    const ex2 = await checkChain.invoke(
      {
        field: field.field,
        result: result,
        content: content,
      },
      { tags: ['ignore'] },
    );
    return ex2.content.toString().includes('true');
  }

  async extractFile(
    doc: Document<Record<string, any>>[],
    fields: {
      name?: string;
      field: string;
      type: string;
      description?: string;
      enumValues?: string[];
    }[],
  ): Promise<any | undefined> {
    if (doc.length == 0) return undefined;
    return this.extractFileAllIn(doc, fields);
    // const SYSTEM_PROMPT_TEMPLATE = [
    //   '你是一个信息抽取专家,帮助用户提取需要的字段信息,可以进行推理得出答案,输出语言跟用户输入的语言一致,如果没有则输出"NULL"',
    // ].join('\n');
    // const prompt = [
    //   new SystemMessage(SYSTEM_PROMPT_TEMPLATE),
    //   new HumanMessage(doc.map((x) => x.pageContent).join('\n')),
    // ];
    // const zodFields = this.toZod(fields);
    // const extractionChain = this.model.withStructuredOutput(zodFields);
    // const { mode, allFieldInLLM, allDocInLLM } = this;

    // const checkExtractResult = false;
    // const splits = await this.textSplitter.splitDocuments(doc);

    // const extractFieldsResult = {};
    // for (const field of fields) {
    //   extractFieldsResult[field.field] = undefined;
    // }

    // if (allFieldInLLM) {
    //   if (mode == 'all_segment' || mode == 'all_in') {
    //     // 使用大模型一次性提取
    //     const ex = await extractionChain.invoke(prompt, { tags: ['ignore'] });
    //     return ex;
    //   } else {
    //     const vectorStore = await MemoryVectorStore.fromDocuments(
    //       splits,
    //       this.embedding,
    //     );
    //     let pageContent = [];
    //     if (splits.length == 1) {
    //       pageContent = [splits[0].pageContent];
    //     } else {
    //       const d = await vectorStore.similaritySearch(
    //         pageContent.map((x) => x.pageContent).join('\n'),
    //         5,
    //       );
    //       pageContent = d.map((x) => x.pageContent);
    //     }

    //     const ex = await extractionChain.invoke(prompt, { tags: ['ignore'] });
    //     console.log(fields);
    //     console.log(ex);
    //     return ex;
    //   }
    // } else {
    //   const vectorStore = await MemoryVectorStore.fromDocuments(
    //     splits,
    //     this.embedding,
    //   );
    //   let canStructured = true;

    //   for (let index = 0; index < fields.length; index++) {
    //     let extractResult = [];
    //     const field = fields[index];
    //     const SYSTEM_PROMPT_TEMPLATE = [
    //       'You are an expert at identifying key historic development in text.',
    //       'Only extract important historic developments. Extract nothing if no important information can be found in the text.',
    //     ].join('\n');

    //     const prompt = ChatPromptTemplate.fromMessages([
    //       ['system', SYSTEM_PROMPT_TEMPLATE],
    //       ['human', '{text}'],
    //     ]);
    //     let d = [];
    //     if (splits.length <= 5 || mode == 'all_segment') {
    //       d = splits;
    //     } else {
    //       d = await vectorStore.similaritySearch(
    //         `${field.name}\n\n${field?.description || ''}`,
    //         5,
    //       );
    //     }

    //     const extractionDataSchema = this.toZod([field]);

    //     try {
    //       if (!canStructured)
    //         throw new Error('Structured is Fail,Use LLM to extract');

    //       let result = 'NULL';
    //       const extractionChain = prompt.pipe(
    //         this.model.withStructuredOutput(extractionDataSchema),
    //       );
    //       for (let index = 0; index < d.length; index++) {
    //         const ex = await extractionChain.invoke(
    //           {
    //             text: d[index].pageContent,
    //           },
    //           { tags: ['ignore'] },
    //         );
    //         result = Object.values(ex)[0] as string;
    //         if (result) {
    //           if (checkExtractResult) {
    //             const isMatch = await this.extractCheck(
    //               result,
    //               d[index].pageContent,
    //               field,
    //             );
    //             if (isMatch) {
    //               extractResult.push(result);
    //               break;
    //             }
    //           } else {
    //             extractResult.push(result);
    //             break;
    //           }
    //         }
    //       }
    //       canStructured = true;
    //       //return result;
    //     } catch (err) {
    //       console.error(err);
    //       canStructured = false;
    //       const prompt_withoutStructured = ChatPromptTemplate.fromMessages([
    //         [
    //           'system',
    //           '你是一个提取信息专家,帮助用户找到需要的内容,需要对用户的输入文本段`<text></text>`内的信息进行提取',
    //         ],

    //         [
    //           'human',
    //           '### 任务\n提取字段: {field}\n提取名称: {name}\n### 注意\n - 直接输出结果无需任务解析,不要胡乱编写答案,如果找不到输出"NULL"\n - 以最简短明确准确的文字一字不漏输出最终答案\n\n### 以下是需要提取的文本\n<text>\n{text}\n</text>\n\n### 需要提取\n{name}\n{field}:',
    //         ],
    //       ]);
    //       let result = 'NULL';
    //       for (let index = 0; index < d.length; index++) {
    //         const text = d[index].pageContent;
    //         const extractionChain = prompt_withoutStructured.pipe(this.model);
    //         const rex = await extractionChain.invoke(
    //           {
    //             text: text,
    //             field: field.field,
    //             name: field.name,
    //           },
    //           { tags: ['ignore'] },
    //         );
    //         result = rex.content.toString();
    //         result = removeThinkTags(result);
    //         console.log(`${field.field}:${result}`);
    //         console.log('==========');
    //         if (!result.includes('NULL')) {
    //           if (checkExtractResult) {
    //             const isMatch = await this.extractCheck(
    //               result,
    //               d[index].pageContent,
    //               field,
    //             );
    //             if (isMatch) {
    //               extractResult.push(result);
    //             }
    //           } else {
    //             extractResult.push(result);
    //           }
    //         }
    //       }
    //     }
    //     if (extractResult.length > 0) {
    //       extractResult = [...new Set(extractResult)];
    //       extractFieldsResult[field.field] = extractResult.join(',');
    //     }
    //   }
    // }
    // return extractFieldsResult;
  }

  async extractFileAllIn(
    doc: Document<Record<string, any>>[],
    fields: {
      name?: string;
      field: string;
      type: string;
      description?: string;
      enumValues?: string[];
    }[],
  ): Promise<any | undefined> {
    if (doc.length == 0) return undefined;
    const zodFields = this.toZod(fields);

    const fieldsMessage = fields
      .map((x) => {
        return `- ${x.name}${x.description ? `: ${x.description}` : ''}`;
      })
      .join('\n');

    const SYSTEM_PROMPT_TEMPLATE = [
      '你是一个信息抽取专家,根据用户提供的文件和需要提取的字段进行信息整理,可以进行推理得出答案\n- 输出语言跟用户输入的语言一致.\n- 不要随意编造答案.\n- 你可以输出自己的解析.- 以正常文本输出',
    ].join('\n');

    const prompt = [
      new SystemMessage(SYSTEM_PROMPT_TEMPLATE),
      new HumanMessage(`提取这份文件的以下字段信息: \n${fieldsMessage}`),
      new HumanMessage(`${doc.map((x) => x.pageContent).join('\n\n')}`),
      // new AIMessage({
      //   content: '',
      //   tool_calls: [
      //     {
      //       name: 'ocr',
      //       args: { path: '/file_1.pdf' },
      //       id: '1',
      //       type: 'tool_call',
      //     },
      //   ],
      // }),
      // new ToolMessage({
      //   name: 'ocr',
      //   tool_call_id: '1',
      //   content: `${doc.map((x) => x.pageContent).join('\n\n')}`,
      // }),
    ];
    const result = await this.model.invoke(prompt, { tags: ['ignore'] });
    const content = removeThinkTags(result.text);
    console.log(content);
    prompt.push(new AIMessage(content));
    const extractionChain = this.model.withStructuredOutput(zodFields, {
      includeRaw: true,
    });

    const result_2 = await extractionChain.invoke(prompt, { tags: ['ignore'] });
    console.log(result_2.parsed);
    return result_2.parsed;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }

  async stream(
    input: z.infer<typeof this.schema>,
    config?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    //const { provider, modelName } = getProviderModel(this.model);
    //const model = await getChatModel(provider, modelName);
    const that = this;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    if (!this.embedding) {
      this.embedding = await getDefaultEmbeddingModel();
    }

    const { pathOrUrl, fields } = input;
    let type: 'url' | 'file' | 'directory';
    if (isUrl(pathOrUrl)) {
      type = 'url';
    } else if (fs.statSync(pathOrUrl).isFile()) {
      type = 'file';
    } else if (fs.statSync(pathOrUrl).isDirectory()) {
      type = 'directory';
    } else {
      throw new Error('Invalid path or url');
    }

    async function* generateStream() {
      if (type === 'url') {
        const loader = new WebLoader();
        const docs = await loader.invoke(pathOrUrl);
      }
      const files = [];
      if (type === 'file') {
        // const loader = getLoaderFromExt(path.extname(pathOrUrl), pathOrUrl);
        // const docs = await loader.load();
        files.push(pathOrUrl);
      } else if (type === 'directory') {
        files.push(...(await that.getFiles([pathOrUrl])));
      }

      yield `\n\nExtract Fields:\n${fields.map((x) => ` - \`${x.type}\` **${x.field}** : ${x.name} (${x.description})`).join('\n')}\n___\n`;
      const headers = ['name', 'path'];
      yield `| name `;
      const defaultFields = {};
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        yield `| ${field.field} `;
        defaultFields[field.field] = null;
        headers.push(field.field);
      }

      yield ` |\n`;
      yield `|${'-'.repeat(7)}`;
      for (let index = 0; index < fields.length; index++) {
        yield `|${'-'.repeat(7)}`;
      }
      yield `|\n`;
      let showMsg = false;
      if (files.length > 5) {
        showMsg = true;
      }
      const notificationId = uuidv4();
      if (showMsg) {
        notificationManager.create({
          id: notificationId,
          title: 'Extract',
          type: 'progress',
          percent: 0,
          duration: undefined,
          closeEnable: false,
        } as NotificationMessage);
      }
      const rows = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const loader = getLoaderFromExt(path.extname(file), file);
        let doc;
        try {
          doc = await loader.load();
        } catch (e) {
          console.error(e);
          throw e;
        }

        if (doc) {
          const row = [path.basename(file), file];
          yield `| [${path.basename(file)}](${file})`;
          const ext = path.extname(file).toLowerCase();
          if (showMsg) {
            notificationManager.update({
              id: notificationId,
              title: 'Extract',
              type: 'progress',
              description: `${file}`,
              percent: (index / files.length) * 100,
              duration: undefined,
              closeEnable: false,
            } as NotificationMessage);
          }
          try {
            const result = await that.extractFile(doc, fields);
            if (result) {
              let p = '';
              const values = { ...defaultFields };
              for (const key of Object.keys(values)) {
                let value = '';
                if (result[key]) {
                  values[key] = result[key];
                  value = values[key];
                }
                if (isArray(value)) {
                  row.push(value?.join('\n'));
                  p += `| ${value?.join(',')?.replaceAll('\n', ' ') || ''} `;
                } else {
                  row.push(value);
                  p += `| ${value?.toString()?.replaceAll('\n', ' ') || ''} `;
                }
              }

              yield `${p}`;
            }
          } catch (err) {
            yield `| extract error: ${err}`;
            row.push(`extract error: ${err}`);
          }
          rows.push(row);
        }
        yield `|\n`;
      }
      if (showMsg) {
        notificationManager.update({
          id: notificationId,
          title: 'Extract',
          type: 'progress',
          description: `Extract Done`,
          percent: 100,
          duration: 3,
          closeEnable: true,
        } as NotificationMessage);
      }
      if (input.savePath) {
        try {
          if (!input.savePath.toLowerCase().endsWith('.xlsx')) {
            input.savePath += '.xlsx';
          }
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Sheet1');

          // 2. 添加数据（带格式）
          worksheet.columns = [
            ...headers.map((x) => ({ header: x, key: x, width: 20 })),
          ];
          rows.forEach((row) => {
            worksheet.addRow(row);
          });
          await workbook.xlsx.writeFile(input.savePath);
          yield '\n___\n';
          yield `Extract Done, File Saved : ${input.savePath}`;
        } catch (err) {
          console.error(err);
        }
      }
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }

  toZod = (
    fields: {
      name?: string;
      field: string;
      type: string;
      description?: string | undefined;
      enumValues?: string[] | undefined;
    }[],
  ): ZodObject<any> => {
    const zodObject = {};
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index];
      let extractionDataSchema;
      if (field.type == 'number') {
        zodObject[field.field] = z
          .number()
          .optional()
          .describe(field.name + (field?.description || ''));
      } else if (field.type == 'boolean') {
        zodObject[field.field] = z
          .boolean()
          .optional()
          .describe(field.name + (field?.description || ''));
      } else if (field.type == 'bigint') {
        zodObject[field.field] = z
          .bigint()
          .optional()
          .describe(field.name + (field?.description || ''));
      } else if (field.type == 'date') {
        zodObject[field.field] = z
          .string()
          .optional()
          .describe(field.name + (field?.description || ''));
      } else if (field.type == 'enum' && field.enumValues) {
        zodObject[field.field] = z
          .enum(field.enumValues as [string, ...string[]])
          .optional()
          .describe(field.name + (field?.description || ''));
      } else if (field.type == 'array') {
        zodObject[field.field] = z
          .array(z.string())
          .optional()
          .describe(field.name + (field?.description || ''));
      } else {
        zodObject[field.field] = z
          .string()
          .optional()
          .describe(field.name + (field?.description || ''));
      }
    }
    return z.object(zodObject);
  };
}

export class ExtractAgent extends BaseAgent {
  name: string = 'extract';

  description: string = '对输入的文字或文件文件夹路径进行提取用户需要的信息';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    source: z.array(z.string()).describe('FilePaths Or Directories'),
    task: z.string().describe('Extract Task'),
    savePath: z.string().optional().describe('Save Path'),
  });

  configSchema: FormSchema[] = [
    // {
    //   label: t('字段分析模型'),
    //   field: 'fieldModel',
    //   component: 'ProviderSelect',
    //   componentProps: {
    //     type: 'llm',
    //   },
    // },
    // {
    //   label: t('提取模型'),
    //   field: 'extractModel',
    //   component: 'ProviderSelect',
    //   componentProps: {
    //     type: 'llm',
    //   },
    // },
    {
      label: t('common.embedding'),
      field: 'embedding',
      component: 'ProviderSelect',
      componentProps: {
        type: 'embedding',
      },
    },
    {
      label: t('一次性全字段提取'),
      field: 'allFieldInLLM',
      component: 'Switch',
      defaultValue: false,
    },
    {
      label: t('全文扫描'),
      field: 'allDocInLLM',
      component: 'Switch',
      defaultValue: false,
    },
    {
      label: '模式',
      field: 'mode',
      component: 'Select',
      componentProps: {
        options: [
          { label: '全文分段扫描', value: 'all_segment' },
          { label: '截取分段扫描', value: 'extract_segment' },
          { label: '全文扫描', value: 'all_in' },
        ],
      },
      defaultValue: 'extract_segment',
    },
    // {
    //   label: t('agents.prompt'),
    //   field: 'systemPrompt',
    //   component: 'InputTextArea',
    //   defaultValue: ExtractAgentSystemPrompt,
    //   required: true,
    // },
  ];

  // config: any = {
  //   fieldModel: '',
  //   extractModel: '',
  //   allDocInLLM: false,
  //   allFieldInLLM: false,
  // };

  textSplitter: TextSplitter;

  llm: BaseChatModel;

  // fieldLLM: BaseChatModel;

  // extractLLM: BaseChatModel;

  embedding: Embeddings;

  systemPrompt: string;

  mode: 'all_segment' | 'extract_segment' | 'all_in';

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  extractTool = tool(async ({ filePath, fields }) => {}, {
    name: 'extract_tool',
    description:
      'extract information from file or directory, filePath must be full path',
    schema: z.object({
      filePath: z
        .string()
        .describe('file or directory path to extract, full path'),
      fields: z.array(z.string()).describe('field names to extract'),
    }),
  });

  async createAgent(params: {
    store?: BaseStore;
    model?: BaseChatModel;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    configurable?: Record<string, any>;
  }) {
    const config = await this.getConfig();
    this.systemPrompt = ExtractAgentSystemPrompt;
    this.mode = config.mode;
    // const { provider, modelName } = getProviderModel(config.fieldModel);
    // const { provider: extractProvider, modelName: extractModelName } =
    //   getProviderModel(config.extractModel);
    const that = this;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 20,
    });
    const fieldModel = params.model;
    const extractModel = params.model;
    if (config.embedding) {
      const { provider: embeddingProvider, modelName: embeddingModelName } =
        getProviderModel(config.embedding);
      this.embedding = await getEmbeddingModel(
        embeddingProvider,
        embeddingModelName,
      );
    } else {
      this.embedding = await getDefaultEmbeddingModel();
    }

    async function callCheck(state: typeof MessagesAnnotation.State) {
      const promptTemplate = ChatPromptTemplate.fromMessages([
        ['system', that.systemPrompt],
        new MessagesPlaceholder('messages'),
      ]);
      const fieldsTool = tool(async ({ pathOrUrl, fields }) => {}, {
        name: 'extract_tool',
        schema: z.object({
          pathOrUrl: z
            .string()
            .describe('file or directory or web url path to extract'),
          fields: fieldZod,
          savePath: z
            .string()
            .optional()
            .describe('save path, Empty if not mentioned by the user'),
        }),
      });
      //const prompt = await promptTemplate.invoke({ messages: state.messages });
      const llmWithTool = fieldModel.bindTools([fieldsTool]);
      const response = await promptTemplate
        .pipe(llmWithTool)
        .invoke({ messages: state.messages });

      return { messages: [response] };
    }

    function shouldExtract({ messages }: typeof MessagesAnnotation.State) {
      const lastMessage = messages[messages.length - 1] as AIMessage;

      // If the LLM makes a tool call, then we route to the "tools" node
      if (
        lastMessage.tool_calls?.length == 1 &&
        lastMessage.tool_calls[0].name == 'extract_tool'
      ) {
        return 'extract';
      }
      // Otherwise, we stop (reply to the user) using the special "__end__" node
      return '__end__';
    }

    async function extractNode({ messages }: typeof MessagesAnnotation.State) {
      const lastMessage = messages[messages.length - 1] as AIMessage;
      const toolCall = lastMessage.tool_calls.find(
        (x) => x.name == 'extract_tool',
      );
      const { filePath, fields } = toolCall.args;

      const extractTool = new ExtractTool({
        model: extractModel,
        allFieldInLLM: config.allFieldInLLM,
        allDocInLLM: config.allDocInLLM,
        mode: config.mode,
        embedding: that.embedding,
        messages: messages,
      });
      const toolNode = new ToolNode([extractTool]);
      const result = await toolNode.streamEvents(
        {
          messages: [lastMessage],
        },
        {
          version: 'v2',
          // tags: ['ignore'],
        },
      );

      for await (const chunk of result) {
        //console.log(chunk);
      }

      return { messages: [lastMessage] };
    }

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('check', callCheck)
      .addEdge('__start__', 'check') // __start__ is a special name for the entrypoint
      .addNode('extract', extractNode)
      .addConditionalEdges('check', shouldExtract);

    // Finally, we compile it into a LangChain Runnable.
    const app = workflow.compile();
    return app;
  }

  async stream(
    input: z.infer<typeof this.schema> | string,
    options?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    const that = this;
    async function* generateStream() {}
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }

  async _call(
    input: z.infer<typeof this.schema> | string,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }
}
