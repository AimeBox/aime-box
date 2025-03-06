import { isBoolean, isFunction } from '../../../main/utils/is';
import { FormSchema } from '../../../types/form';
import {
  Checkbox,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  Switch,
  Upload,
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import React, { forwardRef, useEffect, useState } from 'react';
import type { FormProps } from 'antd/es/form/Form';
import MDEditor from '@uiw/react-md-editor';
import ProviderSelect from '../providers/ProviderSelect';
import { FaPlus } from 'react-icons/fa';
import { t } from 'i18next';
import FileSelect from './FileSelect';

export interface FormItemProps {
  schema: FormSchema;
  formModel: object | Record<string, any>;
  formProps: FormProps;
  allDefaultValues: object | Record<string, any>;
}
const FormModal = forwardRef((props: FormItemProps, ref) => {
  const [isIfShow, setIsIfShow] = useState<boolean>(false);
  const [isShow, setIsShow] = useState<boolean>(false);
  const getValues = () => {
    const { allDefaultValues, formModel, schema } = props;
    // const { mergeDynamicData } = props.formProps;
    return {
      field: schema.field,
      model: props.formModel,
      values: {
        // ...mergeDynamicData,
        ...allDefaultValues,
        ...formModel,
      },
      schema: schema,
    };
  };
  const getShow = () => {
    const { show, ifShow } = props.schema;
    let isShow = true;
    let isIfShow = true;

    if (isBoolean(show)) {
      isShow = show;
    }
    if (isBoolean(ifShow)) {
      isIfShow = ifShow;
    }
    if (isFunction(show)) {
      isShow = show(getValues());
    }
    if (isFunction(ifShow)) {
      isIfShow = ifShow(getValues());
    }
    //return isIfShow && isShow;
    return { isIfShow: isIfShow, isShow };
  };

  useEffect(() => {
    const { isIfShow: _isIfShow, isShow: _isShow } = getShow();
    setIsIfShow(_isIfShow);
    setIsShow(_isShow);
  }, [props.formModel]);
  return (
    isIfShow &&
    isShow && (
      <Form.Item
        label={props.schema.label}
        extra={props.schema.subLabel}
        help={props.schema.helpMessage}
        name={props.schema.field}
        rules={[
          {
            required: props.schema.required,
            message: `Please input ${props.schema.field}!`,
          },
        ]}
      >
        {props.schema.component === 'Input' && (
          <Input {...props.schema.componentProps} />
        )}
        {props.schema.component === 'InputNumber' && (
          <InputNumber {...props.schema.componentProps} />
        )}
        {props.schema.component === 'InputTextArea' && (
          <TextArea {...props.schema.componentProps} />
        )}
        {props.schema.component === 'Select' && (
          <Select {...props.schema.componentProps} />
        )}
        {props.schema.component === 'Checkbox' && (
          <Checkbox {...props.schema.componentProps} />
        )}
        {props.schema.component === 'RadioButtonGroup' && (
          <Radio.Group {...props.schema.componentProps} />
        )}
        {props.schema.component === 'Slider' && (
          <Slider {...props.schema.componentProps} />
        )}
        {props.schema.component === 'Switch' && (
          <Switch {...props.schema.componentProps} />
        )}
        {props.schema.component === 'File' && (
          <FileSelect {...props.schema.componentProps} mode="file" />
        )}
        {props.schema.component === 'Folder' && (
          <FileSelect {...props.schema.componentProps} mode="folder" />
        )}
        {props.schema.component === 'MarkDown' && (
          <MDEditor {...props.schema.componentProps} preview={'edit'} />
        )}

        {typeof props.schema.component == 'object' && props.schema?.component}

        {props.schema.component === 'ProviderSelect' && (
          <ProviderSelect {...props.schema.componentProps}></ProviderSelect>
        )}
      </Form.Item>
    )
  );
});
export default FormModal;
