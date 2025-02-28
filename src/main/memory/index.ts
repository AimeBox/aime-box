import { v4 as uuidv4 } from 'uuid';

import { VectorStore } from '@langchain/core/vectorstores';
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { BaseVectorStore } from '../db/vectorstores';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { LanceDBStore } from '../db/vectorstores/LanceDBStore';
import { DataSource, Repository } from 'typeorm';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { MemoyHistory } from '../../entity/Memoy';
import { dbManager } from '../db';

export const ADD_MEMORY_TOOL = {
  type: 'function',
  function: {
    name: 'add_memory',
    description: 'Add a memory',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data to add to memory' },
      },
      required: ['data'],
    },
  },
};

export const UPDATE_MEMORY_TOOL = {
  type: 'function',
  function: {
    name: 'update_memory',
    description: 'Update memory provided ID and data',
    parameters: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'memoryId of the memory to update',
        },
        data: {
          type: 'string',
          description: 'Updated data for the memory',
        },
      },
      required: ['memoryId', 'data'],
    },
  },
};

export const DELETE_MEMORY_TOOL = {
  type: 'function',
  function: {
    name: 'delete_memory',
    description: 'Delete memory by memory_id',
    parameters: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'memoryId of the memory to delete',
        },
      },
      required: ['memoryId'],
    },
  },
};

export const generateMemoryDeducationPrompt = (
  userInput: string,
  metedata: string,
) => {
  const MEMORY_DEDUCTION_PROMPT = `
    Deduce the facts, preferences, and memories from the provided text.
    Just return the facts, preferences, and memories in bullet points:
    Natural language text: ${userInput}
    User/Agent details: ${metedata}

    Constraint for deducing facts, preferences, and memories:
    - The facts, preferences, and memories should be concise and informative.
    - Don't start by "The person likes Pizza". Instead, start with "Likes Pizza".
    - Don't remember the user/agent details provided. Only remember the facts, preferences, and memories.

    Deduced facts, preferences, and memories:
    `;
  return MEMORY_DEDUCTION_PROMPT;
};
export const UPDATE_MEMORY_PROMPT = `
    You are an expert at merging, updating, and organizing memories. When provided with existing memories and new information, your task is to merge and update the memory list to reflect the most accurate and current information. You are also provided with the matching score for each existing memory to the new information. Make sure to leverage this information to make informed decisions about which memories to update or merge.

    Guidelines:
    - Eliminate duplicate memories and merge related memories to ensure a concise and updated list.
    - If a memory is directly contradicted by new information, critically evaluate both pieces of information:
        - If the new memory provides a more recent or accurate update, replace the old memory with new one.
        - If the new memory seems inaccurate or less detailed, retain the original and discard the old one.
    - Maintain a consistent and clear style throughout all memories, ensuring each entry is concise yet informative.
    - If the new memory is a variation or extension of an existing memory, update the existing memory to reflect the new information.

    Here are the details of the task:
    - Existing Memories:
    {existMemories}

    - New Memory: {memory}
    `;

export type MemoryConfig = {
  // historyDbPath: string;
  // llm: {
  //   provider: 'openai';
  //   config: any;
  // };
  collectionName: string;
  // vectorStore: {
  //   provider: 'qdrant';
  //   config: {
  //     host?: string;
  //     port?: number;
  //     url?: string;
  //     apiKey?: string;
  //   };
  // };
  // embedder: {
  //   provider: 'openai' | 'ollama' | 'huggingface';
  //   config: any;
  // };
};

class Memory {
  config: MemoryConfig;

  llm!: BaseChatModel; // TODO: base LLM class

  embeddingModel!: Embeddings;

  vectorStore?: BaseVectorStore | null;

  collectionName: string;

  db: DataSource;

  memoyRepository: Repository<MemoyHistory>;

  constructor(
    llm: BaseChatModel,
    embeddingModel: Embeddings,
    //vectorStore: BaseVectorStore,
    config: MemoryConfig,
  ) {
    this.llm = llm;
    this.embeddingModel = embeddingModel;
    //this.vectorStore = vectorStore;
    this.config = config;
    this.collectionName = this.config.collectionName;

    //const vectorStoreConfig = this.config.vectorStore.config;
    this.memoyRepository = dbManager.dataSource.getRepository(MemoyHistory);

    //this.db = new SQLiteManager();
    //this.vectorStore = await LanceDBStore.initialize(embeddingModel, );
  }

