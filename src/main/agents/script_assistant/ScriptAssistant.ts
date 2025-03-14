import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseAgent } from '../BaseAgent';
import { Embeddings } from '@langchain/core/embeddings';
import { ChatOptions } from '@/entity/Chat';
import { z } from 'zod';
import {
  CallbackManager,
  CallbackManagerForToolRun,
} from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { getDefaultEmbeddingModel } from '@/main/embeddings';
import { getChatModel } from '@/main/llm';
import settingsManager from '@/main/settings';
import { getProviderModel } from '@/main/utils/providerUtil';
import { toolsManager } from '@/main/tools';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { tool } from '@langchain/core/tools';
import { isArray, isObject, isString } from '@/main/utils/is';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { agentManager } from '..';

export class ScriptAssistant extends BaseAgent {
  name: string = 'ScriptAssistant';

  description: string =
    '智能脚本助手,使用工具和python脚本配合来解决用户的任务问题';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  llm: BaseChatModel;

  embedding: Embeddings;

  configSchema: FormSchema[] = [
    {
      label: t('model'),
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

  excludeTools: string[] = [
    'python_interpreter',
    'file-write',
    'file-read',
    'ListDirectory',
    'file_to_text',
  ];

  constructor(options: {
    provider: string;
    model: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  async _call(
    input: z.infer<typeof this.schema>,
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

  async matchingTools(
    userQuery: string,
    options?: RunnableConfig,
  ): Promise<string[]> {
    let tools = toolsManager.tools
      .map((x) => ({
        name: x.tool.name,
        description: x.tool.description,
      }))
      .filter((x) => !this.excludeTools.includes(x.name.toLowerCase()));

    const agents = agentManager.agents
      .filter((x) => x.info.name != this.name)
      .map((x) => ({
        name: x.agent.name,
        description: x.agent.description,
      }));

    tools = [...tools, ...agents];
    const matchingTools = z.object({
      toolNames: z.array(z.string()).describe('匹配合适的工具名称'),
    });
    const llmfields = this.llm.withStructuredOutput(matchingTools);

    const SYSTEM_PROMPT_TEMPLATE = [
      '根据给定的工具列表和用户问题,匹配可能合适的工具来帮助用户解决问题',
    ].join('\n');
    // const prompt = ChatPromptTemplate.fromTemplate([
    //   new SystemMessage(SYSTEM_PROMPT_TEMPLATE),
    //   new HumanMessage('<tools>\n{tools}\n</tools>\n\n用户问题: {text}'),
    // ]);
    const toolInfos = tools
      .map((x) => `[${x.name}] ${x.description}`)
      .join('\n------\n');

    const modelWithTools = this.llm.bindTools(
      [
        {
          type: 'function',
          function: {
            name: 'matching_tools',
            description: '匹配可能合适的工具来帮助用户解决问题',
            parameters: {
              type: 'object',
              properties: {
                toolNames: {
                  type: 'array',
                  description: '工具名称',
                  items: { type: 'string' },
                },
              },
              required: ['toolNames'],
            },
          },
        },
      ],
      {},
    );
    const prompt = `<tools>\n${toolInfos}\n</tools>\n\nUSER TASK: ${userQuery}`;
    const result = await modelWithTools.invoke(
      [new SystemMessage(SYSTEM_PROMPT_TEMPLATE), new HumanMessage(prompt)],
      {
        //tool_choice: 'matching_tools',
      },
    );
    if (result.tool_calls?.length > 0) {
      const toolNames = result.tool_calls[0]?.args?.toolNames;
      if (isArray(toolNames)) return toolNames;
      else return [];
    } else {
      return [];
    }
  }

  async generateScript(
    task: string,
    toolNames: string[],
    options?: RunnableConfig,
  ): Promise<{
    content?: string;
    script?: string;
    dependencies?: string;
    tool_calls?: {
      id: string;
      name: string;
      type: string;
      args: any;
    }[];
  }> {
    const tools = toolsManager.tools.filter((x) =>
      toolNames.includes(x.tool.name),
    );
    const agents = agentManager.agents.filter((x) =>
      toolNames.includes(x.agent.name),
    );

    const _tools = [...tools.map((x) => x.tool), ...agents.map((x) => x.agent)];

    let toolsApis;

    let text = '';
    for (const tool of _tools) {
      const jsonSchema = zodToJsonSchema(tool?.schema || tool?.schema);
      let schema;
      if (jsonSchema) {
        delete jsonSchema['$schema'];
        delete jsonSchema['additionalProperties'];

        schema = JSON.stringify(jsonSchema);
      } else {
        schema = {
          description: 'Input',
          type: 'object',
          properties: {
            input: {
              type: 'string',
            },
          },
          required: ['input'],
        };
      }

      text += [
        `[${tool.name}]`,
        `   - 描述: ${tool.description}`,
        `   - 请求方法: POST /tools/${tool.name}`,
        `   - 输入格式: ${JSON.stringify(schema)}`,
        `   - 输出格式: 'text/plain'`,
        tool.output ? `   - 输出示例: ${tool.output}` : '',
      ].join('\n');
      text += '\n';
    }

    const prompts = [
      new SystemMessage(
        [
          '## 任务\n你将直接调用工具或使用python为用户生成一个可执行的脚本,帮助实现用户的任务',
          '## 要点',
          '1.如果需要你可以快速使用以下路由请求来帮助你完成任务,如果python即可完成任务,则不需要使用该请求',
          `BaseUrl: http://127.0.0.1:${settingsManager.getSettings().serverPort}`,
          text,
          '',
          '2.如果任务是多个独立的,可以一个脚本或多个脚本完成',
          '3.脚本输出到```python```块中',
          '4.需要使用pip安装的依赖输出到```dependencies```块中,空格分割',
          '5.注意工具中output的示例格式是否是合适的',
          '6.如果工具中能直接完成该任务,则不需要使用python输出',
          '## 输出格式[使用python]',
          '```dependencies',
          'requests {dependencies-1} {dependencies-2} ...',
          '```',
          '',
          '```python',
          '{python-script}',
          '```',
        ].join('\n'),
      ),
      new HumanMessage(task),
    ];
    console.log(prompts[0].content);

    // const pythonInterpreter = toolsManager.tools.find(
    //   (x) => x.tool.name == 'python_interpreter',
    // ).tool;
    // const pyllm = this.llm.bindTools([pythonInterpreter]);
    let result;
    if (tools.length > 0) {
      result = await this.llm
        .bindTools(tools.map((x) => x.tool))
        .invoke(prompts);
    } else {
      result = await this.llm.invoke(prompts);
    }

    console.log(result.content);
    const content = result.content as string;
    if (content) {
      const regex = /```python\s*([\s\S]*?)\s*```/;
      const match = content.match(regex);
      let script;
      let dependencies;
      if (match) {
        script = match[1];
      }
      const regex2 = /```dependencies\s*([\s\S]*?)\s*```/;
      const match2 = content.match(regex2);
      if (match2) {
        dependencies = match2[1].split(' ');
      }
      if (!script) {
        return { content: result.content };
      }
      return { script, dependencies };
    } else {
      // 直接调用工具
      return { tool_calls: result.tool_calls };
    }
    //const script = result.tool_calls[0]?.args.script;
    //const dependencies = result.tool_calls[0]?.args.dependencies;
  }

  async stream(
    input: z.infer<typeof this.schema> | string,
    options?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    const { provider, modelName } =
      getProviderModel(this.config.model) ??
      getProviderModel(settingsManager.getSettings().defaultLLM);
    const that = this;
    this.llm = await getChatModel(provider, modelName);
    this.embedding = await getDefaultEmbeddingModel();

    const task = isString(input) ? input : input.task;
    if (!task) {
      throw new Error('unknow task');
    }
    const tools = toolsManager.tools.map((x) => ({
      name: x.tool.name,
      description: x.tool.description,
    }));
    async function* generateStream() {
      const matchingTools = await that.matchingTools(task, options);
      if (matchingTools.length > 0) {
        yield `\n\n匹配合适的工具为:\n${matchingTools.map((x) => ` - ${x}`).join('\n')}\n\n`;
      }

      const scriptInfo = await that.generateScript(task, matchingTools);

      if (scriptInfo.tool_calls && scriptInfo.tool_calls.length > 0) {
        for (const tool_call of scriptInfo.tool_calls as {
          id: string;
          name: string;
          type: string;
          args: any;
        }[]) {
          const tool = toolsManager.tools.find(
            (x) => x.tool.name == tool_call.name,
          );
          if (tool) {
            const res = await tool.tool.invoke(tool_call.args);
            yield res;
          }
        }
      } else if (scriptInfo.script) {
        yield `**script**\n\`\`\`python\n${scriptInfo.script}\n\`\`\`\n`;
        if (
          isArray(scriptInfo.dependencies) &&
          scriptInfo.dependencies.length > 0
        ) {
          yield `**dependencies**\n\`\`\`\n${scriptInfo.dependencies.join(' ')}\n\`\`\`\n`;
        }
        yield '\n';
        const pythonInterpreter = toolsManager.tools.find(
          (x) => x.tool.name == 'python_interpreter',
        ).tool;
        const res = await pythonInterpreter.invoke(scriptInfo);
        yield res;
      } else if (scriptInfo.content) {
        yield scriptInfo.content;
      }
    }
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
