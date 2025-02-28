import { Tool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { WolframAlphaTool } from '@langchain/community/tools/wolframalpha';
export interface WeatherToolParameters extends ToolParams {
  localtion: string;
  unit: string;
}

export class WeatherTool extends Tool {
  static lc_name() {
    return 'WeatherTool';
  }

  localtion!: string;

  unit!: string;

  name: string;

  description: string;

  constructor(params?: WeatherToolParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'get_current_weather',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'Get the current weather in a given location',
    });
    Object.defineProperty(this, 'schema', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: z.object({
        localtion: z
          .string()
          .describe('The city and state, e.g. San Francisco, CA'),
        unit: z.enum(['celsius', 'fahrenheit']),
      }),
    });
    const { localtion, unit } = params ?? {};
    this.localtion = localtion;
    this.unit = unit || this.unit;
  }
  call(arg, callbacks) {
    return super.call(
      typeof arg === 'string' || !arg ? { input: arg } : arg,
      callbacks,
    );
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
