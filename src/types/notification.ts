export interface NotificationMessage {
  id: string;
  type: 'notification' | 'message' | 'progress';
  title: string;
  description: string;
  percent: number | undefined;
  duration: number | undefined;
  closeEnable: boolean;
  icon: string | 'success' | 'error' | 'info' | 'warning' | 'loading';
  error: string;
}
