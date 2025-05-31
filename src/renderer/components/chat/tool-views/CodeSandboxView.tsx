import {
  Sandpack,
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { useMemo } from 'react';

export interface CodeSandboxViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
}

export default function CodeSandboxView(props: CodeSandboxViewProps) {
  const { className, toolName, toolCall } = props;
  const files = useMemo(() => {
    return {
      '/index.js': 'console.log("Hello, world!");',
    };
  }, []);
  return (
    <div>
      <SandpackProvider template="react" files={files}>
        <SandpackLayout>
          <SandpackFileExplorer />
          <SandpackCodeEditor />
          <SandpackPreview />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
