import { FormSchema } from '../../types/form';

export function ToolField(formSchema: FormSchema): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    Reflect.defineMetadata('toolfield', formSchema, target, propertyKey);
  };
}
