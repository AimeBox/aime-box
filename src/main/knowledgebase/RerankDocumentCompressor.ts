/* eslint-disable import/prefer-default-export */
import { BaseDocumentCompressor } from 'langchain/retrievers/document_compressors';
import type { DocumentInterface } from '@langchain/core/documents';
import { Callbacks } from '@langchain/core/callbacks/manager';
import { Transformers } from '../utils/transformers';

export default class RerankDocumentCompressor extends BaseDocumentCompressor {
  constructor() {
    super();
    Object.defineProperty(this, 'llmChain', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'getInput', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: defaultGetInput,
    });
    this.llmChain = llmChain;
    this.getInput = getInput;
  }

  /**
   * Compresses a list of documents based on the output of an LLM chain.
   * @param documents The list of documents to be compressed.
   * @param query The query to be used for document compression.
   * @returns A list of compressed documents.
   */
  async compressDocuments(
    documents: DocumentInterface[],
    query: string,
    callbacks?: Callbacks,
  ): Promise<DocumentInterface[]> {
    const res = await new Transformers({
      modelName: 'bge-reranker-large',
    }).rank(
      query,
      documents.map((x) => x.pageContent),
      { return_documents: true },
    );
    return res;
    // const compressedDocs = await Promise.all(
    //   documents.map(async (doc) => {
    //     const input = this.getInput(query, doc);
    //     const output = await this.llmChain.predict(input);
    //     return output.length > 0
    //       ? new Document({
    //           pageContent: output,
    //           metadata: doc.metadata,
    //         })
    //       : undefined;
    //   }),
    // );
    // return compressedDocs.filter((doc) => doc !== undefined);
  }

  /**
   * Creates a new instance of LLMChainExtractor from a given LLM, prompt
   * template, and getInput function.
   * @param llm The BaseLanguageModel instance used for document extraction.
   * @param prompt The PromptTemplate instance used for document extraction.
   * @param getInput A function used for constructing the chain input from the query and a Document.
   * @returns A new instance of LLMChainExtractor.
   */
  static fromLLM(llm, prompt, getInput) {
    const _prompt = prompt || getDefaultChainPrompt();
    const _getInput = getInput || defaultGetInput;
    const llmChain = new LLMChain({ llm, prompt: _prompt });
    return new LLMChainExtractor({ llmChain, getInput: _getInput });
  }
}
