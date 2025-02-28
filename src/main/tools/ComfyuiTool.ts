import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { is, isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import { PythonShell, Options } from 'python-shell';
import fs from 'fs';

export interface ComfyuiToolParameters extends ToolParams {
  defaultApiBase?: string;
}

export class ComfyuiTool extends Tool {
  static lc_name() {
    return 'comfyui_tool';
  }

  name: string;

  description: string;

  defaultApiBase: string;

  constructor(params?: ComfyuiToolParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'comfyui_tool',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: `comfyui workflow.`,
    });
    Object.defineProperty(this, 'defaultApiBase', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'http://127.0.0.1:8188',
    });

    this.defaultApiBase = params?.defaultApiBase;
  }

  async _call(fileOrCode: string, runManager, config): Promise<string> {
    if (!this.defaultApiBase) {
      return 'not found python';
    }

    return null;
  }
}
