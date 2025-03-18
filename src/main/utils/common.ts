export const removeEmptyValues = (
  obj: Record<string, any>,
): Record<string, any> => {
  const result = { ...obj };

  Object.keys(result).forEach((key) => {
    const value = result[key];

    // 检查值是否为 null、undefined 或空字符串
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      delete result[key];
    }
    // 如果值是对象，递归清理
    else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeEmptyValues(value);
      // 如果清理后对象为空，则删除该属性
      if (Object.keys(result[key]).length === 0) {
        delete result[key];
      }
    }
  });

  return result;
};
