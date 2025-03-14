import { ipcMain } from 'electron';
import { RemoteRunnable } from '@langchain/core/runnables/remote';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'ts-node';
import { isClassDeclaration } from 'typescript';
import { stringify } from 'querystring';
import { ChatOptions } from '../../entity/Chat';
import { getChatModel, getDefaultLLMModel } from '../llm';
import settingsManager from '../settings';
import providersManager from '../providers';
import { ExtractAgent } from './extract/ExtractAgent';
import { BaseAgent } from './BaseAgent';
import { dbManager } from '../db';
import { Agent } from '@/entity/Agent';
import { Tool } from '@langchain/core/tools';
import { ScriptAssistant } from './script_assistant/ScriptAssistant';
import { FormSchema } from '@/types/form';
import { TranslateAgent } from './translate/TranslateAgent';
import { PlanningAgent } from './planning/PlanningAgent';
import { Like, Repository } from 'typeorm';
import {
  createReactAgent,
  createAgentExecutor,
} from '@langchain/langgraph/prebuilt';
import { BaseTool } from '../tools/BaseTool';
import { toolsManager } from '../tools';
import { getProviderModel } from '../utils/providerUtil';
import { createSupervisor, OutputMode } from '@langchain/langgraph-supervisor';
import { BaseStore, InMemoryStore, MemorySaver } from '@langchain/langgraph';

export interface AgentInfo extends Agent {
  static: boolean;
  hidden: boolean;
  configSchema: FormSchema[];
}

export class AgentManager {
  agents: { info: AgentInfo; agent: BaseAgent }[] = [];

  agentRepository: Repository<Agent>;

  async init() {
    this.agentRepository = dbManager.dataSource.getRepository(Agent);
    this.registerAgent(ExtractAgent);
    this.registerAgent(ScriptAssistant);
    this.registerAgent(TranslateAgent);
    this.registerAgent(PlanningAgent);
    if (!ipcMain) return;
    ipcMain.on('agent:getList', async (event, filter?: string) => {
      event.returnValue = await this.getList(filter);
    });
    ipcMain.handle('agent:create', (event, data: any) =>
      this.createAgent(data),
    );
    ipcMain.handle('agent:update', (event, data: any) =>
      this.updateAgent(data),
    );
    ipcMain.handle('agent:delete', (event, id: string) => this.deleteAgent(id));
    ipcMain.on(
      'agent:invoke',
      async (event, llmProvider: string, name: string, input: any) => {
        const res = await this.invoke(llmProvider, name, input);
        event.returnValue = res;
      },
    );
    ipcMain.on(
      'agent:invokeAsync',
      async (event, llmProvider: string, name: string, input: any) => {
        const res = await this.invoke(llmProvider, name, input);
        event.sender.send('agent:invokeAsync', res);
        event.returnValue = res;
      },
    );
    // ipcMain.on('agent:getList', async (event, filter?: string) => {
    //   event.returnValue = this.agents;
    // });
  }

  private getAgentConfigSchema(agent: Agent): FormSchema[] {
    return [
      {
        component: 'Input',
        field: 'name',
        label: '名称',
        defaultValue: agent.name,
      },
      {
        component: 'InputTextArea',
        field: 'description',
        label: '描述',
        defaultValue: agent.description,
      },
      {
        component: 'InputTextArea',
        field: 'prompt',
        label: '提示词',
        defaultValue: agent.prompt,
      },
      {
        component: 'ProviderSelect',
        field: 'model',
        label: '模型',
        defaultValue: agent.model,
        componentProps: {
          type: 'llm',
        },
      },
      {
        component: 'Select',
        field: 'type',
        label: '类型',
        defaultValue: agent.type,
        componentProps: {
          options: [
            { label: 'React', value: 'react' },
            { label: 'Supervisor', value: 'supervisor' },
          ],
        },
      },
      {
        component: 'AgentSelect',
        field: 'agents',
        label: 'AI助手',
        defaultValue: agent.agents?.map((x) => x.id) || [],
      },
      {
        component: 'ToolSelect',
        field: 'tools',
        label: '工具',
        defaultValue: agent.tools?.map((x) => x.name) || [],
      },
    ];
  }

  public async getAgent(id: string): Promise<AgentInfo> {
    const agent = await this.agentRepository.findOne({
      where: { id },
    });
    if (!agent) throw new Error('找不到该agent');
    return {
      ...agent,
      configSchema: this.getAgentConfigSchema(agent),
    };
  }

  public async getList(filter?: string) {
    // const agents = this.agents
    //   .filter(
    //     (x) => !x.info.hidden && (filter ? x.info.name.includes(filter) : true),
    //   )
    //   .map((x) => x.info);
    let custom_agents: Agent[];
    if (!filter) {
      custom_agents = await this.agentRepository.find();
    } else {
      custom_agents = await this.agentRepository.find({
        where: { name: Like(`%${filter}%`), description: Like(`%${filter}%`) },
      });
    }
    const custom_agents_info = custom_agents.map((agent) => {
      return {
        ...agent,
        hidden: false,
        static: false,
        configSchema: this.getAgentConfigSchema(agent),
      };
    });
    return [...custom_agents_info];
  }

