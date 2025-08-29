import { Chat, ChatMessage, ChatOptions } from '@/entity/Chat';
import ChatMessageBox from '@/renderer/components/chat/ChatMessageBox';
import ChatQuickInput from '@/renderer/components/chat/ChatQuickInput';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';

import { motion } from 'motion/react';
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
import React, {
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FaAngleDown,
  FaAngleUp,
  FaEdit,
  FaEllipsisH,
  FaFile,
  FaFolder,
  FaFolderOpen,
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
  FaRegFolder,
  FaTowerObservation,
} from 'react-icons/fa6';
import { useLocation } from 'react-router-dom';
import ChatOptionsDrawer from './ChatOptionsDrawer';
import { t } from 'i18next';
import EmojiPicker, { SkinTones } from 'emoji-picker-react';
import { GlobalContext } from '@/renderer/context/GlobalContext';
// import { Editor, EditorRef } from '@/renderer/components/common/Editor';
import { ChatInputAttachment } from '@/types/chat';
import ChatAttachment from '@/renderer/components/chat/ChatAttachment';
import domtoimage from 'dom-to-image';
import { ChatInfo } from '@/main/chat';
import FileDropZone from '@/renderer/components/common/FileDropZone';
import ChatToolView from '@/renderer/components/chat/ChatToolView';
import ChatHistoryDrawer from './ChatHistoryDrawer';
import { formatNumber } from '@/main/utils/format';
import ChatInput, { ChatInputRef } from '@/renderer/components/chat/ChatInput';
import { EditorRef } from '@/renderer/components/common/Editor';

export interface ChatContentProps {
  chatId?: string;
}

