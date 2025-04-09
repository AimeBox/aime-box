import { Chat, ChatMessage, ChatOptions } from '@/entity/Chat';
import ChatMessageBox from '@/renderer/components/chat/ChatMessageBox';
import ChatQuickInput from '@/renderer/components/chat/ChatQuickInput';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';
import {
  ScrollArea,
  ScrollAreaProps,
  ScrollAreaRef,
} from '@/renderer/components/ui/scroll-area';
import {
  Button,
  Input,
  message,
  Popconfirm,
  Popover,
  Splitter,
  Tag,
  Tooltip,
} from 'antd';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  FaAngleDown,
  FaAngleUp,
  FaEdit,
  FaEllipsisH,
  FaFile,
  FaPaperclip,
  FaPaperPlane,
  FaSeedling,
  FaSmile,
  FaStop,
  FaTrashAlt,
} from 'react-icons/fa';
import {
  FaFaceLaugh,
  FaFileExport,
  FaGear,
  FaRegFaceLaugh,
  FaTowerObservation,
} from 'react-icons/fa6';
import { useLocation } from 'react-router-dom';
import ChatOptionsDrawer from './ChatOptionsDrawer';
import { t } from 'i18next';
import EmojiPicker, { SkinTones } from 'emoji-picker-react';
import { GlobalContext } from '@/renderer/context/GlobalContext';
import { Editor, EditorRef } from '@/renderer/components/common/Editor';
import { ChatInputAttachment } from '@/types/chat';
import ChatAttachment from '@/renderer/components/chat/ChatAttachment';
import domtoimage from 'dom-to-image';
import { ChatInfo } from '@/main/chat';

