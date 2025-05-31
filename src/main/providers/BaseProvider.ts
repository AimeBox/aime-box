import { Providers } from '@/entity/Providers';

export abstract class BaseProvider {
  abstract name: string;

  abstract description: string;

  abstract defaultApiBase?: string;

  abstract getModelList(
    provider: Providers,
  ): Promise<{ name: string; enable: boolean }[]>;

  getEmbeddingModels(provider: Providers) {
    return [];
  }
}
