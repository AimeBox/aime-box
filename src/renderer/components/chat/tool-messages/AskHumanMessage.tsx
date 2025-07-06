import { ChatMessage } from '@/entity/Chat';
import { cn } from '@/lib/utils';
import BasicForm from '../../form/BasicForm';
import { Form } from 'antd';

export interface AskHumanMessageProps {
  className?: string;
  toolMessage?: ChatMessage;
  toolCall?: any;
  onSubmit?: (value: any) => void;
}

export default function AskHumanMessage(props: AskHumanMessageProps) {
  const { className, toolMessage, toolCall, onSubmit } = props;
  const [form] = Form.useForm();
  const invoke = (value: any) => {
    console.log(value);
    onSubmit?.(value);
  };
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span>{toolCall?.args?.question}</span>
      <BasicForm
        schemas={toolCall?.args?.form_items}
        layout="vertical"
        onFinish={async (value) => {
          await invoke(value);
        }}
      />
    </div>
  );
}
