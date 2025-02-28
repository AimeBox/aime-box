import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  ModalProps,
  Radio,
  Select,
  message,
} from 'antd';
import {
  FormProps,
  FormSchema,
  RenderCallbackParams,
} from '../../../types/form';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import TextArea from 'antd/es/input/TextArea';

import { isArray, isBoolean, isFunction } from '../../../main/utils/is';
import FormItem from './FormItem';

interface BasicFormProps extends FormProps {
  value?: object | undefined;
  schemas?: FormSchema[];
  onFinish?: (value: any) => Promise<void>;
  onChange?: (value: any) => void;
  loading?: boolean;
  // onCancel?: (text: string | undefined) => void;
}
const BasicForm = forwardRef((props: BasicFormProps, ref) => {
  const { loading = false, onChange, value } = props;
  const [form] = Form.useForm();
  const [formModel, setFormModel] = useState(undefined);
  const [schemas, setSchemas] = useState(props.schemas);

  useImperativeHandle(ref, () => ({
    updateSchema: (data: FormSchema | FormSchema[]) => {
      setSchemas(isArray(data) ? data : [data]);
    },
  }));
  const onFinish = async () => {
    try {
      const values = await form.validateFields();
      await props.onFinish(values);
    } catch (err) {}
  };
  const onFieldsChange = (changedFields, allFields) => {
    changedFields.forEach((item) => {
      if (item.validated) {
        formModel[item.name[0]] = item.value;
      }
    });
    setFormModel({ ...formModel });
    onChange?.(formModel);
  };
  // useEffect(() => {
  //   setSchemas(props.schemas);
  // }, [props.schemas]);

  useEffect(() => {
    form.resetFields();
    if (props.schemas) {
      props.schemas.forEach((x) => {
        if (x.defaultValue) {
          const defaultValue = {};
          defaultValue[x.field] = x.defaultValue;
          form.setFieldsValue(defaultValue);
        }
      });
    }
    setSchemas(props.schemas);

    setFormModel(form.getFieldsValue());
  }, [props.schemas]);

  useEffect(() => {
    form.setFieldsValue(value);
  }, [form, value]);
  return (
    <Form
      preserve={false}
      form={form}
      autoComplete="off"
      layout={props?.layout}
      onFieldsChange={onFieldsChange}
    >
      {schemas?.map((schema, index) => {
        return (
          <FormItem
            key={schema.field}
            schema={schema}
            formModel={formModel}
            formProps={props}
            allDefaultValues={{}}
          />
        );
      })}
      <div className="flex flex-row">
        <Button type="primary" loading={loading} onClick={() => onFinish()}>
          Submit
        </Button>
      </div>
    </Form>
  );
});

export default BasicForm;
