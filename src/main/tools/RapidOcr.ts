import { Tool, ToolParams } from '@langchain/core/tools';
//import * as ort from 'onnxruntime-node';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  spawn,
} from 'child_process';
import { isArray, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs, { existsSync } from 'fs';
import { getModelsPath, getTmpPath } from '../utils/path';
import { BaseTool } from './BaseTool';
import Sharp from 'sharp';
import { convertPdfToImages } from '../utils/pdfUtil';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import providersManager from '../providers';
import { getChatModel } from '../llm';
import { getProviderModel } from '../utils/providerUtil';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { runCommand } from '../utils/exec';
import { Document } from '@langchain/core/documents';
import os from 'os';
import fg from 'fast-glob';

export interface RapidOcrToolParameters extends ToolParams {
  model: string;
  prompt: string;
}

interface TextBox {
  box: number[][];
  score: number;
}

interface OcrResult {
  text: string;
  confidence: number;
  textBoxes: Array<{
    box: number[][];
    text: string;
    confidence: number;
  }>;
}

export class RapidOcrTool extends BaseTool {
  schema = z.object({
    filePath: z.string().describe('the path of the image file'),
  });

  name: string = 'ocr';

  description: string = 'an ocr tool that accurately extracts text from images';

  configSchema?: FormSchema[] = [
    {
      field: 'model',
      component: 'ProviderSelect',
      label: t('common.model'),
      required: true,
      componentProps: {
        type: 'ocr',
      },
    },
    {
      field: 'prompt',
      component: 'InputTextArea',
      label: t('common.prompt'),
    },
  ];

  model?: string;

  prompt?: string;

  defaultPrompt: string = [
    'Below is the image of one page of a document. Just return the plain text representation of this document as if you were reading it naturally.',
    'ALL tables should be presented in HTML format.',
    'If there are images or figures in the page, present them as "<Image>(left,top),(right,bottom)</Image>", (left,top,right,bottom) are the coordinates of the top-left and bottom-right corners of the image or figure.',
    'Present all titles and headings as H1 headings.',
    'Do not hallucinate.',
  ].join('\n');

  // private keys: string[] = [];

  constructor(params?: RapidOcrToolParameters) {
    super(params);
    this.model = params?.model;
    if (!this.model && process.platform === 'win32') {
      this.model = 'RapidOCR-json_v0.2.0@local';
    }
    this.prompt = params?.prompt || this.defaultPrompt;
  }

  getImageBase64 = async (inputPath: string): Promise<string> => {
    const buffer = await Sharp(inputPath)
      .jpeg({ quality: 100 }) // 你可以调整质量
      .toBuffer();
    const image = await fs.promises.readFile(inputPath);
    // const imageBuffer = Buffer.from(await image.arrayBuffer());
    //const base64 = imageBuffer.toString('base64');
    const base64 = image.toString('base64');
    return base64;
  };

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const prompt = this.prompt;
    if (!(isString(input.filePath) || fs.statSync(input.filePath).isFile())) {
      throw new Error('Please provide a valid file path');
    }
    await this.checkModel();
    const ext = path.extname(input.filePath).toLowerCase();
    if (
      !(
        ext == '.jpg' ||
        ext == '.jpeg' ||
        ext == '.png' ||
        ext == '.bmp' ||
        ext == '.tiff' ||
        ext == '.webp' ||
        ext == '.pdf'
      )
    ) {
      throw new Error('extension not supported');
    }
    // if (ext == '.pdf') {
    //   const res = await convertPdfToImages(input.filePath, getTmpPath());
    //   if (res.length > 0) {
    //     const results = [];
    //     for (const image of res) {
    //       results.push(await this.winOcr(image));
    //     }
    //     const dir = path.dirname(res[0]);
    //     await fs.promises.rmdir(dir, { recursive: true });
    //     return results.join('\n\n');
    //   } else {
    //     throw new Error('Failed to convert pdf to images');
    //   }
    // }
    this.model = this.model || 'RapidOCR-json_v0.2.0@local';
    if (this.model.endsWith('@local')) {
      return (await this.runOcr(input.filePath))
        .map((x) => x.pageContent)
        .join('\n\n');
    } else {
      const { provider, modelName } = getProviderModel(this.model);
      const model = await getChatModel(provider, modelName);
      let imageBase64;
      if (existsSync(input.filePath)) {
        imageBase64 = await this.getImageBase64(input.filePath);
      }
      if (model) {
        const result = await model.invoke(
          [
            new SystemMessage(prompt),
            new HumanMessage({
              content: [
                // {
                //   type: 'text',
                //   text: prompt,
                // },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
              ],
            }),
          ],
          { tags: ['ignore'] },
        );
        return result.text;
      }
      return 'Provider not found';
    }
  }

  public async paddleOcr(filePaths: string[]): Promise<Document[]> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
    const tmpDirOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-output-'));
    for (const [index, filePath] of filePaths.entries()) {
      const fileExtension = path.extname(filePath);
      const fileName = path.basename(filePath);
      const tmpFilePath = path.join(
        tmpDir,
        index.toString().padStart(5, '0') + fileExtension,
      );

      await fs.promises.copyFile(filePath, tmpFilePath);
    }
    const res = await runCommand(
      `paddleocr pp_structurev3 -i "${tmpDir}" --save_path "${tmpDirOutput}" --device gpu`,
    );
    const files = await fg(
      path.join(tmpDirOutput, '*.md').replaceAll('\\', '/'),
      {
        onlyFiles: true,
        caseSensitiveMatch: false,
      },
    );
    const documents = [];
    for (const [index, file] of files.entries()) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const filtered = content
        .split('\n')
        .filter((line) => !/<img\s*[^>]*>/i.test(line))
        .join('\n');

      documents.push(
        new Document({
          pageContent: filtered,
          metadata: {
            source: file,
            page: index + 1,
          },
        }),
      );
    }
    await fs.promises.rm(tmpDir, { recursive: true });
    await fs.promises.rm(tmpDirOutput, { recursive: true });
    // await fs.promises.rm(tmpDir, { recursive: true });
    return documents;
  }

  public async runOcr(
    filePath: string,
    splitPage: boolean = true,
  ): Promise<Document[]> {
    const imageFiles = [];
    const documents = [];
    let isPdf = false;
    if (path.extname(filePath).toLowerCase() == '.pdf') {
      const res = await convertPdfToImages(filePath, getTmpPath());
      imageFiles.push(...res);
      isPdf = true;
    } else {
      imageFiles.push(filePath);
    }
    if (this.model.endsWith('@local')) {
      if (this.model.toLowerCase().startsWith('paddleocr')) {
        documents.push(...(await this.paddleOcr(imageFiles)));
      } else if (
        process.platform === 'win32' &&
        this.model.toLowerCase().startsWith('rapidocr')
      ) {
        try {
          for (const filePath of imageFiles) {
            try {
              const res = await this.rapidOCR(filePath);
              if (res.length > 0) {
                documents.push(
                  new Document({
                    pageContent: res,
                    metadata: {
                      source: filePath,
                    },
                  }),
                );
              }
            } catch (e) {
              console.error('OCR failed:', e);
            }
          }
          //return documents;
        } catch (err) {
          if (err.message) {
            throw err;
          }
          const out = iconv.decode(
            Buffer.from(err.stderr.length > 0 ? err.stderr : err.stdout),
            'cp936',
          );

          throw new Error(out.trim());
        }
      } else if (process.platform === 'darwin') {
        throw new Error('Unsupported platform');
      } else {
        throw new Error('Unsupported platform');
      }
    } else {
      const { provider, modelName } = getProviderModel(this.model);
      const model = await getChatModel(provider, modelName);
      for (const filePath of imageFiles) {
        let imageBase64;
        if (existsSync(filePath)) {
          imageBase64 = await this.getImageBase64(filePath);
        }
        if (model) {
          const result = await model.invoke(
            [
              new SystemMessage(this.prompt),
              new HumanMessage({
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                  },
                ],
              }),
            ],
            { tags: ['ignore'] },
          );
          if (modelName.toLowerCase().includes('ocrflux')) {
            let isJson = false;
            try {
              JSON.parse(result.text);
              isJson = true;
            } catch {}
            if (isJson) {
              documents.push(
                new Document({
                  pageContent: JSON.parse(result.text).natural_text,
                  metadata: {
                    source: filePath,
                  },
                }),
              );
            } else {
              documents.push(
                new Document({
                  pageContent: result.text,
                  metadata: {
                    source: filePath,
                  },
                }),
              );
            }
          }
        }
      }
    }
    if (isPdf) {
      const dir = path.dirname(imageFiles[0]);
      await fs.promises.rm(dir, { recursive: true });
    }
    return documents;
  }

  public async pdfOcr(
    filePath: string,
    splitPage: boolean = true,
  ): Promise<string | string[]> {
    const res = await convertPdfToImages(filePath, getTmpPath());
    if (res.length > 0) {
      const results = [];
      for (const image of res) {
        try {
          results.push(await this.runOcr(image));
        } catch (e) {
          console.error('OCR failed:', e);
        }
      }
      const dir = path.dirname(res[0]);
      await fs.promises.rmdir(dir, { recursive: true });
      if (splitPage) {
        return results;
      }
      return results.join('\n\n');
    } else {
      throw new Error('Failed to convert pdf to images');
    }
  }

  public async rapidOCR(imagePath: string) {
    if (isString(imagePath) || fs.statSync(imagePath).isFile()) {
      const json_res = (await new Promise((resolve, reject) => {
        const process = spawn('RapidOCR-json.exe', {
          cwd: path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'),
        });
        let output = null;
        process.stdin.write(
          `{"image_path": "${imagePath.replaceAll('\\', '/')}"}\n`,
        );
        process.stdout.on('data', (data) => {
          const text = data.toString();

          if (text.startsWith('{"code":')) {
            const j = JSON.parse(text);
            output = j;
            process.kill();
          }
          //process.kill();
        });

        process.stderr.on('data', (data) => {
          process.kill();
        });

        process.on('close', (code) => {
          if (output != null && output.code == 100) {
            resolve(output);
          } else {
            resolve(output);
          }
        });
      })) as any;
      if (json_res.code == 100) {
        return json_res.data.map((x) => x.text).join('');
      } else if (json_res.code == 101) {
        throw new Error(`Error: ${json_res.data}`);
      } else {
        return json_res.data;
      }
    } else {
      throw new Error('Please provide a valid file path');
    }
  }

  public async checkModel() {
    if (!this.model) throw new Error('model is not set');
    if (this.model.toLowerCase().endsWith('@local')) {
      if (this.model.toLowerCase().startsWith('paddleocr')) {
        const checkPaddleOcr = await runCommand(`paddleocr -v`);
        if (checkPaddleOcr.startsWith('paddleocr ')) {
          return;
        }
        throw new Error('paddleocr not found');
      } else if (this.model.toLowerCase().startsWith('rapidocr')) {
        if (process.platform === 'win32') {
          if (
            !fs.existsSync(
              path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'),
            )
          ) {
            throw new Error('rapidocr not found');
          }
        } else {
          throw new Error('Unsupported platform');
        }
      } else {
        throw new Error('model is not set');
      }
    }
  }
}
