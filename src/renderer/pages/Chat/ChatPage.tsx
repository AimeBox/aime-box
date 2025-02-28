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

export default function ChatPage() {
  const chatListRef = useRef<ChatListRef | null>(null);
  const navigate = useNavigate();
  useEffect(() => {}, []);
  const onNewChat = async (mode: string) => {
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
            <Route path="*" element={<ChatContent />} />
          </Routes>
        </div>
      </div>
    </Content>
  );
}
