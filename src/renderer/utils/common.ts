export function transformFlatObjectToNested(
  flatObj: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(flatObj)) {
    // 如果key不包含点号，直接赋值
    if (!key.includes('.')) {
      result[key] = value;
      continue;
    }

    // 分割路径
    const keys = key.split('.');
    let current = result;

    // 遍历路径，创建嵌套结构
    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (!(currentKey in current)) {
        current[currentKey] = {};
      }
      current = current[currentKey];
    }

    // 设置最终值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  return result;
}
