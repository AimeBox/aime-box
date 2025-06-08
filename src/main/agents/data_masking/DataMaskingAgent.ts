import {
  SystemMessage,
  AIMessage,
  HumanMessage,
  BaseMessage,
} from '@langchain/core/messages';
import {
  BaseCheckpointSaver,
  BaseStore,
  END,
  MessagesAnnotation,
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
import { AgentMessageEvent, BaseAgent } from '../BaseAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolRunnableConfig } from '@langchain/core/tools';
import settingsManager from '@/main/settings';
import { getProviderModel } from '@/main/utils/providerUtil';
import { Document } from '@langchain/core/documents';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { RunnableConfig } from '@langchain/core/runnables';
import { isArray, isString } from '@/main/utils/is';
import { Embeddings } from '@langchain/core/embeddings';
import { FormSchema } from '@/types/form';
import { getLoaderFromExt } from '@/main/loaders';
import { t } from 'i18next';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseTool } from '@/main/tools/BaseTool';

const default_sensitive_fields = [
  'name',
  'full_name',
  'id_number',
  'passport_number',
  'social_security_number',
  'driver_license_number',
  'phone_number',
  'email',
  'address',
  'date_of_birth',
  'gender',
  'nationality',
  'biometric_data',
  'fingerprint',
  'facial_recognition_data',
  'bank_account_number',
  'credit_card_number',
  'credit_card_cvv',
  'credit_card_expiry',
  'tax_id',
  'salary',
  'credit_score',
  'medical_record_number',
  'diagnosis',
  'prescription',
  'dna_data',
  'health_insurance_number',
  'username',
  'password',
  'security_question_answer',
  'session_token',
  'api_key',
  'ip_address',
  'mac_address',
  'imei',
  'gps_coordinates',
  'location_history',
  'camera_footage',
  'ethnicity',
  'religion',
  'political_affiliation',
  'sexual_orientation',
  'gender_identity',
  'criminal_record',
  'school_name',
  'student_id',
  'employee_id',
  'salary_details',
  'performance_review',
];

const prompt = `
Your task is to desensitize the files provided by the user.

1. You need to first confirm the file path to be processed.
2. If the user does not explicitly specify sensitive fields, you should first recommend some potentially sensitive fields for the user to confirm.
3. Use the \`data_masking_tool\` tool to process the file. If the user does not specify savePath, this parameter is not required.

`;

export class DataMaskingTool extends BaseTool {
  schema = z.object({
    path: z.string().describe('file or directory path to masking'),
    sensitive_fields: z.array(z.string()),
    not_limited: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, including but not limited to sensitive_fields'),
    save_path: z.string().optional(),
  });

  name: string = 'data_masking_tool';

  description: string =
    'Extract structured content from the given fields and files';

  model: BaseChatModel;

  textSplitter: TextSplitter;

  constructor(params: { model: BaseChatModel }) {
    super();
    this.model = params.model;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const loader = getLoaderFromExt(path.extname(arg.path), arg.path);
    const docs = await loader.load();
    const content = docs.map((x) => x.pageContent).join('\n\n');
    const chunks = await this.textSplitter.splitText(content);
    const model = this.model.withStructuredOutput(
      z.object({ sensitive_content: z.array(z.string()) }),
      { includeRaw: true },
    );

    let sensitive_content: string[] = [];
    for (const chunk of chunks) {
      const include = `Including sensitive fields: ${arg.sensitive_fields.join(
        ', ',
      )}.`;
      const humanMessage = `<content>\n${chunk}\n</content>`;
      const messages = [
        new SystemMessage(`
# Task
Your task is to extract the content from the provided <content> tags based on the specified fields, keeping the extracted content exactly as in the original text.

# Fields to extract:
${arg.sensitive_fields.map((x) => `- ${x}`).join('\n')}${arg.not_limited ? '\nIncluding but not limited to the above fields' : ''}

# Note
- The output must be the original content and must not include field names.
`),
        new HumanMessage(`
<content>
姓名：【张三】
性别：男
出生日期：【1990年5月15日】
联系电话：【138-1234-5678】
电子邮箱：【zhangsan@example.com】
家庭住址：【北京市朝阳区XX路XX号XX小区X栋X单元1001室】

教育背景
2010.09-2014.07 【北京大学】 计算机科学与技术 本科

工作经历
2015.03-至今 【XX科技有限公司】 高级软件工程师

负责核心系统开发，涉及【用户隐私数据加密】模块设计

参与【国家级政务平台】(项目编号：【NP-2020-12345】)的后端开发

证书与技能

高级程序员认证（证书编号：【GA-2018-98765】）

熟悉【金融支付系统】安全协议开发

其他信息

身份证号：【110105199005153216】

护照号码：【E12345678】

银行卡号（工资卡）：【6222-8888-6666-9999】
</content>
`),
        new AIMessage(
          JSON.stringify({
            sensitive_content: [
              '张三',
              '1990年5月15日',
              '138-1234-5678',
              'zhangsan@example.com',
              '北京市朝阳区XX路XX号XX小区X栋X单元1001室',
              '北京大学',
              '高级软件工程师',
              'NP-2020-12345',
              'GA-2018-98765',
              '6222-8888-6666-9999',
              'E12345678',
              '110105199005153216',
            ],
          }),
        ),
        new HumanMessage(humanMessage),
      ];
      const res = await model.invoke(messages, { tags: ['ignore'] });
      if (res?.parsed && res.parsed.sensitive_content?.length > 0)
        sensitive_content.push(...res.parsed.sensitive_content);
    }
    sensitive_content = [...new Set(sensitive_content)];

    return `File: "${arg.path}" desensitized successfully\nTotal of ${sensitive_content.length} field information processed.\nIncluding:\n${sensitive_content.map((x) => `- ${x}`).join('\n')}
<file>${arg.path}</file>`;
  }
}

export class DataMaskingAgent extends BaseAgent {
  name: string = 'data_masking';

  description: string =
    '对输入的文字或文件文件夹路径进行敏感信息脱敏,支持处理文本, Word文件, 图片';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    source: z.array(z.string()).describe('FilePaths Or Directories'),
    task: z.string().describe('Extract Task'),
    savePath: z.string().optional().describe('Save Path'),
  });

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
  ];

  textSplitter: TextSplitter;

  llm: BaseChatModel;

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  async createAgent(params: {
    store?: BaseStore;
    model?: BaseChatModel;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    configurable?: Record<string, any>;
  }): Promise<any> {
    const { model, chatOptions } = params;
    const config = await this.getConfig();
    this.model = model;
    if (!this.model) {
      try {
        const { provider, modelName } = getProviderModel(config.model);
        this.model = await getChatModel(provider, modelName, chatOptions);
      } catch {
        console.error('model not found');
      }
    }
    const agent = createReactAgent({
      llm: this.model,
      tools: [new DataMaskingTool({ model: this.model })],
      prompt: prompt,
      name: this.name,
    });

    return agent;
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
