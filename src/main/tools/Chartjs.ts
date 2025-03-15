import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, ToolParams } from '@langchain/core/tools';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { CallOptions } from '@langchain/langgraph/dist/pregel/types';
import { notificationManager } from '../app/NotificationManager';
import { Transformers } from '../utils/transformers';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getModelsPath } from '../utils/path';
//import { createCanvas } from 'canvas';

export class ChartjsTool extends Tool {
  name: string;

  description: string;

  static lc_name() {
    return 'Chartjs';
  }

  constructor() {
    super();
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'chartjs',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'draw a chart',
    });
  }

  async _call(
    input: any,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }

  async stream(
    input: string,
    options?: Partial<CallOptions>,
  ): Promise<IterableReadableStream<any>> {
    async function* generateStream() {
      throw new Error('not implemented');
      const t = new Transformers({
        task: 'object-detection',
        modelName: 'doclayout_yolo',
      });
      const fileOrUrl = input.input;
      const output = await t.doclayout(fileOrUrl);
      const image_draw = sharp(fileOrUrl);
      const metadata = await image_draw.metadata();

      const { width, height } = metadata;

      const borderWidth = 2;
      const borderColor = '#ff0000';
      const draw = [
        ...output.map((item) => {
          const _item = {
            x1: Math.round(item.x1),
            y1: Math.round(item.y1),
            x2: Math.round(item.x2),
            y2: Math.round(item.y2),
            score: item.score,
            label: item.label,
            index: item.index,
          };
          return {
            input: Buffer.from(
              `<svg width="${_item.x2 - _item.x1}" height="${_item.y2 - _item.y1 + 20}">
            <rect x="0" y="0" width="${_item.x2 - _item.x1}" height="${_item.y2 - _item.y1}"
                  stroke="${borderColor}" stroke-width="${borderWidth}" fill="none" />
            <text x="5" y="${_item.y2 - _item.y1 + 15}" font-family="Arial" font-size="12" fill="${borderColor}">
            [${_item.index}] ${_item.label} (${(_item.score * 100).toFixed(1)}%)
            </text>
          </svg>`,
            ),
            top: Math.round(item.y1),
            left: Math.round(item.x1),
          };
        }),
      ];
      const outputImagePath = path.join(getModelsPath(), 'other', 'output.png');
      sharp(fileOrUrl)
        .composite(draw)
        .toBuffer()
        .then((outputBuffer) => {
          // 保存文件
          fs.writeFileSync(outputImagePath, outputBuffer);
          console.log('边框和文字已成功绘制，图片保存为:', outputImagePath);

          // 转换为base64并返回
          // const base64Image = `data:image/${metadata.format || 'png'};base64,${outputBuffer.toString('base64')}`;
          // resolve({
          //   result,
          //   base64Image,
          //   outputPath: outputImagePath,
          // });
          return base64Image; // 返回值以修复linter错误
        })
        .catch((err) => {
          console.error('处理图片时出错:', err);
          //reject(err);
          throw err; // 抛出错误以修复linter错误
        });

      yield output.base64Image;
      // const chartJSNodeCanvas = new ChartJSNodeCanvas({
      //   type: 'svg',
      //   width: 600,
      //   height: 800,
      //   backgroundColour: 'white',
      // });
      // const dataUrl = await chartJSNodeCanvas.renderToDataURL({
      //   type: 'bar',
      //   data: {
      //     labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
      //     datasets: [
      //       {
      //         label: 'My First dataset',
      //         backgroundColor: 'rgba(255, 99, 132, 0.2)',
      //         borderColor: 'rgba(255, 99, 132, 1)',
      //         hoverBackgroundColor: 'rgba(255, 99, 132, 0.4)',
      //         hoverBorderColor: 'rgba(255, 99, 132, 1)',
      //         data: [65, 59, 80, 81, 56, 55],
      //       },
      //     ],
      //   },
      //   options: {
      //     responsive: true,
      //     maintainAspectRatio: false,
      //     scales: {
      //       yAxes: [
      //         {
      //           ticks: {
      //             beginAtZero: true,
      //           },
      //         },
      //       ],
      //     },
      //   },
      // });
      //yield '';
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
