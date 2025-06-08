import {
  Sandpack,
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackPreviewRef,
  SandpackProvider,
  SandpackSetup,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { Spin } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface CodeSandboxViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  chatId?: string;
}

export default function CodeSandboxView(props: CodeSandboxViewProps) {
  const { className, toolName, toolCall, chatId } = props;
  const [files, setFiles] = useState<Record<string, string> | undefined>(
    undefined,
  );
  const [customSetup, setCustomSetup] = useState<SandpackSetup>({
    entry: '/index.js',
  });
  //const { sandpack } = useSandpack();
  const previewRef = useRef<SandpackPreviewRef>(null);

  const options = {
    experimental_enableServiceWorker: true,
    experimental_enableStableServiceWorkerId: false, // set this true, in case private package are used
  };

  useEffect(() => {
    const getSandboxSetup = async (toolCall) => {
      const path = toolCall?.args?.path;
      const entry = toolCall?.args?.entry;

      const sandboxSetup = await window.electron.tools.getCodeSandboxSetup(
        path,
        chatId,
      );
      for (const filePath of Object.keys(sandboxSetup.files)) {
        const ext = filePath.split('.').pop();
        if (ext == 'png') {
          const binaryString = atob(sandboxSetup.files[filePath]);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          sandboxSetup.files[filePath] = new Blob([bytes], {
            type: 'image/png',
          });
        }
      }
      setFiles(sandboxSetup.files);
      const client = previewRef.current?.getClient();
      client?.updateSandbox({ files: sandboxSetup.files, entry: entry }, true);
      setFiles(sandboxSetup.files);
      setCustomSetup({ entry });
      console.log(sandboxSetup);
    };
    getSandboxSetup(toolCall);
  }, [toolCall, chatId]);

  return (
    <>
      {files && (
        <SandpackProvider
          // template="react"
          files={files}
          options={options}
          customSetup={customSetup}
          className="h-full"
          style={{ height: '100%' }}
        >
          <SandpackLayout style={{ height: '100%' }}>
            <SandpackFileExplorer style={{ height: '100%' }} />
            <SandpackCodeEditor style={{ height: '100%' }} />
            <SandpackPreview ref={previewRef} style={{ height: '100%' }} />
          </SandpackLayout>
        </SandpackProvider>
      )}
      {!files && (
        <div className="w-full py-10 flex justify-center items-center bg-gray-100 h-[400px] rounded-xl">
          <Spin className="w-full" />
        </div>
      )}
    </>
  );
}
