import { DocumentInterface } from '@langchain/core/documents';
import {
  VectorStore,
  VectorStoreInterface,
} from '@langchain/core/vectorstores';
import {
  Embeddings,
  type EmbeddingsParams,
  EmbeddingsInterface,
} from '@langchain/core/embeddings';

export interface BaseVectorStoreInterface extends VectorStoreInterface {
  get(id: string): Promise<any>;

  initialize(embeddings: Embeddings, collectionName: string);

  getCollections(): Promise<string[]>;

  createCollection(collectionName: string, extendColumns: []);

  deleteCollection(collectionName: string);
}

export class BaseVectorStore
  extends VectorStore
  implements BaseVectorStoreInterface
{
  constructor(embeddings: EmbeddingsInterface, dbConfig: Record<string, any>) {
    super(embeddings, dbConfig);
  }

  _vectorstoreType(): string {
    throw new Error('Method not implemented.');
  }

  addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: { [x: string]: any },
  ): Promise<string[] | void> {
    throw new Error('Method not implemented.');
  }

  addDocuments(
    documents: DocumentInterface[],
    options?: { [x: string]: any },
  ): Promise<string[] | void> {
    throw new Error('Method not implemented.');
  }

  similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this['FilterType'],
  ): Promise<[DocumentInterface, number][]> {
    throw new Error('Method not implemented.');
  }

  get(id: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  initialize(
    embeddings: Embeddings,
    collectionName: string,
  ): Promise<BaseVectorStore> {
    throw new Error('Method not implemented.');
  }

  getCollections(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  //getCollections(): string[];
  createCollection(collectionName: string, extendColumns: {}) {
    throw new Error('Method not implemented.');
  }

  deleteCollection(collectionName: string) {
    throw new Error('Method not implemented.');
  }

  update(data: Record<string, any>, where: Record<string, any>): Promise<any> {
    throw new Error('Method not implemented.');
  }

  insert(
    data: Record<string, any>,
    content: string,
    metadata: Record<string, any>,
    vector: Array<number>,
    source: string,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }

  delete(input?: Record<string, any> | string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  filter(
    input?: Record<string, any> | string,
    limit: number | null = null,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
