import type { RapidOcrTool as RapidOcrToolT } from '../tools/RapidOcr';
import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { getEnv } from '@langchain/core/utils/env';

export class ImageLoader extends BaseDocumentLoader {
  filePathOrBlob: string | Blob;

  constructor(filePathOrBlob: string | Blob) {
    super();
    Object.defineProperty(this, 'filePathOrBlob', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: filePathOrBlob,
    });
  }

  async parse(raw: string): Promise<string[]> {
    return [raw];
  }

  async load(): Promise<Document[]> {
    // let text;
    // let metadata;

    const { RapidOcrTool } = await ImageLoader.imports();
    const ocrTool = new RapidOcrTool();
    const text = await ocrTool.invoke(this.filePathOrBlob);
    const metadata = { source: this.filePathOrBlob };

    const pageContent = text;
    return [new Document({ pageContent, metadata })];
  }

  static async imports(): Promise<{ RapidOcrTool: typeof RapidOcrToolT }> {
    try {
      const { RapidOcrTool } = await import('../tools/RapidOcr');
      return { RapidOcrTool: RapidOcrTool };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`,
      );
    }
  }
}