export default function ChatContent() {
  const location = useLocation();
  const [emojiOpen, setEmojiOpen] = useState<boolean>(false);
  const [currentChat, setCurrentChat] = useState<ChatInfo | undefined>(
    undefined,
  );
  const [openChatOptionsDrawer, setOpenChatOptionsDrawer] =
    useState<boolean>(false);
  const [currentModel, setCurrentModel] = useState<string | undefined>(
    undefined,
  );
  const [chatInputMessage, setChatInputMessage] = useState<string | undefined>(
    undefined,
  );
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);
  const { agents, tools, knowledgeBase } = useContext(GlobalContext);
  const scrollRef = useRef<ScrollAreaRef | null>(null);
  const editorRef = useRef<EditorRef>(null);
  const registerEvent = (id: string) => {
    const list = {
      [`chat:message-finish:${id}`]: handleChatFinish,
      [`chat:message-stream:${id}`]: handleChatStream,
      [`chat:message-changed:${id}`]: handleChatChanged,
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
      if (res.mode == 'agent' || res.mode == 'supervisor') {
        const agent = await window.electron.db.get('agent', res.agent);
        console.log(agent);
        if (agent?.model) {
          await window.electron.db.update(
            'chat',
            { model: agent.model } as any,
            {
              id: res.id,
            },
          );
          res = await window.electron.chat.getChat(id);
        }
      } else if (res.mode == 'default') {
        const defaultLLM = await window.electron.providers.getDefaultLLM();
        if (defaultLLM) {
          await window.electron.db.update(
            'chat',
            { model: defaultLLM } as any,
            {
              id: res.id,
            },
          );

          res = await window.electron.chat.getChat(id);
        }
      }
    }
    setCurrentModel(res.model);
    setCurrentChat((chat) => {
      registerEvent(res.id);

      return res;
    });
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
    scrollToBottom(false);
  };

  const onCancel = async (chatId: string) => {
    window.electron.chat.cancel(chatId);
  };
  async function handleChatChanged(chatMessage: ChatMessage) {
    setCurrentChat((preChat) => {
      if (preChat?.id === chatMessage.chat.id) {
        getChat(chatMessage.chat.id);
        return preChat;
      }
      return preChat;
    });
  }

  const scrollToBottom = useCallback((onlyIsBottom = false) => {
    setTimeout(() => scrollRef.current?.scrollBottom(onlyIsBottom), 500);
  }, []);

  const handleChatStream = async (stream) => {
    setCurrentChat((preChat) => {
      if (preChat?.id === stream.chatId) {
        const index = preChat.chatMessages.findIndex(
          (x) => x.id == stream.chatMessageId,
        );
        if (index >= 0) {
          preChat.chatMessages[index].content = [
            { type: 'text', text: stream.content },
          ];

          const r = { ...preChat, chatMessages: [...preChat.chatMessages] };
          scrollToBottom(true);
          return r;
        }

        return preChat;
      }
      return preChat;
    });
  };

  const onChangeCurrentModel = async (currentModel: string) => {
    await window.electron.db.update('chat', { model: currentModel } as any, {
      id: currentChat.id,
    });
    setCurrentModel(currentModel);
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

  const handleChangedTitle = async () => {
    await window.electron.chat.update(
      currentChat.id,
      currentChat.title,
      currentModel,
      { options: currentChat.options },
    );

    // await window.electron.db.update(
    //   'chat',
    //   { title: currentChat.title } as any,
    //   {
    //     id: currentChat.id,
    //   },
    // );
  };

  useEffect(() => {
    const id = location.pathname.split('/')[2];
    if (id) {
      getChat(id);
      scrollToBottom();
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

  const onDelete = async (chatMessage: ChatMessage) => {
    const res = await window.electron.chat.getChat(chatMessage.chatId);
    setCurrentChat(res);
  };
  const onClearChatMessages = async () => {
    window.electron.db.delete('chat_message', {
      chatId: currentChat.id,
    });
    const res = await window.electron.chat.getChat(currentChat.id);
    setCurrentChat(res);
  };

  const onChatOptionsChanged = async (value: Record<string, any>) => {
    if (currentChat) {
      console.log(currentChat);
      const options = { ...currentChat.options, ...value };
      await window.electron.db.update('chat', { options } as any, {
        id: currentChat.id,
      });
      setCurrentChat({ ...currentChat, options: options });
      console.log(options);
    }
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

  const onExport = async () => {};
  const onExportImage = async () => {
    try {
      const dataUrl = await domtoimage.toJpeg(
        document.querySelector('#chat-content'),
        {
          bgcolor: '#ffffff',
        },
      );
      await window.electron.chat.export('image', currentChat.id, {
        image: dataUrl,
      });
    } catch (err) {
      message.error('Export image failed');
      console.error(err);
    }
  };
  const onSetDivider = async (chatMessage: ChatMessage, value: boolean) => {
    await window.electron.db.update(
      'chat_message',
      {
        divider: value,
      } as any,
      {
        id: chatMessage.id,
      },
    );
    const res = await window.electron.chat.getChat(currentChat.id);
    setCurrentChat(res);
  };

  const onDeleteAttachment = async (attachment: ChatInputAttachment) => {
    setAttachments(attachments.filter((x) => x.path != attachment.path));
  };

  return (
    <div className="h-full">
      {currentChat && (
        <Splitter
          layout="vertical"
          className="h-full"
          style={{
            height: '100%',
          }}
        >
          <Splitter.Panel min={400}>
            <div className="flex flex-col w-full h-full">
              <div className="w-full border-b border-gray-200">
                <div className="flex flex-row flex-1 justify-between items-center p-2 w-full text-lg font-semibold">
                  <div className="flex flex-col flex-1">
                    <Input
                      value={currentChat.title}
                      onChange={(e) => {
                        setCurrentChat({
                          ...currentChat,
                          title: e.target.value,
                        });
                      }}
                      size="large"
                      variant="borderless"
                      className="flex-1 w-full text-lg"
                      onBlur={handleChangedTitle}
                    />
                    <small className="flex flex-row gap-2 ml-3 text-xs text-gray-400">
                      {currentChat.id}
                      <span>token: {currentChat.totalToken}</span>
                      <span className="flex flex-row items-center">
                        <FaAngleUp /> {currentChat.inputToken}
                      </span>
                      <span className="flex flex-row items-center">
                        <FaAngleDown /> {currentChat.outputToken}
                      </span>
                    </small>
                  </div>

                  <div className="">
                    <Popover
                      placement="bottomRight"
                      trigger="click"
                      content={
                        <div className="flex flex-col w-full">
                          {/* <Button
                            icon={<FaFileExport />}
                            type="text"
                            block
                            onClick={() => {
                              onExport();
                            }}
                          >
                            {t('chat.export')}
                          </Button> */}
                          <Button
                            icon={<FaFileExport />}
                            type="text"
                            block
                            onClick={() => {
                              onExportImage();
                            }}
                          >
                            {t('chat.export_image')}
                          </Button>
                        </div>
                      }
                    >
                      <Button icon={<FaEllipsisH />} type="text" />
                    </Popover>
                  </div>
                </div>
              </div>
              <ScrollArea
                className="flex-1 h-full"
                ref={scrollRef}
                showScrollBottom
              >
                <div className="" id="chat-content">
                  {currentChat && (
                    <div className="flex flex-col py-8 w-full h-full">
                      <div className="pb-10">
                        {currentChat?.chatMessages?.map(
                          (chatMessage: ChatMessage) => {
                            return (
                              <ChatMessageBox
                                key={chatMessage.id}
                                // onRedo={() => onRedo(chatMessage)}
                                onDeleted={() => onDelete(chatMessage)}
                                onSetDivider={(v) =>
                                  onSetDivider(chatMessage, v)
                                }
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
                  <Popconfirm
                    icon={null}
                    open={emojiOpen}
                    onOpenChange={setEmojiOpen}
                    title={
                      <EmojiPicker
                        className="!border-none"
                        onEmojiClick={(v) => {
                          editorRef.current?.insertText(v.emoji);
                          setEmojiOpen(false);
                        }}
                      />
                    }
                    onConfirm={() => {}}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button
                      icon={<FaRegFaceLaugh />}
                      type="text"
                      onClick={() => {
                        setEmojiOpen(!emojiOpen);
                      }}
                    />
                  </Popconfirm>

                  <Button
                    icon={<FaPaperclip />}
                    type="text"
                    onClick={() => {
                      onSelectFile();
                    }}
                  ></Button>
                </div>

                {!currentChat.agent && (
                  <div>
                    <Button
                      icon={<FaGear />}
                      type="text"
                      onClick={() => {
                        setOpenChatOptionsDrawer(true);
                      }}
                    />
                  </div>
                )}
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

                  {/* <textarea
                    id="chat-textarea"
                    className={`flex-1 w-full h-full text-sm bg-transparent outline-none resize-none custom-scrollbar`}
                    placeholder="Send a message"
                    rows={1}
                    value={chatInputMessage}
                    onChange={async (e) => {
                      setChatInputMessage(e.target.value);
                    }}
                    style={{
                      minHeight: '50px',
                      overflowY: 'auto',
                    }}
                  /> */}
                </div>
              </div>
              <div className="flex flex-row justify-between items-center w-full">
                <div className="flex gap-2 items-center">
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
                      onClick={() =>
                        tools.open(currentChat?.options?.toolNames || [])
                      }
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
                {currentChat.status == 'running' && (
                  <Button
                    type="primary"
                    icon={<FaStop />}
                    onClick={() => {
                      onCancel(currentChat.id);
                    }}
                  />
                )}
                {currentChat.status != 'running' && (
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
      )}

      <ChatOptionsDrawer
        value={currentChat?.options}
        open={openChatOptionsDrawer}
        onChange={onChatOptionsChanged}
        width={'50vw'}
        onClose={() => setOpenChatOptionsDrawer(false)}
      />
    </div>
  );
}
