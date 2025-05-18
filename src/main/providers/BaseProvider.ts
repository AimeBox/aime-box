import { Providers } from '@/entity/Providers';

export abstract class BaseProvider {
  abstract name: string;

  abstract description: string;

  abstract getModelList(
    connection: Providers,
  ): Promise<{ name: string; enable: boolean }[]>;
}
