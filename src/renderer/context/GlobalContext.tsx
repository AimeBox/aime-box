import {
  Button,
  Divider,
  Input,
  Menu,
  message,
  Modal,
  ModalProps,
  notification,
  Progress,
  Skeleton,
  Space,
} from 'antd';
import React, {
  createContext,
  ForwardedRef,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { ScrollArea } from '../components/ui/scroll-area';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ToolInfo } from '@/main/tools';
import { FaCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';
import { ToolsModal } from './ToolsModal';
import { AgentsModal } from './AgentsModal';
import { AgentInfo } from '@/main/agents';
import { NotificationMessage } from '@/types/notification';
import { HomeOutlined } from '@ant-design/icons';
import { PromptsModal } from './PromptsModal';
import { Prompt } from '@/entity/Prompt';

type GlobalContextProviderState = {
  tools: {
    //isOpen: boolean;
    open: (selectToolNames: string[]) => void;
    close: () => void;
    selectedTools: ToolInfo[];
    setSelectedTools: (tools: ToolInfo[]) => void;
  };
  agents: {
    //isOpen: boolean;
    open: (selectAgentNames: string[]) => void;
    close: () => void;
    selectedAgents: AgentInfo[];
    setSelectedAgents: (agents: AgentInfo[]) => void;
  };
  prompts: {
    open: (role: string) => void;
    close: () => void;
    onSelect: (prompt: Prompt) => void;
  };
};
const initialState = {
  tools: {
    open: (selectToolNames: string[]) => {},
    close: () => {},
    selectedTools: [],
    setSelectedTools: (tools: ToolInfo[]) => {},
  },
  agents: {
    open: (selectAgentNames: string[]) => {},
    close: () => {},
    selectedAgents: [],
    setSelectedAgents: (agents: AgentInfo[]) => {},
  },
  prompts: {
    open: (role: string) => {},
    close: () => {},
    onSelect: (prompt: Prompt) => {},
  },
  // isOpen: false,
  // openToolsModal: (selectToolNames: string[]) => Promise<void>,
  // closeToolsModal: () => {},
};

export const GlobalContext = createContext(initialState);

export interface GlobalContextProviderProps {
  children: React.ReactNode;
}
export function GlobalContextProvider({
  children,
}: GlobalContextProviderProps) {
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isPromptsModalOpen, setIsPromptsModalOpen] = useState(false);
  const [promptsRole, setPromptsRole] = useState<string | undefined>(undefined);

  const [selectedTools, setSelectedTools] = useState<ToolInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<AgentInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [api, contextHolder] = notification.useNotification();
  const [messageApi, messageContextHolder] = message.useMessage();

  // const onCancel = () => {
  //   setIsToolModalOpen(false);
  // };

  const value: GlobalContextProviderState = useMemo(
    () => ({
      tools: {
        //isOpen: isToolModalOpen,
        open: (selectToolNames: string[]) => {
          setIsToolModalOpen(true);
          const tools = window.electron.tools.getInfo();
          setTools(tools);
          setSelectedTools(
            tools.filter((t) => selectToolNames.includes(t.name)),
          );
        },
        close: () => {
          setIsToolModalOpen(false);
        },
        selectedTools,
        setSelectedTools,
      },
      agents: {
        //isOpen: isAgentModalOpen,
        open: (selectAgentNames: string[]) => {
          setIsAgentModalOpen(true);
          const agents = window.electron.agents.getList();
          setAgents(agents);
          setSelectedAgents(
            agents.filter((a) => selectAgentNames.includes(a.name)),
          );
        },
        close: () => {
          setIsAgentModalOpen(false);
        },
        selectedAgents,
        setSelectedAgents,
      },
      prompts: {
        open: (role: string) => {
          setIsPromptsModalOpen(true);
          setPromptsRole(role);
        },
        close: () => {
          setIsPromptsModalOpen(false);
        },
        onSelect: (prompt: Prompt) => {
          console.log(prompt);
        },
      },
    }),
    [selectedTools, selectedAgents, setPromptsRole],
  );

  useEffect(() => {
    window.electron.ipcRenderer.on(
      'app:notification',
      (input: {
        action: 'create' | 'update' | 'delete';
        data: NotificationMessage;
      }) => {
        if (input.action == 'create') {
          if (input.data.type == 'notification') {
            if (input.data.icon == 'success') {
              messageApi.success(input.data.title, input.data.duration);
            } else if (input.data.icon == 'error') {
              messageApi.error(input.data.title, input.data.duration);
            } else if (input.data.icon == 'info') {
              messageApi.info(input.data.title, input.data.duration);
            } else if (input.data.icon == 'warning') {
              messageApi.warning(input.data.title, input.data.duration);
            } else if (input.data.icon == 'loading') {
              messageApi.loading(input.data.title, input.data.duration);
            } else {
              messageApi.open({
                content: input.data.title,

                duration: input.data.duration,
              });
            }
          } else {
            api.open({
              key: input.data.id,
              message: <div className="font-semibold">{input.data.title}</div>,
              description:
                input.data.type == 'message' ? (
                  input.data.description
                ) : (
                  <div className="flex flex-col gap-1">
                    {input.data.description}
                    <Progress
                      percent={input.data.percent}
                      format={(percent, successPercent) =>
                        `${percent.toFixed(1)}%`
                      }
                    />
                  </div>
                ),
              duration: input.data.duration ?? 0,
              closable: input.data.type == 'message' || input.data.closeEnable,
              placement: 'bottomRight',
            });
          }
        } else if (input.action == 'update') {
          api.open({
            key: input.data.id,
            message: <div className="font-semibold">{input.data.title}</div>,
            description:
              input.data.type == 'message' ? (
                input.data.description
              ) : (
                <div className="flex flex-col gap-1">
                  {input.data.description}
                  <Progress
                    percent={input.data.percent}
                    format={(percent, successPercent) =>
                      `${percent.toFixed(1)}%`
                    }
                    status={input.data.error ? 'exception' : 'active'}
                  />
                </div>
              ),
            closable: input.data.type == 'message' || input.data.closeEnable,
            duration: input.data.duration ?? 0,
            placement: 'bottomRight',
          });
        } else if (input.action == 'delete') {
          api.destroy(input.data.id);
        }
      },
    );
    return () => {
      window.electron.ipcRenderer.removeAllListeners('app:notification');
    };
  }, []);

  return (
    <GlobalContext.Provider value={value}>
      {contextHolder}
      {messageContextHolder}

      {children}
      <ToolsModal
        zIndex={2000}
        open={isToolModalOpen}
        tools={tools}
        selectedTools={selectedTools}
        onCancel={() => setIsToolModalOpen(false)}
        footer={null}
        onChange={(items) => {
          setSelectedTools(items);
        }}
        setSelectedTools={setSelectedTools}
      ></ToolsModal>
      <AgentsModal
        zIndex={2000}
        open={isAgentModalOpen}
        agents={agents}
        selectedAgents={selectedAgents}
        onCancel={() => setIsAgentModalOpen(false)}
        footer={null}
        onChange={(items) => {
          setSelectedAgents(items);
        }}
        setSelectedAgents={setSelectedAgents}
      ></AgentsModal>
      <PromptsModal
        zIndex={2000}
        open={isPromptsModalOpen}
        destroyOnClose
        footer={null}
        role={promptsRole}
        onSelect={(prompt) => {
          setIsPromptsModalOpen(false);
          value.prompts.onSelect(prompt);
        }}
        onCancel={() => setIsPromptsModalOpen(false)}
      ></PromptsModal>
    </GlobalContext.Provider>
  );
}
