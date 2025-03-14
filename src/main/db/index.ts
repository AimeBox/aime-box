// import sqlite, { Database } from 'sqlite3';
import 'reflect-metadata';
import { ipcMain } from 'electron';
import { DataSource } from 'typeorm';
import path from 'path';
import Settings from '../../entity/Settings';
import { Providers } from '../../entity/Providers';
import { Chat, ChatFile, ChatMessage } from '../../entity/Chat';
import { KnowledgeBase, KnowledgeBaseItem } from '../../entity/KnowledgeBase';
import { TypeormSaver } from './TypeormSaver';
import {
  LanggraphWrites,
  LanggraphCheckPoints,
} from '../../entity/CheckPoints';
import { MemoyHistory } from '../../entity/Memoy';
import { getDataPath } from '../utils/path';
import { Plugins } from '@/entity/Plugins';
import { Prompt, PromptGroup } from '@/entity/Prompt';
import { Agent } from '@/entity/Agent';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { McpServers, Tools } from '@/entity/Tools';

export class DBManager {
  // defaultDb: Database;
  dataSource: DataSource;

  langgraphSaver: TypeormSaver;

  constructor() {
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: path.join(getDataPath(), 'data.db'),
      synchronize: true,
      logging: false,
      entities: [
        Settings,
        Providers,
        Chat,
        ChatMessage,
        ChatFile,
        KnowledgeBase,
        KnowledgeBaseItem,
        LanggraphCheckPoints,
        LanggraphWrites,
        MemoyHistory,
        Plugins,
        Prompt,
        PromptGroup,
        Agent,
        Tools,
        McpServers,
      ],
      migrations: [],
      subscribers: [],
    });
  }

  public init = async () => {
    this.dataSource = await this.dataSource.initialize();
    try {
      this.langgraphSaver = new TypeormSaver(this.dataSource);
      this.langgraphSaver.getTuple({});
    } catch (err) {
      console.error(err);
    }

    if (!ipcMain) return;
    ipcMain.on('db:table', async (event) => {
      event.returnValue = this.getTables();
    });

    ipcMain.on(
      'db:query',
      async (event, query, params: any[] | undefined) => {},
    );
    ipcMain.on(
      'get',
      async (
        event,
        tableName: string,
        id: string | number,
        relations: string[] | null = null,
      ) => {
        event.returnValue = await this.get(tableName, id, relations);
      },
    );
    ipcMain.on('db:getMany', async (event, tableName, where, sort) => {
      event.returnValue = await this.getMany(tableName, where, sort);
    });
    ipcMain.on('db:insert', async (event, tableName, data) => {
      event.returnValue = await this.insert(tableName, data);
    });
    ipcMain.on('db:update', async (event, tableName, data, condition) => {
      event.returnValue = await this.update(tableName, data, condition);
    });

    ipcMain.on('insert-or-update', async (event, tableName, data) => {
      const res = await this.get(tableName, data.id);
      if (!res) {
        const resV = await this.insert(tableName, data);
        event.returnValue = resV;
      } else {
        const resV = await this.update(tableName, data, `id = '${data.id}'`);
        event.returnValue = resV;
      }
    });
    ipcMain.on('db:delete', async (event, tableName, condition) => {
      const res = await this.delete(tableName, condition);
      event.returnValue = res;
    });
    ipcMain.on(
      'db:page',
      async (event, tableName, where, skip, pageSize, sort) => {
        const res = await this.page(tableName, where, skip, pageSize, sort);
        event.returnValue = res;
      },
    );
  };

  public getTables = () => {
    return this.dataSource.entityMetadatas.map((x) => x.tableName);
  };

  public get = async (
    tableName: string,
    id: string | number,
    relations: string[] | null = null,
  ) => {
    let q = this.dataSource
      .getRepository(tableName)
      .createQueryBuilder(tableName)
      .where('id = :id', { id });

    relations?.forEach((r) => {
      q = q.leftJoinAndSelect(`${tableName}.${r}`, r);
    });
    const vrelations = {};
    relations?.forEach((x) => {
      vrelations[x] = true;
    });
    const res = await this.dataSource.getRepository(tableName).findOne({
      where: {
        id,
      },
      relations: vrelations,
    });
    return res;
  };

  public getMany = async (
    tableName: string,
    where: any,
    sort: string | undefined = undefined,
  ) => {
    let sortField = '';
    let order: 'ASC' | 'DESC' = 'ASC';
    if (sort) {
      if (sort.split(' ').length === 2) {
        sortField = sort.split(' ')[0];
        if (sort.split(' ')[1].toLowerCase() === 'desc') order = 'DESC';
      } else {
        sortField = sort;
      }
    }
    const res = await this.dataSource
      .getRepository(tableName)
      .createQueryBuilder(tableName)
      .where(where)
      // .select(tableName)
      // .from(tableName, tableName)
      .orderBy(sortField, order)
      .getMany();
    return res;
  };

  public insert = async (tableName: string, data: any | any[]) => {
    const r = this.dataSource.getRepository(tableName);
    return await r.insert(data);
  };

  public update = async (tableName: string, data: any, condition) => {
    const r = this.dataSource.getRepository(tableName);
    const res = await r.update(condition, data);
    return res;
  };

  public delete = async (tableName: string, condition) => {
    const res = await this.dataSource
      .getRepository(tableName)
      .createQueryBuilder()
      .delete()
      .where(condition)
      .execute();
    return res;
  };

  public page = async (
    tableName: string,
    where: any,
    skip: number,
    pageSize: number,
    sort: string | undefined = undefined,
  ) => {
    let sortField = '';
    let order: 'ASC' | 'DESC' = 'ASC';
    if (sort) {
      if (sort.split(' ').length === 2) {
        sortField = sort.split(' ')[0];
        if (sort.split(' ')[1].toLowerCase() === 'desc') order = 'DESC';
      } else {
        sortField = sort;
      }
    }

    const res = await this.dataSource
      .getRepository(tableName)
      .createQueryBuilder(tableName)
      .where(where)
      .skip(skip)
      .take(pageSize)
      .orderBy(sortField, order)
      .getMany();

    const totalCount = await this.dataSource
      .getRepository(tableName)
      .createQueryBuilder(tableName)
      .where(where)
      .getCount();
    return { totalCount, items: res };
  };
}

export const dbManager = new DBManager();
