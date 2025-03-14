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
  Popconfirm,
  Space,
  Splitter,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { FaPaperclip, FaPaperPlane, FaStop, FaTrashAlt } from 'react-icons/fa';
import { FaGear } from 'react-icons/fa6';
import { Editor, EditorRef } from '@/renderer/components/common/Editor';
import { useEffect, useRef, useState } from 'react';
import { t } from 'i18next';
import DocumentView from '@/renderer/components/common/DocumentView';
import { isUrl } from '@/main/utils/is';
import Link from 'antd/es/typography/Link';
import { useLocation } from 'react-router-dom';

export default function ChatManusContent() {
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
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [currentFileExt, setCurrentFileExt] = useState<string | undefined>(
    undefined,
  );
  const [currentFileTranscript, setCurrentFileTranscript] = useState<
    string | undefined
  >(undefined);
  const [currentFileSummary, setCurrentFileSummary] = useState<
    string | undefined
  >(undefined);
  const [currentFileUrl, setCurrentFileUrl] = useState<string | undefined>(
    undefined,
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorRef>(null);
  const onDelete = async (chatMessage: ChatMessage) => {};
  const onChangeCurrentModel = async (currentModel: string) => {};
  const onClearChatMessages = async () => {};
  const onChat = async () => {};
  const onCancel = async (chatId: string) => {
    window.electron.chat.cancel(chatId);
  };

  const registerEvent = (id: string) => {
    // const list = {
    //   [`chat:message-finish:${id}`]: handleChatFinish,
    //   [`chat:message-stream:${id}`]: handleChatStream,
    //   [`chat:message-changed:${id}`]: handleChatChanged,
    // };
    // Object.keys(list).forEach((eventId) => {
    //   if (window.electron.ipcRenderer.listenerCount(eventId) != 1) {
    //     window.electron.ipcRenderer.removeAllListeners(eventId);
    //     console.log(`已注册监听${eventId}`);
    //     window.electron.ipcRenderer.on(eventId, list[eventId]);
    //   }
    // });
  };
  const getChat = async (id: string) => {
    let res = await window.electron.chat.getChat(id);
    console.log(res);
    if (!res.model) {
      const defaultLLM = await window.electron.providers.getDefaultLLM();
      if (defaultLLM) {
        await window.electron.db.update('chat', { model: defaultLLM } as any, {
          id: res.id,
        });

        res = await window.electron.chat.getChat(id);
      }
    }
    setCurrentModel(res.model);

    setCurrentChat((chat) => {
      registerEvent(res.id);
      if (res.options && res.options.files && res.options.files.length > 0) {
        setCurrentFile(res.options.files[0].path);
        setCurrentFileExt(res.options.files[0].ext);
      } else {
        setCurrentFile(undefined);
        setCurrentFileExt(undefined);
      }
      return res;
    });
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
      <Splitter.Panel min={360}></Splitter.Panel>
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
                </div>
              </div>

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
