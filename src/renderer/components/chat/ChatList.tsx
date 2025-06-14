import { Button, Input, Popconfirm, Popover, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  FaEdit,
  FaEllipsisH,
  FaFile,
  FaFileAudio,
  FaPlus,
  FaSearch,
  FaTrashAlt,
} from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chat, ChatStatus } from '../../../entity/Chat';
import List from '../common/List';
import { t } from 'i18next';
import dayjs from 'dayjs';
import { ListItem } from '../common/ListItem';
import { FaRegMessage, FaRegRectangleList } from 'react-icons/fa6';
import { ChatInfo } from '@/main/chat';

// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
export interface ChatListRef {
  getData: (clear: boolean) => void;
}

export interface ChatListProps {
  onNewChat?: (mode: 'default' | 'planner' | 'file') => void;
}
// const ChatListComponent = function ({
//   onNewChat,
//   forwardedRef,
// }: ChatListProps) {

// };

const ChatList = React.forwardRef((props: ChatListProps, ref) => {
  const { onNewChat } = props;
  const location = useLocation();
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [addButtonOpen, setAddButtonOpen] = useState(false);
  const [searchText, setSearchText] = useState<string | null>(null);
  const [isPackaged, setIsPackaged] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const getData = async (clear = false) => {
    const res = await window.electron.chat.getChatPage({
      skip: clear ? 0 : chats.length,
      pageSize: 30,
      sort: 'timestamp desc',
      filter: searchText,
    });
    setTotalCount(res.totalCount);
    setChats((preChats) => {
      if (clear) {
        return res.items;
      }
      return [...preChats, ...res.items];
    });
  };

  useEffect(() => {
    getData(true);
  }, [searchText]);

  async function onDelete(chat: Chat) {
    await window.electron.chat.delete(chat.id);
    message.success('delete success');
    setChats(chats.filter((x) => x.id != chat.id));
    setTotalCount(totalCount - 1);
    navigate(`/chat`);
  }

  React.useImperativeHandle(ref, () => ({
    getData,
  }));

  // useEffect(() => {
  //   getData();
  // }, []);

  useEffect(() => {
    const id = location.pathname.split('/')[2];
    setCurrentChatId(id);
    const appInfo = window.electron.app.info();
    setIsPackaged(appInfo.isPackaged);
  }, [location]);

  const handleTitleChanged = (chat: Chat) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((x) => {
        if (x.id === chat.id) {
          return { ...x, title: chat.title };
        }
        return x;
      });
      return updatedChats;
    });
  };
  const handleChatChanged = (chat: ChatInfo) => {
    console.log('chat:changed', chat);
    setChats((prevChats) => {
      const updatedChats = prevChats.map((x) => {
        if (x.id === chat.id) {
          return { ...x, ...chat };
        }
        return x;
      });
      return updatedChats;
    });
  };
  useEffect(() => {
    window.electron.ipcRenderer.on('chat:title-changed', handleTitleChanged);
    window.electron.ipcRenderer.on('chat:start', handleChatChanged);
    window.electron.ipcRenderer.on('chat:end', handleChatChanged);
    return () => {
      window.electron.ipcRenderer.removeListener(
        'chat:title-changed',
        handleTitleChanged,
      );
    };
  }, []);

  const renderChatIcon = (mode: string) => {
    if (mode === 'file') return <FaFile />;
    else if (mode === 'planner') return <FaRegRectangleList />;
    else return <FaRegMessage />;
  };

  return (
    <>
      {contextHolder}
      <List
        onSearch={setSearchText}
        dataLength={chats.length}
        hasMore={chats.length < totalCount}
        width={250}
        loadMoreData={() => {
          getData();
        }}
        addButton={
          <Popover
            placement="rightTop"
            trigger="click"
            open={addButtonOpen}
            onOpenChange={setAddButtonOpen}
            content={
              <div className="flex flex-col">
                <Button
                  type="text"
                  block
                  icon={<FaRegMessage />}
                  onClick={() => {
                    setAddButtonOpen(false);
                    onNewChat('default');
                  }}
                >
                  {t('chat.newchat')}
                </Button>
                {!isPackaged && (
                  <Button
                    type="text"
                    block
                    icon={<FaRegMessage />}
                    onClick={() => {
                      setAddButtonOpen(false);
                      onNewChat('file');
                    }}
                  >
                    {t('chat.fileChat')}
                  </Button>
                )}
                {!isPackaged && (
                  <Button
                    type="text"
                    block
                    icon={<FaRegMessage />}
                    onClick={() => {
                      setAddButtonOpen(false);
                      onNewChat('planner');
                    }}
                  >
                    {t('chat.plannerChat')}
                  </Button>
                )}
              </div>
            }
          >
            <Button icon={<FaPlus />} className=""></Button>
          </Popover>
        }
      >
        <div className="flex flex-col gap-1">
          {chats.map((chat) => {
            return (
              <ListItem
                key={chat.id}
                icon={renderChatIcon(chat.mode)}
                active={currentChatId === chat.id}
                title={chat.title}
                shiny={chat.status === 'running'}
                subTitle={
                  chat.mode === 'agent' && <small>@{chat.agentName}</small>
                }
                href={`/chat/${chat.id}?mode=${chat.mode}`}
                menu={
                  <div className="flex flex-col">
                    <Button
                      icon={<FaTrashAlt />}
                      type="text"
                      style={{ justifyContent: 'flex-start' }}
                      block
                      danger
                      onClick={() => {
                        onDelete(chat);
                      }}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                }
              />
            );
          })}
        </div>
      </List>
    </>
  );
});
export default ChatList;
