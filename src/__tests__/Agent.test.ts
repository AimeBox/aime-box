import { dbManager } from '../main/db';
import { chatManager } from '../main/chat';
import { toolsManager } from '../main/tools';
import { agentManager } from '../main/agents';
import settingsManager from '../main/settings';
import { kbManager } from '../main/knowledgebase';

const main = async () => {
  await dbManager.init();
  await chatManager.init();
  await settingsManager.loadSettings();
  await kbManager.init();
  await toolsManager.init();
  await agentManager.init();
};

main();
