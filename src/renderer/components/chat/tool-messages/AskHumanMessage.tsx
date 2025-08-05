import { cn } from '@/lib/utils';
import BasicForm from '../../form/BasicForm';
import { Form, FormInstance } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/entity/Chat';
import e from 'express';
import { Markdown } from '../../common/Markdown';

export interface AskHumanMessageProps {
  className?: string;
  toolMessage?: ChatMessage;
  toolCall?: any;
  onSubmit?: (value: any) => void;
}

export default function AskHumanMessage(props: AskHumanMessageProps) {
  const { className, toolMessage, toolCall, onSubmit } = props;
  const formRef = useRef<any>(null);
  const [readonly, setReadonly] = useState(false);
  const invoke = (value: any) => {
    onSubmit?.(
      `<ask-human-callback>\n${JSON.stringify(value, null, 2)}\n</ask-human-callback>`,
    );
  };

  useEffect(() => {
    if (toolMessage?.status == 'success') {
      const form: FormInstance<any> = formRef.current.getForm();
      form.setFieldsValue(toolMessage.additional_kwargs?.input);
      formRef.current.updateSchema(
        toolCall?.args?.form_items.map((x) => {
          if (!x.componentProps) {
            x.componentProps = {};
          }
          x.componentProps['disabled'] = true;
          return {
            ...x,
          };
        }),
      );
      setReadonly(true);
    }
  }, [toolMessage, formRef]);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Markdown value={toolCall?.args?.question}></Markdown>
      <BasicForm
        ref={formRef}
        schemas={toolCall?.args?.form_items}
        layout="vertical"
        showSubmit={!readonly}
        onFinish={async (value) => {
          await invoke(value);
        }}
      />
    </div>
  );
}
