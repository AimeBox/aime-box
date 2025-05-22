import { BaseAgent } from "./BaseAgent";

export const getChatModel = (agent: BaseAgent) => {
  return agent.config.model;
};

