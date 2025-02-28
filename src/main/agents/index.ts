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

export interface AgentInfo {
  name: string;
  description: string;
  hidden: boolean;
  icon?: string;
  tags?: string[] | undefined;
  configSchema: FormSchema[];
  config: any;
}

export class AgentManager {
  agents: { info: AgentInfo; agent: BaseAgent }[] = [];

  async init() {
    this.registerAgent(ExtractAgent);
    this.registerAgent(ScriptAssistant);
    this.registerAgent(TranslateAgent);
    if (!ipcMain) return;
    ipcMain.on('agent:getList', async (event, filter?: string) => {
      const agents = this.agents
        .filter(
          (x) =>
            !x.info.hidden && (filter ? x.info.name.includes(filter) : true),
        )
        .map((x) => x.info);
      event.returnValue = agents;
    });
    ipcMain.handle('agent:update', (event, name: string, config: any) =>
      this.updateAgent(name, config),
    );
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

  private async registerAgent(ClassType) {
    try {
      const agent = Reflect.construct(ClassType, []) as BaseAgent;
      const agentRepository = dbManager.dataSource.getRepository(Agent);
      let ts = await agentRepository.findOne({
        where: { name: agent.name },
      });
      if (!ts) {
        ts = new Agent(agent.name, agent.description, agent.tags, {});

        await agentRepository.save(ts);
      }
      this.agents = this.agents.filter((x) => x.info.name != agent.name);
      agent.config = ts.config;
      this.agents.push({
        info: {
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

  public async updateAgent(name: string, config: any) {
    const agentRepository = dbManager.dataSource.getRepository(Agent);
    const agent = await agentRepository.findOne({
      where: { name: name },
    });
    agent.config = config;
    await agentRepository.save(agent);
    this.agents.find((x) => x.info.name == name).info.config = config;
    this.agents.find((x) => x.info.name == name).agent.config = config;
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
