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
import { Chat } from '../../../entity/Chat';
import List from '../common/List';
import { t } from 'i18next';
import dayjs from 'dayjs';
import { ListItem } from '../common/ListItem';
import { FaRegMessage } from 'react-icons/fa6';

// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
export interface ChatListRef {
  getData: (clear: boolean) => void;
}

export interface ChatListProps {
  onNewChat?: (mode: 'default' | 'task' | 'file') => void;
}
// const ChatListComponent = function ({
//   onNewChat,
//   forwardedRef,
// }: ChatListProps) {

// };

const ChatList = React.forwardRef((props: ChatListProps, ref) => {
  const { onNewChat } = props;
  const location = useLocation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [addButtonOpen, setAddButtonOpen] = useState(false);

  const navigate = useNavigate();
  const getData = async (clear = false) => {
    const res = await window.electron.chat.getChatPage({
      skip: clear ? 0 : chats.length,
      pageSize: 30,
      sort: 'timestamp desc',
    });

    setTotalCount(res.totalCount);
    setChats((preChats) => {
      if (clear) {
        return res.items;
      }
      return [...preChats, ...res.items];
    });
  };
  const onSearch = async (text: string) => {
    const res = await window.electron.db.page<Chat>(
      'chat',
      text ? { title: text } : {},
      0,
      30,
      'timestamp desc',
    );
    setTotalCount(res.totalCount);
    setChats((preChats) => {
      return res.items;
    });
  };
  async function onDelete(chat: Chat) {
    await window.electron.db.delete('chat', `id = '${chat.id}'`);
    message.success('delete success');
    setChats(chats.filter((x) => x.id != chat.id));
    navigate(`/chat`);
    // getData(true);
  }

  async function onEditTitle(chat: Chat) {
    message.success('delete success');
    getData();
  }

  React.useImperativeHandle(ref, () => ({
    getData,
  }));

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    const id = location.pathname.split('/')[2];
    setCurrentChatId(id);
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
  useEffect(() => {
    window.electron.ipcRenderer.on('chat:title-changed', handleTitleChanged);
    return () => {
      window.electron.ipcRenderer.removeListener(
        'chat:title-changed',
        handleTitleChanged,
      );
    };
  }, []);
  return (
    <List
      onSearch={onSearch}
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
            </div>
          }
        >
          <Button type="text" icon={<FaPlus />} className=""></Button>
        </Popover>
      }
    >
      <div className="flex flex-col gap-1">
        {chats.map((chat) => {
          return (
            <ListItem
              key={chat.id}
              icon={chat.mode === 'file' ? <FaFile /> : undefined}
              active={currentChatId === chat.id}
              title={chat.title}
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
  );
});
export default ChatList;