  async build() {
    this.vectorStore = await LanceDBStore.initialize(this.embeddingModel, {
      database: 'memory',
      tableName: this.collectionName,
      extendColumns: { agentId: '', sessionId: '', userId: '' },
    });
    const collectionNames = await this.vectorStore.getCollections();
    if (collectionNames.includes(this.collectionName)) return this;
    throw new Error('记忆体创建失败');
    // if (!collectionNames.includes(this.collectionName)) {
    //   await this.vectorStore.createCollection(this.collectionName, {
    //     agentId: '',
    //     sessionId: '',
    //     userId: '',
    //   });
    // }
  }

  async add(
    data: string,
    userId?: string,
    agentId?: string,
    sessionId?: string,
    metadata: { [key: string]: any } = {},
    filters: { [key: string]: any } = {},
    custom_categories: Record<string, string>[] = [],
  ) {
    const embeddings = await this.embeddingModel.embedQuery(data);
    if (userId) {
      metadata['userId'] = userId;
      filters['userId'] = userId;
    }
    if (agentId) {
      metadata['agentId'] = agentId;
      filters['agentId'] = agentId;
    }
    if (sessionId) {
      metadata['sessionId'] = sessionId;
      filters['sessionId'] = sessionId;
    }
    const prompt = generateMemoryDeducationPrompt(
      data,
      JSON.stringify(metadata),
    );
    // const extractedMemories = await this.llm.generateResponse([
    //   {
    //     role: 'system',
    //     content:
    //       'You are an expert at deducing facts, preferences and memories from unstructured text.',
    //   },
    //   { role: 'user', content: prompt },
    // ]);
    const input_prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are an expert at deducing facts, preferences and memories from unstructured text.',
      ],
      ['human', '{prompt}'],
    ]);
    const extractedMemories = await input_prompt.pipe(this.llm).invoke({
      prompt: prompt,
    });
    const existingMemories =
      await this.vectorStore.similaritySearchVectorWithScore(
        embeddings,
        5,
        filters,
      );
    // const existingMemoryItems = existingMemories.map((item) => ({
    //     id: item.id,
    //     score: item.score,
    //     text: item.payload!["data"],
    //     metadata: item.payload,
    // }));
    const serializedExistingMemories = existingMemories.map((item) => ({
      id: item[0].metadata.id,
      text: item[0].pageContent,
      score: item[1],
    }));

    const prompt_update = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(UPDATE_MEMORY_PROMPT),
    ]);

    const tools = [ADD_MEMORY_TOOL, UPDATE_MEMORY_TOOL, DELETE_MEMORY_TOOL];

    const update_chain = prompt_update.pipe(this.llm.bindTools(tools));

    const response = await update_chain.invoke({
      existMemories: JSON.stringify(serializedExistingMemories),
      memory: extractedMemories.content,
    });

    const toolCalls = response['tool_calls'];
    if (toolCalls) {
      const availableFuncs = {
        add_memory: this._createMemoryTool.bind(this),
        update_memory: this._updateMemoryTool.bind(this),
        delete_memory: this._deleteMemoryTool.bind(this),
      } as { [key: string]: (...args: any[]) => Promise<any> };
      console.log(toolCalls);
      for (const toolCall of toolCalls) {
        const funcName = toolCall['name'];
        const funcToCall = availableFuncs[funcName];
        const funcParams = toolCall['args'];
        await funcToCall({ ...funcParams });
        console.log(`func ${funcToCall} execute successfully`);
      }
    }
  }

  /**
   * Retrieve a memory by ID.
   * @param memoryId
   */
  async get(memoryId: string) {
    const memory = await this.vectorStore.get(memoryId);

    if (!memory.length) return null;
    return {
      id: memory[0].id,
      metaData: memory[0].payload,
      text: memory[0].payload!['data'],
    };
  }

  async getAll(userId = '', agentId = '', runId = '', limit = 100) {
    const filters = {} as { [key: string]: any };
    if (userId) {
      filters['user_id'] = userId;
    }
    if (agentId) {
      filters['agent_id'] = agentId;
    }
    if (runId) {
      filters['run_id'] = runId;
    }
    // const memories = await this.vectorStore.filter(this.collectionName, {
    //   filter: filters,
    //   limit,
    // });
    const memories = await this.vectorStore.filter(filters, limit);
    return memories.map((mem) => ({
      id: mem.id,
      metaData: mem.metaData,
      text: mem.payload!['data'],
    }));
  }

  async search(
    query: string,
    userId: string = '',
    agentId: string = '',
    runId: string = '',
    limit: number = 100,
    filter: { [key: string]: any } = {},
  ) {
    let filters = {} as { [key: string]: any };

    if (filter) {
      filters = { ...filter };
    }
    if (userId) {
      filters['user_id'] = userId;
    }
    if (agentId) {
      filters['agent_id'] = agentId;
    }
    if (runId) {
      filters['run_id'] = runId;
    }
    // const embeddings = await this.embeddingModel.embedQuery(query);
    const memories = await this.vectorStore.similaritySearchWithScore(
      query,
      limit,
      filters,
    );

    return memories.map((mem) => ({
      id: mem[0].metadata.id,
      metaData: mem[0].metadata,
      score: mem[1],
      text: mem[0].pageContent,
    }));
  }

  async update(memoryId: string, data: string) {
    await this._updateMemoryTool({ memoryId, data });
  }

  async delete(memoryId: string) {
    await this._deleteMemoryTool({ memoryId });
  }

  async deleteAll(userId = '', agentId = '', runId = '') {
    const filters = {} as { [key: string]: string };
    if (userId) {
      filters['user_id'] = userId;
    }
    if (agentId) {
      filters['agent_id'] = agentId;
    }
    if (runId) {
      // eslint-disable-next-line dot-notation
      filters['run_id'] = runId;
    }
    if (!Object.keys(filters).length) {
      throw new Error(
        'At least one filter is required to delete all memories. If you want to delete all memories, use the `reset()` method.',
      );
    }
    await this.vectorStore.delete(filters);
    // const memories = await this.vectorStore.(this.collectionName, {
    //   filter: filters,
    // });
    // await Promise.all(
    //   memories.points.map((memory) =>
    //     this._deleteMemoryTool({ memoryId: memory.id as string }),
    //   ),
    // );
  }

  async history(memoryId: string): Promise<MemoyHistory[]> {
    const histories = await this.memoyRepository.find({
      where: { memoryId: memoryId },
    });
    return histories;
  }

  private async _createMemoryTool({ data }: { data: string }) {
    const embeddings = await this.embeddingModel.embedQuery(data);
    const memoryId = uuidv4();

    // await this.vectorStore.upsert(this.collectionName, {
    //   points: [
    //     {
    //       id: memoryId,
    //       vector: embeddings,
    //       payload: metadata,
    //     },
    //   ],
    // });
    await this.vectorStore.insert(
      { id: memoryId, userid: '', agentid: '', sessionid: '' },
      data,
      { created_at: new Date().getTime() },
      embeddings,
      null,
    );
    const m = new MemoyHistory();
    m.id = uuidv4();
    m.memoryId = memoryId;
    m.newValue = data;
    m.event = 'add';
    m.timestamp = new Date().getTime();
    m.isDeleted = false;
    this.memoyRepository.save(m);
  }

  private async _updateMemoryTool({
    memoryId,
    data,
  }: {
    memoryId: string;
    data: string;
  }) {
    const existingMemory = await this.vectorStore.get(memoryId);
    const preValue = existingMemory.content as string;

    const embeddings = await this.embeddingModel.embedQuery(data);
    await this.vectorStore.update(
      {
        vector: embeddings,
        content: data,
        metadata: {
          updated_at: new Date().getTime(),
        },
      },
      { id: memoryId },
    );
    // await this.vectorStore.upsert(this.collectionName, {
    //   points: [
    //     {
    //       id: memoryId,
    //       vector: embeddings,
    //       payload: newMetaData,
    //     },
    //   ],
    // });
    const m = new MemoyHistory();
    m.id = uuidv4();
    m.memoryId = memoryId;
    m.newValue = data;
    m.preValue = preValue;
    m.event = 'update';
    m.timestamp = new Date().getTime();
    m.isDeleted = false;
    this.memoyRepository.save(m);

    // this.db.addHistory(memoryId, preValue, data, 'update');
  }

  private async _deleteMemoryTool({ memoryId }: { memoryId: string }) {
    const existingMemory = await this.vectorStore.get(memoryId);

    if (!existingMemory) {
      throw new Error(`Memory with id ${memoryId} not found.`);
    }
    const preValue = existingMemory.content as string;
    await this.vectorStore.delete({ id: existingMemory.id });
    const entity = await this.memoyRepository.find({ where: { memoryId } });
    entity.forEach((x) => {
      x.preValue = preValue;
      x.newValue = '';
      x.event = 'delete';
      x.isDeleted = true;
    });
    this.memoyRepository.save(entity);
    //this.db.this.db.addHistory(memoryId, preValue, '', 'delete', 1);
  }

  async reset() {
    await this.vectorStore.deleteCollection(this.collectionName);
    // this.db.reset();
  }

  chat() {
    throw new Error('Chat function not implemented yet.');
  }
}

export default Memory;
