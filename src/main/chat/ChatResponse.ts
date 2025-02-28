import { DocumentInterface } from '@langchain/core/documents';

export interface ChatResponse {
  output: string;
  actions?: any[] | undefined;
  documents?: DocumentInterface<any>[] | undefined;
}
