// src/decorators/ipc.ts
import { ipcMain } from 'electron';

// 主进程装饰器
export function channel(channelName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // 确保类有注册方法
    if (!target.registerIpcChannels) {
      target.registerIpcChannels = function (instance: any) {
        // 这里会在类装饰器中填充
      };
    }

    // 保存通道信息供后续注册使用
    if (!target._ipcChannels) {
      target._ipcChannels = [];
    }

    target._ipcChannels.push({
      channel: channelName,
      method: propertyKey,
    });

    // 修改原始方法，确保它能在主进程中被正确调用
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      return originalMethod.apply(this, args);
    };
  };
}
