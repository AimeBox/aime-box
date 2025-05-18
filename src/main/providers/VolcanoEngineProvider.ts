import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider } from './BaseProvider';
import settingsManager from '../settings';

export class VolcanoEngineProvider extends BaseProvider {
  name: string = ProviderType.VOLCANOENGINE;

  description: string;

  async getModelList(
    connection: Providers,
  ): Promise<{ name: string; enable: boolean }[]> {
    const httpProxy = settingsManager.getHttpAgent();
    const options = {
      method: 'GET',
      agent: httpProxy,
      Authorization: `Bearer ${connection.api_key}`,
    };
    const url = `${connection.api_base}/ListFoundationModels`;
    const res = await fetch(url, options);
    const data = await res.json();
    return data.models
      .map((x) => {
        return {
          name: x.name.split('/')[1],
          enable:
            connection.models?.find((z) => z.name == x.name.split('/')[1])
              ?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
