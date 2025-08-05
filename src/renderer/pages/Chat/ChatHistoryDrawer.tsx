import { ChatMessage } from '@/entity/Chat';
import { CopyOutlined } from '@ant-design/icons';
import {
  Button,
  ConfigProvider,
  Divider,
  Drawer,
  DrawerProps,
  List,
  message,
  Tag,
} from 'antd';
import { t } from 'i18next';
import { useEffect, useState } from 'react';

export interface ChatHistoryDrawerProps extends DrawerProps {
  value?: any[];
  onChange?: (value: Record<string, any>) => void;
}

export default function ChatHistoryDrawer(props: ChatHistoryDrawerProps) {
  const { value, onChange } = props;
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    const messages = value?.map((item) => {
      return {
        id: item.kwargs.id,
        role: item.id[item.id.length - 1],
        content: Array.isArray(item.kwargs.content)
          ? item.kwargs.content
              .filter((x) => x.type === 'text')
              .map((x) => x.text)
              .join('\n')
          : item.kwargs.content,
        tool_calls: item?.kwargs?.tool_calls,
      };
    });
    setMessages(messages);
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
        title={t('chat.chat_history')}
        className="rounded-2xl shadow-lg"
        {...props}
      >
        <List
          dataSource={messages}
          renderItem={(item) => (
            <List.Item id={item.id} className="flex flex-col items-start">
              <div className="flex flex-row gap-2 items-center justify-between w-full mb-2">
                <Tag>{item.role}</Tag>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(item.content);
                    message.success(t('chat.copy_success'));
                  }}
                ></Button>
              </div>
              <div className="whitespace-pre-wrap break-all w-full">
                {item.content}
              </div>

              {item.tool_calls && item.tool_calls.length > 0 && (
                <div className="whitespace-pre-wrap break-all w-full">
                  {JSON.stringify(item.tool_calls, null, 2)}
                </div>
              )}
            </List.Item>
          )}
        ></List>
      </Drawer>
    </ConfigProvider>
  );
}
