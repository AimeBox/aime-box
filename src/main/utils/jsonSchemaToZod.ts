import { z } from 'zod';

export const jsonSchemaToZod = (schema: any) => {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  // 处理基本类型
  if (schema.type === 'string') {
    let validator;
    if (schema.enum) {
      validator = z.enum(schema.enum);
    } else {
      validator = z.string();
      if (schema.pattern)
        validator = validator.regex(new RegExp(schema.pattern));
      if (schema.minLength !== undefined)
        validator = validator.min(schema.minLength);
      if (schema.maxLength !== undefined)
        validator = validator.max(schema.maxLength);
    }

    if (schema.description) validator = validator.describe(schema.description);
    validator.default = undefined;

    return z.optional(validator);
  } else if (schema.type === 'number' || schema.type === 'integer') {
    let validator;
    if (schema.enum) {
      validator = z.enum(schema.enum);
    } else {
      validator = schema.type === 'integer' ? z.number().int() : z.number();
      if (schema.minimum !== undefined)
        validator = validator.min(schema.minimum, {
          message: `minimum must be greater than or equal to ${schema.minimum}`,
        });
      if (schema.maximum !== undefined)
        validator = validator.max(schema.maximum, {
          message: `maximum must be less than or equal to ${schema.maximum}`,
        });
    }

    if (schema.description) validator = validator.describe(schema.description);
    validator.default = undefined;
    return z.optional(validator);
  } else if (schema.type === 'boolean') {
    let validator;
    if (schema.enum) {
      validator = z.enum(schema.enum);
    } else {
      validator = z.boolean();
    }

    if (schema.description) validator = validator.describe(schema.description);
    validator.default = undefined;
    return z.optional(validator);
  } else if (schema.type === 'null') {
    let validator = z.null();
    if (schema.description) validator = validator.describe(schema.description);
    validator.default = undefined;
    return z.optional(validator);
  } else if (schema.type === 'array') {
    const itemValidator = schema.items
      ? jsonSchemaToZod(schema.items)
      : z.any();
    let validator = z.array(itemValidator);
    if (schema.minItems !== undefined)
      validator = validator.min(schema.minItems);
    if (schema.maxItems !== undefined)
      validator = validator.max(schema.maxItems);
    if (schema.description) validator = validator.describe(schema.description);
    validator.default = undefined;
    return z.optional(validator);
  } else if (schema.type === 'object') {
    const shape = {};
    let validator;
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        shape[key] = jsonSchemaToZod(propSchema);
      }
      validator = z.object(shape);
    } else {
      validator = z.any();
    }

    // 处理必填字段
    if (schema.required && Array.isArray(schema.required)) {
      const required = {};
      for (const key of schema.required) {
        if (shape[key]) {
          required[key] = shape[key];
        }
      }
      validator = validator.required(required);
    }
    if (schema.description) validator = validator.describe(schema.description);
    return validator;
  }

  // 处理复合类型
  if (schema.anyOf) {
    return z.union(schema.anyOf.map((s) => jsonSchemaToZod(s)));
  } else if (schema.allOf) {
    return schema.allOf.reduce(
      (acc, s) => acc.and(jsonSchemaToZod(s)),
      z.object({}),
    );
  } else if (schema.oneOf) {
    return z.union(schema.oneOf.map((s) => jsonSchemaToZod(s)));
  }

  return z.any();
};
