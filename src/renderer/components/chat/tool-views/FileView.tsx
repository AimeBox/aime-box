import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { Button, Radio } from 'antd';
import { useMemo, useState } from 'react';
import { FaDownload } from 'react-icons/fa';
import { Markdown } from '../../common/Markdown';
import { ResponseCard } from '../../common/ResponseCard';

export interface FileViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function FileView(props: FileViewProps) {
  const { className, toolName, toolCall, content } = props;
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [ext, setExt] = useState<string>('');
  const extension = useMemo(() => {
    const ext = toolCall.args?.path?.split('.').pop().toLowerCase();
    if (ext == 'html') {
      return 'html';
    }
    if (ext == 'md') {
      return 'md';
    }
    if (ext == 'js' || ext == 'ts' || ext == 'py' || ext == 'json') {
      setExt(ext);
      return 'code';
    }

    return 'text';
  }, [toolCall.args.path]);

  const data = useMemo(() => {
    if (extension == 'html') {
      return toolCall.args.data;
    }
    return toolCall.args.data;
  }, [toolCall.args.data, extension]);

  return (
    <div className="flex flex-col gap-2 items-start">
      {toolCall.args?.path && (
        <a href={toolCall.args.path} target="_blank" rel="noreferrer">
          {toolCall.args.path}
        </a>
      )}
      {extension == 'html' && (
        <div className="h-full w-full">
          <Radio.Group
            size="small"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mb-2"
          >
            <Radio.Button value="preview">Preview</Radio.Button>
            <Radio.Button value="code">Code</Radio.Button>
          </Radio.Group>
          {mode == 'preview' && (
            <iframe
              srcDoc={data}
              className="w-full h-[600px]"
              title={toolCall.args.path}
            ></iframe>
          )}
          {mode == 'code' && <Markdown value={`\`\`\`html\n${data}\n\`\`\``} />}
          {/* <SandpackProvider
            template="static"
            style={{ height: '600px' }}
            className="h-full "
            files={{ '/index.html': content }}
          >
            <SandpackLayout style={{ height: '100%' }}>

              <SandpackPreview style={{ height: '100%' }} />
            </SandpackLayout>
          </SandpackProvider>  */}
        </div>
      )}
      {extension == 'md' && (
        <div className="h-full w-full">
          <Radio.Group
            size="small"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mb-2"
          >
            <Radio.Button value="preview">Preview</Radio.Button>
            <Radio.Button value="code">Code</Radio.Button>
          </Radio.Group>
          {mode == 'preview' && <Markdown value={data} />}
          {mode == 'code' && (
            <pre className="break-all p-2 whitespace-pre-wrap">{data}</pre>
          )}
        </div>
      )}
      {extension == 'code' && (
        <Markdown className="" value={`\`\`\`${ext}\n${data}\n\`\`\``} />
      )}
      {extension == 'text' && (
        <pre className="break-all p-2 whitespace-pre-wrap">
          {toolCall.args.data}
        </pre>
      )}
      {content?.text && <ResponseCard value={content.text} />}

      {/* <pre className="text-xs break-all whitespace-pre-wrap mt-2 bg-gray-100 p-2 rounded-md"></pre> */}
    </div>
  );
}
