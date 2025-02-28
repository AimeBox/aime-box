/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, StructuredTool } from '@langchain/core/tools';
import { HuggingFaceTransformersEmbeddings } from '../embeddings/HuggingFaceTransformersEmbeddings';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import {
  RecursiveCharacterTextSplitter,
  MarkdownTextSplitter,
  LatexTextSplitter,
  TokenTextSplitter,
  CharacterTextSplitter,
  TextSplitter,
} from 'langchain/text_splitter';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
// import {
//   UnstructuredLoader,
//   UnstructuredDirectoryLoader,
// } from 'langchain/document_loaders/fs/multi_file';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import {
  JSONLoader,
  JSONLinesLoader,
} from 'langchain/document_loaders/fs/json';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';

import { z } from 'zod';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
// import { Client, PoolConfig } from 'pg';
import { statSync } from 'fs';
import { Url } from 'url';

export class KnowledgeBaseSave extends StructuredTool {
  schema = z.object({
    path: z.string().describe('File local Path'),
    type: z.string().describe('File Type'),
  });

  name = 'KnowledgeBase_SaveTool';

  description = 'Save Knowledge From User File';

  pgvectorStore: PGVectorStore | null = null;

  embeddings: Embeddings | null = null;

  constructor() {
    super();
    Object.defineProperty(this, 'embeddings', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new HuggingFaceTransformersEmbeddings({
        modelName: 'bge-large-zh-v1.5',
      }),
    });
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    if (!this.pgvectorStore) {
      // this.pgvectorStore = await PGVectorStore.initialize(this.embeddings, {
      //   postgresConnectionOptions: {
      //     type: 'postgres',
      //     host: '127.0.0.1',
      //     port: 5432,
      //     user: 'pgvector',
      //     password: 'pgvector',
      //     database: 'postgres',
      //   } as PoolConfig,
      //   tableName: 'kb_bge_large_zh_embedding',
      //   columns: {
      //     idColumnName: 'id',
      //     vectorColumnName: 'vector',
      //     contentColumnName: 'content',
      //     metadataColumnName: 'metadata',
      //   },
      //   distanceStrategy: 'euclidean' as DistanceStrategy,
      // });
    }

    const loader = new DocxLoader(input.path);

    const docs = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 0,
    });
    const allSplits = await textSplitter.splitDocuments(docs);

    const vectorStore = await this.pgvectorStore.addDocuments(allSplits);
    return 'ok';
  }
  // protected _call(
  //   arg: any,
  //   runManager?: CallbackManagerForToolRun | undefined,
  //   config?: RunnableConfig | undefined,
  // ): Promise<string> {}
}

export class KnowledgeBaseManage extends StructuredTool {
  schema = z.object({
    action: z.enum(['create', 'get', 'save']).describe('KnowledgeBase Action'),
    tableName: z.string().describe('KnowledgeBase TableName'),
    pathOrUrl: z.string().describe('File or local Path, or Url '),
  });

  name = 'KnowledgeManage';

  description =
    'Knowledge Manage Can Create a Table to save different classification , or Get already Knowledge classification';

  pgvectorStore: PGVectorStore | null = null;

  embeddings: Embeddings | null = null;

  host: string;

  port: number;

  user: string;

  password: string;

  database: string;

  constructor() {
    super();
    this.host = '127.0.0.1';
    this.port = 5432;
    this.user = 'pgvector';
    this.password = 'pgvector';
    this.database = 'postgres';
  }

  async _call(input: z.infer<typeof this.schema>) {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: 'bge-large-zh-v1.5',
    });
    if (input.action == 'create') {
      this.pgvectorStore = await PGVectorStore.initialize(this.embeddings, {
        postgresConnectionOptions: {
          type: 'postgres',
          host: this.host,
          port: this.port,
          user: this.user,
          password: this.password,
          database: this.database,
        } as PoolConfig,
        tableName: input.tableName,
        columns: {
          idColumnName: 'id',
          vectorColumnName: 'vector',
          contentColumnName: 'content',
          metadataColumnName: 'metadata',
        },
        distanceStrategy: 'euclidean' as DistanceStrategy,
      });
    } else if (input.action === 'get') {
      const client = new Client({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database,
      });
      await client.connect();
      // client.query();
    } else if (input.action === 'save') {
      if (this.isValidUrl(input.pathOrUrl)) {
        const loader = new CheerioWebBaseLoader(input.pathOrUrl);
      } else {
        const stats = statSync(input.pathOrUrl);
        if (stats.isFile()) {
        } else if (stats.isDirectory()) {
          const loader = new DirectoryLoader(input.pathOrUrl, {
            '.json': (path) => new JSONLoader(path, '/texts'),
            '.jsonl': (path) => new JSONLinesLoader(path, '/html'),
            '.txt': (path) => new TextLoader(path),
            '.csv': (path) => new CSVLoader(path, 'text'),
            '.docx': (path) => new DocxLoader(path),
            '.pdf': (path) => new PDFLoader(path),
          });
        } else {
          throw new Error('该输入无效');
        }
      }
    }
  }

  private isValidUrl(input: string): Boolean {
    try {
      const urlObj = new URL(input);
      return true;
    } catch (e) {
      return false;
    }
  }
}
// export const saveFromFile = (path: string) => {};
// export const saveFromUrl = (url: string) => {};
