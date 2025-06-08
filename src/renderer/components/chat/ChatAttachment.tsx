import React, { useCallback, useMemo, useState } from 'react';
import type { ChatInputAttachment } from '../../../types/chat';
import {
  FaEllipsisH,
  FaEllipsisV,
  FaFile,
  FaFileExcel,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
  FaFolder,
  FaFolderOpen,
  FaImage,
  FaReadme,
  FaTrashAlt,
} from 'react-icons/fa';
import { Button, Popover, Image } from 'antd';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

export interface ChatAttachmentProps {
  value: ChatInputAttachment;
  onDelete?: () => void;
  showPreview?: boolean;
}

export function ObjectModel(props: { path: string }) {
  const { path } = props;
  // useGLTF.preload(path);
  try {
    const { scene } = useGLTF(path); // 替换为您的GLB文件路径
    return <primitive object={scene} {...props} />;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default function ChatAttachment({
  value,
  showPreview = false,
  onDelete,
}: ChatAttachmentProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.electron.app.startDrag(value.path);
  };

  const [openMenu, setOpenMenu] = useState(false);
  const isImage =
    value.ext == '.jpg' ||
    value.ext == '.jpeg' ||
    value.ext == '.png' ||
    value.ext == '.gif' ||
    value.ext == '.bmp' ||
    value.ext == '.webp';
  const isVideo =
    value.ext == '.mp4' ||
    value.ext == '.mov' ||
    value.ext == '.avi' ||
    value.ext == '.mkv' ||
    value.ext == '.webm';
  const isAudio =
    value.ext == '.mp3' ||
    value.ext == '.wav' ||
    value.ext == '.ogg' ||
    value.ext == '.m4a' ||
    value.ext == '.aac';
  const is3DObject = value.ext == '.glb' || value.ext == '.gltf';
  const renderIcon = useCallback(() => {
    if (value.type == 'folder') {
      return <FaFolder />;
    }
    if (value.ext == '.doc' || value.ext == '.docx') {
      return <FaFileWord />;
    } else if (value.ext == '.xlsx' || value.ext == '.xls') {
      return <FaFileExcel />;
    } else if (value.ext == '.ppt' || value.ext == '.pptx') {
      return <FaFilePowerpoint />;
    } else if (value.ext == '.pdf') {
      return <FaFilePdf />;
    } else if (isImage) {
      return <FaImage />;
    }

    return <FaFile />;
  }, [value]);

  const renderPreview = () => {
    let { path } = value;
    if (!path.startsWith('file://')) {
      path = `file://${path}`;
    }

    if (isImage) {
      return (
        <Image
          src={path}
          className="max-h-[15rem] w-[15rem] !h-[15rem] object-contain"
          alt={value.name}
        />
      );
    }
    if (isVideo) {
      return (
        <video
          src={path}
          className="max-h-[15rem] w-[15rem] !h-[15rem] object-contain"
          controls
        >
          <track kind="captions" />
        </video>
      );
    }
    if (isAudio) {
      return (
        <audio
          src={path}
          className="w-[30rem] object-contain rounded-full border border-solid border-gray-200 dark:border-gray-700 shadow-sm"
          controls
        >
          <track kind="captions" />
        </audio>
      );
    }

    if (is3DObject) {
      return (
        // <Canvas style={{ height: '300rem' }}>
        //   <ambientLight />
        //   <pointLight position={[10, 10, 10]} />

        //   <OrbitControls />
        // </Canvas>
        <Canvas
          style={{ width: '600px', height: '600px' }}
          className="bg-gray-300 rounded-xl shadow"
        >
          {/* 环境光和方向光 */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} />
          <ObjectModel path={path} />

          {/* 轨道控制器 */}
          <OrbitControls />
        </Canvas>
      );
    }
    return null;
  };

  return (
    <div
      className="flex flex-col gap-2 items-start "
      style={{ maxWidth: 'min-content' }}
    >
      {showPreview &&
        value.path &&
        (isImage || isVideo || isAudio || is3DObject) &&
        renderPreview()}

      <div
        className="h-8 max-w-[15rem] min-w-[10rem] items-center justify-between cursor-pointer group flex flex-row border gap-1 border-gray-200 dark:border-none rounded-xl px-2 hover:bg-gray-300 bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300"
        draggable
        onDragStart={handleDragStart}
      >
        <div className="flex flex-row flex-1 gap-1 items-center min-w-0">
          <div
            className="flex overflow-hidden flex-row flex-1 gap-1 items-center text-sm font-medium dark:text-gray-100"
            onClick={() => {
              window.electron.app.openPath(value.path);
            }}
          >
            <div>{renderIcon()}</div>
            <div className="line-clamp-1">{value.name}</div>
          </div>
        </div>

        <div>
          <Popover
            placement="bottomLeft"
            trigger="click"
            open={openMenu}
            onOpenChange={setOpenMenu}
            content={
              <div
                className="flex flex-col items-start"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenMenu(false);
                }}
              >
                <Button
                  type="text"
                  className="w-full"
                  icon={<FaFolderOpen />}
                  onClick={() => {
                    window.electron.app.showItemInFolder(value.path);
                  }}
                >
                  Open Folder
                </Button>
                {onDelete && (
                  <Button
                    type="text"
                    className="w-full"
                    style={{ justifyContent: 'flex-start' }}
                    icon={<FaTrashAlt />}
                    onClick={() => onDelete()}
                  >
                    Delete
                  </Button>
                )}
              </div>
            }
          >
            <FaEllipsisH />
          </Popover>
        </div>
      </div>
    </div>
  );
}
