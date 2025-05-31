import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { Button } from 'antd';
import { useMemo } from 'react';
import { FaDownload } from 'react-icons/fa';
import { Markdown } from '../../common/Markdown';

export interface FileViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
}

export default function FileView(props: FileViewProps) {
  const { className, toolName, toolCall } = props;
  const extension = useMemo(
    () => toolCall.args.path.split('.').pop().toLowerCase(),
    [toolCall.args.path],
  );
  const content = useMemo(() => {
    if (extension == 'html') {
      return toolCall.args.data;
    }
    return toolCall.args.data;
  }, [toolCall.args.data, extension]);

  return (
    <div className="flex flex-col gap-2 items-start">
      <a href={toolCall.args.path} target="_blank" rel="noreferrer">
        {toolCall.args.path}
      </a>
      {extension == 'html' && (
        <div className="h-full w-full">
          <iframe
            srcDoc={content}
            className="w-full h-[600px]"
            title="toolCall.args.path"
          ></iframe>
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
      {extension == 'md' && <Markdown value={content} />}
      {!extension && toolCall.args.data}
      {/* <pre className="text-xs break-all whitespace-pre-wrap mt-2 bg-gray-100 p-2 rounded-md"></pre> */}
    </div>
  );
}
