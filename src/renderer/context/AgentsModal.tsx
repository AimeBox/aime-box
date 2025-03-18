import {
  Button,
  Divider,
  Input,
  Menu,
  Modal,
  ModalProps,
  Skeleton,
  Space,
} from 'antd';
import React, { createContext, ForwardedRef, useState, useMemo } from 'react';
import { ScrollArea } from '../components/ui/scroll-area';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ToolInfo } from '@/main/tools';
import { FaCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';
import { AgentInfo } from '@/main/agents';

interface AgentsModalProps extends ModalProps {
  agents: AgentInfo[];
  selectedAgents: AgentInfo[];
  setSelectedAgents: (agents: AgentInfo[]) => void;
  onChange?: (agents: AgentInfo[]) => void;
}

interface AgentsModalPropsRef {}

export const AgentsModal = React.forwardRef(
  (props: AgentsModalProps, ref: ForwardedRef<AgentsModalPropsRef>) => {
    const {
      agents,
      selectedAgents = [],
      setSelectedAgents = (agents: AgentInfo[]) => {},
      onChange = (agents: AgentInfo[]) => {},
    } = props;

    const onSearch = (v) => {};

    const onSelect = (agent: AgentInfo) => {
      let _selectedAgents;
      if (selectedAgents.includes(agent)) {
        _selectedAgents = selectedAgents.filter((t) => t.name !== agent.name);
      } else {
        _selectedAgents = [...selectedAgents, agent];
      }
      setSelectedAgents(_selectedAgents);
      onChange(_selectedAgents);
    };

    return (
      <Modal title={t('agent.add_agent')} {...props}>
        <Space direction="vertical" className="w-full">
          <Input.Search
            placeholder="input search"
            enterButton
            onSearch={onSearch}
          />
          <div className="flex flex-row">
            <div className="w-[100px] border-solid border-gray-300 border-r pr-2">
              <Menu
                style={{ border: 'none' }}
                className="bg-transparent"
                defaultSelectedKeys={['all']}
                items={[
                  {
                    key: 'all',
                    label: <span>{t('agent.show_all')}</span>,
                    className: '!h-8 !flex !items-center',
                  },
                ]}
              />
            </div>
            <ScrollArea className="flex-1 pl-2 my-1 w-full">
              <div className="flex flex-col gap-1">
                {agents.map((agent) => {
                  return (
                    <Button
                      key={agent.name}
                      type="text"
                      className="flex flex-row gap-2 justify-between items-center h-16"
                      onClick={() => {
                        onSelect(agent);
                      }}
                    >
                      <div className="flex overflow-hidden flex-col flex-1 items-start whitespace-nowrap text-ellipsis">
                        <strong>{agent.name}</strong>
                        <small className="text-left text-gray-500 whitespace-break-spaces">
                          {agent.description}
                        </small>
                      </div>
                      <FaCheck
                        color="green"
                        className={`${selectedAgents.some((x) => x.name === agent.name) ? 'opacity-100' : 'opacity-0'}`}
                      />
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </Space>
      </Modal>
    );
  },
);
