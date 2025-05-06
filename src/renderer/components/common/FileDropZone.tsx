import { cn } from '@/lib/utils';
import React, { forwardRef, useCallback, useRef, useState } from 'react';
import './FileDropZone.css';
import { FaFileArrowUp } from 'react-icons/fa6';

export interface FileDropZoneProps {
  onSelectedFiles?: (files: string[]) => void;
  className?: string;
  children?: React.ReactNode;
}

const FileDropZone = forwardRef((props: FileDropZoneProps) => {
  const { onSelectedFiles, className, children } = props;
  const [files, setFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const onDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      if (!e.dataTransfer.types?.includes('Files')) {
        e.dataTransfer.effectAllowed = 'none';
        return;
      }
      setIsDragging(true);
    }
  };

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) {
        if (!e.dataTransfer.types?.includes('Files')) {
          e.dataTransfer.effectAllowed = 'none';
          return;
        }
        e.currentTarget.classList.add('dragover');
        setIsDragging(true);
        console.log('onDragOver', e.dataTransfer.effectAllowed);
      }
    },
    [isDragging],
  );

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    console.log('onDragLeave', dragCounter.current);
    if (dragCounter.current === 0) {
      e.currentTarget.classList.remove('dragover');
      setIsDragging(false);
      console.log('onDragLeave', e.dataTransfer.effectAllowed);
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();

      dragCounter.current = 0;
      e.currentTarget.classList.remove('dragover');
      if (e.dataTransfer.files.length == 0) return;
      const _files: FileList = e.dataTransfer.files;
      const files = [];

      for (let index = 0; index < _files.length; index++) {
        const file = _files[index];
        files.push(file.path);
      }
      onSelectedFiles?.(files);
      setFiles(files);
      setIsDragging(false);
      console.log('onSelectedFiles', files);
    },
    [onSelectedFiles],
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(className, 'relative w-full h-full')}
    >
      <div
        className={`pointer-events-none overlay flex flex-col  ${isDragging ? 'visible backdrop-blur-lg' : ''}`}
      >
        <p>
          <FaFileArrowUp className="text-[64px]"></FaFileArrowUp>
        </p>
        <p className="mt-2">将文件或文件夹拖入此处</p>
      </div>
      <div className="w-full h-full">{children}</div>
      {/* <h4>已选择文件：</h4>
      <ul>
        {files.map((file, index) => (
          <li key={index}>{file}</li>
        ))}
      </ul>

      <h4>已选择文件夹：</h4>
      <ul>
        {folders.map((folder, index) => (
          <li key={index}>{folder}</li>
        ))}
      </ul> */}
    </div>
  );
});

export default FileDropZone;
