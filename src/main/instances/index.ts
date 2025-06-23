import { ipcMain } from 'electron';
import { dbManager } from '../db';
import { Instances, InstanceType } from '../../entity/Instances';
import { Repository } from 'typeorm';
import { channel } from '../ipc/IpcController';
import { BaseManager } from '../BaseManager';
import { v4 as uuidv4 } from 'uuid';
import { BrowserInstance } from './BrowserInstance';
import { BaseInstance } from './BaseInstance';
import { notificationManager } from '../app/NotificationManager';
import path from 'path';
import { getDataPath } from '../utils/path';
import { chromePath } from 'chrome-paths';
import { getEdgePath } from 'edge-paths';

export interface InstanceInfo extends Instances {
  status: 'running' | 'stop';
}

export class InstanceManager extends BaseManager {
  repository: Repository<Instances>;

  instanceInfos: Map<string, InstanceInfo> = new Map();

  instances: Map<string, BaseInstance> = new Map();

  DEFAULT_BROWSER_INSTANCE_ID = 'default_browser';

  constructor() {
    super();
    this.repository = dbManager.dataSource.getRepository(Instances);
  }

  public async init() {
    if (!ipcMain) return;
    this.registerIpcChannels();
    await this.createDefaultInstance();
    const _instances = await this.repository.find();
    _instances.forEach((instance) => {
      this.instanceInfos.set(instance.id, { ...instance, status: 'stop' });
    });
  }

  async createDefaultInstance() {
    let instance = await this.repository.findOneBy({
      id: this.DEFAULT_BROWSER_INSTANCE_ID,
    });
    const userDataPath = path.join(
      getDataPath(),
      'instances',
      this.DEFAULT_BROWSER_INSTANCE_ID,
    );

    const executablePath = chromePath?.chrome || getEdgePath();
    if (!instance) {
      instance = new Instances(
        this.DEFAULT_BROWSER_INSTANCE_ID,
        'Default Browser',
        InstanceType.BROWSER,
        {
          executablePath: executablePath,
          userDataPath: userDataPath,
        },
      );
    }
    if (!instance?.config?.executablePath || !instance?.config?.userDataPath) {
      instance.config = {
        executablePath: executablePath,
        userDataPath: userDataPath,
      };
    }

    instance.static = true;

    await this.repository.save(instance);
  }

  @channel('instances:get')
  public async get(id: string) {
    return await this.repository.findOneBy({ id: id });
  }

  @channel('instances:getList')
  public async getList() {
    return Array.from(this.instanceInfos.values());
  }

  @channel('instances:create')
  public async create(instance: Instances) {
    instance.id = uuidv4();
    const _instance = await this.repository.save(instance);
    this.instanceInfos.set(_instance.id, { ..._instance, status: 'stop' });
    return _instance;
  }

  @channel('instances:update')
  public async update(id: string, instance: Instances) {
    const oldInstance = await this.repository.findOneBy({ id: id });
    if (!oldInstance) return;
    const _instance = await this.repository.save({
      ...oldInstance,
      ...instance,
    });
    this.instanceInfos.set(_instance.id, { ..._instance, status: 'stop' });
    // return _instance;
  }

  @channel('instances:delete')
  public async delete(id: string) {
    let instance = this.instances.get(id);
    if (instance) {
      await instance.stop();
    } else {
      const _instance = await this.repository.findOneBy({ id: id });
      instance = new BrowserInstance({ instances: _instance });
    }
    this.instances.delete(id);
    await instance.clear();

    await this.repository.delete(id);
    this.instanceInfos.delete(id);
  }

  @channel('instances:run')
  public async run(id: string): Promise<void> {
    const instance = await this.repository.findOneBy({ id: id });
    if (instance.type === 'browser') {
      try {
        const browserInstance = new BrowserInstance({ instances: instance });
        const browserContext = await browserInstance.run();
        this.instanceInfos.set(id, { ...instance, status: 'running' });
        this.instances.set(id, browserInstance);
        browserInstance.on('close', () => {
          this.instanceInfos.set(id, { ...instance, status: 'stop' });
          this.instances.delete(id);
        });
      } catch (err) {
        console.error(err);
        notificationManager.sendNotification(err.message, 'error');
      }
    }
  }

  @channel('instances:stop')
  public async stop(id: string) {
    const instance = this.instances.get(id);
    await instance?.stop();
  }

  public async getInstance(id: string) {
    let instance = this.instances.get(id);
    if (!instance) {
      await this.run(id);
      instance = this.instances.get(id);
      if (!instance) {
        throw new Error('instance start failed');
      }
    }
    return instance;
  }

  public async getBrowserInstance(id?: string): Promise<BrowserInstance> {
    return (await this.getInstance(
      id || this.DEFAULT_BROWSER_INSTANCE_ID,
    )) as BrowserInstance;
  }
}

export const instanceManager = new InstanceManager();
