import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { ImageLoader } from './ImageLoader';

export const getLoaderFromExt = (ext: string, value: string) => {
  switch (ext) {
    case '.txt':
      return new TextLoader(value);
    case '.pdf':
      return new PDFLoader(value);
    case '.docx':
    case '.doc':
      return new DocxLoader(value);
    case '.png':
    case '.jpg':
    case '.jpeg':
      return new ImageLoader(value);
    default:
      return null;
  }
};
