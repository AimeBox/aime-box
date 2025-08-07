import { ChatOptions } from '@/entity/Chat';
import { ToolInfo } from '@/main/tools';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import {
  Button,
  ConfigProvider,
  Divider,
  Drawer,
  DrawerProps,
  Form,
  Input,
  message,
  Slider,
  Switch,
  Tabs,
  TabsProps,
  Tag,
} from 'antd';
import { t } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { FaBook, FaTools, FaTrash, FaTrashAlt } from 'react-icons/fa';
import { GlobalContext } from '@/renderer/context/GlobalContext';
import BasicForm from '@/renderer/components/form/BasicForm';
import { FormSchema } from '@/types/form';
import { AgentInfo } from '@/main/agents';

export interface AgentConfigDrawerProps extends DrawerProps {
  value?: AgentInfo;

  onChange?: (value: Record<string, any>) => void;
}

export default function AgentConfigDrawer(props: AgentConfigDrawerProps) {
  const { value, onChange } = props;
  const [currentTab, setCurrentTab] = useState<string>('base');

  const [insideValue, setInsideValue] = useState<AgentInfo>(value);

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'base',
        label: t('agent.base_config'),
      },
    ],
    [],
  );

  const onFinish = async (config: Record<string, any>) => {
    const data = { ...value, config: config };
    try {
      await window.electron.agents.update(data);
      onChange?.(value);
    } catch (err) {
      message.error(err.message);
    }
  };

  useEffect(() => {}, []);

  useEffect(() => {
    setInsideValue(value);
  }, [value]);
  return (
    <ConfigProvider
      drawer={{
        classNames: {
          wrapper: 'p-4 !shadow-none',
        },
      }}
    >
      <Drawer
        title={value?.name}
        className="rounded-2xl shadow-lg"
        {...props}
        width={600}
        styles={{ body: { padding: 0 } }}
        maskClosable={false}
      >
        <div className="flex flex-col h-full">
          <div className="px-4">
            <Tabs
              items={items}
              onChange={setCurrentTab}
              activeKey={currentTab}
            />
          </div>
          <ScrollArea className="flex-1 p-4 h-full">
            {currentTab == 'base' && (
              <div>
                <BasicForm
                  layout="vertical"
                  value={value?.config}
                  schemas={value?.configSchema ?? []}
                  onFinish={onFinish}
                ></BasicForm>
              </div>
            )}
            {currentTab == 'pre_prompt' && <div></div>}
          </ScrollArea>
        </div>
      </Drawer>
    </ConfigProvider>
  );
}
