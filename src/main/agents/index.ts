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
import { AgentMessageEvent, BaseAgent } from './BaseAgent';
import { dbManager } from '../db';
import { Agent } from '@/entity/Agent';
import { tool, Tool } from '@langchain/core/tools';
import {
  Runnable,
  RunnableLambda,
  RunnableParallel,
  RunnablePassthrough,
  RunnableSequence,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { ScriptAssistant } from './script_assistant/ScriptAssistant';
import { FormSchema } from '@/types/form';
import { TranslateAgent } from './translate/TranslateAgent';
import { PlannerAgent } from './planner/PlannerAgent';
import { Like, Repository } from 'typeorm';
import {
  createReactAgent,
  createAgentExecutor,
} from '@langchain/langgraph/prebuilt';
import { BaseTool } from '../tools/BaseTool';
import { toolsManager } from '../tools';
import { getProviderModel } from '../utils/providerUtil';
import { createSupervisor, OutputMode } from '@langchain/langgraph-supervisor';
import { BaseStore } from '@langchain/langgraph';
import { ManusAgent } from './manus/ManusAgent';
import { notificationManager } from '../app/NotificationManager';
import { createReactAgentWithSummary } from './react/ReActAgent';
import { z } from 'zod';
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import dayjs from 'dayjs';
import { parse as parseYaml } from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import OpenAPIClientAxios from 'openapi-client-axios';
import { A2ACardResolver, A2AClient } from 'a2a-js';
import { createA2A } from './a2a/Agent2Agent';
import { jsonSchemaToZod } from '../utils/jsonSchemaToZod';
import { WatsonxToolkit } from '@langchain/community/agents/toolkits/ibm';

export interface AgentInfo extends Agent {
  static: boolean;
  hidden: boolean;
  fixedThreadId?: boolean;
  configSchema: FormSchema[];
}

export class AgentManager {
  agents: { info: AgentInfo; agent: BaseAgent }[] = [];

  agentRepository: Repository<Agent>;

  async init() {
    this.agentRepository = dbManager.dataSource.getRepository(Agent);

    await this.registerAgent(ExtractAgent);
    await this.registerAgent(ScriptAssistant);
    //this.registerAgent(TranslateAgent);
    await this.registerAgent(PlannerAgent);

    await this.registerAgent(ManusAgent);
    if (!ipcMain) return;
    ipcMain.on('agent:getList', async (event, filter?: string) => {
      event.returnValue = await this.getList(filter);
    });
    ipcMain.handle('agent:create', (event, data: any) =>
      this.createAgent(data),
    );
    ipcMain.handle(
      'agent:update',
      async (event, data: any) => await this.updateAgent(data),
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
    ipcMain.handle(
      'agent:addRemoteAgent',
      async (event, data: any) => await this.addRemoteAgent(data),
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
    let configSchema;
    let fixedThreadId = false;
    if (agent.type == 'built-in') {
      const baseagent = this.agents.find((x) => x.info.name == agent.name);
      configSchema = baseagent?.info.configSchema;
      fixedThreadId = baseagent?.info.fixedThreadId;
    }

    return {
      ...agent,
      config: agent.config || {},
      hidden: false,
      static: agent.type == 'built-in',
      configSchema,
      fixedThreadId,
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
        where: {
          name: Like(`%${filter.toLowerCase()}%`),
          description: Like(`%${filter.toLowerCase()}%`),
        },
      });
    }
    const custom_agents_info = [];
    for (const agent of custom_agents) {
      let configSchema;
      let config;
      if (agent.type == 'built-in') {
        if (
          !this.agents.find(
            (x) => x.info.name == agent.name.toLocaleLowerCase(),
          )
        ) {
          continue;
        }
        config = await this.agents
          .find((x) => x.info.name == agent.name)
          ?.agent.getConfig();
        configSchema = this.agents.find((x) => x.info.name == agent.name)?.info
          .configSchema;
      }
      custom_agents_info.push({
        ...agent,
        hidden: false,
        static: agent.type == 'built-in',
        config: config,
        configSchema: configSchema,
      });
    }

    // const custom_agents_info = await Promise.all(
    //   custom_agents.map(async (agent) => {}),
    // );
    return [...custom_agents_info];
  }

  private async registerAgent(ClassType) {
    try {
      const agent = Reflect.construct(ClassType, []) as BaseAgent;
      let ts = await this.agentRepository.findOne({
        where: { id: agent.name.toLowerCase() },
      });

      if (!ts) {
        ts = new Agent(
          agent.name.toLowerCase(),
          agent.name,
          agent.description,
          '',
          'built-in',
          [],
          [],
          '',
          25,
          {},
        );

        await this.agentRepository.save(ts);
      }
      this.agents = this.agents.filter((x) => x.info.name != agent.name);
      const config = await agent.getConfig();

      this.agents.push({
        info: {
          id: ts.id,
          static: true,
          name: agent.name,
          description: agent.description,
          hidden: agent.hidden,
          tags: agent.tags,
          config: config,
          configSchema: agent.configSchema,
          fixedThreadId: agent.fixedThreadId,
        },
        agent,
      });
      console.log(`registered '${ClassType.name}'`, this.agents);
    } catch (err) {
      console.error(`register '${ClassType.name}' agent fail, ${err.message}`);
    }
  }

  public async createAgent(data: any) {
    const agent = new Agent(
      undefined,
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
      if (
        data.type == 'react' ||
        data.type == 'supervisor' ||
        data.type == 'built-in'
      ) {
        const workflow = await this.buildAgent({ agent });
        if (workflow) {
          try {
            const graph = await workflow.getGraphAsync();
            const mermaid = await graph.drawMermaid();
            agent.mermaid = mermaid;
          } catch (err) {
            console.error(`build agent '${agent.name}' fail, ${err.message}`);
          }
        }
      }
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
      throw new Error('agent id is required');
    }
    const agentInfo = await this.getAgent(agent.id);
    if (agentInfo.config.model) {
      agent.model = agentInfo.config.model;
    }
    if (/^[a-zA-Z0-9_-]+$/.test(agent.name)) {
      await this.agentRepository.save(agent);
    } else {
      throw new Error('名称只能包含字母、数字、下划线和破折号');
    }
    if (
      agentInfo.type == 'react' ||
      agentInfo.type == 'supervisor' ||
      agentInfo.type == 'built-in'
    ) {
      try {
        const workflow = await this.buildAgent({ agent });
        if (workflow) {
          try {
            const graph = await workflow.getGraphAsync();
            const mermaid = await graph.drawMermaid();
            agent.mermaid = mermaid;
            await this.agentRepository.save(agent);
          } catch (err) {
            console.error(
              `agent "${agent.name}" draw mermaid fail, ${err.message}`,
            );
          }
        }
      } catch (err) {
        // notificationManager.sendNotification(
        //   `build agent "${agent.name}" fail, ${err.message}`,
        //   'error',
        // );
        throw new Error(`build agent "${agent.name}" fail, ${err.message}`);
      }
    }

    //this.agents.find((x) => x.info.name == data.name).info.config = data.config;
  }

  public async deleteAgent(id: string) {
    await this.agentRepository.delete(id);
  }

  public async buildAgent(config: {
    agent: Agent;
    tools?: BaseTool[];
    store?: BaseStore;
    model?: string;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    responseFormat?: z.ZodObject<any>;
    configurable?: Record<string, any>;
  }) {
    const {
      agent,
      store,
      tools,
      model: providerModel,
      messageEvent,
      chatOptions,
      signal,
      configurable,
    } = config;
    let model;
    if (providerModel || agent.model) {
      const { provider, modelName } = getProviderModel(
        providerModel || agent.model,
      );
      model = await getChatModel(provider, modelName, agent.config);
    }

    const commonParams = {
      current_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      locale: settingsManager.getSettings()?.language,
    };

    if (agent.type == 'react' || agent.type == 'supervisor') {
      const tools = await toolsManager.buildTools(agent?.tools);
      if (agent.type == 'react') {
        const prompt = agent.prompt
          ? await SystemMessagePromptTemplate.fromTemplate(agent.prompt).format(
              commonParams,
            )
          : 'You are a ai agent, you can use the tools to help you answer the question.';

        const reactAgent = createReactAgent({
          llm: model,
          tools: tools,
          name: agent.name,
          store: store,
          checkpointSaver: dbManager.langgraphSaver,
          prompt: prompt,
          // summaryOption: {
          //   keepLastMessagesCount: 3,
          // },
          responseFormat: config.responseFormat,
        });

        return reactAgent;
      } else if (agent.type == 'supervisor') {
        const agents = [];
        for (const agentId of agent.agents) {
          const _agent = await this.agentRepository.findOne({
            where: { id: agentId },
          });
          const workflow = await this.buildAgent({
            agent: _agent,
            store,
            model: providerModel,
            messageEvent,
            chatOptions,
          });

          agents.push(workflow);
        }
        const prompt = await SystemMessagePromptTemplate.fromTemplate(
          agent.prompt,
        ).format(commonParams);
        const supervisorAgent = createSupervisor({
          supervisorName: agent.name,
          agents: agents,
          llm: model,
          tools: tools,
          prompt: prompt,
          outputMode: (agent.supervisorOutputMode ||
            'last_message') as OutputMode,
        });

        return supervisorAgent.compile({
          name: agent.name,
          store,
          checkpointer: dbManager.langgraphSaver,
        });
      }
    } else if (agent.type == 'built-in') {
      const _agent = this.agents.find((x) => x.info.name == agent.name);

      return await _agent.agent.createAgent({
        store,
        model,
        messageEvent,
        chatOptions,
        signal,
        configurable,
      });
    } else if (agent.type == 'anp') {
      const res = await fetch(`${agent.remote_url}/ad.json`, {
        method: 'GET',
      });
      const json = await res.json();
      const { name, description, version, did } = json;
      const interfaces: any[] = json['ad:interfaces'];
      const tools = [];
      for (const _interface of interfaces) {
        const { url, description } = _interface;
        const res = await fetch(url, {
          method: 'GET',
        });
        const text = await res.text();
        const openapiDocument = parseYaml(text);
        const api = new OpenAPIClientAxios({ definition: openapiDocument });
        const client = await api.init();

        const baseUrl = openapiDocument.servers[0].url;
        const { paths }: { paths: Record<string, any> } = openapiDocument;
        console.log(openapiDocument);
        for (const key of Object.keys(paths)) {
          const method = paths[key];
          const toolName = key.split('/').pop();
          const methodKeys = Object.keys(method);
          for (const methodKey of methodKeys) {
            const methodSchema = method[methodKey];
            if (methodKey == 'post') {
              const _schema = jsonSchemaToZod(
                methodSchema.requestBody['content']['application/json'][
                  'schema'
                ],
              );
              const _tool = tool(
                async (input: any) => {
                  const res = await fetch(`${baseUrl}${key}`, {
                    method: methodKey.toUpperCase(),
                    body: input ? JSON.stringify(input) : undefined,
                  });
                  if (res.ok) {
                    return res.json();
                  } else {
                    return 'error';
                  }
                },
                {
                  name: toolName,
                  description: openapiDocument.info.description,
                  schema: _schema,
                },
              );
              tools.push(_tool);
            } else if (methodKey == 'get') {
              const _parameters = methodSchema?.parameters;
              let _schema;
              if (_parameters) {
                _schema = {};
                for (const item of _parameters) {
                  _schema[item.name] = z.any();
                  if (item.schema.type == 'string')
                    _schema[item.name] = z.string();
                  if (item.description) {
                    _schema[item.name] = _schema[item.name].describe(
                      item.description,
                    );
                  }
                  if (!item?.required) {
                    _schema[item.name] = _schema[item.name].optional();
                  }
                }
                _schema = z.object(_schema);
              }
              const _tool = tool(
                async (input: any) => {
                  const q = Object.entries(input).map((x) => `${x[0]}=${x[1]}`);
                  const res = await fetch(`${baseUrl}${key}?${q}`, {
                    method: 'GET',
                  });
                  if (res.ok) {
                    return res.json();
                  } else {
                    return 'error';
                  }
                },
                {
                  name: toolName,
                  description: openapiDocument.info.description,
                  schema: _schema,
                },
              );
              tools.push(_tool);
            }
          }
        }
      }

      const reactAgent = createReactAgent({
        llm: model,
        tools: tools,
        name: agent.name,
        store: store,
        checkpointSaver: dbManager.langgraphSaver,
        responseFormat: config.responseFormat,
      });

      return reactAgent;
    } else if (agent.type == 'a2a') {
      const a2a = await createA2A(agent, {
        store,
        model,
        messageEvent,
        chatOptions,
        signal,
        configurable,
      });
      return a2a;
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

  public async addRemoteAgent(data: any) {
    if (data.type == 'anp') {
      await this.addAnp(data);
    } else if (data.type == 'a2a') {
      await this.addA2A(data);
    } else {
      throw new Error('不支持的agent类型');
    }
  }

  public async addA2A(data: any) {
    const client = new A2ACardResolver(data.baseUrl);
    const agentCard = await client.getAgentCard();
    console.log(agentCard);
    const agent = new Agent(
      agentCard.url,
      agentCard.name,
      agentCard.description,
      undefined,
      'a2a',
      [],
      [],
      undefined,
      undefined,
    );
    agent.remote_url = data.baseUrl;
    agent.tags = [...new Set(agentCard.skills.map((x) => x.tags).flat())];
    await this.agentRepository.save(agent);
  }

  public async addAnp(data: any) {
    const res = await fetch(`${data.baseUrl}/ad.json`, {
      method: 'GET',
    });
    const json = await res.json();
    const { name, description, version, did } = json;

    const interfaces: any[] = json['ad:interfaces'];
    for (const _interface of interfaces) {
      const { url, description } = _interface;
      const res = await fetch(url, {
        method: 'GET',
      });
      const text = await res.text();
      console.log(text);
    }
    const agent = new Agent(
      did,
      name,
      description,
      undefined,
      'anp',
      [],
      [],
      undefined,
      undefined,
    );
    agent.remote_url = data.baseUrl;
    await this.agentRepository.save(agent);
  }
}

export const agentManager = new AgentManager();
