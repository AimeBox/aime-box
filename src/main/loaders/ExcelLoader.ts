import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { getEnv } from '@langchain/core/utils/env';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

export class ExcelLoader extends BaseDocumentLoader {
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
    let metadata;
    let wb: xlsx.WorkBook;
    xlsx.set_fs(fs);
    if (this.filePathOrBlob instanceof Blob) {
      const arrayBuffer = await this.filePathOrBlob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      wb = xlsx.read(data, { type: 'array' });
    } else {
      wb = xlsx.readFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    }
    const docs: Document[] = [];
    for (const sheetName of wb.SheetNames) {
      const worksheet = wb.Sheets[sheetName];
      debugger;
      const data = xlsx.utils.sheet_to_txt(worksheet);
      // const pageContent = data.map((x) => JSON.stringify(x)).join('\n\n');
      docs.push(new Document({ id: sheetName, pageContent: data, metadata }));
    }
    return docs;
  }
}
