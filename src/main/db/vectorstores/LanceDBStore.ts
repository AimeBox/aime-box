import { DocumentInterface, Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import { EmbeddingsInterface } from '@langchain/core/embeddings';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LanceDB } from '@langchain/community/vectorstores/lancedb';
import { isObject, isString } from '../../utils/is';
import * as lancedb from '@lancedb/lancedb';
import fs from 'fs';
import { getDataPath } from '../../utils/path';
import { BaseVectorStore } from '.';
import * as arrow from 'apache-arrow';

export interface LanceDBStoreArgs {
  tableName: string;
  database: string;
  extendColumns?: Record<string, any>;
}

export class LanceDBStore extends BaseVectorStore {
  client: lancedb.Table;

  connect: lancedb.Connection;

  extendColumns?: Record<string, any>;

  tableName: string;

  uri: string;

  // constructor(embeddings: EmbeddingsInterface, config: LanceDBStoreArgs) {
  //   super(embeddings, config);
  // }

  _vectorstoreType(): string {
    return 'lancedb';
  }

  static async initialize(
    embeddings: EmbeddingsInterface,
    config: LanceDBStoreArgs,
  ): Promise<BaseVectorStore> {
    const store = new LanceDBStore(embeddings, config);
    store.uri = path.join(getDataPath(), 'vector-db', config.database);
    store.connect = await lancedb.connect(store.uri);
    if (!config.extendColumns) {
      config.extendColumns = {};
    } else {
      const extendColumns = {};
      Object.keys(config.extendColumns).forEach((x) => {
        extendColumns[x.toLowerCase()] = config.extendColumns[x];
      });
      config.extendColumns = extendColumns;
    }
    store.tableName = config.tableName;

    if ((await store.connect.tableNames()).includes(store.tableName)) {
      store.client = await store.connect.openTable(store.tableName);
      const schema = await store.client.schema();
      console.log(schema);
    } else {
      const schemaList = [
        new arrow.Field('id', new arrow.Utf8()),
        new arrow.Field('vector', new arrow.Float32()),
        new arrow.Field('content', new arrow.Utf8()),
        new arrow.Field('metadata', new arrow.Utf8()),
        new arrow.Field('source', new arrow.Utf8()),
      ];

      Object.keys(config.extendColumns).forEach((k) => {
        schemaList.push(new arrow.Field(k, new arrow.Utf8()));
      });
      const schema = new arrow.Schema(schemaList);
      // store.client = await store.connect.createEmptyTable(
      //   store.tableName,
      //   schema,
      //   {
      //     mode: 'create',
      //   },
      // );
      // await store.client.createIndex('vector');
      // const info = store.client.display();
      store.client = await store.connect.createTable(store.tableName, [
        {
          id: '1',
          vector: Array(1024),
          content: '',
          metadata: '',
          source: '',
          ...config.extendColumns,
        },
      ]);

      await store.client.delete('id = "1"');
    }
    const indexxx = await store.client.listIndices();
    store.extendColumns = config.extendColumns;
    return store;
  }

  async createCollection(collectionName: string, extendColumns: []) {}

  async getCollections(): Promise<string[]> {
    return await this.connect.tableNames();
  }

  async addVectors(
    vectors: number[][],
    documents: DocumentInterface<Record<string, any>>[],
    options?: { [x: string]: any },
  ): Promise<void | string[]> {
    const ids = options?.ids;
    // Either all documents have ids or none of them do to avoid confusion.
    if (ids !== undefined && ids.length !== vectors.length) {
      throw new Error(
        'The number of ids must match the number of vectors provided.',
      );
    }
    const rows = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const values = [];
      const embedding = vectors[i];
      let v = {};
      if (ids !== undefined) {
        v['id'] = ids[i];
      } else {
        v['id'] = uuidv4();
      }
      v = {
        ...v,
        vector: embedding,
        content: documents[i].pageContent.replace(/\0/g, ''),
        metadata: JSON.stringify(documents[i].metadata),
        source: documents[i].metadata.source,
      };
      const _options = {};
      Object.keys(options).forEach((x) => {
        _options[x.toLowerCase()] = options[x];
      });
      options = _options;
      Object.keys(this.extendColumns).forEach((k) => {
        if (options[k.toLowerCase()])
          v[k.toLowerCase()] = options[k.toLowerCase()][i];
      });

      // values.push(
      //   documents[i].pageContent.replace(/\0/g, ''),
      //   embedding,
      //   documents[i].metadata,
      // );
      rows.push(v);
    }
    await this.client.add(rows);
    // this.client.close();
    // this.connect.close();
    // this.connect = await lancedb.connect(this.uri);
    // this.client = await this.connect.openTable(this.tableName);