  private async registerAgent(ClassType) {
    try {
      const agent = Reflect.construct(ClassType, []) as BaseAgent;
      const agentRepository = dbManager.dataSource.getRepository(Agent);
      let ts = await agentRepository.findOne({
        where: { name: agent.name },
      });
      if (!ts) {
        ts = new Agent(agent.name, agent.description, '', '', [], [], '', {});

        await agentRepository.save(ts);
      }
      this.agents = this.agents.filter((x) => x.info.name != agent.name);
      agent.config = ts.config;
      this.agents.push({
        info: {
          id: agent.name,
          static: true,
          name: agent.name,
          description: agent.description,
          hidden: agent.hidden,
          tags: agent.tags,
          config: ts.config,
          configSchema: agent.configSchema,
        },
        agent,
      });
    } catch (err) {
      console.error(`register '${ClassType.name}' agent fail, ${err.message}`);
    }
  }

  public async createAgent(data: any) {
    const agent = new Agent(
      data.name,
      data.description,
      data.prompt,
      data.type,
      data.tools,
      data.agents,
      data.model,
      data.config,
    );
    if (/^[a-zA-Z0-9_-]+$/.test(agent.name)) {
      await this.agentRepository.save(agent);
    } else {
      throw new Error('名称只能包含字母、数字、下划线和破折号');
    }
  }

  public async updateAgent(data: any) {
    let agent;
    if (data.id) {
      agent = await this.agentRepository.findOne({
        where: { id: data.id },
      });
      agent = {
        ...agent,
        ...data,
      };
      if (agent?.agents?.includes(agent.id)) {
        throw new Error('不能将自身作为AI助手');
      }
    } else {
      agent = new Agent(
        data.name,
        data.description,
        data.prompt,
        data.type,
        data.tools,
        data.agents,
        data.model,
        data.config,
      );
    }
    const agentInfo = await this.getAgent(agent.id);
    if (agentInfo.type == 'react' || agentInfo.type == 'supervisor') {
      const workflow = await this.buildAgent(agent);
      if (workflow) {
        const graph = await workflow.getGraphAsync();
        const mermaid = await graph.drawMermaid();
        agent.mermaid = mermaid;
      }
    }
    if (/^[a-zA-Z0-9_-]+$/.test(agent.name)) {
      await this.agentRepository.save(agent);
    } else {
      throw new Error('名称只能包含字母、数字、下划线和破折号');
    }

    //this.agents.find((x) => x.info.name == data.name).info.config = data.config;
  }

  public async deleteAgent(id: string) {
    await this.agentRepository.delete(id);
  }

  public async buildAgent(agent: Agent, store?: BaseStore) {
    const { provider, modelName } = getProviderModel(agent.model);
    const model = await getChatModel(provider, modelName, agent.config);

    const tools = await toolsManager.buildTools(agent?.tools);
    if (agent.type == 'react') {
      const reactAgent = createReactAgent({
        llm: model,
        tools: tools,
        name: agent.name,
        store: store,
        checkpointSaver: dbManager.langgraphSaver,
        prompt:
          agent.prompt ||
          'You are a ai agent, you can use the tools to help you answer the question.',
      });
      return reactAgent;
    } else if (agent.type == 'supervisor') {
      const agents = [];
      for (const agentId of agent.agents) {
        const _agent = await this.agentRepository.findOne({
          where: { id: agentId },
        });
        const workflow = await this.buildAgent(_agent);
        agents.push(workflow);
      }

      const supervisorAgent = createSupervisor({
        supervisorName: agent.name,
        agents: agents,
        llm: model,
        tools: tools,

        prompt: agent.prompt,
        outputMode: (agent.supervisorOutputMode ||
          'last_message') as OutputMode,
      });

      return supervisorAgent.compile({
        name: agent.name,
        store,
        checkpointer: dbManager.langgraphSaver,
      });
    }
    return null;
  }

  public async invoke(llmProvider: string, name: string, input: any) {
    const key = Object.keys(this.agents).find((x) => x == name.toLowerCase());
    if (!key) throw new Error('找不到该agent');
    const { name: agent_name, agent: agentClass } = this.agents[key];

    const a: BaseAgent = Reflect.construct(agentClass, []);
    let _llmProvider = llmProvider;
    if (!_llmProvider) {
      _llmProvider = settingsManager.getSettings()?.defaultLLM;
    }

    const connectionName = _llmProvider.split('@')[1];
    const modelName = _llmProvider.split('@')[0];
    const agent = await a.build(connectionName, modelName);
    return await agent.invoke(input);
  }
}

export const agentManager = new AgentManager();
