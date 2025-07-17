import { ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAI } from 'openai';

export class MoonshotProvider extends BaseProvider {
  name: string = ProviderType.MOONSHOT;

  description: string;

  defaultApiBase: string = 'https://api.moonshot.cn/v1';

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }

  async getCredits(): Promise<{
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
  }> {
    const options = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };

    const res = await fetch(
      `https://api.moonshot.cn/v1/users/me/balance`,
      options,
    );
    if (!res.ok) return undefined;

    const data = await res.json();
    if (data.code != 0) return undefined;
    return {
      totalCredits: undefined,
      usedCredits: undefined,
      remainingCredits: parseFloat(data.data.available_balance),
    };
  }
}
