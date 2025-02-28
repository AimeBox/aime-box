import { END, START, StateGraph } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatOptions } from '../../../entity/Chat';
import { getChatModel } from '../../llm';
import { toolsManager } from '../../tools';
import { PlannerNode } from '../nodes/PlannerNode';
import { SolverNode } from '../nodes/SolverNode';
import { ChatResponse } from '@/main/chat/ChatResponse';

type ReWOO = {
  task: string | null;
  plan_string: string | null;
  steps: Array<any>;
  results: any;
  result: string;
};
export const ReWOOAgent = async (
  connectionName: string,
  modelName: string,

  options: ChatOptions,
) => {
  const tools = toolsManager.tools
    .filter((x) => options.toolNames.includes(x.name))
    .map((x) => x.tool);

  const reWOO = {
    task: {
      value: String,
    },
    plan_string: {
      value: String,
    },
    steps: {
      value: (x: any[], y: any[]) => x.concat(y),
      default: () => [],
    },
    results: {
      value: Object,
      default: (): any => {
        // return y;
      },
    },
    result: {
      value: String,
    },
  };
  const llm = await getChatModel(connectionName, modelName, options);

  const planner = PlannerNode(llm, tools);
  const solver = SolverNode(llm);
  const get_plan = async (state: ReWOO) => {
    const result = (await planner.invoke({ task: state.task })) as string;
    const regex_pattern = /Plan:\s*(.+)\s*(#E\d+)\s*=\s*(\w+)\s*\[([^\]]+)\]/g;
    const matches = [];
    let match;
    while ((match = regex_pattern.exec(result)) !== null) {
      matches.push(match);
    }
    console.log(result);
    return { steps: matches, plan_string: result };
  };
  const get_current_task = (state: ReWOO): number | null => {
    if (!state.results) return 1;
    if (Object.keys(state.results).length == state.steps.length) return null;
    else return Object.keys(state.results).length + 1;
  };

  const tool_execution = async (state: ReWOO) => {
    const _step = get_current_task(state);
    const step_name = state.steps[_step - 1][2];
    const tool = state.steps[_step - 1][3];
    let tool_input = state.steps[_step - 1][4];

    const _results = state.results || {};
    for (const [k, v] of Object.entries(_results)) {
      tool_input = tool_input.replace(k, v);
    }

    if (tool == 'Google') {
      console.log(`========Search[${tool_input}]=======`);
      let result = await tools[0].invoke(tool_input.trim('"'));
      result = (
        await llm.invoke(
          `根据搜索结果回答问题,只需要回答问题的结果\n\n-----START-----\n${result}\n----END---\n\n问题:${tool_input.trim(
            '"',
          )}\n\n回答:`,
        )
      ).content.toString();
      console.log(`========Search Result[${result}]=======`);
      _results[step_name] = result;
    } else if (tool == 'LLM') {
      console.log(`========LLM[${tool_input}]=======`);
      const result = await llm.invoke(tool_input);
      console.log(`========LLM Result[${result.content.toString()}]=======`);
      _results[step_name] = result.content.toString();
    } else {
      throw new Error();
    }
    return { results: _results };
  };

  const solve = async (state: ReWOO) => {
    let plan = '';
    for (let index = 0; index < state.steps.length; index++) {
      // const { _plan, step_name, tool, tool_input } = state.steps[index];
      const _plan = state.steps[index][1];
      let step_name = state.steps[index][2];
      const tool = state.steps[index][3];
      let tool_input = state.steps[index][4];

      const _results = state.results || {};
      Object.keys(_results).forEach((k) => {
        tool_input = tool_input.replace(k, _results[k]);
        step_name = step_name.replace(k, _results[k]);
      });
      plan += `Plan: ${_plan}\n${step_name} = ${tool}[${tool_input}]`;
    }

    const result = await solver.invoke({ plan, task: state.task });
    return { result: result };
  };
  const buildGraph = () => {
    const workflow = new StateGraph<
      ReWOO,
      ReWOO,
      Partial<ReWOO>,
      'plan' | 'solve' | 'tool'
    >({
      channels: reWOO,
    });

    workflow.addNode('plan', get_plan);
    workflow.addNode('tool', tool_execution);
    workflow.addNode('solve', solve);

    workflow.addEdge('plan', 'tool');
    workflow.addEdge('solve', END);

    workflow.addConditionalEdges(
      'tool',
      (state) => {
        const _step = get_current_task(state);
        if (!_step) return 'solve';
        else return 'tool';
      },
      {
        solve: 'solve',
        tool: 'tool',
      },
    );
    workflow.addEdge(START, 'plan');
    const app = workflow.compile();
    return app;
  };

  return buildGraph();
};

export const chatWithReWOOAgent = async (
  query: string,
  connectionName: string,
  modelName: string,
  options: ChatOptions,
  history: BaseMessage[],
): Promise<ChatResponse> => {
  const app = await ReWOOAgent(connectionName, modelName, options);
  const config = { recursionLimit: 50 };
  const ress = await app.stream({ task: query }, config);
  // let res;
  let result = '';
  // let documents = [];
  while (true) {
    const res = await ress.next();
    if (res.value && Object.keys(res.value).includes(END)) {
      result = res.value[END].result;
    }
    if (res.done) {
      break;
    }
  }
  return { output: result };
};
