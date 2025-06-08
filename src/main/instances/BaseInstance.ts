import { Instances } from '@/entity/Instances';

export interface BaseInstanceParams {
  instances: Instances;
}

export abstract class BaseInstance {
  instances: Instances;

  constructor(params?: BaseInstanceParams) {
    this.instances = params?.instances;
  }

  stop = async () => {};
}
