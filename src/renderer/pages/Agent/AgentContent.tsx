import { BaseAgent } from '@/main/agents/BaseAgent';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Divider } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { FaEdit, FaInfo } from 'react-icons/fa';
import { FaRegMessage } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import AgentConfigDrawer, { AgentConfigDrawerProps } from './AgentConfigDrawer';
import { ChatMode } from '@/types/chat';
import { AgentInfo } from '@/main/agents';

export default function ChatContent() {
  const [agents, setAgents] = useState<{ name: string; description: string }[]>(
    [],
  );
  const [currentAgent, setCurrentAgent] = useState<AgentInfo>();
  const navigate = useNavigate();
  const [agentConfigDrawerOpen, setAgentConfigDrawerOpen] = useState(false);
  const onNewChat = async (mode: ChatMode, agentName: string) => {
    const chat = await window.electron.chat.create(mode, null, agentName);

    if (chat) {
      navigate(`/chat/${chat.id}?mode=${mode}`);
    }
  };
  const onOpenAgentConfigDrawer = (agent: {
    name: string;
    description: string;
  }) => {
    setCurrentAgent(agent);
    setAgentConfigDrawerOpen(true);
  };

  const onAgentChange = async (agent: AgentInfo) => {
    const agents = await window.electron.agents.getList();
    setAgents(agents);
  };

  useEffect(() => {
    const agents = window.electron.agents.getList();
    setAgents(agents);
    console.log(agents);
  }, []);
  return (
    <>
      <ScrollArea className="p-4">
        <div className="flex flex-wrap gap-4">
          {agents.map((agent) => (
            <Card key={agent.name}>
              <div className="flex justify-between items-center text-lg font-bold">
                <strong className="flex-1">{agent.name}</strong>

                <div className="flex flex-row gap-1">
                  <Button
                    icon={<FaRegMessage />}
                    type="text"
                    onClick={() => onNewChat('agent', agent.name)}
                  ></Button>
                  <Button icon={<FaInfo />} type="text"></Button>
                  <Button
                    icon={<FaEdit />}
                    type="text"
                    onClick={() => onOpenAgentConfigDrawer(agent)}
                  ></Button>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {agent.description}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
      <AgentConfigDrawer
        open={agentConfigDrawerOpen}
        value={currentAgent}
        onChange={onAgentChange}
        onClose={() => {
          setAgentConfigDrawerOpen(false);
          setCurrentAgent(undefined);
        }}
      />
    </>
  );
}
