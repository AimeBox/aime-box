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
import { KnowledgeBase } from '@/entity/KnowledgeBase';
import { KnowledgeBaseModal } from './KnowledgeBaseModal';

type GlobalContextProviderState = {
  tools: {
    //isOpen: boolean;
    open: (selectToolNames: string[]) => void;
    close: () => void;
    // selectedTools: ToolInfo[];
    // setSelectedTools: (tools: ToolInfo[]) => void;
    onSelect: (tools: ToolInfo[]) => void;
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
  knowledgeBase: {
    open: (kbIds: string[]) => void;
    close: () => void;
    onSelect: (kbs: KnowledgeBase[]) => void;
  };
};
const initialState = {
  tools: {
    open: (selectToolNames: string[]) => {},
    close: () => {},
    // selectedTools: [],
    // setSelectedTools: (tools: ToolInfo[]) => {},
    onSelect: (tools: ToolInfo[]) => {},
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
  knowledgeBase: {
    open: (kbIds: string[]) => {},
    close: () => {},
    onSelect: (kbs: KnowledgeBase[]) => {},
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
  const [isKnowledgeBaseModalOpen, setIsKnowledgeBaseModalOpen] =
    useState(false);
  const [promptsRole, setPromptsRole] = useState<string | undefined>(undefined);

  const [selectedTools, setSelectedTools] = useState<ToolInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<AgentInfo[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<
    KnowledgeBase[]
  >([]);
  //const [tools, setTools] = useState<ToolInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [api, contextHolder] = notification.useNotification();
  const [messageApi, messageContextHolder] = message.useMessage();

  // const onCancel = () => {
  //   setIsToolModalOpen(false);
  // };

  const value: GlobalContextProviderState = useMemo(
    () => ({
      tools: {
        open: async (selectToolNames: string[]) => {
          setIsToolModalOpen(true);
          const tools = await window.electron.tools.getList();
          const selected_tools = tools
            .filter((t) => !t.is_toolkit)
            .filter((x) => selectToolNames.includes(x.id));

          for (const toolkit of tools.filter((x) => x.is_toolkit)) {
            const selected_tools_toolkit = toolkit.tools.filter((x) =>
              selectToolNames.includes(x.id),
            );
            if (selected_tools_toolkit.length > 0) {
              selected_tools.push(...selected_tools_toolkit);
            }
          }

          setSelectedTools(selected_tools);
        },
        close: () => {
          setIsToolModalOpen(false);
        },
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
      knowledgeBase: {
        open: (kbIds: string[]) => {
          setIsKnowledgeBaseModalOpen(true);
          const res = window.electron.db.getMany<KnowledgeBase>(
            'knowledgebase',
            {},
          );
          setSelectedKnowledgeBases(res.filter((kb) => kbIds.includes(kb.id)));
        },
        close: () => {
          setIsKnowledgeBaseModalOpen(false);
        },
      },
    }),
    [selectedAgents, setPromptsRole],
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
    window.electron.ipcRenderer.on(
      'play-audio',
      (input: { filename: string }) => {
        const audio = new Audio(input.filename);
        audio.play();
      },
    );
    return () => {
      window.electron.ipcRenderer.removeAllListeners('app:notification');
      window.electron.ipcRenderer.removeAllListeners('play-audio');
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
        //tools={tools}
        destroyOnClose
        selectedTools={selectedTools}
        setSelectedTools={setSelectedTools}
        onCancel={() => setIsToolModalOpen(false)}
        // footer={null}
        onOk={(e) => {
          setIsToolModalOpen(false);
          value.tools.onSelect?.(selectedTools);
        }}
        // onChange={(items) => {
        //   setSelectedTools(items);
        // }}
      ></ToolsModal>
      <KnowledgeBaseModal
        zIndex={2000}
        open={isKnowledgeBaseModalOpen}
        destroyOnClose
        selectedKnowledgeBases={selectedKnowledgeBases}
        setSelectedKnowledgeBases={setSelectedKnowledgeBases}
        onOk={(e) => {
          setIsKnowledgeBaseModalOpen(false);
          value.knowledgeBase.onSelect?.(selectedKnowledgeBases);
        }}
        onCancel={() => setIsKnowledgeBaseModalOpen(false)}
      ></KnowledgeBaseModal>
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
