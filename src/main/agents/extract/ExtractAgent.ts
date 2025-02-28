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

export class ExtractAgent extends BaseAgent {
  name: string = 'Extract';

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
      field: 'fieldModel',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
    {
      label: t('提取模型'),
      field: 'extractModel',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
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
  ];

  config: any = {
    fieldModel: '',
    extractModel: '',
    allDocInLLM: false,
    allFieldInLLM: false,
  };

  textSplitter: TextSplitter;

  llm: BaseChatModel;
  fieldLLM: BaseChatModel;
  extractLLM: BaseChatModel;
  embedding: Embeddings;

  constructor(options: {
    provider: string;
    model: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  // protected async _call(
  //   input: z.infer<typeof this.schema>,
  //   runManager?: CallbackManagerForToolRun,
  //   parentConfig?: ToolRunnableConfig,
  // ): Promise<any> {
  //   return await this.invoke(input);
  // }

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
      name: string;
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
    const checkChain = prompt_check.pipe(this.extractLLM);
    const ex2 = await checkChain.invoke({
      field: field.field,
      result: result,
      content: content,
    });
    return ex2.content.toString().includes('true');
  }

  async extractFile(
    doc: Document<Record<string, any>>[],
    fields: {
      name: string;
      field: string;
      type: string;
      description?: string | undefined;
      enumValues?: string[] | undefined;
    }[],
  ): Promise<any | undefined> {
    if (doc.length == 0) return undefined;
    const SYSTEM_PROMPT_TEMPLATE = [
      '你是一个信息抽取专家,帮助用户提取需要的字段信息,可以进行推理得出答案,输出语言跟用户输入的语言一致,如果没有则输出"NULL"',
    ].join('\n');
    const prompt = [
      new SystemMessage(SYSTEM_PROMPT_TEMPLATE),
      new HumanMessage(doc.map((x) => x.pageContent).join('\n')),
    ];
    const zodFields = this.toZod(fields);
    const extractionChain = this.extractLLM.withStructuredOutput(zodFields);

    const allFieldInLLM = this.config.allFieldInLLM ?? false;
    const allDocInLLM = this.config.allDocInLLM ?? false;
    const checkExtractResult = false;
    const splits = await this.textSplitter.splitDocuments(doc);
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splits,
      this.embedding,
    );
    const extractFieldsResult = {};
    for (const field of fields) {
      extractFieldsResult[field.field] = undefined;
    }

    if (allFieldInLLM) {
      if (allDocInLLM) {
        // 使用大模型一次性提取
        const ex = await extractionChain.invoke(prompt);
        return Object.values(ex);
      } else {
        let pageContent = [];
        if (splits.length == 1) {
          pageContent = [splits[0].pageContent];
        } else {
          const d = await vectorStore.similaritySearch(
            pageContent.map((x) => x.pageContent).join('\n'),
            5,
          );
          pageContent = d.map((x) => x.pageContent);
        }

        const ex = await extractionChain.invoke(prompt);
        console.log(fields);
        console.log(ex);
        return Object.values(ex);
      }
    } else {
      let canStructured = true;

      for (let index = 0; index < fields.length; index++) {
        let extractResult = [];
        const field = fields[index];
        const SYSTEM_PROMPT_TEMPLATE = [
          'You are an expert at identifying key historic development in text.',
          'Only extract important historic developments. Extract nothing if no important information can be found in the text.',
        ].join('\n');

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', SYSTEM_PROMPT_TEMPLATE],
          ['human', '{text}'],
        ]);
        let d = [];
        if (splits.length <= 5 || allDocInLLM) {
          d = splits;
        } else {
          d = await vectorStore.similaritySearch(
            `${field.name}\n\n${field.description}`,
            5,
          );
        }

        let extractionDataSchema = this.toZod([field]);

        try {
          if (!canStructured)
            throw new Error('Structured is Fail,Use LLM to extract');

          let result = 'NULL';
          const extractionChain = prompt.pipe(
            this.extractLLM.withStructuredOutput(extractionDataSchema),
          );
          for (let index = 0; index < d.length; index++) {
            const ex = await extractionChain.invoke({
              text: d[index].pageContent,
            });
            result = Object.values(ex)[0] as string;
            if (result) {
              if (checkExtractResult) {
                const isMatch = await this.extractCheck(
                  result,
                  d[index].pageContent,
                  field,
                );
                if (isMatch) {
                  extractResult.push(result);
                  break;
                }
              } else {
                extractResult.push(result);
                break;
              }
            }
          }
          canStructured = true;
          //return result;
        } catch (err) {
          console.error(err);
          canStructured = false;
          const prompt_withoutStructured = ChatPromptTemplate.fromMessages([
            [
              'system',
              '你是一个提取信息专家,帮助用户找到需要的内容,需要对用户的输入文本段`<text></text>`内的信息进行提取',
            ],

            [
              'human',
              '### 任务\n提取字段={field}[{name}:{description}]\n### 注意\n - 直接输出结果无需任务解析,不要胡乱编写答案,如果找不到输出"NULL"\n - 以最简短明确准确的文字一字不漏输出最终答案\n\n### 以下为需要提取的文本\n<text>\n{text}\n</text>\n\n### 提取结果\n{name}:{description}\n{field}:',
            ],
          ]);
          let result = 'NULL';
          for (let index = 0; index < d.length; index++) {
            const text = d[index].pageContent;
            const extractionChain = prompt_withoutStructured.pipe(
              this.extractLLM,
            );
            const rex = await extractionChain.invoke({
              text: text,
              field: field.field,
              name: field.name,
              description: field.description,
            });
            result = rex.content.toString();
            console.log(`${field.field}:${result}`);
            console.log('==========');
            if (!result.includes('NULL')) {
              if (checkExtractResult) {
                const isMatch = await this.extractCheck(
                  result,
                  d[index].pageContent,
                  field,
                );
                if (isMatch) {
                  extractResult.push(result);
                }
              } else {
                extractResult.push(result);
              }
            }
          }
        }
        if (extractResult.length > 0) {
          extractResult = [...new Set(extractResult)];
          extractFieldsResult[field.field] = extractResult;
        }
      }
    }
    return extractFieldsResult;
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

    const { provider: fieldProvider, modelName: fieldModel } = getProviderModel(
      this.config.fieldModel,
    );

    this.fieldLLM = await getChatModel(fieldProvider, fieldModel);
    const { provider: extractProvider, modelName: extractModel } =
      getProviderModel(this.config.extractModel);

    this.extractLLM = await getChatModel(extractProvider, extractModel);

    this.embedding = await getDefaultEmbeddingModel();
    const llmGraphTransformer = new LLMGraphTransformer({
      llm: this.llm,
    });
    let source;
    let task;
    if (isString(input)) {
      const ss = await this.llm
        .withStructuredOutput(this.schema)
        .invoke([
          new SystemMessage(
            '需要处理的路径输出至`source`\n主要的提取任务信息输出至`task`,必须是详细保留所有关键信息的任务描述',
          ),
          new HumanMessage(input),
        ]);
      source = ss.source;
      task = ss.task;
    } else {
      source = input.source;
      task = input.task;
    }

    async function* generateStream() {
      if (!source || source.length == 0) {
        throw new Error('请输入需要提取的文件路径');
      }
      const pendingFiles = await that.getFiles(source);
      if (pendingFiles.length == 0) {
        throw new Error('没有找到支持的文件');
      }
      yield `共发现 ${pendingFiles.length} 个文件,开始提取文件`;
      console.log(pendingFiles);

      const { fields, canStructured } = await that.getFields(
        task,
        that.fieldLLM,
      );
      if (!canStructured) {
        throw new Error('不支持的模型');
      }

      yield `\n\n需要提取字段为:\n${fields.map((x) => ` - \`${x.type}\` **${x.field}** : ${x.name} (${x.description})`).join('\n')}\n\n`;
      const outputs = [];
      yield `| 文件名 `;
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        yield `| ${field.field} `;
      }
      yield ` |\n`;
      yield `|${'-'.repeat(7)}`;
      for (let index = 0; index < fields.length; index++) {
        yield `|${'-'.repeat(7)}`;
      }
      yield `|\n`;

      for (let index = 0; index < pendingFiles.length; index++) {
        const file = pendingFiles[index];
        yield `| ${path.basename(file)} `;
        const ext = path.extname(file).toLowerCase();

        let doc = undefined;
        try {
          const loader = getLoaderFromExt(ext, file);
          doc = await loader.load();
        } catch {}

        if (doc) {
          const result = await that.extractFile(doc, fields);
          if (result) {
            let p = '';
            const values = Object.values(result);
            for (let vindex = 0; vindex < values.length; vindex++) {
              const value = values[vindex];
              if (isArray(value)) {
                p += `| ${value?.join(',')?.replaceAll('\n', ' ') || ''} `;
              } else {
                p += `| ${value?.toString()?.replaceAll('\n', ' ') || ''} `;
              }
            }

            yield `${p}`;
          } else {
          }
        }
        yield `|\n`;
      }
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }

  getFields = async (query: string, llm: BaseChatModel) => {
    let canStructured = false;

    //根据问题提取字段
    const jsonFields = z
      .object({
        fields: z.array(
          z.object({
            name: z.string().describe('字段名称_中文'),
            field: z.string().describe('字段名称_小写英文'),
            description: z.optional(z.string()).describe('字段描述'),
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
              .describe('字段类型'),
            enumValues: z.optional(
              z.array(z.string()).describe('字段类型为enum的value枚举'),
            ),
          }),
        ),
      })
      .describe('用户输入的字段结构化');
    const messages = [
      new SystemMessage(
        '请对用户输入描述整理为结构化的json,可以补充详细的字段描述',
      ),
      // new HumanMessage(
      //   '我想提取论文中的作者信息和发布时间还有论文的标题论文副标题,包括引用的来源论文 还有一些作者邮箱和论文类型(分别是: 学术论文, 会议论文, 专利, 技术报告, 学位论文, 其他)',
      // ),
      // new AIMessage({
      //   content: '已为你提取相关信息',
      //   tool_calls: [
      //     {
      //       id: '12345',
      //       name: 'fields',
      //       args: {
      //         fields: [
      //           {
      //             name: '作者信息',
      //             field: 'author',
      //             description: '作者信息',
      //             type: 'string',
      //           },
      //           {
      //             name: '发布时间',
      //             field: 'publish_time',
      //             description: '发布时间',
      //             type: 'date',
      //           },
      //           {
      //             name: '论文标题',
      //             field: 'title',
      //             description: '论文标题',
      //             type: 'string',
      //           },
      //           {
      //             name: '论文副标题',
      //             field: 'subtitle',
      //             description: '论文副标题',
      //             type: 'string',
      //           },
      //           {
      //             name: '引用的来源论文',
      //             field: 'reference',
      //             description: '引用的来源论文',
      //             type: 'string',
      //           },
      //           {
      //             name: '作者邮箱',
      //             field: 'email',
      //             description: '作者邮箱',
      //             type: 'email',
      //           },
      //           {
      //             name: '论文类型',
      //             field: 'type',
      //             description: '论文类型',
      //             type: 'enum',
      //             enumValues: [
      //               '学术论文',
      //               '会议论文',
      //               '专利',
      //               '技术报告',
      //               '学位论文',
      //               '其他',
      //             ],
      //           },
      //         ],
      //       },
      //     },
      //   ],
      // }),
      // new ToolMessage({
      //   content: '已为你提取相关信息',
      //   tool_calls: [
      //     {
      //       id: '12345',
      //       name: 'fields',
      //     }
      //   ]
      // }),
      new HumanMessage(query),
    ];

    const llmfields = llm.withStructuredOutput(jsonFields, {
      name: 'jsonFields',
      //method: 'jsonSchema',
      includeRaw: false,
      //strict: true,
    });
    let fields = [] as {
      name: string;
      field: string;
      type: string;
      description?: string;
      enumValues?: string[] | undefined;
    }[];
    try {
      const res = await llmfields.invoke(messages);

      const validationResult = jsonFields.safeParse(res);
      if (!validationResult.success) {
        throw new Error('Invalid response format');
      }
      fields = validationResult.data.fields;

      canStructured = true;
    } catch (err) {
      console.error(err);
      fields = query.split(',').map((x) => {
        return { name: x, field: x, type: 'string', description: undefined };
      });
    }
    return { fields, canStructured };
  };

  toZod = (
    fields: {
      name: string;
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
          .optional(z.number())
          .describe(field.name + field.description);
      } else if (field.type == 'boolean') {
        zodObject[field.field] = z
          .optional(z.boolean())
          .describe(field.name + field.description);
      } else if (field.type == 'bigint') {
        zodObject[field.field] = z
          .optional(z.bigint())
          .describe(field.name + field.description);
      } else if (field.type == 'date') {
        zodObject[field.field] = z
          .optional(z.string())
          .describe(field.name + field.description);
      } else if (field.type == 'enum' && field.enumValues) {
        zodObject[field.field] = z
          .optional(z.enum(field.enumValues as [string, ...string[]]))
          .describe(field.name + field.description);
      } else if (field.type == 'array') {
        zodObject[field.field] = z
          .optional(z.array(z.string()))
          .describe(field.name + field.description);
      } else {
        zodObject[field.field] = z
          .optional(z.string())
          .describe(field.name + field.description);
      }
    }
    return z.object(zodObject);
  };
}
