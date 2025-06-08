import { BaseAgent } from '@/main/agents/BaseAgent';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { EditOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Divider,
  Dropdown,
  Input,
  message,
  Modal,
  Popconfirm,
  Tag,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  FaAngleDown,
  FaEdit,
  FaEllipsisH,
  FaInfo,
  FaPlus,
  FaSearch,
  FaTrash,
  FaTrashAlt,
} from 'react-icons/fa';
import { FaRegMessage } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import AgentConfigDrawer, { AgentConfigDrawerProps } from './AgentConfigDrawer';
import { ChatMode } from '@/types/chat';
import { AgentInfo } from '@/main/agents';
import { t } from 'i18next';
import FormModal, {
  FormModalRef,
} from '@/renderer/components/modals/FormModal';
import { FormSchema } from '@/types/form';
import { Markdown } from '@/renderer/components/common/Markdown';

export default function ChatContent() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentInfo>();
  const navigate = useNavigate();
  const [agentConfigDrawerOpen, setAgentConfigDrawerOpen] = useState(false);
  const [agentMermaidOpen, setAgentMermaidOpen] = useState(false);
  const modalRef = useRef<FormModalRef>(null);
  const remoteAgentModalRef = useRef<FormModalRef>(null);

  const onNewChat = async (mode: ChatMode, agentName: string) => {
    const chat = await window.electron.chat.create(mode, null, agentName);

    if (chat) {
      navigate(`/chat/${chat.id}?mode=${mode}`);
    }
  };
  const onOpenAgentConfigDrawer = (agent: any) => {
    setCurrentAgent(agent);
    setAgentConfigDrawerOpen(true);
  };

  const onAgentChange = async (agent: AgentInfo) => {
    setAgentConfigDrawerOpen(false);
    setCurrentAgent(undefined);
    message.success('success');
    const agents = await window.electron.agents.getList();
    setAgents(agents);
  };

  useEffect(() => {
    const agents = window.electron.agents.getList();
    setAgents(agents);
    console.log(agents);
  }, []);

  const remoteAgentSchemas = [
    {
      component: 'Select',
      field: 'type',
      label: t('agents.type'),
      required: true,
      componentProps: {
        options: [
          // { label: t('agents.type_anp'), value: 'anp' },
          { label: t('agents.type_a2a'), value: 'a2a' },
          { label: t('agents.type_dify'), value: 'dify' },
          { label: t('agents.type_coze'), value: 'coze' },
        ],
      },
    },
    {
      component: 'Input',
      field: 'baseUrl',
      label: t('agents.baseUrl'),
      required: true,
    },
    {
      component: 'Input',
      field: 'apiKey',
      label: t('agents.apiKey'),
      required: true,
      ifShow: ({ values }) => {
        return values.type == 'dify' || values.type == 'coze';
      },
    },
  ] as FormSchema[];

  const schemas = [
    {
      component: 'Input',
      field: 'name',
      label: t('agents.name'),
      required: true,
    },
    {
      component: 'InputTextArea',
      field: 'description',
      label: t('agents.description'),
      required: true,
    },
    {
      component: 'InputTextArea',
      field: 'prompt',
      label: t('agents.prompt'),
      required: true,
    },
    {
      component: 'ProviderSelect',
      field: 'model',
      label: t('agents.model'),
      componentProps: {
        type: 'llm',
      },
      required: true,
    },
    {
      component: 'Select',
      field: 'type',
      label: t('agents.type'),
      defaultValue: 'react',
      required: true,
      componentProps: {
        options: [
          { label: t('agents.type_react'), value: 'react' },
          { label: t('agents.type_supervisor'), value: 'supervisor' },
          // { label: t('agents.type.toolcall'), value: 'toolcall' },
        ],
      },
    },
    {
      component: 'ToolSelect',
      field: 'tools',
      label: t('agents.tools'),
    },
    {
      component: 'AgentSelect',
      field: 'agents',
      label: t('agents.agents'),

      ifShow: ({ values }) => {
        return values.type === 'supervisor';
      },
    },
    {
      component: 'Select',
      field: 'supervisorOutputMode',
      label: t('agents.supervisorOutputMode'),
      componentProps: {
        options: [
          {
            label: t('agents.supervisorOutputMode_last_message'),
            value: 'last_message',
          },
          {
            label: t('agents.supervisorOutputMode_full_history'),
            value: 'full_history',
          },
        ],
      },
      ifShow: ({ values }) => {
        return values.type === 'supervisor';
      },
    },
    {
      component: 'InputNumber',
      field: 'recursionLimit',
      defaultValue: 25,
      label: t('agents.recursionLimit'),
    },
  ] as FormSchema[];
  const onSave = async (values: any) => {
    try {
      if (currentAgent) {
        await window.electron.agents.update({
          id: currentAgent.id,
          ...values,
        });
      } else {
        await window.electron.agents.create(values);
      }
      message.success('success');
      modalRef.current.openModal(false);
      setAgents(await window.electron.agents.getList());
    } catch (error) {
      message.error(error.message);
    }
  };

  const onSaveRemoteAgent = async (values: any) => {
    await window.electron.agents.addRemoteAgent(values);
    message.success('success');
    remoteAgentModalRef.current.openModal(false);
    setAgents(await window.electron.agents.getList());
  };

  const onCreate = () => {
    setCurrentAgent(undefined);
    modalRef.current.openModal(true, undefined, t('common.create'));
  };

  const onDelete = async (agent: AgentInfo) => {
    await window.electron.agents.delete(agent.id);
    setAgents(await window.electron.agents.getList());
  };

  return (
    <>
      <FormModal
        maskClosable={false}
        formProps={{ layout: 'vertical' }}
        title={t('common.create')}
        ref={modalRef}
        schemas={schemas}
        onFinish={(values) => onSave(values)}
        onCancel={() => {
          modalRef.current.openModal(false);
        }}
      />
      <FormModal
        maskClosable={false}
        formProps={{ layout: 'vertical' }}
        title={t('common.add_remote_agent')}
        ref={remoteAgentModalRef}
        schemas={remoteAgentSchemas}
        onFinish={(values) => onSaveRemoteAgent(values)}
        onCancel={() => {
          remoteAgentModalRef.current.openModal(false);
        }}
      />
      <Modal
        open={agentMermaidOpen}
        onCancel={() => setAgentMermaidOpen(false)}
        footer={null}
      >
        <div className="flex justify-center w-full">
          <Markdown value={`\`\`\`mermaid\n${currentAgent?.mermaid}\n\`\`\``} />
        </div>
      </Modal>
      <ScrollArea className="p-4">
        <div className="flex flex-col gap-4">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div className="self-center text-xl font-semibold">
                {t('common.agents')}
              </div>
              <div className="flex-1 max-w-[300px] mx-8">
                <Input
                  prefix={<FaSearch></FaSearch>}
                  placeholder={t('common.search')}
                ></Input>
              </div>
              <div>
                <Dropdown.Button
                  icon={<FaAngleDown />}
                  menu={{
                    items: [
                      {
                        label: 'Add Remote Agent',
                        key: 'remoteAgent',
                        onClick: () => {
                          remoteAgentModalRef.current.openModal(true);
                        },
                      },
                      {
                        label: 'Add Coze Agent',
                        key: 'coze',
                      },
                      {
                        label: 'Add Dify Agent',
                        key: 'dify',
                      },
                      {
                        label: 'Import',
                        key: 'import',
                      },
                    ],
                  }}
                  onClick={() => onCreate()}
                >
                  <FaPlus></FaPlus>
                  {t('common.create')}
                </Dropdown.Button>
              </div>

              {/* <Button
                onClick={() => onCreate()}
                shape="round"
                variant="filled"
                type="primary"
              ></Button> */}
            </div>
          </div>
          {/* <Card
            className="flex justify-center items-center p-2 w-64 transition-all duration-300 cursor-pointer hover:bg-gray-100"
            onClick={() => onCreate()}
          >
            <strong className="text-lg">+ {t('common.create')}</strong>
          </Card> */}

          {agents.map((agent) => (
            <Card key={agent.name} styles={{ body: { padding: 16 } }}>
              <div className="flex justify-between items-center text-lg font-bold w-ftll">
                <strong className="flex-1">{agent.name}</strong>

                <div className="flex flex-row gap-1 ml-2">
                  <Button
                    icon={<FaRegMessage />}
                    type="text"
                    onClick={() => onNewChat('agent', agent.id)}
                  ></Button>
                  {agent.mermaid && (
                    <Button
                      icon={<FaInfo />}
                      type="text"
                      onClick={() => {
                        setCurrentAgent(agent);
                        setAgentMermaidOpen(true);
                      }}
                    ></Button>
                  )}
                  <Button
                    icon={<FaEdit />}
                    type="text"
                    onClick={() => {
                      if (agent.static) {
                        onOpenAgentConfigDrawer(agent);
                      } else {
                        setCurrentAgent(agent);
                        modalRef.current.openModal(
                          true,
                          {
                            ...agent,
                          },
                          t('common.edit'),
                        );
                      }
                    }}
                  ></Button>
                  {!agent.static && (
                    <Popconfirm
                      title={t('common.delete_confirm')}
                      onConfirm={() => {
                        onDelete(agent);
                      }}
                    >
                      <Button danger icon={<FaTrashAlt />} type="text"></Button>
                    </Popconfirm>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 whitespace-break-spaces">
                {agent.description}
              </div>
              <div className="mt-2">
                <Tag color={agent.type == 'built-in' ? 'purple' : 'blue'}>
                  {agent.type}
                </Tag>
                {(agent?.tools?.length ?? 0) > 0 && (
                  <Tag color="warning">Tools +{agent.tools.length}</Tag>
                )}
              </div>
              {agent.model && !agent.static && (
                <div className="mt-2">
                  <Tag>{agent.model}</Tag>
                </div>
              )}
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
