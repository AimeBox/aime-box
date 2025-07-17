import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from './BaseTool';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { z } from 'zod';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { getProviderModel } from '../utils/providerUtil';
import { getChatModel } from '../llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { toolsManager } from '.';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface AutoToolParameters extends ToolParams {
  model: string;
}

export class SearchTool extends BaseTool {
  toolKitName: string = 'auto_tool_toolkit';

  name: string = 'search';

  description: string = 'Search tool';

  schema = z.object({
    task: z.string(),
  });

  model: string;

  constructor(params?: AutoToolParameters) {
    super(params);
    this.model = params?.model;
  }

  async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const { provider, modelName } = getProviderModel(this.model);
    const llm = await getChatModel(provider, modelName, { temperature: 0 });
    const alltools = [];
    for (const tool of toolsManager.tools) {
      if (tool.is_toolkit) {
        for (const subTool of tool.tools) {
          alltools.push(subTool);
        }
      } else {
        alltools.push(tool);
      }
    }

    const tools = alltools.map((x) => {
      return `Tool Name: ${x.name}\n Tool Description: ${x.description}\n Tool Schema: ${JSON.stringify(x.schema)}\n`;
    });
    const hum = `TASK: ${arg.task}\n\n---TOOL LIST---\n${tools.join('\n----\n')}\n---TOOL LIST---\n`;
    const msg = [
      new SystemMessage(
        `You are a helpful assistant who can use the following tools. You may choose as many tools as reasonably applicable to the task, selecting one or more that best match the requirements.
Please explain the name and reason for each tool you selected.
Do not output the tool arguments, just the tool name and reason.`,
      ),
      new HumanMessage(hum),
    ];
    const res = await llm
      .withStructuredOutput(
        z.object({
          tools: z.array(z.object({ name: z.string(), reason: z.string() })),
        }),
      )
      .invoke(msg, { tags: ['ignore'] });
    if (res.tools.length === 0) {
      return 'No tools selected';
    }
    const toolInstances = alltools.filter((x) =>
      res.tools.some((y) => y.name === x.name),
    );
    if (toolInstances.length === 0) {
      return 'Tool not found';
    }
    const selectedTools = [];
    for (const tool of res.tools) {
      const toolInstance = toolInstances.find((x) => x.name === tool.name);
      if (!toolInstance) {
        continue;
      }
      selectedTools.push(
        `Tool Name: ${tool.name}\n Tool Reason: ${tool.reason}\nTool Schema: \n${JSON.stringify(toolInstance.schema, null, 2)}`,
      );
    }

    return selectedTools.join('\n\n---\n\n');
  }
}

export class ExtractTool extends BaseTool {
  toolKitName: string = 'auto_tool_toolkit';

  name: string = 'extract';

  description: string = 'Extract tool';

  schema = z.object({
    toolName: z.string(),
    toolArgs: z.any(),
  });

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class AutoToolToolkit extends BaseToolKit {
  name: string = 'auto_tool_toolkit';

  configSchema: FormSchema[] = [
    {
      field: 'model',
      label: 'LLM',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
  ];

  constructor(params?: AutoToolParameters) {
    super(params);
    //this.apiKey = params?.apiKey;
  }

  getTools(): BaseTool[] {
    return [new SearchTool(this.params), new ExtractTool(this.params)];
  }
}