    //await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async addDocuments(
    documents: DocumentInterface<Record<string, any>>[],
    options?: { [x: string]: any },
  ): Promise<void | string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options,
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number = 4,
    filter: string | object | null = null,
  ): Promise<[DocumentInterface<Record<string, any>>, number][]> {
    const rows = await this.client.countRows();
    let q = this.client.vectorSearch(query);

    if (filter) {
      if (isObject(filter)) {
        const input_where = this.obj2where(filter);
        if (input_where) q = q.where(input_where);
      } else if (isString(filter)) {
        q = q.where(filter);
      }
    }
    const documents = (await q.limit(k).toArray()) as any[];
    documents.forEach((x) => {
      console.log({ ...x });
    });

    const results = [];
    for (const doc of documents) {
      if (doc._distance != null && doc.content != null) {
        let metadata = {};
        Object.keys(doc).forEach((x) => {
          if (!(x == 'content' || x == 'source' || x == 'vector')) {
            if (x == 'metadata') {
              metadata = { ...metadata, ...JSON.parse(doc['metadata']) };
            } else {
              metadata[x] = doc[x];
            }
          }
        });

        const document = new Document({
          pageContent: doc.content as string,
          metadata: {
            source: doc.source,
            ...metadata,
          },
        });
        results.push([document, doc._distance]);
      }
    }

    return results;
  }

  async delete(input?: Record<string, any> | string) {
    const where = this.obj2where(input);
    await this.client.delete(where);
  }

  async drop(tableName: string) {
    if ((await this.connect.tableNames()).includes(tableName)) {
      if (
        fs
          .statSync(
            path.join(getDataPath(), 'vector-db', 'kb', `${tableName}.lance`),
          )
          .isDirectory()
      ) {
        await this.connect.dropTable(tableName);
      }
    }
  }

  async deleteCollection(collectionName: string) {
    const tableNames = await this.connect.tableNames();
    if ((await this.connect.tableNames()).includes(collectionName)) {
      if (
        fs
          .statSync(
            path.join(
              getDataPath(),
              'vector-db',
              collectionName,
              `${collectionName}.lance`,
            ),
          )
          .isDirectory()
      ) {
        await this.connect.dropTable(collectionName);
      }
    }
  }

  async get(id: string): Promise<any> {
    const q = await this.client.query().where(`id = '${id}'`).limit(1);
    const res = await q.toArray();
    if (res.length == 0) return null;
    return res[0];
  }

  // async update(id: string, data: Map<string, string>): Promise<any> {
  //   const res = await this.client.query().where(`id = '${id}'`).limit(1);
  //   debugger;
  //   return res;
  // }

  async filter(
    input?: Record<string, any> | string,
    limit: number | null = null,
  ): Promise<any> {
    const where = this.obj2where(input);
    let q = this.client.query().where(where);
    if (limit) q = q.limit(limit);
    const res = await q.toArray();
    // res.forEach((item) => {
    //   if (isString(item.metadata))
    //     item.metadata = JSON.parse(item.metadata as string);
    // });
    return res;
  }

  async update(data: Record<string, any>, where: Record<string, any>) {
    const input_where = this.obj2where(where);
    const old_data = await this.client.query().where(input_where).toArray();
    const new_data = [];
    old_data.forEach((d) => {
      const js = JSON.stringify(d);
      const ndata = { ...d };
      const vector = [...d['vector']] as Array<number>;
      ndata['vector'] = vector;
      Object.keys(data).forEach((x) => {
        if (x == 'vector') {
          ndata[x.toLowerCase()] = data[x]; //`[${data[x].map((x) => x.toString()).join(',')}]`; //new Float32Array(data[x]);
        } else if (isObject(data[x])) {
          ndata[x.toLowerCase()] = JSON.stringify(data[x]);
        } else {
          ndata[x.toLowerCase()] = data[x]; //.toString();
        }
      });
      new_data.push(ndata);
    });
    await this.client.delete(input_where);
    // const update_data = {};

    // Object.keys(data).forEach((x) => {
    //   if (x == 'vector') {
    //     update_data[x.toLowerCase()] = data[x]; //`[${data[x].map((x) => x.toString()).join(',')}]`; //new Float32Array(data[x]);
    //   } else {
    //     if (isObject(data[x])) {
    //       update_data[x.toLowerCase()] = JSON.stringify(data[x]);
    //     } else {
    //       update_data[x.toLowerCase()] = data[x].toString();
    //     }
    //   }
    // });
    await this.client.add(new_data);
    //await this.client.update({ values: update_data, where: input_where });
    //await this.client.insert(update_data, ,,data['vector'],);
  }

  async insert(
    data: Record<string, any>,
    content: string,
    metadata: Record<string, any>,
    vector: Array<number>,
    source: string = '',
  ) {
    let v = {};
    if (!Object.keys(data).includes('id')) {
      v['id'] = uuidv4();
    }

    Object.entries(data).forEach((item) => {
      v[item[0]] = item[1];
    });

    v = {
      id: v['id'],
      vector: vector,
      content: content,
      metadata: JSON.stringify(metadata),
      source: source || '',
    };

    Object.keys(this.extendColumns).forEach((k) => {
      v[k.toLowerCase()] = data[k];
    });
    await this.client.add([v]);
  }

  obj2where(input?: Record<string, any> | string) {
    let where = '';
    if (isString(input)) {
      where = input;
    } else if (isObject(input)) {
      Object.keys(input).forEach((k, index) => {
        where += `${k} = ${
          isString(input[k]) ? `'${input[k]}'` : input[k]
        }${index == Object.keys(input).length - 1 ? '' : ' and '}`;
      });
    }
    return where;
  }
}
