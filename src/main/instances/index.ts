import { ipcMain } from "electron";
import { dbManager } from "../db";
import { Instances } from "../../entity/Instances";
import { Repository } from "typeorm";
import { channel } from "../ipc/IpcController";
import { BaseManager } from "../BaseManager";
import { v4 as uuidv4 } from 'uuid';


export class InstanceManager extends BaseManager {
  repository: Repository<Instances>;

  constructor() {
    super();
    this.repository = dbManager.dataSource.getRepository(Instances);    
  }

  public async init() {
    if (!ipcMain) return;
    this.registerIpcChannels();
  }
  @channel('instances:get')
  public async get(id: string) {
    return await this.repository.findOneBy({ id: id });
  }

  @channel('instances:getList')
  public async getList() {
    return await this.repository.find();
  }

  @channel('instances:create')
  public async createI(instance: Instances) {
    instance.id = uuidv4();
    return await this.repository.save(instance);
  }

  @channel('instances:update')
  public async update(id: string, instance: Instances) {
    const oldInstance = await this.repository.findOneBy({ id: id });
    if(!oldInstance) return;
    return await this.repository.save({...oldInstance, ...instance});
  }

  @channel('instances:delete')
  public async delete(id: string) {
    return await this.repository.delete(id);
  }

  @channel('instances:run')
  public async run(id: string) {
    const instance = await this.repository.findOneBy({ id: id });
    if(instance.type === 'browser'){
      
    }
  }
}

export const instanceManager = new InstanceManager();
