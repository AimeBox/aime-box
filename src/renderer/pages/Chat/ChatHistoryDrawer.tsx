import { ChatMessage } from '@/entity/Chat';
import { Divider, Drawer, DrawerProps, Tag } from 'antd';
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
    <Drawer title={t('chat.chat_history')} {...props}>
      <div className="flex flex-col gap-2">
        {messages?.map((item) => (
          <div key={item.id}>
            <Tag>{item.role}</Tag>
            <div className="whitespace-pre-wrap break-all">{item.content}</div>

            {item.tool_calls && item.tool_calls.length > 0 && (
              <div className="whitespace-pre-wrap break-all">
                {JSON.stringify(item.tool_calls, null, 2)}
              </div>
            )}
            <Divider></Divider>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
