import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import type { DocumentInterface } from '@langchain/core/documents';
import { RemoteRunnable } from '@langchain/core/runnables/remote';
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
import { ChatResponse } from '@/main/chat/ChatResponse';

const plan = zodToJsonSchema(
  z.object({
    steps: z
      .array(z.string())
      .describe('different steps to follow, should be in sorted order'),
  }),
);

const planFunction = {
  name: 'plan',
  description: 'This tool is used to plan the steps to follow',
  parameters: plan,
};
type PlanExecuteState = {
  input: string | null;
  plan: Array<string>;
  pastSteps: Array<string>;
  response: string | null;
  actions: Array<Object>;
};
const planExecuteState = {
  input: {
    value: null,
  },
  plan: {
    value: null,
    default: () => [],
  },
  pastSteps: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  response: {
    value: null,
  },
  actions: {
    value: (x, y) => {
      return x.concat(y);
    },
    default: () => [],
  },
};

const PlannerPrompt = ChatPromptTemplate.fromTemplate(
  `For the given objective, come up with a simple step by step plan. \
This plan should involve individual tasks, that if executed correctly will yield the correct answer. Do not add any superfluous steps. \
The result of the final step should be the final answer. Make sure that each step has all the information needed - do not skip steps.

{objective}`,
);

const ReplannerPrompt = ChatPromptTemplate.fromTemplate(
  `For the given objective, come up with a simple step by step plan.
This plan should involve individual tasks, that if executed correctly will yield the correct answer. Do not add any superfluous steps.
The result of the final step should be the final answer. Make sure that each step has all the information needed - do not skip steps.

Your objective was this:
{input}

Your original plan was this:
{plan}

You have currently done the follow steps:
{pastSteps}

Update your plan accordingly. If no more steps are needed and you can return to the user, then respond with that and use the 'response' function.
Otherwise, fill out the plan.
Only add steps to the plan that still NEED to be done. Do not return previously done steps as part of the plan.`,
);

const response = zodToJsonSchema(
  z.object({
    response: z.string().describe('Response to user.'),
  }),
);
const responseFunction = {
  name: 'response',
  description: 'Response to user.',
  parameters: response,
};

export const chatWithPlanExecuteAgent = async (
  query: string,
  connectionName: string,
  modelName: string,
  options: ChatOptions,
  history: BaseMessage[],
): Promise<ChatResponse> => {
  const memory = dbManager.langgraphMemory;
  const app = await PlanExecuteAgent(
    connectionName,
    modelName,
    options,
    memory,
  );

  const config = {
    recursionLimit: 50,
    configurable: { thread_id: 'conversation-num-1' },
  };

  let result;
  let actions = [];
  for await (const event of await app.stream({ input: query }, config)) {
    console.log(event);
    if (event?.agent?.actions) {
      actions = actions.concat(event?.agent?.actions);
    }
    if (!event.done) {
      result = event;
    }
  }
  const state = await app.getState(config);
  return { actions, output: result.replan.response };
};

