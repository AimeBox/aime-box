import fs from 'fs';
import { VectorStore } from '@langchain/core/vectorstores';
import type { DocumentInterface } from '@langchain/core/documents';
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  RawImage,
  AutoModel,
  env,
  pipeline,
  ChineseCLIPModel,
  cos_sim,
} from '@huggingface/transformers';

import { LanceDB } from '@langchain/community/vectorstores/lancedb';
import { Milvus } from '@langchain/community/vectorstores/milvus';
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { ipcMain } from 'electron';

import path from 'path';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { ImageLoader } from '../loaders/ImageLoader';
import { SitemapLoader } from '@langchain/community/document_loaders/web/sitemap';
import {
  DirectoryLoader,
  UnknownHandling,
} from 'langchain/document_loaders/fs/directory';
import {
  RecursiveCharacterTextSplitter,
  MarkdownTextSplitter,
  LatexTextSplitter,
  TokenTextSplitter,
  CharacterTextSplitter,
} from 'langchain/text_splitter';

import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import { Document } from '@langchain/core/documents';
import { v4 as uuidv4 } from 'uuid';
import { In, Like, Or } from 'typeorm';
import { LanceDBStore } from '../db/vectorstores/LanceDBStore';
import {
  KnowledgeBase,
  KnowledgeBaseItem,
  KnowledgeBaseItemState,
  KnowledgeBaseSourceType,
  VectorStoreType,
} from '../../entity/KnowledgeBase';
import { dbManager } from '../db';
import { HuggingFaceTransformersEmbeddings } from '../embeddings/HuggingFaceTransformersEmbeddings';
import { isArray, isString, isUrl } from '../utils/is';
import { Transformers } from '../utils/transformers';
import { htmlToMarkdown, urlToMarkdown } from '../utils/document_transformers';
import { getEmbeddingModel } from '../embeddings';
import { getReranker } from '../reranker';
import { getLoaderFromExt } from '../loaders';
import { notificationManager } from '../app/NotificationManager';
import { NotificationMessage } from '@/types/notification';
import { ChatStatus } from '@/entity/Chat';
import { appManager } from '../app/AppManager';
import { BaseManager } from '../BaseManager';
import { channel } from '../ipc/IpcController';
import { getAssetPath } from '../utils/path';

export interface KnowledgeBaseDocument {
  document: DocumentInterface<Record<string, any>>;
  vector_distance: number;
  reranker_score?: number;
  score: number;
}
export interface KnowledgeBaseItemChunk {
  index: number;
  content: string;
}
export interface KnowledgeBaseCreateInput {
  name: string;
  description: string;
  tags: string[];
  vectorStoreType: 'lancedb' | 'pgvector' | 'milvus';
  embedding: 'bge-m3' | 'text-embedding-ada-002';
  reranker?: string | undefined;
}
export interface KnowledgeBaseUpdateInput {
  name: string;
  description: string;
  tags: string[];
  reranker?: string | undefined;
}

export class KnowledgeBaseManager extends BaseManager {
  // limiter: Bottleneck;

  public async init() {
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    await repository.update(
      {
        state: KnowledgeBaseItemState.Pending,
      },
      {
        state: KnowledgeBaseItemState.Fail,
      },
    );
    if (!ipcMain) return;
    this.registerIpcChannels();
    ipcMain.on(
      'kb:queue',
      async (
        event,
        input: {
          kbId: string;
          config: Record<string, any>;
        },
      ) => {
        await this.queue(input, () => {});
        event.sender.send('kb:queue');
      },
    );
    ipcMain.on('kb:restart', async (event, kbId: string) => {
      await this.restart(kbId);
      event.sender.send('kb:restart');
    });
  }

  public async registerKnowledgeBaseFromAssetPath() {
    const knowledgeBasesPath = path.join(getAssetPath(), 'knowledge-bases');
    if (fs.existsSync(knowledgeBasesPath)) {
      const knowledgeBaseFiles = await fs.promises.readdir(knowledgeBasesPath);
    }
  }

