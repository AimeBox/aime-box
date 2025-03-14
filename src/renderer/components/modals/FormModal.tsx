import {
  Checkbox,
  Form,
  Input,
  Modal,
  ModalProps,
  Radio,
  Select,
  message,
} from 'antd';
import { FormSchema, RenderCallbackParams } from '../../../types/form';
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import TextArea from 'antd/es/input/TextArea';
import type { FormInstance, FormProps } from 'antd/es/form/Form';
import { isBoolean, isFunction } from '../../../main/utils/is';
import FormItem from '../form/FormItem';

class FormModalEvent extends Event {
  values: any;
}
interface FormModalProps extends ModalProps {
  value?: object | undefined;
  schemas?: FormSchema[];
  onFinish?: (values: object | undefined) => void;
  formProps?: FormProps;
  // onCancel?: (text: string | undefined) => void;
}

export interface FormModalRef extends FormInstance {
  // setValues: (input: Record<string, any>) => void;
  // getValue: (field: string) => any;
  openModal: (
    open: boolean,
    data?: Record<string, any>,
    title?: string | undefined,
    schemas?: FormSchema[] | undefined,
  ) => void;
  closeModal: () => void;
  updateSchema: (field: string, schema: FormSchema) => void;
}
const FormModal = forwardRef(
  (
    props: FormModalProps & ModalProps,
    ref: React.ForwardedRef<FormModalRef>,
  ) => {
    //const eventTarget = new EventTarget();
    //class MyEventTarget extends eventTarget {}
    //const eventTarget = new EventTarget();

    const [eventTarget, setEventTarget] = useState(new EventTarget());
    const [open, setOpen] = useState(props.open);
    const [form] = Form.useForm();
    const [formModel, setFormModel] = useState({});
    const [schemas, setSchemas] = useState(props.schemas);

    const [title, setTitle] = useState(props.title);
    // const [successCallback, setSuccessCallback] = useState((values) => {});
    const openModal = (
      open: boolean,
      data?: Record<string, any>,
      title?: string | undefined,
      schemas?: FormSchema[] | undefined,
      //success: any,
    ) => {
      //setSuccessCallback((successCallback) => success);
      return new Promise((resolve, reject) => {
        const handler = (event: FormModalEvent) => {
          resolve(event.values);
          eventTarget.removeEventListener('onFinish', handler);
        };

        eventTarget.addEventListener('onFinish', handler);
        setEventTarget((eventTarget) => eventTarget);
        if (schemas) setSchemas(schemas);
        else setSchemas(props.schemas);
        if (title) setTitle(title);
        form.resetFields();
        props.schemas.forEach((x) => {
          if (x.defaultValue) {
            const defaultValue = {};
            defaultValue[x.field] = x.defaultValue;
            form.setFieldsValue(defaultValue);
          }
        });

        if (data) {
          setFormModel(data);
          form.setFieldsValue(data);
        } else {
          setFormModel({});
          form.setFieldsValue({});
        }
        setOpen(open);
      });

      // setTimeout(() => {

      // });
      // data = form.getFieldsValue();
      // setFormModel(data);
    };
    const closeModal = () => {
      const e = new FormModalEvent('onFinish');
      eventTarget.dispatchEvent(e);
      setOpen(false);
    };
    const updateSchema = (field: string, schema: FormSchema) => {
      const _schemas = [...schemas];
      const index = schemas.findIndex((x) => x.field === field);
      if (index > -1) {
        _schemas[index] = schema;
      }
      setSchemas(_schemas);
    };
    // const setFieldsValue = (values: Record<string, any>) => {
    //   form.setFieldsValue(values);
    // };
    // const getFieldValue = (field: string) => {
    //   return form.getFieldValue(field);
    // };
    useImperativeHandle(ref, () => ({
      openModal,
      closeModal,
      updateSchema,
      ...form,
    }));
    const onFinish = async () => {
      try {
        const values = await form.validateFields();
        props.onFinish(values);
        const e = new FormModalEvent('onFinish');
        e.values = values;
        eventTarget.dispatchEvent(e);
        // if (typeof successCallback == 'function') {
        //   successCallback(values);
        // }
      } catch (err) {
        console.error(err);
      }
    };
    const onFieldsChange = (changedFields, allFields) => {
      //console.log(changedFields, allFields);
      //setSchemas(schemas);
      //setFormModel(allFields);
      changedFields.forEach((item) => {
        if (item.validated) {
          formModel[item.name[0]] = item?.value;
        }
      });
      setFormModel({ ...formModel });
    };

    return (
      <Modal {...props} onOk={onFinish} open={open} title={title}>
        <Form
          preserve={false}
          form={form}
          autoComplete="off"
          layout={props.formProps?.layout}
          onFieldsChange={onFieldsChange}
        >
          {schemas?.map((schema) => {
            return (
              <FormItem
                key={schema.field}
                schema={schema}
                formModel={formModel}
                formProps={props.formProps}
                allDefaultValues={{}}
              />
            );
          })}
        </Form>
      </Modal>
    );
  },
);

export default FormModal;
// export default function FormModal(props: FormModalProps & ModalProps) {

// }
