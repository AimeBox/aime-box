import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

interface Explore {
  name: string;
  icon: string;
  filePath: string;
}

export class ExploresManager {
  public explores: { name: string; explore: Explore; pluginCode: string }[];

  constructor() {
    this.explores = [];
    if (!ipcMain) return;

    ipcMain.on('explores:getList', async (event) => {
      event.returnValue = this.explores;
    });
  }

  public async unload(directory: string) {
    try {
      const main_url = pathToFileURL(path.join(directory, 'main.cjs')).href;
      const main_plugin = await import(/* webpackIgnore: true */ main_url);
      const explores = main_plugin.default.explores;
      explores.forEach((explore) => {
        this.explores = this.explores.filter(
          (item) => item.explore.name !== explore.name,
        );
      });
    } catch (e) {
      console.log(e);
    }
  }

  public async load(directory: string) {
    //const files = fs.readdirSync(path.join(directory, 'renderer', 'explores'));
    try {
      const renderer_url = pathToFileURL(
        path.join(directory, 'renderer.js'),
      ).href;
      // const renderer_plugin = await import(
      //   /* webpackIgnore: true */ renderer_url
      // );
      const main_url = pathToFileURL(path.join(directory, 'main.cjs')).href;
      const main_plugin = await import(/* webpackIgnore: true */ main_url);
      const explores = main_plugin.default.explores;
      // plugin.default.explores.forEach(async (t) => {
      //   await exploresManager.load(t);
      // });
      const pluginCode = await fs.promises.readFile(
        path.join(directory, 'renderer.js'),
        'utf-8',
      );

      // const explores = main_plugin.default.explores;
      explores.forEach((explore) => {
        this.explores.push({
          name: explore.name,
          explore: { name: explore.name, icon: '', filePath: directory },
          pluginCode: pluginCode,
        });
      });
    } catch (e) {
      console.log(e);
    }
  }
}

const exploresManager = new ExploresManager();
export default exploresManager;
