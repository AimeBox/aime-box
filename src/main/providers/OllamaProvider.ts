import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider } from './BaseProvider';
import { Ollama } from 'ollama';

export class OllamaProvider extends BaseProvider {
  name: string = ProviderType.OLLAMA;

  description: string;

  defaultApiBase: string = 'http://localhost:11434';

  async getModelList(
    provider: Providers,
  ): Promise<{ name: string; enable: boolean }[]> {
    const ollama = new Ollama({
      host: provider.api_base || this.defaultApiBase,
    });
    const list = await ollama.list();
    return list.models
      .map((x) => {
        return {
          name: x.name,
          enable:
            provider.models.find((z) => z.name == x.name)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getEmbeddingModels(provider: Providers) {
    return [];
  }
}
