import { ChatMessage } from '@/entity/Chat';
import { Drawer, DrawerProps } from 'antd';
import { t } from 'i18next';

export interface ChatHistoryDrawerProps extends DrawerProps {
  value?: any[];
  onChange?: (value: Record<string, any>) => void;
}

export default function ChatHistoryDrawer(props: ChatHistoryDrawerProps) {
  return <Drawer title={t('chat.chat_history')} {...props}></Drawer>;
}
