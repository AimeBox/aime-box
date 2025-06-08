import { Chat } from '@/entity/Chat';
import { Prompt, PromptGroup } from '@/entity/Prompt';
import { Repository, Not } from 'typeorm';
import { ipcMain } from 'electron';
import { dbManager } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { BaseManager } from '../BaseManager';
import { channel } from '../ipc/IpcController';

export class PromptsManager extends BaseManager {
  public promptsGroups: PromptGroup[] = [];

  promptsGroupRepository: Repository<PromptGroup>;

  promptsRepository: Repository<Prompt>;

  constructor() {
    super();
    this.promptsGroupRepository =
      dbManager.dataSource.getRepository(PromptGroup);
    this.promptsRepository = dbManager.dataSource.getRepository(Prompt);
  }

  public async init() {
    if (!ipcMain) return;
    this.registerIpcChannels();
    // ipcMain.handle(
    //   'prompts:createPrompt',
    //   (event, prompt: Prompt, groupId: string | undefined) =>
    //     this.createPrompt(prompt, groupId),
    // );
    // ipcMain.handle('prompts:updatePrompt', (event, prompt: Prompt) =>
    //   this.updatePrompt(prompt),
    // );
    // ipcMain.handle('prompts:deletePrompt', (event, promptId: string) =>
    //   this.deletePrompt(promptId),
    // );
    // ipcMain.handle('prompts:getGroups', (event) => this.getGroups());
    // ipcMain.handle(
    //   'prompts:getPrompts',
    //   (event, groupId: string | undefined, role: string | undefined) =>
    //     this.getPrompts(groupId, role),
    // );
    // ipcMain.handle('prompts:createGroup', (event, group: PromptGroup) =>
    //   this.createGroup(group),
    // );
    // ipcMain.handle('prompts:updateGroup', (event, group: PromptGroup) =>
    //   this.updateGroup(group),
    // );
    // ipcMain.handle('prompts:deleteGroup', (event, groupId) =>
    //   this.deleteGroup(groupId),
    // );
  }

  @channel('prompts:createPrompt')
  public async createPrompt(prompt: Prompt, groupId: string | undefined) {
    prompt.id = uuidv4();
    prompt.group = await this.promptsGroupRepository.findOne({
      where: { id: groupId },
    });
    prompt.timestamp = Date.now();
    const newPrompt = this.promptsRepository.create(prompt);
    const savedPrompt = await this.promptsRepository.save(newPrompt);
    return savedPrompt;
  }

  @channel('prompts:updatePrompt')
  public async updatePrompt(prompt: Prompt) {
    const updatedPrompt = await this.promptsRepository.update(
      prompt.id,
      prompt,
    );
    return updatedPrompt;
  }

  @channel('prompts:deletePrompt')
  public async deletePrompt(promptId: string) {
    const result = await this.promptsRepository.delete(promptId);
    return result.affected && result.affected > 0;
  }

  @channel('prompts:getGroups')
  public async getGroups() {
    const promptsGroups = await this.promptsGroupRepository.find();
    return promptsGroups;
  }

  @channel('prompts:getPrompts')
  public async getPrompts(
    groupId: string | undefined,
    role: string | undefined,
  ) {
    const where: any = {};
    if (groupId) {
      where.group = { id: groupId };
    }
    if (role) {
      where.role = role;
    }

    const prompts = await this.promptsRepository.find({
      where,
    });
    return prompts;
  }

  @channel('prompts:createGroup')
  public async createGroup(group: Partial<PromptGroup>) {
    // 检查是否存在同名组
    const existingGroup = await this.promptsGroupRepository.findOne({
      where: { name: group.name },
    });
    if (existingGroup) {
      throw new Error('组名已存在');
    }
    group.id = uuidv4();
    const newGroup = this.promptsGroupRepository.create(group);
    const savedGroup = await this.promptsGroupRepository.save(newGroup);
    return savedGroup;
  }

  @channel('prompts:updateGroup')
  public async updateGroup(group: Partial<PromptGroup>) {
    if (!group.id) {
      throw new Error('Group ID is required for update');
    }

    // 检查是否存在其他同名组
    const existingGroup = await this.promptsGroupRepository.findOne({
      where: { name: group.name, id: Not(group.id) },
    });
    if (existingGroup) {
      throw new Error('组名已存在');
    }

    await this.promptsGroupRepository.update(group.id, group);
    return await this.promptsGroupRepository.findOne({
      where: { id: group.id },
    });
  }

  @channel('prompts:deleteGroup')
  public async deleteGroup(groupId: number) {
    const result = await this.promptsGroupRepository.delete(groupId);
    return result.affected && result.affected > 0;
  }
}

const promptsManager = new PromptsManager();
export default promptsManager;
