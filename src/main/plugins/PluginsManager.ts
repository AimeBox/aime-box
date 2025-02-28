import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { dbManager } from '../db';
import { Plugins } from '@/entity/Plugins';
import { pathToFileURL } from 'url';
import { toolsManager } from '../tools';
import { StructuredTool, Tool } from '@langchain/core/tools';
import exploresManager from '../explores';

export class PluginsManager {
  private plugins: Map<string, Plugins> = new Map();

  private pluginsRepository = dbManager.dataSource.getRepository(Plugins);

  public init() {
    this.pluginsRepository
      .find()
      .then((res) => {
        for (let index = 0; index < res.length; index++) {
          const plugin = res[index];
          this.plugins.set(plugin.id, plugin);
          if (plugin.isEnable) {
            this.loadPlugins(plugin.path);
          }
        }
        return null;
      })
      .catch((error) => {});

    if (!ipcMain) return;
    ipcMain.on('plugins:loadPlugins', async (event, input: string) => {
      event.returnValue = null;
    });
    ipcMain.on('plugins:reload', async (event) => {
      event.returnValue = null;
    });
    ipcMain.on('plugins:getList', async (event) => {
      event.returnValue = await this.pluginsRepository.find();
    });
    ipcMain.on('plugins:import', async (event, path: string) => {
      await this.import(path);
      event.returnValue = null;
    });
    ipcMain.on('plugins:delete', async (event, id: string) => {
      await this.delete(id);
      event.returnValue = null;
    });
    ipcMain.on(
      'plugins:setEnable',
      async (event, id: string, enable: boolean) => {
        if (enable) await this.enablePlugin(id);
        else await this.disablePlugin(id);
        event.returnValue = null;
      },
    );
  }

  public async import(directory: string) {
    try {
      const url = pathToFileURL(path.join(directory, 'index.js')).href;
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
      data.path = directory;
      data.isEnable = false;
      await this.pluginsRepository.save(data);
    } catch (e) {
      console.log(e);
    }
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

  public async loadPlugins(directory: string) {
    this.loadTool(directory);
    this.loadExplores(directory);
  }

  public async unloadPlugins(directory: string) {
    await this.unloadTool(directory);
    await exploresManager.unload(directory);
  }

  public async enablePlugin(id: string) {
    const plugin = await this.pluginsRepository.findOne({
      where: { id: id },
    });
    plugin.isEnable = true;
    this.loadPlugins(plugin.path);
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

    this.unloadPlugins(plugin.path);
    plugin.isEnable = false;
    await this.pluginsRepository.save(plugin);
    // if (plugin) {
    //   plugin.disable();
    // }
  }

  public unloadPlugin(name: string): void {
    const plugin = this.plugins.get(name);
    // if (plugin) {
    //   plugin.unload();
    //   this.plugins.delete(name);
    // }
  }

  public async delete(id: string) {
    await this.disablePlugin(id);
    await this.pluginsRepository.delete(id);
  }
}

export const pluginsManager = new PluginsManager();
