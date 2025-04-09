import ChatQuickInput from '@/renderer/components/chat/ChatQuickInput';
import { Chat, ChatMessage } from '@/entity/Chat';
import ChatMessageBox from '@/renderer/components/chat/ChatMessageBox';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import {
  Alert,
  Button,
  Divider,
  Input,
  List,
  Popconfirm,
  Space,
  Splitter,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import {
  FaEdit,
  FaPaperclip,
  FaPaperPlane,
  FaStop,
  FaTrashAlt,
} from 'react-icons/fa';
import { FaGear } from 'react-icons/fa6';
import { Editor, EditorRef } from '@/renderer/components/common/Editor';
import { useEffect, useRef, useState } from 'react';
import { t } from 'i18next';
import DocumentView from '@/renderer/components/common/DocumentView';
import { isUrl } from '@/main/utils/is';
import Link from 'antd/es/typography/Link';
import { useLocation } from 'react-router-dom';
import { ChatInputAttachment } from '@/types/chat';
import ChatAttachment from '@/renderer/components/chat/ChatAttachment';

export default function ChatPlannerContent() {
  const location = useLocation();
  const [currentChat, setCurrentChat] = useState<
    (Chat & { status: string }) | undefined
  >(undefined);
  const [chatInputMessage, setChatInputMessage] = useState<string | undefined>(
    undefined,
  );
  const [currentModel, setCurrentModel] = useState<string | undefined>(
    undefined,
  );

  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorRef>(null);
  const onDelete = async (chatMessage: ChatMessage) => {};
  const onChangeCurrentModel = async (currentModel: string) => {
    await window.electron.db.update('chat', { model: currentModel } as any, {
      id: currentChat.id,
    });
    setCurrentModel(currentModel);
  };
  const onClearChatMessages = async () => {
    window.electron.db.delete('chat_message', {
      chatId: currentChat.id,
    });
    const res = await window.electron.chat.getChat(currentChat.id);
    setCurrentChat(res);
  };
  const onChat = async () => {
    if (!chatInputMessage?.trim()) {
      return;
    }

    window.electron.chat.chatResquest({
      chatId: currentChat.id,
      content: chatInputMessage.trim(),
      extend: { attachments: attachments },
    });
    editorRef.current?.clear();
    setAttachments([]);
  };
  const onCancel = async (chatId: string) => {
    window.electron.chat.cancel(chatId);
  };
  const handleChatFinish = async (chatMessage: ChatMessage) => {
    setCurrentChat((preChat) => {
      if (preChat?.id === chatMessage.chat.id) {
        getChat(chatMessage.chat.id);
        return preChat;
      }
      return preChat;
    });
  };

  const registerEvent = (id: string) => {
    const list = {
      [`chat:message-finish:${id}`]: handleChatFinish,
      // [`chat:message-stream:${id}`]: handleChatStream,
      // [`chat:message-changed:${id}`]: handleChatChanged,
    };
    Object.keys(list).forEach((eventId) => {
      if (window.electron.ipcRenderer.listenerCount(eventId) != 1) {
        window.electron.ipcRenderer.removeAllListeners(eventId);
        console.log(`已注册监听${eventId}`);
        window.electron.ipcRenderer.on(eventId, list[eventId]);
      }
    });
  };
  const getChat = async (id: string) => {
    let res = await window.electron.chat.getChat(id);
    console.log(res);
    if (!res.model) {
      const agent = await window.electron.db.get('agent', res.agent);
      console.log(agent);
      if (agent?.model) {
        await window.electron.db.update('chat', { model: agent.model } as any, {
          id: res.id,
        });
        res = await window.electron.chat.getChat(id);
      }
    }
    setCurrentModel(res.model);

    setCurrentChat((chat) => {
      registerEvent(res.id);
      return res;
    });
  };

  const updatePlanner = async (task: string) => {
    await window.electron.db.update(
      'chat_planner',
      { task },
      { id: currentChat.id },
    );
  };
  const onSelectFile = async () => {
    const res = await window.electron.app.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
    });

    if (res && res.length > 0) {
      const _attachments = [];
      for (const item of res) {
        if (attachments.find((x) => x.path == item.path)) {
          continue;
        }
        _attachments.push({
          path: item.path,
          name: item.name,
          type: item.type,
          ext: item.ext,
        });
      }

      setAttachments([...attachments, ..._attachments]);
    }
  };

  const onDeleteAttachment = async (attachment: ChatInputAttachment) => {
    setAttachments(attachments.filter((x) => x.path != attachment.path));
  };

  useEffect(() => {
    const id = location.pathname.split('/')[2];
    if (id) {
      getChat(id);
    } else {
      setCurrentChat(undefined);
      return () => {};
    }

    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-changed:${id}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-finish:${id}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-stream:${id}`,
      );
      console.log('已删除监听');
    };
  }, [location.pathname]);

  return (
    <Splitter className="flex flex-row h-full">
      <Splitter.Panel min={360}>
        <div className="flex flex-col gap-2 p-2 h-full">
          <strong>Task</strong>
          <Input.TextArea
            placeholder="Search"
            variant="filled"
            value={currentChat?.chatPlanner?.task}
            onChange={(e) => {
              updatePlanner(e.target.value);
            }}
          />
          <strong>Plans</strong>
          <ScrollArea className="flex-1 h-full">
            {currentChat?.chatPlanner?.plans && (
              <div className="mr-2">
                {currentChat?.chatPlanner?.plans.map((plan) => (
                  <div key={plan.title} className="flex flex-col gap-2 p-2">
                    <strong>{plan.title}</strong>
                    <small>{plan.thought}</small>
                    <List
                      itemLayout="horizontal"
                      bordered={false}
                      dataSource={plan.steps}
                      renderItem={(item, index) => (
                        <List.Item className="rounded-2xl border-none hover:bg-gray-50">
                          <List.Item.Meta
                            // avatar={
                            //   <Avatar
                            //     src={`https://api.dicebear.com/7.x/miniavs/svg?seed=${index}`}
                            //   />
                            // }
                            title={
                              <div className="flex flex-row gap-2 items-center px-2">
                                <Button
                                  icon={<FaTrashAlt />}
                                  type="text"
                                  danger
                                />
                              </div>
                            }
                            description={
                              <div className="flex flex-col gap-2 p-2">
                                <Input.TextArea
                                  className="text-sm text-gray-500"
                                  variant="filled"
                                  value={item.description}
                                />
                                <div>
                                  <small>{item.note}</small>
                                  <small>{item.status}</small>
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </Splitter.Panel>
      <Splitter.Panel min={220}>
        <Splitter
          layout="vertical"
          className="h-full"
          style={{
            height: '100%',
          }}
        >
          <Splitter.Panel min={400}>
            <div className="flex flex-col w-full h-full">
              <ScrollArea className="flex-1 h-full">
                <div className="">
                  {currentChat && (
                    <div className="flex flex-col py-8 w-full h-full">
                      <div className="pb-10">
                        {currentChat?.chatMessages?.map(
                          (chatMessage: ChatMessage) => {
                            return (
                              <ChatMessageBox
                                key={chatMessage.id}
                                onDeleted={() => onDelete(chatMessage)}
                                onChange={async (text, content) => {
                                  const res =
                                    await window.electron.chat.getChat(
                                      chatMessage.chatId,
                                    );
                                  setCurrentChat(res);
                                }}
                                value={chatMessage}
                              />
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </Splitter.Panel>
          <Splitter.Panel min={220} defaultSize={220}>
            <div className="flex flex-col gap-2 p-2 h-full">
              <div className="flex flex-row justify-between">
                <div>
                  <ProviderSelect
                    type="llm"
                    value={currentModel}
                    onChange={onChangeCurrentModel}
                    style={{ width: '200px' }}
                    className="mr-2"
                  />
                  <Button
                    icon={<FaPaperclip />}
                    type="text"
                    onClick={() => {
                      onSelectFile();
                    }}
                  ></Button>
                </div>
              </div>
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
              <div className="flex overflow-hidden flex-col flex-1 gap-2 p-2 h-full bg-gray-100 rounded-2xl dark:bg-gray-800">
                <div className="flex flex-col flex-1 h-full">
                  <ChatQuickInput
                    onClick={(text) => {
                      editorRef.current?.insertText(text);
                      setChatInputMessage(text);
                    }}
                    className="mb-1"
                  />
                  <ScrollArea className="flex-1 h-full rounded-xl border border-gray-300 border-solid dark:border-gray-700">
                    <Editor
                      ref={editorRef}
                      className={`flex-1 w-full h-full text-sm bg-transparent outline-none resize-none`}
                      value={chatInputMessage}
                      onChange={setChatInputMessage}
                    />
                  </ScrollArea>
                </div>
              </div>
              <div className="flex flex-row justify-between items-center w-full">
                <div className="flex gap-2 items-center">
                  <Tooltip placement="top" title={'Clear All Message'}>
                    <Popconfirm
                      title="Delete All Message?"
                      onConfirm={onClearChatMessages}
                      okText="Yes"
                      cancelText={t('cancel')}
                    >
                      <Button icon={<FaTrashAlt />} type="text" />
                    </Popconfirm>
                  </Tooltip>
                </div>
                {currentChat?.status == 'running' && (
                  <Button
                    type="primary"
                    icon={<FaStop />}
                    onClick={() => {
                      onCancel(currentChat.id);
                    }}
                  />
                )}
                {currentChat?.status != 'running' && (
                  <Button
                    type="primary"
                    disabled={!chatInputMessage?.trim()}
                    icon={<FaPaperPlane />}
                    onClick={onChat}
                  />
                )}
              </div>
            </div>
          </Splitter.Panel>
        </Splitter>
      </Splitter.Panel>
    </Splitter>
  );
}
