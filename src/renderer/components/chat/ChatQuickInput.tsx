import { cn } from '@/lib/utils';
import { Button } from 'antd';
import React, { HTMLAttributes, useState, useContext } from 'react';
import { GlobalContext } from '@/renderer/context/GlobalContext';
import { FaRegMessage, FaSignalMessenger } from 'react-icons/fa6';
import { t } from 'i18next';
import { Prompt } from '@/entity/Prompt';

export interface ChatQuickInputProps {
  className?: string;
  onClick: (input: string) => void;
}

const ChatQuickInput = React.forwardRef(
  (
    { className, onClick }: ChatQuickInputProps,
    ref: React.ForwardedRef<{ setValue: (value: string) => void }>,
  ) => {
    const [messages, setMessages] = useState<string[]>(['Hello ?']);
    const { prompts } = useContext(GlobalContext);

    return (
      <div className={cn(className, 'flex flex-row gap-2')}>
        {messages.map((message, index) => {
          return (
            <Button
              key={index}
              type="default"
              size="small"
              shape="round"
              onClick={() => onClick(message)}
            >
              {message}
            </Button>
          );
        })}
        <Button
          type="default"
          size="small"
          shape="round"
          icon={<FaRegMessage />}
          onClick={() => {
            prompts.open('user');
            prompts.onSelect = (prompt: Prompt) => {
              if (prompt) {
                onClick(prompt.content);
              }
            };
          }}
        >
          {t('chat.prompts')}
        </Button>
      </div>
    );
  },
);

export default ChatQuickInput;
