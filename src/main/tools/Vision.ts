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

export interface VisionParameters extends ToolParams {
  model: string;
}

export class Vision extends BaseTool {
  schema = z.object({
    fileOrUrl: z
      .string()
      .describe('file or url example: /path_to_folder/*.jpg'),
    prompt: z.string().describe('system prompt').optional(),
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
    let { fileOrUrl, prompt } = input;
    const { provider, modelName } = getProviderModel(this.model);
    const llm = await getChatModel(provider, modelName, { temperature: 0 });
    if (llm) {
      if (fs.statSync(fileOrUrl).isDirectory()) {
        fileOrUrl = path.join(fileOrUrl, '**/*.{jpg,jpeg,png}');
      }
      const files = await fg(fileOrUrl, {
        onlyFiles: true,
        caseSensitiveMatch: false,
      });

      const imageDescriptions = {};
      for (const fileOrUrl of files) {
        let imageBase64;
        if (isUrl(fileOrUrl)) {
          const image = await fetch(fileOrUrl);
          const imageBlob = await image.blob();
          const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
          imageBase64 = imageBuffer.toString('base64');
        } else if (existsSync(fileOrUrl)) {
          const image = await fsPromises.readFile(fileOrUrl);
          imageBase64 = image.toString('base64');
        }
        const msg = [];
        if (prompt) {
          msg.push(new SystemMessage(prompt));
        }
        if (imageBase64) {
          msg.push(
            new HumanMessage({
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
              ],
            }),
          );
        }
        const imageDescription = await llm.invoke(msg, {
          tags: ['ignore'],
        });
        imageDescriptions[fileOrUrl] = imageDescription.content.toString();
      }
      return Object.entries(imageDescriptions)
        .map(
          ([fileOrUrl, description]) =>
            `<img_description src="${fileOrUrl}">\n${description}\n</img_description>`,
        )
        .join('\n');
    } else {
      throw new Error('Model not found');
    }
  }
}
