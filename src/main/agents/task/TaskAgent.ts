import { AgentRegister, BaseAgent } from '..';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import type { DocumentInterface } from '@langchain/core/documents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import { JsonOutputFunctionsParser } from '@langchain/core/output_parsers/openai_functions';
import {
  BaseCheckpointSaver,
  END,
  START,
  StateGraph,
  MemorySaver,
} from '@langchain/langgraph';
import { createOpenAIFnRunnable } from 'langchain/chains/openai_functions';
import {
  createAgentExecutor,
  createReactAgent,
} from '@langchain/langgraph/prebuilt';
import { createOpenAIFunctionsAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { v4 as uuidv4 } from 'uuid';
import { toolsManager } from '../../tools';
import providersManager from '../../providers';
import { getChatModel } from '../../llm';
import { ChatOptions } from '../../../entity/Chat';
import { dbManager } from '../../db';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';

@AgentRegister('TaskAgent')
export class TaskAgent implements BaseAgent {
  llm: BaseChatModel;

  build = async (
    connectionName: string,
    modelName: string,
    options?: ChatOptions,
  ) => {
    const agent = new TaskAgent();
    agent.llm = await getChatModel(connectionName, modelName, options);
    return agent;
  };

  invoke = async (input: any) => {
    const tools = toolsManager.getList();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个任务实现AI助手,帮助用户达到最终目的,提供一步一步可以实现的步骤,最终生成一个可以执行的逻辑图
首先你需要提供一个或多个步骤来实现用户的最终目的,你可以使用一个或多个循环来达到目的

### 工具使用
- 你可以在逻辑节点中使用各种工具实现达到该目的
- 遇到不确定的事情或需要向用户提问的时候,你可以使用"askHuman"工具询问用户
- 如果没有合适的工具你可以使用"NodeJSVM"编写合适的代码来实现目的


### 逻辑图解析
START:起点
END:终点
Node:节点 addNode('节点名称', '节点运行逻辑函数')
ConditionalEdges:条件函数 addConditionalEdges('条件名称','条件函数',{{ '条件1': '下一个节点名称 | END' ,'条件2' :'下一个节点名称 | END', ... }})
Edge:节点和条件连接 addEdge('节点名称 | 条件名称 | START','下一个节点名称 | 下一个条件名称 | END')


### 逻辑图的全局变量
- 你可以制作一个全局变量json对象来存储每个逻辑运行的需要保留的信息
- 可以是一个数组用于执行循环
      `,
      ],
      ['human', '{task_goal}'],
    ]);
    const steps = z.object({
      steps: z.array(z.string().describe('每个步骤简单描述')),
      graph: z.array(z.string().describe('逻辑图')),
      variable: z.array(
        z.object({
          name: z.string().describe('变量名称'),
          description: z.string().describe('变量作用描述'),
          type: z.enum(['number', 'string', 'array', 'bool', 'object']),
        }),
      ),
    });
    const llmfields = this.llm.withStructuredOutput(steps, {
      method: 'functionCalling',
    });
    const chain = prompt.pipe(llmfields);
    const res = await chain.invoke(input);
    console.log(res);
    return res;
  };
}

@AgentRegister('TaskGraphAgent')
export class TaskGraphAgent implements BaseAgent {
  llm: BaseChatModel;

  build = async (
    connectionName: string,
    modelName: string,
    options?: ChatOptions,
  ) => {
    const agent = new TaskGraphAgent();
    agent.llm = await getChatModel(connectionName, modelName, options);
    return agent;
  };

  invoke = async (input: any) => {
    const tools = toolsManager.getList();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个任务实现AI助手,帮助用户达到最终目的,提供一步一步可以实现的步骤,最终生成一个可以执行的逻辑图
首先你需要提供一个或多个步骤来实现用户的最终目的,你可以使用一个或多个循环来达到目的

### 工具使用
- 你可以在逻辑节点中使用各种工具实现达到该目的
- 遇到不确定的事情或需要向用户提问的时候,你可以使用"askHuman"工具询问用户
- 如果没有合适的工具你可以使用"NodeJSVM"编写合适的代码来实现目的


### 逻辑图解析
START:起点
END:终点
Node:节点 addNode('节点名称', '节点运行逻辑函数')
ConditionalEdges:条件函数 addConditionalEdges('条件名称','条件函数',{{ '条件1': '下一个节点名称 | END' ,'条件2' :'下一个节点名称 | END', ... }})
Edge:节点和条件连接 addEdge('节点名称 | 条件名称 | START','下一个节点名称 | 下一个条件名称 | END')


### 逻辑图的全局变量
- 你可以制作一个全局变量json对象来存储每个逻辑运行的需要保留的信息
- 可以是一个数组用于执行循环
      `,
      ],
      ['human', '{task_goal}'],
      ['function'],
    ]);
    const steps = z.object({
      steps: z.array(z.string().describe('每个步骤简单描述')),
      graph: z.array(z.string().describe('逻辑图')),
      variable: z.array(
        z.object({
          name: z.string().describe('变量名称'),
          description: z.string().describe('变量作用描述'),
          type: z.enum(['number', 'string', 'array', 'bool', 'object']),
        }),
      ),
    });
    const llmfields = this.llm.withStructuredOutput(steps, {
      method: 'functionCalling',
    });
    const chain = prompt.pipe(llmfields);
    const res = await chain.invoke(input);
    console.log(res);
    return res;
  };
}
// export const BuildTaskAgent=()=>{
//   return 'TaskAgent'
// }
