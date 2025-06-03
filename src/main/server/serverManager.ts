import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import settingsManager from '../settings';
import { ToolInfo, toolsManager } from '../tools';
import { agentManager } from '../agents';
import { isArray, isObject, isString } from '../utils/is';
import { appManager } from '../app/AppManager';
import { notificationManager } from '../app/NotificationManager';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import zodToJsonSchema from 'zod-to-json-schema';
import { supabase } from '../supabase/supabaseClient';

class ServerManager {
  app: express.Application;

  private server: Server;

  private httpServer?: ReturnType<express.Application['listen']>;

  private isRunning = false;

  constructor() {
    this.server = new Server(
      {
        name: 'aime-box-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
    this.registerTools(this.server);

    const transports: { [sessionId: string]: SSEServerTransport } = {};

    this.app = express();

    this.app.get('/auth/callback', async (req, res) => {
      const { code } = req.query;
      // 用 code 换取 supabase session
      await supabase.auth.exchangeCodeForSession(code);
      // 关闭窗口，通知主应用登录成功
    });

    //this.app.use(express.json());
    this.app.get('/sse', async (_: Request, res: Response) => {
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;

      res.on('close', () => {
        delete transports[transport.sessionId];
        console.log(`会话 ${transport.sessionId} 已关闭`);
      });

      console.log(`新会话已连接: ${transport.sessionId}`);
      await this.server.connect(transport);
    });

    // 设置消息处理端点
    this.app.post('/messages', async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];

      if (transport) {
        const resMsg = await transport.handlePostMessage(req, res);
        console.log(resMsg);
      } else {
        res.status(400).send('未找到对应的会话');
      }
    });

    
    this.app.post(`/tools/:tool_name`, async (req, res) => {
      const toolName = req.params.tool_name;
      const methodName = req.body.method;
      const toolInfo = toolsManager.tools.find((t) => t.name === toolName);
      let tool;
      if (!toolInfo) {
        const agent = agentManager.agents.find(
          (a) => a.agent.name === toolName,
        );
        if (!agent) {
          return res.status(404).json({ error: 'Tool or agent not found' });
        }
        tool = agent.agent;
      } else {
        tool = await toolsManager.buildTools([toolName]);
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

  registerTools(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = toolsManager.getList();

      const tools = toolList.map((x: ToolInfo) => {
        return {
          name: x.name,
          description: x.description,
          inputSchema: x.schema,
        };
      });
      return {
        tools: [...tools],
      };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!request.params.arguments) {
          throw new Error('Arguments are required');
        }
        const { name } = request.params;

        const tool = await toolsManager.buildTools([name]);
        const res = await tool[0].invoke(request.params.arguments);
        if (isArray(res)) {
          return { content: res };
        } else if (isObject(res) && 'content' in res) {
          return res;
        } else if (isString(res)) {
          return {
            content: [{ type: 'text', text: res }],
          };
        } else {
          throw new Error('Tool call output format error');
        }
      } catch (error) {
        throw new Error(error?.message || 'Tool call failed');
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
    if (this.isRunning) return;
    if (
      settingsManager.getSettings().serverEnable &&
      settingsManager.getSettings().serverPort
    ) {
      try {
        this.httpServer = this.app.listen(
          settingsManager.getSettings().serverPort,
          '127.0.0.1',
          () => {
            this.isRunning = true;
            console.log(
              `AIME HTTP Server running on port ${settingsManager.getSettings().serverPort}`,
            );
          },
        );
      } catch {
        this.isRunning = false;
        notificationManager.sendNotification(
          'AIME HTTP Server start failed',
          'error',
        );
      }
    } else {
      console.log('AIME HTTP Server is disabled');
    }
  }

  public restart() {
    this.close();
    this.start();
  }

  public close() {
    if (this.isRunning) {
      this.httpServer?.close();
      this.isRunning = false;
    }
  }
}
const serverManager = new ServerManager();

export default serverManager;
