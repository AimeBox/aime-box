import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { ImageLoader } from './ImageLoader';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { EPubLoader } from '@langchain/community/document_loaders/fs/epub';
import { ExcelLoader } from './ExcelLoader';
import { PDFLoader } from './PDFLoader';

export const getLoaderFromExt = (ext: string, value: string) => {
  switch (ext.toLowerCase()) {
    case '.txt':
      return new TextLoader(value);
    case '.pdf':
      return new PDFLoader(value);
    case '.docx':
      return new DocxLoader(value, { type: 'docx' });
    case '.doc':
      return new DocxLoader(value, { type: 'doc' });
    case '.png':
    case '.jpg':
    case '.jpeg':
      return new ImageLoader(value);
    case '.pptx':
      return new PPTXLoader(value);
    case '.json':
      return new JSONLoader(value);
    case '.epub':
      return new EPubLoader(value);
    case '.xlsx':
    case '.xls':
      return new ExcelLoader(value);
    default:
      return null;
  }
};
