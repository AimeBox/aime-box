import { useEffect, useRef, useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Button, Input, message, Splitter } from 'antd';
import { FaEdit, FaFile, FaPlus, FaSmile } from 'react-icons/fa';

import List from '@/renderer/components/common/List';
import FormModal from '@/renderer/components/modals/FormModal';
import { isArray, isBoolean, isNumber, isString } from '@/main/utils/is';
import { FormSchema } from '@/types/form';

import BasicForm from '@/renderer/components/form/BasicForm';

import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { t } from 'i18next';
import { FaSeedling, FaTowerObservation } from 'react-icons/fa6';
import ChatList, { ChatListRef } from '@/renderer/components/chat/ChatList';
import ChatContent from './ChatContent';
import Content from '@/renderer/components/layout/Content';
import { ChatMode } from '@/types/chat';
import { Chat } from '@/entity/Chat';
import ChatFileContent from './ChatFileContent';
import ChatPlannerContent from './ChatPlannerContent';

export default function ChatPage() {
  const chatListRef = useRef<ChatListRef | null>(null);
  const [mode, setMode] = useState<ChatMode | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    // ?mode=default
    if (location.search) {
      const s = {};
      location.search
        .substring(1)
        .split('&')
        .forEach((item) => {
          const [key, value] = item.split('=');
          s[key] = value;
        });
      const _mode = s['mode'];
      setMode(_mode);
    }
    // debugger;
    const chatId = location.pathname.split('/')[2];

    setChatId(chatId);
  }, [location.search, location.pathname]);

  const onNewChat = async (mode: ChatMode) => {
    const chat = await window.electron.chat.create(mode);
    if (chatListRef.current) {
      chatListRef.current.getData(true);
    }
    if (chat) {
      navigate(`/chat/${chat.id}?mode=${mode}`);
    }
  };
  return (
    <Content>
      <div className="flex flex-row w-full h-full">
        <ChatList onNewChat={onNewChat} ref={chatListRef} />

        <div className="flex flex-col flex-1 w-full min-w-0 h-full min-h-full">
          <Routes>
            {(mode == 'default' || mode == 'agent') && (
              <Route path="*" element={<ChatContent chatId={chatId} />} />
            )}
            {mode == 'file' && <Route path="*" element={<ChatFileContent />} />}
            {mode == 'planner' && (
              <Route path="*" element={<ChatPlannerContent />} />
            )}
          </Routes>
        </div>
      </div>
    </Content>
  );
}
