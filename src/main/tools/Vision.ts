import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import fs, { promises as fsPromises, existsSync } from 'fs';
import settingsManager from '../settings';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { getProviderModel } from '../utils/providerUtil';
import { getChatModel } from '../llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isUrl } from '../utils/is';
import { t } from 'i18next';
import fg from 'fast-glob';
import path from 'path';
import mime from 'mime-types';
import { saveFile } from '../utils/common';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import Sharp from 'sharp';

export interface VisionParameters extends ToolParams {
  model: string;
}

export class Vision extends BaseTool {
  schema = z.object({
    fileOrUrl: z
      .string()
      .describe('file or url example: /path_to_folder/*.jpg'),
    // prompt: z.string().describe('system prompt').optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'model',
      component: 'ProviderSelect',
      label: t('common.model'),
      componentProps: {
        type: 'llm',
      },
    },
  ];

  name: string = 'vision';

  description: string =
    'get me the image from the file or url and return the image description, support .jpg, .png, .jpeg';

  model?: string;

  constructor(params?: VisionParameters) {
    super();
    this.model = params?.model || settingsManager.getSettings().defaultVision;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { fileOrUrl } = input;
    let imageBase64;
    let imagePath;
    let message_part = {};
    let fileInfo = '';
    if (isUrl(fileOrUrl)) {
      // imagePath = await saveFile(
      //   fileOrUrl,
      //   path.join(getTmpPath(), 'image.jpg'),
      //   config,
      // );
      const image = await fetch(fileOrUrl);
      const imageBlob = await image.blob();
      const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
      imageBase64 = imageBuffer.toString('base64');
      const imagePath = await saveFile(imageBuffer, uuidv4(), config);
      const mimeType = mime.lookup(imagePath);
      message_part = {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
        },
      };
    } else if (existsSync(fileOrUrl)) {
      const mimeType = mime.lookup(fileOrUrl);
      if (mimeType.startsWith('image/')) {
        imagePath = fileOrUrl;
        const image = await fsPromises.readFile(fileOrUrl);
        imageBase64 = image.toString('base64');
        message_part = {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
          },
        };
        const { width, height, format } = await Sharp(fileOrUrl).metadata();
        imageBase64 = image.toString('base64');
        message_part = {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
          },
        };
        fileInfo = `Width: ${width}\nHeight: ${height}\nFormat: ${format}`;
      } else if (mimeType.startsWith('video/')) {
        imagePath = fileOrUrl;
        const image = await fsPromises.readFile(fileOrUrl);
        imageBase64 = image.toString('base64');
        message_part = {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
          },
        };
      } else if (mimeType.startsWith('audio/')) {
        const audio = await fsPromises.readFile(fileOrUrl);
        const audioBase64 = audio.toString('base64');
        message_part = {
          type: 'input_audio',
          input_audio: {
            data: `data:${mimeType};base64,${audioBase64}`,
            format: mimeType,
          },
        };
      }
    } else {
      throw new Error('file or url not found');
    }

    return [
      {
        type: 'text',
        text: `here is the image: ${fileOrUrl}
${fileInfo ? `MetaData: \n${fileInfo}` : ''}`,
      },
      message_part,
    ];

    // const { provider, modelName } = getProviderModel(this.model);
    // const llm = await getChatModel(provider, modelName, { temperature: 0 });
    // if (llm) {
    //   if (fs.statSync(fileOrUrl).isDirectory()) {
    //     fileOrUrl = path.join(fileOrUrl, '**/*.{jpg,jpeg,png}');
    //   }
    //   const files = await fg(fileOrUrl, {
    //     onlyFiles: true,
    //     caseSensitiveMatch: false,
    //   });

    //   const imageDescriptions = {};
    //   for (const fileOrUrl of files) {
    //     let imageBase64;
    //     if (isUrl(fileOrUrl)) {
    //       const image = await fetch(fileOrUrl);
    //       const imageBlob = await image.blob();
    //       const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
    //       imageBase64 = imageBuffer.toString('base64');
    //     } else if (existsSync(fileOrUrl)) {
    //       const image = await fsPromises.readFile(fileOrUrl);
    //       imageBase64 = image.toString('base64');
    //     }
    //     const msg = [];
    //     if (prompt) {
    //       msg.push(new SystemMessage(prompt));
    //     }
    //     if (imageBase64) {
    //       msg.push(
    //         new HumanMessage({
    //           content: [
    //             {
    //               type: 'image_url',
    //               image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    //             },
    //           ],
    //         }),
    //       );
    //     }
    //     const imageDescription = await llm.invoke(msg, {
    //       tags: ['ignore'],
    //     });
    //     imageDescriptions[fileOrUrl] = imageDescription.content.toString();
    //   }
    //   return Object.entries(imageDescriptions)
    //     .map(
    //       ([fileOrUrl, description]) =>
    //         `<img_description src="${fileOrUrl}">\n${description}\n</img_description>`,
    //     )
    //     .join('\n');
    // } else {
    //   throw new Error('Model not found');
    // }
  }
}
