import { Tool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseTool } from './BaseTool';

export interface WeatherToolParameters extends ToolParams {
  localtion: string;
  unit: string;
}

export class WeatherTool extends BaseTool {
  localtion!: string;

  unit!: string;

  name: string = 'get_current_weather';

  description: string = 'Get the current weather in a given location';

  schema = z.object({
    localtion: z
      .string()
      .describe('The city and state, e.g. San Francisco, CA'),
    unit: z.enum(['celsius', 'fahrenheit']),
  });

  constructor(params?: WeatherToolParameters) {
    super(params);

    const { localtion, unit } = params ?? {};
    this.localtion = localtion;
    this.unit = unit || this.unit;
  }

  async _call(input): Promise<string> {
    const { localtion, unit } = input;
    if (localtion.toLowerCase().includes('tokyo')) {
      return JSON.stringify({
        localtion: 'Tokyo',
        temperature: '10',
        unit: 'celsius',
      });
    }
    if (
      localtion.toLowerCase().includes('beijing') ||
      localtion.toLowerCase().includes('北京')
    ) {
      return JSON.stringify({
        localtion: 'beijing',
        temperature: '10',
        unit: 'celsius',
      });
    }
    if (
      localtion.toLowerCase().includes('guangzhou') ||
      localtion.toLowerCase().includes('广州')
    ) {
      return JSON.stringify({
        localtion: 'guangzhou',
        temperature: '20',
        unit: 'celsius',
      });
    }
    if (localtion.toLowerCase().includes('san francisco')) {
      return JSON.stringify({
        location: 'San Francisco',
        temperature: '72',
        unit: 'fahrenheit',
      });
    }
    if (localtion.toLowerCase().includes('paris')) {
      return JSON.stringify({
        localtion: 'Paris',
        temperature: '22',
        unit: 'celsius',
      });
    }
    return JSON.stringify({ localtion: localtion, temperature: 'unknown' });
  }
}
