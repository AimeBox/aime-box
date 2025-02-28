export const getProviderModel = (providerModel: string) => {
  try {
    const _ = providerModel.split('@');
    return { modelName: _[0], provider: _[1] };
  } catch {
    return undefined;
  }
};
