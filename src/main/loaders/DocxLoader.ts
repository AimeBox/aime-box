import { Document } from '@langchain/core/documents';
import { BufferLoader } from 'langchain/document_loaders/fs/buffer';
import * as cheerio from 'cheerio';

type DocxLoaderOptions = {
  type: 'docx' | 'doc';
};
/**
 * A class that extends the `BufferLoader` class. It represents a document
 * loader that loads documents from DOCX files.
 * It has a constructor that takes a `filePathOrBlob` parameter representing the path to the word
 * file or a Blob object, and an optional `options` parameter of type
 * `DocxLoaderOptions`
 */
export class DocxLoader extends BufferLoader {
  protected options: DocxLoaderOptions = { type: 'docx' };

  constructor(filePathOrBlob: string | Blob, options?: DocxLoaderOptions) {
    super(filePathOrBlob);
    if (options) {
      this.options = {
        ...options,
      };
    }
  }

  /**
   * A method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances. It
   * uses the `extractRawText` function from the `mammoth` module or
   * `extract` method from the `word-extractor` module to extract
   * the raw text content from the buffer. If the extracted text content is
   * empty, it returns an empty array. Otherwise, it creates a new
   * `Document` instance with the extracted text content and the provided
   * metadata, and returns it as an array.
   * @param raw The raw buffer from which to extract text content.
   * @param metadata The metadata to be associated with the created `Document` instance.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  public async parse(
    raw: Buffer,
    metadata: Document['metadata'],
  ): Promise<Document[]> {
    if (this.options.type === 'doc') {
      return this.parseDoc(raw, metadata);
    }
    return this.parseDocx(raw, metadata);
  }

  /**
   * A private method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances. It
   * uses the `extractRawText` function from the `mammoth` module to extract
   * the raw text content from the buffer. If the extracted text content is
   * empty, it returns an empty array. Otherwise, it creates a new
   * `Document` instance with the extracted text content and the provided
   * metadata, and returns it as an array.
   * @param raw The raw buffer from which to extract text content.
   * @param metadata The metadata to be associated with the created `Document` instance.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  private async parseDocx(
    raw: Buffer,
    metadata: Document['metadata'],
  ): Promise<Document[]> {
    if (this.options.type === 'doc') {
      return this.parseDoc(raw, metadata);
    }
    const { extractRawText, convertToHtml } = await DocxLoaderImports();
    const docx = await extractRawText({
      buffer: raw,
    });

    const html = await convertToHtml({
      buffer: raw,
    });
    // const md = new MarkdownIt();
    // const htmlContent = md.render(html.value);
    const text = this.htmlToTextPreserveTable(html.value);
    if (!docx.value) return [];

    return [
      new Document({
        pageContent: docx.value,
        metadata,
      }),
    ];
  }

  private htmlToTextPreserveTable(html: string): string {
    const $ = cheerio.load(html);

    // 暂存所有 table
    const tables: string[] = [];
    $('table').each((i, el) => {
      tables[i] = $.html(el); // 保留原始 HTML 表格
      $(el).replaceWith(`___TABLE_PLACEHOLDER_${i}___`);
    });

    // 移除所有 HTML 标签（表格已替换为占位符）
    const textOnly = $.text();

    // 恢复表格
    let finalText = textOnly;
    tables.forEach((tableHtml, i) => {
      finalText = finalText.replace(`___TABLE_PLACEHOLDER_${i}___`, tableHtml);
    });

    return finalText.trim();
  }

  /**
   * A private method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances. It
   * uses the `extract` method from the `word-extractor` module to extract
   * the raw text content from the buffer. If the extracted text content is
   * empty, it returns an empty array. Otherwise, it creates a new
   * `Document` instance with the extracted text content and the provided
   * metadata, and returns it as an array.
   * @param raw The raw buffer from which to extract text content.
   * @param metadata The metadata to be associated with the created `Document` instance.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  private async parseDoc(
    raw: Buffer,
    metadata: Document['metadata'],
  ): Promise<Document[]> {
    const WordExtractor = await DocLoaderImports();
    const extractor = new WordExtractor();
    const doc = await extractor.extract(raw);
    return [
      new Document({
        pageContent: doc.getBody(),
        metadata,
      }),
    ];
  }
}

async function DocxLoaderImports() {
  try {
    const { extractRawText, convertToHtml } = await import('mammoth');
    return { extractRawText, convertToHtml };
  } catch (e) {
    console.error(e);
    throw new Error(
      'Failed to load mammoth. Please install it with eg. `npm install mammoth`.',
    );
  }
}

async function DocLoaderImports() {
  try {
    const WordExtractor = await import('word-extractor');
    return WordExtractor.default;
  } catch (e) {
    console.error(e);
    throw new Error(
      'Failed to load word-extractor. Please install it with eg. `npm install word-extractor`.',
    );
  }
}
