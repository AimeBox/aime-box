import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import settingsManager from '../settings';

export class VolcanoEngineProvider extends BaseProvider {
  name: string = ProviderType.VOLCANOENGINE;

  description: string;

  defaultApiBase: string = 'https://ark.cn-beijing.volces.com/api/v3';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const httpProxy = settingsManager.getHttpAgent();
    const options = {
      method: 'GET',
      agent: httpProxy,
      Authorization: `Bearer ${this.provider.api_key}`,
    };
    const url = `${this.provider.api_base || this.defaultApiBase}/ListFoundationModels`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data.models
      .map((x) => {
        return {
          name: x.name.split('/')[1],
          enable:
            this.provider.models?.find((z) => z.name == x.name.split('/')[1])
              ?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    return [];
  }
}
