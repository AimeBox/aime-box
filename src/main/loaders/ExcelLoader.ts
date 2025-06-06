import { Document } from '@langchain/core/documents';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { getEnv } from '@langchain/core/utils/env';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

export class ExcelLoader extends BaseDocumentLoader {
  filePathOrBlob: string | Blob;
  maxRow?: number;
  constructor(filePathOrBlob: string | Blob, { maxRow = 15}) {
    super();
    this.filePathOrBlob = filePathOrBlob;
    this.maxRow = maxRow;
  }

  // async parse(raw: string): Promise<string[]> {
  //   return [raw];
  // }

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
      const row = worksheet['!rows'];
      
      const data = xlsx.utils.sheet_to_txt(worksheet);
      let pageContent = data;

      if(this.maxRow < 15){
        this.maxRow = 15;
      }

      if(this.maxRow && data.split('\n').length > this.maxRow){
        pageContent = data.split('\n').slice(0, 5).join('\n');
        pageContent += `\n\n...[the data is too large]...\n\n`;
        pageContent += data.split('\n').slice(data.split('\n').length - 5, data.split('\n').length).join('\n');
      }
      // debugger;
      // const pageContent = data.map((x) => JSON.stringify(x)).join('\n\n');
      docs.push(new Document({ id: sheetName, pageContent: pageContent, metadata }));
    }
    return docs;
  }
}
