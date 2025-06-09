import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { dbManager } from '../db';
import { Plugins } from '@/entity/Plugins';
import { pathToFileURL } from 'url';
import { toolsManager } from '../tools';
import { StructuredTool, Tool } from '@langchain/core/tools';
import exploresManager from '../explores';
import { BaseManager } from '../BaseManager';
import { channel } from '../ipc/IpcController';
import { notificationManager } from '../app/NotificationManager';

export class PluginsManager extends BaseManager {
  private plugins: Map<string, any> = new Map();

  private pluginsRepository = dbManager.dataSource.getRepository(Plugins);

  public async init() {
    this.pluginsRepository
      .find()
      .then((res) => {
        for (let index = 0; index < res.length; index++) {
          const plugin = res[index];
          // this.plugins.set(plugin.id, plugin);
          if (plugin.isEnable) {
            this.loadPlugins(plugin);
          }
        }
        return null;
      })
      .catch((error) => {});

    if (!ipcMain) return;
    this.registerIpcChannels();
  }

  @channel('plugins:getList')
  public async getList() {
    return await this.pluginsRepository.find();
  }

  @channel('plugins:create')
  public async create(input: any) {
    try {
      const directoryPath = input.directoryPath[0]
      const url = pathToFileURL(path.join(directoryPath, 'index.js')).href;
      const pluginModule = await Function(
        `return import("${url}?v=${Date.now()}")`,
      )();
      const metadata = pluginModule.default.metadata;
      const data = new Plugins();
      data.id = metadata.name;
      data.name = metadata.name;
      data.author = metadata.author;
      data.version = metadata.version;
      data.description = metadata.description;
      data.path = directoryPath;
      data.config = input.config;
      data.isEnable = false;
      await this.pluginsRepository.save(data);
      this.loadPlugins(data, pluginModule);
    } catch (e) {
      console.log(e);
    }
  }

