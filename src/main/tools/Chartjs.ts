import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, ToolParams } from '@langchain/core/tools';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { CallOptions } from '@langchain/langgraph/dist/pregel/types';
import { notificationManager } from '../app/NotificationManager';
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
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(arg, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }

  async stream(
    input: string | ToolCall | { [x: string]: any },
    options?: Partial<CallOptions>,
  ): Promise<IterableReadableStream<any>> {
    async function* generateStream() {
      const canvasNode = Function('return import("canvas")')();
      const { createCanvas } = await canvasNode;
      const canvas = createCanvas(800, 600);
      const ctx = canvas.getContext('2d');
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
      yield '';
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
