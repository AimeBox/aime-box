import { Select, SelectProps, Upload, UploadFile } from 'antd';

import { t } from 'i18next';

import React, { ForwardedRef, useEffect, useRef, useState } from 'react';
import {
  FaFile,
  FaFileAlt,
  FaFolder,
  FaPlus,
  FaRegFileAlt,
  FaRegFolder,
} from 'react-icons/fa';

interface FileSelectProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  mode?: 'file' | 'folder';
  accept?: string;
}

interface FileSelectRef {}
const FileSelect = React.forwardRef(
  (props: FileSelectProps, ref: ForwardedRef<FileSelectRef>) => {
    const { value, onChange, mode = 'file', accept } = props;

    const [fileList, setFileList] = useState<UploadFile[]>([]);

    useEffect(() => {
      setFileList(
        value?.map((x) => ({
          uid: x,
          name: x.replaceAll('\\', '/').split('/').pop(),
          fileName: x.replaceAll('\\', '/').split('/').pop(),
          status: 'done',
        })) || [],
      );
    }, [value]);

    const iconRender = (_file: UploadFile) => {
      if (mode == 'folder')
        return (
          <FaRegFolder className="inline-flex items-center w-full" size={32} />
        );

      return (
        <FaRegFileAlt className="inline-flex items-center w-full" size={32} />
      );
    };
    return (
      <Upload
        name="avatar"
        listType="picture-card"
        className="avatar-uploader"
        showUploadList
        openFileDialogOnClick={false}
        fileList={fileList}
        accept={accept}
        onRemove={(file) => {
          const _fileList = fileList.filter((x) => x.uid !== file.uid);
          setFileList(_fileList);
          onChange?.(_fileList.map((x) => x.uid));
        }}
        iconRender={iconRender}
      >
        <button
          style={{ border: 0, background: 'none' }}
          type="button"
          className="flex flex-col justify-center items-center w-full h-full"
          onClick={async () => {
            const filters = [];
            if (mode == 'file' && accept) {
              filters.push({
                name: '文件',
                extensions: accept?.split(',').map((x) => x.substring(1)),
              });
            }
            const res = await window.electron.app.showOpenDialog({
              properties:
                mode == 'file'
                  ? ['openFile', 'multiSelections']
                  : ['openDirectory', 'multiSelections'],
              filters: mode == 'file' ? filters : undefined,
            });
            if (res && res.length > 0) {
              const _fileList: UploadFile[] = [...fileList];
              for (let index = 0; index < res.length; index++) {
                const item = res[index];
                if (!_fileList.find((x) => x.uid == item.path)) {
                  _fileList.push({
                    uid: item.path,
                    name: item.name,
                    fileName: item.name,
                    status: 'done',
                  });
                }
              }

              setFileList(_fileList);

              onChange?.(_fileList.map((x) => x.uid));
            }
          }}
        >
          <FaPlus />
          <div style={{ marginTop: 8 }}>
            {mode == 'file' ? t('selectFile') : t('selectFolder')}
          </div>
        </button>
      </Upload>
    );
  },
);

export default FileSelect;
