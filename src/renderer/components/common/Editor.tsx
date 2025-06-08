import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import ReactDOM from 'react-dom';
// import ReactQuill, { Quill } from 'react-quill';
// import quill, { Delta, DeltaStatic } from 'quill';
// import 'react-quill/dist/quill.bubble.css';
import { cn } from '@/lib/utils';

const BlockEmbed = Quill.import('blots/block/embed');

class FileBlot extends BlockEmbed {
  static blotName = 'file';

  static tagName = 'a';

  static create(value) {
    const node = super.create();
    node.setAttribute('href', value.url);
    node.setAttribute('download', value.name);
    node.innerHTML = value.name;
    return node;
  }

  static value(node) {
    return {
      url: node.getAttribute('href'),
      name: node.getAttribute('download'),
    };
  }
}

Quill.register(FileBlot);

const Clipboard = Quill.import('modules/clipboard');

class PlainClipboard extends Clipboard {
  onPaste(e) {
    e.preventDefault();
    const range = this.quill.getSelection();
    const text = e.clipboardData.getData('text/plain');

    this.quill.deleteText(range.index, range.length);

    this.quill.insertText(range.index, text);
    this.quill.setSelection(range.index + text.length, 0);
  }
}

// 注册自定义的 Clipboard 模块
Quill.register('modules/clipboard', PlainClipboard, true);

export interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  onClear?: () => void;
}

export interface EditorRef {
  insertFile: (input: {
    path: string;
    filename: string;
    type: 'file' | 'folder';
  }) => void;
  insertText: (text: string) => void;
  clear: () => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>((props, ref) => {
  const { value, onChange, className, onClear } = props;
  // const [value, setValue] = useState('');
  const [editorValue, setEditorValue] = useState<string>('');
  const quillRef = useRef<ReactQuill>(null);
  const [selection, setSelection] = useState({ index: 0, length: 0 });

  const insertFile = (input: {
    path: string;
    filename: string;
    type: 'file' | 'folder';
  }) => {
    const quill = quillRef.current.getEditor();
    const fileData = {
      name: input.filename,
      path: input.path,
    };
    const ext = input.filename.split('.').pop();

    const range = quill.getSelection(true);

    quill.insertEmbed(range?.index ?? 0, 'file', fileData);
    setTimeout(() => {
      quill.insertText((range?.index ?? 0) + 1, ' ');
      quill.setSelection((range?.index ?? 0) + 2, 0);
    }, 1);
  };
  const insertText = (text: string) => {
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true);
    if (range && range.length > 0) {
      quill.deleteText(range.index, range.length); // 删除选中文本
      quill.insertText(range.index, text); // 插入新文本
    } else {
      quill.insertText(range?.index ?? 0, text);
    }

    setTimeout(() => {
      quill.setSelection(quill.getText().length, 0);
      quill.focus();
    }, 500);
  };
  const clear = () => {
    const quill = quillRef.current.getEditor();
    quill.deleteText(0, quill.getText().length);
  };

  useImperativeHandle(ref, () => ({
    insertFile,
    insertText,
    clear,
  }));

  useEffect(() => {
    onChange?.(quillRef.current.getEditor().getText());
  }, [editorValue, onChange]);
  return (
    <>
      <ReactQuill
        theme="bubble"
        className={cn(className, 'dark:text-white')}
        value={editorValue}
        onChange={(v) => {
          setEditorValue(v);
        }}
        // formats={['file', 'image']}
        style={{
          height: '100%',
        }}
        modules={{
          toolbar: false,
          clipboard: true,
          // keyboard: {
          //   bindings: {
          //     enter: {
          //       key: 13, // Enter 键
          //       handler: () => {
          //         console.log('Enter pressed! Submitting content...');
          //         return false; // 阻止默认换行行为
          //       },
          //     },
          //     shiftEnter: {
          //       key: 13,
          //       shiftKey: true, // 需要 Shift 组合键
          //       handler: (range, context) => {
          //         const quill = quillRef.current.getEditor();
          //         if (quill) {
          //           quill.insertText(range.index, '\n'); // 插入换行
          //           quill.setSelection(range.index + 1); // 移动光标
          //         }
          //       },
          //     },
          //   },
          // },
          // keyboard: {
          //   bindings: {
          //     enter: {
          //       key: 13, // Enter key code
          //       handler: (range, context) => {
          //         if (!context.event.shiftKey) {
          //           // 没有按下Shift键，阻止默认行为
          //           context.event.preventDefault();
          //           return false;
          //         }
          //         // 按下了Shift键，由Quill处理默认的换行行为
          //         return true;
          //       },
          //     },
          //   },
          // },
        }}
        ref={quillRef}
      />
      {/* <br />
      <div className="whitespace-pre-wrap">{value}</div> */}
    </>
  );
});