const ChatContent = React.forwardRef((props: ChatContentProps, ref) => {
  const { chatId } = props;

  const location = useLocation();

  const [emojiOpen, setEmojiOpen] = useState<boolean>(false);
  const [currentChat, setCurrentChat] = useState<ChatInfo | undefined>(
    undefined,
  );
  const [openChatOptionsDrawer, setOpenChatOptionsDrawer] =
    useState<boolean>(false);
  const [openChatHistoryDrawer, setOpenChatHistoryDrawer] = useState<{
    open: boolean;
    value: ChatMessage[];
  }>({
    open: false,
    value: [],
  });
  const [currentModel, setCurrentModel] = useState<string | undefined>(
    undefined,
  );
  const [chatInputMessage, setChatInputMessage] = useState<string | undefined>(
    undefined,
  );
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);
  const { agents, tools, knowledgeBase } = useContext(GlobalContext);
  const scrollRef = useRef<ScrollAreaRef | null>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const [openCanvasView, setOpenCanvasView] = useState<boolean>(false);

  const [canvasViewValue, setCanvasViewValue] = useState<any>({});
  const registerEvent = (id: string) => {
    const list = {
      [`chat:changed:${id}`]: handleChatChanged,
      [`chat:message-finish:${id}`]: handleChatFinish,
      [`chat:message-stream:${id}`]: handleChatStream,
      [`chat:message-changed:${id}`]: handleChatMessageChanged,
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
    const lastMessage = res.chatMessages[res.chatMessages.length - 1];
    setCurrentModel(res.model);
    setCurrentChat(res);
    registerEvent(res.id);
    return res;
  };

  const onChat = async (text?: string, attachments?: ChatInputAttachment[]) => {
    if (!text?.trim() || !chatId) {
      return;
    }
    window.electron.chat.chatResquest({
      chatId: chatId,
      content: text.trim(),
      extend: { attachments },
    });
    chatInputRef.current?.clear();
    setAttachments([]);
    setChatInputMessage('');
    scrollToBottom(false);
  };

  const onCancel = async (chatId: string) => {
    window.electron.chat.cancel(chatId);
  };
  async function handleChatChanged(chat?: Chat) {
    await getChat(chat.id);
  }
  async function handleChatMessageChanged(chatMessage: ChatMessage) {
    const chatMessageId = chatMessage.id;
    setCurrentChat((preChat) => {
      if (preChat?.id == chatMessage.chatId) {
        preChat.status = 'running';
        const msg = preChat?.chatMessages.find((x) => x.id == chatMessageId);
        if (msg) {
          msg.content = chatMessage.content;
          msg.additional_kwargs = chatMessage.additional_kwargs;
          preChat.status == 'running';
          return { ...preChat };
        } else {
          preChat.chatMessages.push(chatMessage);
          return { ...preChat };
        }
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
    console.log('handleChatFinish', chatMessage);
    const chat = await getChat(chatMessage.chat.id);
    if (chatMessage.role == 'tool' && chatMessage?.content?.length > 0) {
      const { tool_call_id } = chatMessage.content[0];
      const tool_call = chat.chatMessages
        .find((x) => x.tool_calls?.some((z) => z.id == tool_call_id))
        .tool_calls.find((x) => x.id == tool_call_id);
      if (tool_call_id && tool_call) {
        openCanvas({
          title: chatMessage.name,
          content: chatMessage.content[0],
          toolCall: tool_call,
        });
      }
    }
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
    //const id = location.pathname.split('/')[2];
    closeCanvas();
    if (chatId) {
      getChat(chatId);
      const { message } = location.state || {};
      if (message && (message.text || message.attachments?.length > 0)) {
        onChat(message.text, message.attachments);
      }
      scrollToBottom();
    } else {
      setCurrentChat(undefined);
      return () => {};
    }
    return () => {
      window.electron.ipcRenderer.removeAllListeners(`chat:changed:${chatId}`);
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-changed:${chatId}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-finish:${chatId}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-stream:${chatId}`,
      );
      console.log('已删除监听');
    };
  }, [chatId]);

  const openHistory = (history: any) => {
    setOpenChatHistoryDrawer({ open: true, value: history });
  };

  const onDelete = async (chatMessage: ChatMessage) => {
    const res = await window.electron.chat.getChat(chatMessage.chatId);
    setCurrentChat(res);
  };
  const onClearChatMessages = async () => {
    await window.electron.chat.clearChat(currentChat.id);
    closeCanvas();
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

  const onSelectFile = async (files: string[] = []) => {
    try {
      const res = await window.electron.app.getPathInfo(files);
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
    } catch (err) {
      message.error(err);
    }
  };

  const onExport = async () => {};
  const onOpenWorkspace = async () => {
    const res = await window.electron.chat.openWorkspace(currentChat.id);
  };
  const onChangeWorkspace = async () => {
    const res = await window.electron.chat.changeWorkspace(currentChat.id);
  };
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

  const closeCanvas = () => {
    setOpenCanvasView(false);
    setCanvasViewValue({});
    setCanvasSize(0);
  };

  const openCanvas = (value: any) => {
    setOpenCanvasView(true);
    setCanvasViewValue(value);
    console.log(value);
    setCanvasSize(400);
  };

  const [canvasSize, setCanvasSize] = useState(0);

  const [openMenu, setOpenMenu] = useState(false);

  const onAskHumanSubmit = (value: any, toolMessage: ChatMessage) => {
    console.log(value, toolMessage);
    window.electron.chat.chatResquest({
      chatId: currentChat.id,
      content: value,
      extend: { attachments: [] },
      is_hidden_message: true,
    });
  };

  const chatInputHandleReplace = (value: string) => {
    const textarea = document.getElementById(
      'chat-input',
    ) as HTMLTextAreaElement;

    console.log(textarea.value, textarea.selectionStart, textarea.selectionEnd);

    const insertionText = value; // 你要替换或插入的字符

    const beforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const afterCursor = textarea.value.substring(textarea.selectionEnd);

    setChatInputMessage(beforeCursor + insertionText + afterCursor);
  };

  return (
    <div className="h-full">
      <FileDropZone onSelectedFiles={onSelectFile}>
        {currentChat && (
          <Splitter
            className="flex flex-row w-full h-full"
            onResize={(size) => {
              setCanvasSize(size[1]);
            }}
          >
            <Splitter.Panel min={400}>
              <Splitter
                layout="vertical"
                className="flex-1 h-full"
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
                          <small className="flex flex-row gap-2 ml-3 text-xs text-gray-400 items-center">
                            <Button
                              size="small"
                              type="text"
                              onClick={() => {
                                onOpenWorkspace();
                              }}
                            >
                              {chatId}
                            </Button>
                            <span>
                              token: {formatNumber(currentChat.totalToken)}
                            </span>
                            <span className="flex flex-row items-center">
                              <FaAngleUp />{' '}
                              {formatNumber(currentChat.inputToken)}
                            </span>
                            <span className="flex flex-row items-center">
                              <FaAngleDown />{' '}
                              {formatNumber(currentChat.outputToken)}
                            </span>
                          </small>
                        </div>

                        <div className="">
                          <Popover
                            placement="bottomRight"
                            trigger="click"
                            open={openMenu}
                            onOpenChange={setOpenMenu}
                            content={
                              <div className="flex flex-col items-start w-full">
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
                                  icon={<FaRegFolder />}
                                  type="text"
                                  block
                                  className="justify-start"
                                  onClick={() => {
                                    setOpenMenu(false);
                                    onOpenWorkspace();
                                  }}
                                >
                                  {t('chat.open_workspace')}
                                </Button>
                                <Button
                                  icon={<FaFolder />}
                                  type="text"
                                  block
                                  className="justify-start"
                                  onClick={() => {
                                    setOpenMenu(false);
                                    onChangeWorkspace();
                                  }}
                                >
                                  {t('chat.change_workspace')}
                                </Button>
                                <Button
                                  icon={<FaFileExport />}
                                  type="text"
                                  className="justify-start"
                                  block
                                  onClick={() => {
                                    setOpenMenu(false);
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
                              {currentChat?.chatMessages
                                ?.filter(
                                  (x) => x.role != 'tool' && !x.is_hidden,
                                )
                                .map((chatMessage: ChatMessage) => {
                                  const toolMessages =
                                    chatMessage?.tool_calls?.length == 0
                                      ? []
                                      : currentChat?.chatMessages?.filter(
                                          (x) =>
                                            x.role == 'tool' &&
                                            x.content?.some(
                                              (y) =>
                                                y?.type == 'tool_call' &&
                                                chatMessage?.tool_calls
                                                  ?.filter((x) => x?.id)
                                                  .map((t) => t?.id)
                                                  .includes(y?.tool_call_id),
                                            ),
                                        );

                                  return (
                                    <ChatMessageBox
                                      key={chatMessage.id}
                                      toolMessages={toolMessages}
                                      editEnabled={
                                        currentChat.message_edit_enable
                                      }
                                      // onRedo={() => onRedo(chatMessage)}
                                      onToolClick={(
                                        toolCall,
                                        toolMessageContent,
                                        toolMessage,
                                      ) => {
                                        console.log(
                                          toolCall,
                                          toolMessageContent,
                                        );
                                        if (toolMessageContent) {
                                          openCanvas({
                                            title: toolCall.name,
                                            content: toolMessageContent,
                                            toolCall: toolCall,
                                            toolMessage: toolMessage,
                                          });
                                        }
                                      }}
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
                                      onOpenHistory={(history) => {
                                        openHistory(history);
                                      }}
                                      onAskHumanSubmit={onAskHumanSubmit}
                                      value={chatMessage}
                                    />
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </Splitter.Panel>
                <Splitter.Panel min={220} defaultSize={220}>
                  <ChatInput
                    ref={chatInputRef}
                    isRunning={currentChat?.status == 'running'}
                    onChat={onChat}
                    chatInputValue={chatInputMessage}
                    attachments={attachments}
                    onAttachmentsChanged={setAttachments}
                    onCancel={() => onCancel(currentChat.id)}
                    footer={
                      <div className="flex flex-row items-center justify-between w-full pr-2">
                        <div className="flex flex-row items-center gap-2">
                          <ProviderSelect
                            type="llm"
                            value={currentModel}
                            onChange={onChangeCurrentModel}
                            style={{ width: '200px' }}
                          />
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
                                tools.open(
                                  currentChat?.options?.toolNames || [],
                                );
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
                                knowledgeBase.open(
                                  currentChat?.options?.kbList || [],
                                );

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
                          <Button
                            icon={<FaGear />}
                            type="text"
                            onClick={() => {
                              setOpenChatOptionsDrawer(true);
                            }}
                          />
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
                        </div>
                        {/* <Button
                          icon={<FaPaperclip />}
                          type="text"
                          onClick={() => {
                            onSelectFile([]);
                          }}
                        ></Button> */}
                      </div>
                    }
                  />
                </Splitter.Panel>
              </Splitter>
            </Splitter.Panel>
            <Splitter.Panel
              // min={openCanvasView ? 400 : 0}
              // max={openCanvasView ? 600 : 0}
              // collapsible
              // size={canvasSize}
              // defaultSize={openCanvasView ? 400 : 0}
              // size={400}
              min={400}
              size={canvasSize}
              defaultSize={400}
              collapsible
            >
              <div className="h-full">
                <ChatToolView
                  className="flex-1 w-full"
                  open={openCanvasView}
                  onClose={() => closeCanvas()}
                  value={canvasViewValue}
                  toolName={canvasViewValue?.toolCall?.name}
                  // toolCall={canvasViewValue?.toolCall}
                  chatId={currentChat?.id}
                />
              </div>
            </Splitter.Panel>
          </Splitter>
        )}
      </FileDropZone>

      <ChatOptionsDrawer
        value={currentChat?.options}
        open={openChatOptionsDrawer}
        onChange={onChatOptionsChanged}
        width="50vw"
        onClose={() => setOpenChatOptionsDrawer(false)}
      />
      <ChatHistoryDrawer
        open={openChatHistoryDrawer.open}
        value={openChatHistoryDrawer.value}
        width="50vw"
        onClose={() => setOpenChatHistoryDrawer({ open: false, value: [] })}
      ></ChatHistoryDrawer>
    </div>
  );
});

export default ChatContent;