  @channel('plugins:update')
  public async update(id:string,input: any) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });
    plugin.config = input.config
    await this.pluginsRepository.save(plugin);
  }

  @channel('plugins:reload')
  public async reload(id: string) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });

    const isEnable = plugin.isEnable;
    if (!isEnable) return;
    await this.unloadPlugin(plugin);
    if (isEnable) await this.loadPlugins(plugin);
  }

  @channel('plugins:setEnable')
  public async setEnable(id: string, isEnable: boolean) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });

    plugin.isEnable = isEnable;
    if (!isEnable) {
      await this.unloadPlugin(plugin);
    } else {

      const res = await this.loadPlugins(plugin);
      if(!res){
        throw new Error('Plugin init fail')
      }
    }
    await this.pluginsRepository.save(plugin);
  }

  public async loadTool(directory: string) {
    try {
      const url = pathToFileURL(path.join(directory, 'main.cjs')).href;
      const plugin = await import(/* webpackIgnore: true */ url);
      plugin.default.tools.forEach(async (t) => {
        try {
          const tool = t as StructuredTool;
          const lc_name = t.lc_name();
          //const p = Object.getPrototypeOf(t);
          await toolsManager.registerTool(t);
          console.log(`加载工具 ${tool.name} 成功`);
        } catch (e) {
          console.error(`加载工具 ${t.name} 失败`, e);
        }

        // toolsManager.registerTool(t);
      });
    } catch (e) {
      console.error(`加载工具 ${directory} 失败`, e);
    }
  }

  public async unloadTool(directory: string) {
    try {
      const url = pathToFileURL(path.join(directory, 'main.cjs')).href;
      const plugin = await import(/* webpackIgnore: true */ url);
      plugin.default.tools.forEach(async (t) => {
        const p = Object.getPrototypeOf(t);
        if (p.name == 'Tool' || p.name == 'StructuredTool') {
          await toolsManager.unregisterTool(t);
          console.log(`卸载工具 ${t.name} 成功`);
        }
        // toolsManager.registerTool(t);
      });
    } catch (e) {
      console.error(`卸载工具 ${directory} 失败`, e);
    }
  }

  public async loadExplores(directory: string) {
    //const files = fs.readdirSync(path.join(directory, 'renderer', 'explores'));
    try {
      await exploresManager.load(directory);
      // const url = pathToFileURL(path.join(directory, 'index.js')).href;
      // const plugin = await import(/* webpackIgnore: true */ url);
      // plugin.default.explores.forEach(async (t) => {
      //   await exploresManager.load(t);
      // });

      //const url = pathToFileURL(path.join(directory, 'index.js')).href;
      //const pluginModule = await Function(`return import("${url}")`)();

      // for (let index = 0; index < files.length; index++) {
      //   const file = files[index];
      //   if (file.endsWith('.tsx')) {
      //     const url = pathToFileURL(
      //       path.join(directory, 'renderer', 'explores', file),
      //     ).href;
      //     await exploresManager.load(
      //       path.join(directory, 'renderer', 'explores', file),
      //     );
      //     // const pluginModule = await Function(`return import("${url}")`)();
      //     // const keys = Object.keys(pluginModule);
      //     //   for (let index = 0; index < keys.length; index++) {
      //     //     //const m = pluginModule[keys[index]];
      //     //     //const p = Object.getPrototypeOf(m);

      //     //   }
      //     // }
      //   }
      // }
    } catch (e) {
      console.error(`加载工具 ${directory} 失败`, e);
    }
  }

  public async loadPlugins(plugin: Plugins, pluginModule?: any) {
    try {
      if (!pluginModule) {
        const url = pathToFileURL(path.join(plugin.path, 'index.js')).href;
        // const modulePath = require.resolve(path.join(plugin.path, 'index.js'));
        // const module = await import(modulePath);
        // const url = pathToFileURL(path.join(plugin.path, 'index.js')).href;
        pluginModule = await Function(
          `return import("${url}?v=${Date.now()}")`,
        )();
      }
      this.plugins[plugin.name] = pluginModule;
      await pluginModule.default.main(plugin.config);
      plugin.isEnable = true;
      await this.pluginsRepository.save(plugin);
      console.log(`Plugin "${plugin.name}:${plugin.version}" import success`);
      return true;
    } catch (err) {
      console.log(`Plugin "${plugin.name}:${plugin.version}" import fail`);
      notificationManager.sendNotification(err.message, 'error');
      await pluginModule.default.cleanUp();
      return false;
    }

    // this.loadTool(directory);
    // this.loadExplores(directory);
  }

  // public async unloadPlugins(directory: string) {
  //   const sss = require.cache;
  //   // await this.unloadTool(directory);
  //   // await exploresManager.unload(directory);
  // }

  public async enablePlugin(id: string) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });
    // plugin.isEnable = true;
    await this.loadPlugins(plugin);
    await this.pluginsRepository.save(plugin);
    // const plugin = this.plugins.get(name);
    // if (plugin) {
    //   plugin.enable();
    // }
  }

  public async disablePlugin(id: string) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });

    await this.unloadPlugin(plugin);
    plugin.isEnable = false;
    await this.pluginsRepository.save(plugin);
    // if (plugin) {
    //   plugin.disable();
    // }
  }

  public unloadPlugin(plugin: Plugins): void {

    const keys = Object.keys(this.plugins)


    if(keys.includes(plugin.name)){
      this.plugins[plugin.name].default.cleanUp();
      delete this.plugins[plugin.name];
    }
    

    // const plugin = this.plugins.get(name);
    // if (plugin) {
    //   plugin.unload();
    //   this.plugins.delete(name);
    // }
  }

  @channel('plugins:delete')
  public async delete(id: string) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });
    try{
      await this.unloadPlugin(plugin);
    } catch(err) {
      console.error(err)
    }
    
    await this.pluginsRepository.delete(id);
  }
}

export const pluginsManager = new PluginsManager();
