type ColSpanType = number | string;
export interface ColEx {
  style?: any;
  /**
   * raster number of cells to occupy, 0 corresponds to display: none
   * @default none (0)
   * @type ColSpanType
   */
  span?: ColSpanType;

  /**
   * raster order, used in flex layout mode
   * @default 0
   * @type ColSpanType
   */
  order?: ColSpanType;

  /**
   * the layout fill of flex
   * @default none
   * @type ColSpanType
   */
  flex?: ColSpanType;

  /**
   * the number of cells to offset Col from the left
   * @default 0
   * @type ColSpanType
   */
  offset?: ColSpanType;

  /**
   * the number of cells that raster is moved to the right
   * @default 0
   * @type ColSpanType
   */
  push?: ColSpanType;

  /**
   * the number of cells that raster is moved to the left
   * @default 0
   * @type ColSpanType
   */
  pull?: ColSpanType;

  /**
   * <576px and also default setting, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  xs?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;

  /**
   * ≥576px, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  sm?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;

  /**
   * ≥768px, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  md?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;

  /**
   * ≥992px, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  lg?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;

  /**
   * ≥1200px, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  xl?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;

  /**
   * ≥1600px, could be a span value or an object containing above props
   * @type { span: ColSpanType, offset: ColSpanType } | ColSpanType
   */
  xxl?: { span: ColSpanType; offset: ColSpanType } | ColSpanType;
}

export const ComponentTypes = [
  'Input',
  'InputGroup',
  'InputPassword',
  'InputSearch',
  'InputTextArea',
  'InputNumber',
  'InputCountDown',
  'Select',
  'ApiSelect',
  'TreeSelect',
  'ApiTree',
  'ApiTreeSelect',
  'ApiRadioGroup',
  'RadioButtonGroup',
  'RadioGroup',
  'Checkbox',
  'CheckboxGroup',
  'AutoComplete',
  'ApiCascader',
  'Cascader',
  'DatePicker',
  'MonthPicker',
  'RangePicker',
  'WeekPicker',
  'TimePicker',
  'TimeRangePicker',
  'Switch',
  'StrengthMeter',
  'Upload',
  'IconPicker',
  'Render',
  'Slider',
  'Rate',
  'Divider',
  'File',
  'Folder',
  'ApiTransfer',
  'ColorPicker',
  'Tinymce',
  'MarkDown',
  'ProviderSelect',
  'AgentSelect',
  'ToolSelect',
  'JsonEditor',
  'InstanceSelect',
] as const;

export type ComponentType = (typeof ComponentTypes)[number];
// export type ComponentType =
//   | 'Input'
//   | 'InputGroup'
//   | 'InputPassword'
//   | 'InputSearch'
//   | 'InputTextArea'
//   | 'InputNumber'
//   | 'InputCountDown'
//   | 'Select'
//   | 'ApiSelect'
//   | 'TreeSelect'
//   | 'ApiTree'
//   | 'ApiTreeSelect'
//   | 'ApiRadioGroup'
//   | 'RadioButtonGroup'
//   | 'RadioGroup'
//   | 'Checkbox'
//   | 'CheckboxGroup'
//   | 'AutoComplete'
//   | 'ApiCascader'
//   | 'Cascader'
//   | 'DatePicker'
//   | 'MonthPicker'
//   | 'RangePicker'
//   | 'WeekPicker'
//   | 'TimePicker'
//   | 'TimeRangePicker'
//   | 'Switch'
//   | 'StrengthMeter'
//   | 'Upload'
//   | 'IconPicker'
//   | 'Render'
//   | 'Slider'
//   | 'Rate'
//   | 'Divider'
//   | 'File'
//   | 'Folder'
//   | 'ApiTransfer'
//   | 'ColorPicker'
//   | 'Tinymce'
//   | 'MarkDown'
//   | 'ProviderSelect'
//   | 'AgentSelect'
//   | 'ToolSelect'
//   | 'JsonEditor';
