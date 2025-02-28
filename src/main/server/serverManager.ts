import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import express, { Application } from 'express';
import bodyParser from 'body-parser';
import settingsManager from '../settings';
import { toolsManager } from '../tools';
import { agentManager } from '../agents';
import { isObject } from '../utils/is';
class ServerManager {
  server: Application;

  private httpServer?: ReturnType<Application['listen']>;

  constructor() {
    this.server = express();

    this.server.use(bodyParser.json());
    this.server.post(`/tools/:tool_name`, async (req, res) => {
      const toolName = req.params.tool_name;
      const methodName = req.body.method;
      let tool = toolsManager.getTools().find((t) => t.name === toolName);

      if (!tool) {
        const agent = agentManager.agents.find(
          (a) => a.agent.name === toolName,
        );
        if (!agent) {
          return res.status(404).json({ error: 'Tool or agent not found' });
        }
        tool = agent.agent;
      }
      try {
        const result = await tool.invoke(req.body);
        if (isObject(result)) {
          return res.json(result);
        } else {
          return res.send(result);
        }
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
  }

  public async initServer() {
    ipcMain.handle('server:start', async (event: IpcMainInvokeEvent) => {
      await serverManager.init();
      return true;
    });
    ipcMain.handle('server:restart', async (event: IpcMainInvokeEvent) => {
      await serverManager.restart();
      return true;
    });
    ipcMain.handle('server:close', async (event: IpcMainInvokeEvent) => {
      await serverManager.close();
      return true;
    });
  }

  async init() {
    this.start();
    if (!ipcMain) return;
    await this.initServer();
  }

  public start() {
    if (
      settingsManager.getSettings().serverEnable &&
      settingsManager.getSettings().serverPort
    ) {
      this.httpServer = this.server.listen(
        settingsManager.getSettings().serverPort,
        '127.0.0.1',
        () => {
          console.log(
            `AIME HTTP Server running on port ${settingsManager.getSettings().serverPort}`,
          );
        },
      );
    } else {
      console.log('AIME HTTP Server is disabled');
    }
  }

  public restart() {
    this.close();
    this.start();
  }

  public close() {
    this.httpServer?.close();
  }
}
const serverManager = new ServerManager();

export default serverManager;