  public restart = async (kbId: string) => {
    // const turndownService = new TurndownService({
    //   codeBlockStyle: 'fenced',
    // });
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const kb = await kb_repository.findOne({ where: { id: kbId } });
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kbItems = await repository.find({
      where: {
        knowledgeBaseId: kbId,
        state: KnowledgeBaseItemState.Fail,
      },
    });
    const vectraStore = await this.getVectorStore(kb);
    const notificationId = uuidv4();
    notificationManager.create({
      id: notificationId,
      title: notificationId,
      type: 'progress',
      description: '导入中...',
      percent: 0,
      duration: undefined,
      closeEnable: false,
    } as NotificationMessage);

    for (let index = 0; index < kbItems.length; index++) {
      const kbItem = kbItems[index];
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: kbItem.config?.chunkSize ?? 500,
        chunkOverlap: kbItem.config?.chunkOverlap ?? 50,
      });
      notificationManager.update({
        id: notificationId,
        title: '导入知识库',
        type: 'progress',
        description: `正在导入[${kbItem.name}]`,
        percent: (index / kbItems.length) * 100,
        duration: undefined,
        closeEnable: false,
      } as NotificationMessage);
      console.log(`${index}/${kbItems.length} ${kbItem.source}`);

      let loader;
      let documents = [];
      try {
        if (kbItem.sourceType == KnowledgeBaseSourceType.Web) {
          const doc = await urlToMarkdown(kbItem.source);
          documents = await textSplitter.splitDocuments([
            new Document({
              metadata: { source: kbItem.source, title: doc.metadata.title },
              pageContent: doc.pageContent,
            }),
          ]);
        } else if (kbItem.sourceType == KnowledgeBaseSourceType.File) {
          const ext = path.extname(kbItem.source).toLowerCase();
          const loader = getLoaderFromExt(ext, kbItem.source);
          const name = path.basename(kbItem.source);

          const doc = await loader.load();
          documents = await textSplitter.splitDocuments([...doc]);
          if (documents.length > 0) {
            documents.forEach((d) => {
              d.metadata.title = name;
            });
          }
        }
        if (documents.length > 0) {
          await vectraStore.addDocuments(documents, {
            kbid: Array(documents.length).fill(kb.id),
            kbitemid: Array(documents.length).fill(kbItem.id),
            isEnable: Array(documents.length).fill(true),
          });
          kbItem.state = KnowledgeBaseItemState.Completed;
          kbItem.chunkCount = documents.length;
          await repository.save(kbItem);
        } else {
          await repository.delete(kbItem);
        }
      } catch (err) {
        console.error(err);
        kbItem.state = KnowledgeBaseItemState.Fail;
        await repository.save(kbItem);
        notificationManager.sendNotification(
          `${kbItem.source} 导入失败`,
          'error',
        );
      }
    }
    notificationManager.update({
      id: notificationId,
      title: '导入知识库',
      type: 'progress',
      description: `导入完成`,
      percent: 100,
      duration: 3,
      closeEnable: true,
    } as NotificationMessage);
  };

  public async insertRecord(
    kbId: string,
    document: Document,
    sourceType: KnowledgeBaseSourceType,
    config: Record<string, any>,
  ) {
    let splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config?.chunkSize ?? 500,
      chunkOverlap: config?.chunkOverlap ?? 0,
    });

    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kb = await kb_repository.findOne({ where: { id: kbId } });
    const vectraStore = await this.getVectorStore(kb);
    const kbItemId = uuidv4();
    // if (sourceType == KnowledgeBaseSourceType.Web) {
    //   document = htmlToMarkdown(document);
    //   // document.metadata.title = document.metadata.source;
    // }
    let name = document.pageContent.slice(0, 20);
    if (document.metadata.source || document.metadata.title) {
      name = document.metadata.title ?? path.basename(document.metadata.source);
    }
    let kbItem = {
      id: kbItemId,
      knowledgeBase: kb,
      name,
      source: document.metadata.source,
      sourceType,
      isEnable: true,
      state: KnowledgeBaseItemState.Pending,
      metadata: document.metadata,
      timestamp: new Date().getTime(),
      config: {
        chunkSize: splitter.chunkSize,
        chunkOverlap: splitter.chunkOverlap,
      },
      content: document.pageContent,
    } as KnowledgeBaseItem;
    await repository.insert(kbItem);
    appManager.sendEvent(`kb:update-item`, kbItem);
    let documents = [];
    if (sourceType == KnowledgeBaseSourceType.Web) {
      splitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
        chunkSize: config?.chunkSize ?? 500,
        chunkOverlap: config?.chunkOverlap ?? 50,
      });
    }
    documents = await splitter.splitDocuments([document]);
    kbItem = await repository.findOne({
      where: { id: kbItemId },
      relations: { knowledgeBase: true },
    });
    if (documents.length > 0) {
      try {
        await vectraStore.addDocuments(documents, {
          kbid: Array(documents.length).fill(kb.id),
          kbitemid: Array(documents.length).fill(kbItemId),
          isEnable: Array(documents.length).fill(true),
        });
        kbItem.chunkCount = documents.length;
        kbItem.state = KnowledgeBaseItemState.Completed;
      } catch (err) {
        console.error(err);
        kbItem.isEnable = false;
        kbItem.state = KnowledgeBaseItemState.Fail;
      }
    } else {
      kbItem.isEnable = false;
      kbItem.state = KnowledgeBaseItemState.Fail;
    }
    await repository.save(kbItem);
    appManager.sendEvent(`kb:update-item`, kbItem);
  }

  public queue = async (
    input: { kbId: string; config: Record<string, any> },
    callback,
  ) => {
    let documents: Document[] = [];
    let name;
    let sourceType;
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kb = await kb_repository.findOne({ where: { id: input.kbId } });
    const vectraStore = await this.getVectorStore(kb);
    try {
      const embeddings = await this.getEmbeddings(kb);
      await embeddings.embedQuery('embedding test');
    } catch (err) {
      console.error(err);
      notificationManager.sendNotification('embedding fail', 'error');
      return;
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: input.config.chunkSize ?? 500,
      chunkOverlap: input.config.chunkOverlap ?? 0,
    });
    // const turndownService = new TurndownService({
    //   codeBlockStyle: 'fenced',
    // });
    if (isUrl(input.config.url)) {
      const list = [];
      const doc = await urlToMarkdown(input.config.url);
      await this.insertRecord(
        kb.id,
        doc,
        KnowledgeBaseSourceType.Web,
        input.config,
      );
    } else if (input.config.files && input.config.files.length > 0) {
      sourceType = KnowledgeBaseSourceType.File;
      const kbItems = [] as KnowledgeBaseItem[];
      const notificationId = uuidv4();
      notificationManager.create({
        id: notificationId,
        title: '导入文件',
        type: 'progress',
        description: '导入中...',
        percent: 0,
        duration: undefined,
        closeEnable: false,
      } as NotificationMessage);
      for (let index = 0; index < input.config.files.length; index++) {
        const file = input.config.files[index];
        const ext = path.extname(file).toLowerCase();
        const loader = getLoaderFromExt(ext, file);
        const name = path.basename(file);
        notificationManager.update({
          id: notificationId,
          title: '导入知识库',
          type: 'progress',
          description: `正在导入[${name}]`,
          percent: (index / input.config.files.length) * 100,
          duration: undefined,
          closeEnable: false,
        } as NotificationMessage);
        try {
          documents = await loader.load();

          if (documents.length > 0) {
            documents.forEach((d) => {
              d.metadata.title = name;
            });
            await this.insertRecord(
              kb.id,
              documents[0],
              KnowledgeBaseSourceType.File,
              input.config,
            );
          }
        } catch {
          notificationManager.sendNotification(`${name} 导入失败`, 'error');
        }
      }
      notificationManager.update({
        id: notificationId,
        title: '导入知识库',
        type: 'progress',
        description: `导入完成`,
        percent: 100,
        duration: 3,
        closeEnable: true,
      } as NotificationMessage);
    } else if (input.config.folders && input.config.folders.length > 0) {
      sourceType = KnowledgeBaseSourceType.Folder;
      const notificationId = uuidv4();
      notificationManager.create({
        id: notificationId,
        title: notificationId,
        type: 'progress',
        description: '导入中...',
        percent: 0,
        duration: undefined,
        closeEnable: false,
      } as NotificationMessage);
      for (let index = 0; index < input.config.folders.length; index++) {
        const loader = new DirectoryLoader(
          input.config.folders[index],
          {
            // '.json': (path) => new JSONLoader(path, '/texts'),
            // '.jsonl': (path) => new JSONLinesLoader(path, '/html'),
            '.jpeg': (path) => new ImageLoader(path),
            '.jpg': (path) => new ImageLoader(path),
            '.png': (path) => new ImageLoader(path),
            '.txt': (path) => new TextLoader(path),
            '.docx': (path) => new DocxLoader(path, { type: 'docx' }),
            '.doc': (path) => new DocxLoader(path, { type: 'doc' }),
            '.pdf': (path) => new PDFLoader(path),
            // '.csv': (path) => new CSVLoader(path, 'text'),
          },
          input.config.recursive ?? true,
          UnknownHandling.Ignore,
        );
        documents = await loader.load();
        const kbItems = [] as KnowledgeBaseItem[];
        for (let d_index = 0; d_index < documents.length; d_index++) {
          const document = documents[d_index];
          document.metadata.title = path.basename(document.metadata.source);
          await this.insertRecord(
            kb.id,
            document,
            KnowledgeBaseSourceType.File,
            input.config,
          );
        }
      }
    } else if (input.config.text) {
      await this.insertRecord(
        kb.id,
        new Document({
          pageContent: input.config.text,
          metadata: {
            source: null,
            title: null,
          },
        }),
        KnowledgeBaseSourceType.Text,
        input.config,
      );
    } else if (input.config.sitemap) {
      const notificationId = uuidv4();
      let sitemap = [];
      try {
        const loader = new SitemapLoader(input.config.sitemap);
        const docs = await loader.load();
        sitemap = await loader.parseSitemap();

        notificationManager.create({
          id: notificationId,
          title: '导入知识库',
          type: 'progress',
          description: '导入中...',
          percent: 0,
          duration: undefined,
          closeEnable: false,
        } as NotificationMessage);
      } catch {
        notificationManager.sendNotification(
          `${input.config.sitemap} 导入失败`,
          'error',
        );
        return;
      }

      for (let index = 0; index < sitemap.length; index++) {
        const { loc } = sitemap[index];
        try {
          const doc = await urlToMarkdown(loc.trim());
          notificationManager.update({
            id: notificationId,
            title: '导入知识库',
            type: 'progress',
            description: `正在导入[${loc.trim()}]`,
            percent: (index / sitemap.length) * 100,
            duration: undefined,
            closeEnable: false,
          } as NotificationMessage);
          await this.insertRecord(
            kb.id,
            doc,
            KnowledgeBaseSourceType.Web,
            input.config,
          );
        } catch {
          notificationManager.sendNotification(
            `${loc.trim()} 导入失败`,
            'error',
          );
        }
      }
      notificationManager.update({
        id: notificationId,
        title: '导入知识库',
        type: 'progress',
        description: `导入完成`,
        percent: 100,
        duration: 3,
        closeEnable: true,
      } as NotificationMessage);
    }
  };

  public async getVectorStore(kb: KnowledgeBase | string): Promise<
    VectorStore & {
      drop: (p: any) => {};
      filter: (where: any) => {};
      update: (
        data: Map<string, string>,
        input_where: Record<string, any>,
      ) => {};
    }
  > {
    let _kb: KnowledgeBase;
    if (isString(kb)) {
      const kbIdOrName = kb as string;
      const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
      _kb = await kb_repository.findOne({
        where: [{ id: kbIdOrName }, { name: kbIdOrName }],
      });
    } else {
      _kb = kb;
    }
    const embeddings = await this.getEmbeddings(_kb);
    let vectraStore;
    if (_kb.vectorStoreType == VectorStoreType.PGVector) {
      throw new Error('PGVector is not supported');
    } else if (_kb.vectorStoreType == VectorStoreType.Milvus) {
      throw new Error('Milvus is not supported');
    } else if (_kb.vectorStoreType == VectorStoreType.LanceDB) {
      vectraStore = await LanceDBStore.initialize(embeddings, {
        database: 'kb',
        tableName: _kb.id,
        rootPath: _kb.rootPath,
        extendColumns: { kbid: '', kbitemid: '', isenable: true },
      });
    }
    return vectraStore;
  }

  async getEmbeddings(kb: KnowledgeBase): Promise<Embeddings> {
    if (kb.embedding) {
      return await getEmbeddingModel(
        kb.embedding.split('@')[1],
        kb.embedding.split('@')[0],
      );
    } else {
      throw new Error();
    }
  }

  @channel('kb:query')
  public async query(
    kbId: string,
    query: string,
    options: Record<string, any> = { k: 10 },
  ): Promise<KnowledgeBaseDocument[]> {
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const kb = await kb_repository.findOne({ where: { id: kbId } });
    const embeddings = await this.getEmbeddings(kb);
    const vectraStore = await this.getVectorStore(kb);
    const emb = await embeddings.embedQuery(query);
    const documents = await vectraStore.similaritySearchVectorWithScore(
      emb,
      options.k,
      'isenable = true',
    );
    if (documents.length == 0) return [];
    const scores = {};
    const ranker_scores = {};
    const result = [];
    if (kb.reranker) {
      try {
        const reranker = await getReranker(kb.reranker);
        const res = await reranker.rerank(
          query,
          documents.map((x) => x[0].pageContent),
          undefined,
          true,
        );
        for (let index = 0; index < res.length; index++) {
          ranker_scores[documents[res[index].index][0].metadata.id] =
            res[index].score;
        }
      } catch {
        notificationManager.sendNotification(`${kb.reranker} error`, 'error');
      }
    }

    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      const doc_emb = await embeddings.embedQuery(document[0].pageContent);
      const score = cos_sim(emb, doc_emb);
      const d = {
        document: document[0],
        vector_distance: document[1],
        score: score,
      } as KnowledgeBaseDocument;
      d.reranker_score = ranker_scores[document[0].metadata.id];
      result.push(d);
    }

    result.sort((a, b) => {
      if (a.reranker_score !== undefined && b.reranker_score !== undefined) {
        return b.reranker_score - a.reranker_score;
      }

      if (a.reranker_score !== undefined) return -1;
      if (b.reranker_score !== undefined) return 1;
      return b.score - a.score;
    });

    return result;
  }

  @channel('kb:delete')
  public async delete(kbId: string) {
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const kb = await kb_repository.findOne({
      where: { id: kbId },
    });

    await kb_repository.delete({ id: kbId });
    try {
      const vectorStore = await this.getVectorStore(kb);
      await vectorStore.drop(kbId);
    } catch (e) {
      console.error(e);
    }
  }

  @channel('kb:delete-item')
  public async deleteItem(kbItemId: string | string) {
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    if (isArray(kbItemId)) {
      const kb_items = await repository.find({ where: { id: In(kbItemId) } });
      const kbs = await kb_repository.find({
        where: { id: In([...new Set(kb_items.map((x) => x.knowledgeBaseId))]) },
      });
      for (let index = 0; index < kbs.length; index++) {
        const kb = kbs[index];
        const vectorStore = await this.getVectorStore(kb);
        const ids = kb_items
          .filter((x) => x.knowledgeBaseId == kb.id)
          .map((x) => x.id);

        ids.forEach(async (id) => {
          await vectorStore.delete({ kbitemid: id });
        });
      }
      await repository.delete({ id: In(kbItemId) });
    } else {
      const kb_item = await repository.findOne({ where: { id: kbItemId } });

      const kb = await kb_repository.findOne({
        where: { id: kb_item.knowledgeBaseId },
      });
      const vectorStore = await this.getVectorStore(kb);
      await repository.delete({ id: kbItemId });
      await vectorStore.delete({ kbitemid: kb_item.id });
    }
  }

  @channel('kb:get')
  public async get(input: {
    knowledgeBaseId: string;
    filter: string;
    skip: number;
    pageSize: number;
    sort: string | undefined;
  }) {
    const where = { knowledgeBaseId: input.knowledgeBaseId } as any;
    if (input.filter) where['name'] = Like(`%${input.filter.trim()}%`);
    const res = await dbManager.page(
      'knowledgebase_item',
      where,
      input.skip,
      input.pageSize,
      input.sort,
    );
    return res;
  }

  @channel('kb:get-item')
  public async getItem(kbItemId: string): Promise<{
    pageContent: string;
    metadata: any;
    chunks: KnowledgeBaseItemChunk[];
  }> {
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kb_item = await repository.findOne({
      where: { id: kbItemId },
      relations: {
        knowledgeBase: true,
      },
    });
    const vectorStore = await this.getVectorStore(kb_item.knowledgeBase);
    const res = (await vectorStore.filter({ kbitemid: kb_item.id })) as any[];
    const results = {
      pageContent: kb_item.content,
      metadata: kb_item.metadata,
      chunks: [],
    };

    res.sort((a, b) => {
      const a_metadata = JSON.parse(a.metadata);
      const b_metadata = JSON.parse(b.metadata);
      return a_metadata.loc.lines.from - b_metadata.loc.lines.from;
    });
    res.forEach((item, index) => {
      results.chunks.push({
        index,
        content: item.content,
      } as KnowledgeBaseItemChunk);
    });

    return results;
  }

  @channel('kb:update-item')
  public async updateItem(kbItemId: string, data: any) {
    const repository = dbManager.dataSource.getRepository(KnowledgeBaseItem);
    const kb_item = await repository.findOne({ where: { id: kbItemId } });
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const kb = await kb_repository.findOne({
      where: { id: kb_item.knowledgeBaseId },
    });
    const vectorStore = await this.getVectorStore(kb);
    await vectorStore.update(data, { kbitemid: kb_item.id });
    await repository.update({ id: kbItemId }, data);
  }

  @channel('kb:create')
  public async create(input: KnowledgeBaseCreateInput) {
    const kbId = uuidv4();
    await dbManager.insert('knowledgebase', {
      id: kbId,
      ...input,
    });
    const v = await this.getVectorStore(kbId);
  }

  @channel('kb:update')
  public async update(id: string, input: KnowledgeBaseUpdateInput) {
    delete input['embedding'];
    delete input['vectorStoreType'];
    const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
    const kb = await kb_repository.findOne({
      where: { id },
    });
    const _kb = { ...kb, ...input };
    const res = await kb_repository.save(_kb);
    console.log(res);
  }
}

export const kbManager = new KnowledgeBaseManager();
