import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { chunkArray } from '@langchain/core/utils/chunk_array';
import { app } from 'electron';
// import transformers from '@huggingface/transformers';
import path from 'path';
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  RawImage,
  AutoModel,
  env,
  pipeline,
  ChineseCLIPModel,
} from '@huggingface/transformers';
import settingsManager from '../settings';

export interface SiliconflowEmbeddingsParams extends EmbeddingsParams {
  modelName: string;
  apiKey: string;
  baseURL: string;
}
// eslint-disable-next-line import/prefer-default-export
export class SiliconflowEmbeddings
  extends Embeddings
  implements SiliconflowEmbeddingsParams
{
  modelName: string;

  apiKey: string;

  baseURL: string;

  batchSize: number = 10;

  stripNewLines: boolean = true;

  constructor(fields?: Partial<SiliconflowEmbeddingsParams>) {
    super(fields ?? {});

    this.modelName = fields?.modelName;
    this.apiKey = fields?.apiKey;
    this.baseURL = fields?.baseURL;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts,
      this.batchSize,
    );

    const batchRequests = batches.map((batch) => this.runEmbedding(batch));
    const batchResponses = await Promise.all(batchRequests);
    const embeddings = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batchResponse = batchResponses[i];
      for (let j = 0; j < batchResponse.length; j += 1) {
        embeddings.push(batchResponse[j]);
      }
    }
    return embeddings;
  }

  async embedQuery(text: string) {
    const data = await this.runEmbedding([
      this.stripNewLines ? text.replace(/\n/g, ' ') : text,
    ]);
    return data[0];
  }

  async runEmbedding(texts: string[]) {
    return this.caller.call(async () => {
      const data = {
        model: this.modelName,
        input: texts,
        encoding_format: 'float',
      };
      const options = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        httpAgent: settingsManager.getHttpAgent(),
      };

      const response = await fetch(`${this.baseURL}/embeddings`, options);

      if (response.ok) {
        const res = await response.json();
        const embeddings = res.data.map((x) => x.embedding);
        return embeddings;
      } else {
        const text = await response.text();
        console.log(text);
      }
      throw new Error('Failed to get embeddings');
    });
  }
}
