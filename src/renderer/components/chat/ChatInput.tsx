import React, { useEffect, useState } from 'react';
import ProviderSelect from '../providers/ProviderSelect';
import { Button, Input, Popconfirm, Tag, Tooltip } from 'antd';
import {
  FaArrowCircleUp,
  FaArrowUp,
  FaPaperclip,
  FaPaperPlane,
  FaStop,
  FaTrashAlt,
} from 'react-icons/fa';
import ChatAttachment from './ChatAttachment';
import { FaGear } from 'react-icons/fa6';
import { t } from 'i18next';
import { ChatInputAttachment } from '@/types/chat';

export interface ChatInputProps {
  className?: string;
  onChat?: (text?: string, attachments?: ChatInputAttachment[]) => void;
  onCancel?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isRunning?: boolean;
  attachments: ChatInputAttachment[];
  onAttachmentsChanged?: (attachments: ChatInputAttachment[]) => void;
  submitIcon?: React.ReactNode;
  chatInputValue?: string;
}

const ChatInput = React.forwardRef((props: ChatInputProps, ref) => {
  const {
    className,
    header,
    footer,
    isRunning = false,
    attachments: initialAttachments = [],
    chatInputValue: initialChatInputValue = '',
  } = props;
  const [attachments, setAttachments] =
    useState<ChatInputAttachment[]>(initialAttachments);
  const [chatInputValue, setChatInputValue] = useState<string>(
    initialChatInputValue,
  );
  const onChat = () => {
    props.onChat?.(chatInputValue, attachments);
  };

  const onCancel = () => {
    props.onCancel?.();
  };

  useEffect(() => {
    setAttachments(initialAttachments);
    setChatInputValue(initialChatInputValue);
  }, [initialAttachments, initialChatInputValue]);

  const onDeleteAttachment = (attachment: ChatInputAttachment) => {
    const _attachments = attachments.filter((x) => x.path != attachment.path);
    setAttachments(_attachments);
    props.onAttachmentsChanged?.(_attachments);
  };

  return (
    <div className="p-4 h-full">
      <div className="flex flex-col gap-2 p-3 h-full bg-gray-100 rounded-2xl border border-gray-200 border-solid dark:border-none dark:bg-gray-600">
        {header}
        {attachments.length > 0 && (
          <div className="flex flex-row flex-wrap gap-2 w-full">
            {attachments.map((attachment) => (
              <ChatAttachment
                key={attachment.path}
                value={attachment}
                onDelete={() => onDeleteAttachment(attachment)}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col flex-1 gap-2 h-full">
          <div className="flex flex-col flex-1 h-full">
            <div className="flex-1 w-full h-full text-sm bg-transparent outline-none resize-none">
              <Input.TextArea
                id="chat-input"
                className="w-full !h-full !outline-none !shadow-none !bg-transparent dark:text-white"
                rows={1}
                value={chatInputValue}
                variant="borderless"
                placeholder="Type a message"
                onChange={(e) => {
                  setChatInputValue(e.target.value);
                }}
                onKeyPress={(e) => {
                  if (e.key == 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onChat();
                  }
                }}
              ></Input.TextArea>
            </div>
          </div>
        </div>
        <div className="flex flex-row justify-between items-center w-full">
          {/* <div className="flex gap-2 items-center">
            <Tooltip
              placement="top"
              title={
                <div className="flex flex-col">
                  <strong>{t('chat.tool')}</strong>
                  {currentChat?.options?.toolNames?.join(',')}
                </div>
              }
            >
              <Button
                className="flex flex-row items-center rounded-full"
                color={
                  currentChat?.options?.toolNames?.length > 0
                    ? 'primary'
                    : 'default'
                }
                variant={
                  currentChat?.options?.toolNames?.length > 0
                    ? 'filled'
                    : 'outlined'
                }
                onClick={() => {
                  tools.open(currentChat?.options?.toolNames || []);
                  tools.onSelect = (_tools) => {
                    onChatOptionsChanged({
                      toolNames: _tools.map((x) => x.name),
                    });
                  };
                }}
              >
                {t('chat.tool')}
                <Tag className="mr-0 rounded-full">
                  +{' '}
                  {currentChat?.options?.toolNames?.length > 0
                    ? currentChat?.options?.toolNames?.length
                    : 'add'}
                </Tag>
              </Button>
            </Tooltip>
            <Tooltip
              placement="top"
              title={
                <div className="flex flex-col">
                  <strong>{t('chat.knowledgebase')}</strong>
                  {currentChat?.options?.toolNames?.join(',')}
                </div>
              }
            >
              <Button
                className="flex flex-row items-center rounded-full"
                color={
                  currentChat?.options?.kbList?.length > 0
                    ? 'primary'
                    : 'default'
                }
                variant={
                  currentChat?.options?.kbList?.length > 0
                    ? 'filled'
                    : 'outlined'
                }
                onClick={() => {
                  knowledgeBase.open(currentChat?.options?.kbList || []);
                  knowledgeBase.onSelect = (kbs) => {
                    onChatOptionsChanged({
                      kbList: kbs.map((kb) => kb.id),
                    });
                  };
                }}
              >
                {t('chat.knowledgebase')}
                <Tag className="mr-0 rounded-full">
                  +{' '}
                  {currentChat?.options?.kbList?.length > 0
                    ? currentChat?.options?.kbList?.length
                    : 'add'}
                </Tag>
              </Button>
            </Tooltip>
            <Tooltip placement="top" title="Clear All Message">
              <Popconfirm
                title="Delete All Message?"
                onConfirm={onClearChatMessages}
                okText="Yes"
                cancelText={t('cancel')}
              >
                <Button icon={<FaTrashAlt />} type="text" />
              </Popconfirm>
            </Tooltip>
          </div> */}
          {footer || <div></div>}
          {isRunning && (
            <Button
              type="primary"
              icon={<FaStop />}
              onClick={() => {
                onCancel();
              }}
            />
          )}
          {!isRunning && (
            <Button
              type="primary"
              disabled={!chatInputValue?.trim()}
              icon={props.submitIcon || <FaArrowUp />}
              onClick={onChat}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
