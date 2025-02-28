import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
// import Potrace from 'potrace';

export interface ImageToSvgParameters extends ToolParams {}

export class ImageToSvg extends Tool {
  static lc_name() {
    return 'ImageToSvg';
  }

  name: string;

  description: string;

  constructor(params?: ImageToSvgParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'image_to_svg',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'image convert to svg',
    });
  }

  async _call(filePath: string, runManager, config): Promise<string> {
    // try {
    //   if (!isString(filePath)) {
    //     return 'input value is not filePath';
    //   }
    //   const ext = path.extname(filePath).toLowerCase();
    //   const traced = await Potrace(filePath).trace();
    // } catch (err) {
    //   return JSON.stringify(err);
    // }
    return null;
  }
}