export const PlanExecuteAgent = async (
  connectionName: string,
  modelName: string,
  options: ChatOptions,
  memory?: BaseCheckpointSaver,
) => {
  const tools = toolsManager.tools
    .filter((x) => (options?.toolNames ?? []).includes(x.name))
    .map((x) => x.tool);
  const connection = await (
    await providersManager.getProviders()
  ).find((x) => x.name === connectionName);
  const llm = await getChatModel(connectionName, modelName, options);
  const model = llm.bindTools([planFunction]);
  // let model;
  // let model_tools;
  // if (connection.type == 'ollama') {
  //   model = new OllamaFunctions(llm).bind({
  //     functions: [planFunction],
  //     function_call: planFunction,
  //   });
  //   model_tools = new OllamaFunctions(llm).bind({
  //     functions: tools.map((x) => {
  //       return {
  //         name: x.name,
  //         description: x.description,
  //         parameters: zodToJsonSchema(x.schema),
  //       };
  //     }),
  //   });
  // } else {
  //   model = (llm as any).bind({
  //     functions: [planFunction],
  //     function_call: planFunction,
  //   });
  // }

  // const model = new ChatOpenAI({
  //   modelName: 'gpt-4-0125-preview',
  // })
  const parserSingle = new JsonOutputFunctionsParser({ argsOnly: true });
  const planner = PlannerPrompt.pipe(model).pipe(parserSingle);

  const parser = new JsonOutputFunctionsParser();

  // if (connection.type == 'ollama') {
  //   const a = new OllamaFunctions(llm).bind({
  //     functions: [planFunction, responseFunction],
  //     function_call: planFunction,
  //   });
  //   replanner = ReplannerPrompt.pipe(a).pipe(parser);
  // } else {

  // }
  const replanner = createOpenAIFnRunnable({
    functions: [planFunction, responseFunction],
    outputParser: parser,
    llm: llm,
    prompt: ReplannerPrompt as any,
  });
  // const prompt = await pull<ChatPromptTemplate>(
  //   'hwchase17/openai-functions-agent',
  // );

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate('You are a helpful assistant'),
    // new MessagesPlaceholder('chat_history'),
    HumanMessagePromptTemplate.fromTemplate('{input}'),
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  // const react_prompt = await pull('wfh/react-agent-executor');
  const agentRunnable = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = createAgentExecutor({
    agentRunnable: agentRunnable,
    tools: tools as any[],
  });

  async function executeStep(
    state: PlanExecuteState,
  ): Promise<Partial<PlanExecuteState>> {
    const plan_str = state.plan
      .map((step, i) => {
        return `${i + 1}. ${step}`;
      })
      .join('\n');
    const task = state.plan[0];
    const task_formatted = `For the following plan:${plan_str}\n\nYou are tasked with executing step ${1}, ${task}.`;
    const agentResponse = await agentExecutor.invoke({
      input: task_formatted,
      // chat_history: '',
    });
    console.log('=======ExecuteStep=======');
    console.log([task, agentResponse]);
    const actions = [];
    agentResponse.steps.forEach((step) => {
      actions.push({
        runId: uuidv4(),
        thought: '',
        tool: step.action.tool,
        toolInput: step.action.toolInput,
        toolOutput: step.observation,
      });
    });

    return {
      actions: actions,
      pastSteps: [task, agentResponse.agentOutcome.returnValues.output],
    };
  }

  async function planStep(
    state: PlanExecuteState,
  ): Promise<Partial<PlanExecuteState>> {
    const plan = await planner.invoke({ objective: state.input });
    return { plan: plan.steps };
  }

  async function replanStep(
    state: PlanExecuteState,
  ): Promise<Partial<PlanExecuteState>> {
    const output = await replanner.invoke({
      input: state.input,
      plan: state.plan ? state.plan.join('\n') : '',
      pastSteps: state.pastSteps.join('\n'),
    });
    if ('response' in output) {
      return { response: output.response };
    }

    return { plan: output.steps };
  }

  function shouldEnd(state: PlanExecuteState) {
    if (state.response) {
      return 'true';
    }
    return 'false';
  }

  const buildGraph = () => {
    const workflow = new StateGraph<
      PlanExecuteState,
      PlanExecuteState,
      Partial<PlanExecuteState>,
      'agent' | 'planner' | 'replan'
    >({
      channels: planExecuteState,
    });

    // Add the plan node
    workflow.addNode('planner', planStep);

    // Add the execution step
    workflow.addNode('agent', executeStep);

    // Add a replan node
    workflow.addNode('replan', replanStep);

    workflow.addEdge(START, 'planner');

    // From plan we go to agent
    workflow.addEdge('planner', 'agent');

    // From agent, we replan
    workflow.addEdge('agent', 'replan');

    workflow.addConditionalEdges(
      'replan',
      // Next, we pass in the function that will determine which node is called next.
      shouldEnd,
      {
        true: END,
        false: 'agent',
      },
    );
    const app = workflow.compile({ checkpointer: memory });
    return app;
  };

  return await buildGraph();
};
