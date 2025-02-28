import { RuleObject } from 'antd/es/form';
import { ColEx, ComponentType } from '.';
import { FormItem } from './formItem';
import { NamePath } from 'antd/es/form/interface';
import React, { CSSProperties } from 'react';
import { RowProps } from 'antd';

export type Rule = RuleObject & {
  trigger?: 'blur' | 'change' | ['change', 'blur'];
};
export interface RenderCallbackParams {
  schema: FormSchema;
  values: Record<string, any>;
  model: Record<string, any>;
  field: string;
}

export interface FormProps {
  name?: string;
  layout?: 'vertical' | 'inline' | 'horizontal';
  // Form value
  model?: Record<string, any>;
  // The width of all items in the entire form
  labelWidth?: number | string;
  // alignment
  labelAlign?: 'left' | 'right';
  // Row configuration for the entire form
  rowProps?: RowProps;
  // Submit form on reset
  submitOnReset?: boolean;
  // Submit form on form changing
  submitOnChange?: boolean;
  // Col configuration for the entire form
  labelCol?: Partial<ColEx>;
  // Col configuration for the entire form
  wrapperCol?: Partial<ColEx>;

  // General row style
  baseRowStyle?: CSSProperties;

  // General col configuration
  baseColProps?: Partial<ColEx>;

  // Form configuration rules
  schemas?: FormSchema[];
  // Function values used to merge into dynamic control form items
  mergeDynamicData?: Record<string, any>;
  // Compact mode for search forms
  compact?: boolean;
  // Blank line span
  emptySpan?: number | Partial<ColEx>;
  // Internal component size of the form
  size?: 'default' | 'small' | 'large';
  // Whether to disable
  disabled?: boolean;
  // Placeholder is set automatically
  autoSetPlaceHolder?: boolean;
  // Auto submit on press enter on input
  autoSubmitOnEnter?: boolean;
  // Check whether the information is added to the label
  rulesMessageJoinLabel?: boolean;
  // Whether to show collapse and expand buttons
  showAdvancedButton?: boolean;
  // Whether to focus on the first input box, only works when the first form item is input
  autoFocusFirstItem?: boolean;
  // Automatically collapse over the specified number of rows
  autoAdvancedLine?: number;
  // Always show lines
  alwaysShowLines?: number;
  // Whether to show the operation button
  showActionButtonGroup?: boolean;

  // // Reset button configuration
  // resetButtonOptions?: Partial<ButtonProps>;

  // // Confirm button configuration
  // submitButtonOptions?: Partial<ButtonProps>;

  // Operation column configuration
  actionColOptions?: Partial<ColEx>;

  // Show reset button
  showResetButton?: boolean;
  // Show confirmation button
  showSubmitButton?: boolean;

  resetFunc?: () => Promise<void>;
  submitFunc?: () => Promise<void>;
  transformDateFunc?: (date: any) => string;
  colon?: boolean;
}

export interface FormActionType {
  submit: () => Promise<void>;
  setFieldsValue: (values: Record<string, any>) => Promise<void>;
  resetFields: () => Promise<void>;
  getFieldsValue: () => Record<string, any>;
  clearValidate: (name?: string | string[]) => Promise<void>;
  updateSchema: (
    data: Partial<FormSchema> | Partial<FormSchema>[],
  ) => Promise<void>;
  resetSchema: (
    data: Partial<FormSchema> | Partial<FormSchema>[],
  ) => Promise<void>;
  setProps: (formProps: Partial<FormProps>) => Promise<void>;
  removeSchemaByField: (field: string | string[]) => Promise<void>;
  appendSchemaByField: (
    schema: FormSchema | FormSchema[],
    prefixField: string | undefined,
    first?: boolean | undefined,
  ) => Promise<void>;
  validateFields: (nameList?: NamePath[]) => Promise<any>;
  validate: (nameList?: NamePath[] | false) => Promise<any>;
  scrollToField: (name: NamePath, options?: ScrollOptions) => Promise<void>;
}
export interface FormSchema {
  // Field name
  field: string;
  // Extra Fields name[]
  fields?: string[];
  // Event name triggered by internal value change, default change
  changeEvent?: string;
  // Variable name bound to v-model Default value
  valueField?: string;
  // Label name
  label?: string;
  // Auxiliary text
  subLabel?: string;
  // Help text on the right side of the text
  helpMessage?:
    | string
    | string[]
    | ((renderCallbackParams: RenderCallbackParams) => string | string[]);
  // BaseHelp component props
  // helpComponentProps?: Partial<HelpComponentProps>;
  // Label width, if it is passed, the labelCol and WrapperCol configured by itemProps will be invalid
  labelWidth?: string | number;
  // Disable the adjustment of labelWidth with global settings of formModel, and manually set labelCol and wrapperCol by yourself
  disabledLabelWidth?: boolean;
  // render component
  component: ComponentType | React.ReactElement;
  // Component parameters
  componentProps?:
    | ((opt: {
        schema: FormSchema;
        // tableAction: TableActionType;
        formActionType: FormActionType;
        formModel: Record<string, any>;
      }) => Record<string, any>)
    | object;
  // Required
  required?:
    | boolean
    | ((renderCallbackParams: RenderCallbackParams) => boolean);

  suffix?:
    | string
    | number
    | ((values: RenderCallbackParams) => string | number);

  // Validation rules
  rules?: Rule[];
  // Check whether the information is added to the label
  rulesMessageJoinLabel?: boolean;

  // Reference formModelItem
  itemProps?: Partial<FormItem>;

  // col configuration outside formModelItem
  colProps?: Partial<ColEx>;

  // 默认值
  defaultValue?: any;

  // 额外默认值数组对象
  defaultValueObj?: { [key: string]: any };

  // 是否自动处理与时间相关组件的默认值
  isHandleDateDefaultValue?: boolean;

  isAdvanced?: boolean;

  // Matching details components
  span?: number;

  ifShow?: boolean | ((renderCallbackParams: RenderCallbackParams) => boolean);

  show?: boolean | ((renderCallbackParams: RenderCallbackParams) => boolean);

  // // Render the content in the form-item tag
  // render?: (
  //   renderCallbackParams: RenderCallbackParams,
  //   opts: RenderOpts,
  // ) => VNode | VNode[] | string;

  // // Rendering col content requires outer wrapper form-item
  // renderColContent?: (
  //   renderCallbackParams: RenderCallbackParams,
  //   opts: RenderOpts,
  // ) => VNode | VNode[] | string;

  // renderComponentContent?:
  //   | ((renderCallbackParams: RenderCallbackParams, opts: RenderOpts) => any)
  //   | VNode
  //   | VNode[]
  //   | string;

  // Custom slot, in from-item
  slot?: string;

  // Custom slot, similar to renderColContent
  colSlot?: string;

  dynamicDisabled?:
    | boolean
    | ((renderCallbackParams: RenderCallbackParams) => boolean);

  dynamicRules?: (renderCallbackParams: RenderCallbackParams) => Rule[];
}
