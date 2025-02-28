import { ProviderType } from '@/entity/Providers';
import providersManager from '../providers';
import { getProviderModel } from '../utils/providerUtil';
import { Transformers } from '../utils/transformers';

export interface RerankerParams {
  modelName: string;

  timeout?: number;

  batchSize?: number;

  apiKey?: string;
}

export abstract class Reranker implements RerankerParams {
  modelName: string;

  timeout?: number;

  batchSize?: number;

  apiKey?: string;

  constructor(params?: Partial<RerankerParams>) {
    this.modelName = params?.modelName;
    this.timeout = params?.timeout;
    this.batchSize = params?.batchSize;
    this.apiKey = params?.apiKey;
  }

  abstract rerank(
    query: string,
    documents: string[],
    top_n?: number,
    return_documents?: boolean,
  ): Promise<{ document: string; index: number; score: number }[]>;
}

export class TransformersReranker extends Reranker {
  constructor(params?: Partial<RerankerParams>) {
    super(params);
  }

  async rerank(
    query: string,
    texts: string[],
    top_n: number | undefined = undefined,
    return_documents: boolean = false,
  ): Promise<any> {
    const reranker = new Transformers({
      modelName: this.modelName,
    });
    return await reranker.reranker(query, texts, {
      return_documents: return_documents,
      top_k: top_n ?? texts.length,
    });
  }
}

export class SiliconFlowReranker extends Reranker {
  async rerank(
    query: string,
    documents: string[],
    top_n: number | undefined = undefined,
    return_documents: boolean = false,
  ) {
    const body = {
      model: this.modelName,
      query,
      documents,
      top_n: top_n ?? documents.length,
      return_documents,
      max_chunks_per_doc: 1024,
      overlap_tokens: 80,
    };
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };

    const res = await fetch('https://api.siliconflow.cn/v1/rerank', options);
    const data = await res.json();
    return data.results.map((x: any) => ({
      document: x.document.text,
      index: x.index,
      score: x.relevance_score,
    }));
  }

  constructor(params: Partial<RerankerParams>) {
    super(params);
  }
}

export async function getReranker(providerModel?: string): Promise<Reranker> {
  const { provider: providerName, modelName } = getProviderModel(providerModel);

  if (providerName === 'local') {
    return new TransformersReranker({
      modelName: modelName,
    });
  } else {
    const provider = await (
      await providersManager.getProviders()
    ).find((x) => x.name === providerName);

    if (provider?.type === ProviderType.SILICONFLOW) {
      return new SiliconFlowReranker({
        modelName,
        apiKey: provider.api_key,
      });
    }
  }

  throw new Error('Unsupported provider');
}
