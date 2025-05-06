import ReactJson, { InteractionProps } from '@microlink/react-json-view';
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

interface JsonEditorProps {
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
}

interface JsonEditorRef {}
const JsonEditor = React.forwardRef(
  (props: JsonEditorProps, ref: ForwardedRef<JsonEditorRef>) => {
    const { value, onChange } = props;

    // useEffect(() => {
    //   setFileList(
    //     value?.map((x) => ({
    //       uid: x,
    //       name: x.replaceAll('\\', '/').split('/').pop(),
    //       fileName: x.replaceAll('\\', '/').split('/').pop(),
    //       status: 'done',
    //     })) || [],
    //   );
    // }, [value]);

    const onEdit = (value: InteractionProps) => {
      onChange?.(value.updated_src);
    };

    const onAdd = (value: InteractionProps) => {
      onChange?.(value.updated_src);
    };

    const onDelete = (value: any) => {
      onChange?.(value.updated_src);
    };

    return (
      <ReactJson
        src={value}
        enableClipboard={false}
        onEdit={onEdit}
        onAdd={onAdd}
        onDelete={onDelete}
      />
    );
  },
);

export default JsonEditor;
