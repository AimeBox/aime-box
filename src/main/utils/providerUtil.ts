export const getProviderModel = (providerModel: string) => {
  try {
    const _ = providerModel.lastIndexOf('@');
    return {
      modelName: providerModel.slice(0, _),
      provider: providerModel.slice(_ + 1),
    };
  } catch {
    return undefined;
  }
};
