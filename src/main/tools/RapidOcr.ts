import { Tool, ToolParams } from '@langchain/core/tools';
//import * as ort from 'onnxruntime-node';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  spawn,
} from 'child_process';
import { isArray, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs, { existsSync } from 'fs';
import { getModelsPath, getTmpPath } from '../utils/path';
import { BaseTool } from './BaseTool';
import Sharp from 'sharp';
import { convertPdfToImages } from '../utils/pdfUtil';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import providersManager from '../providers';
import { getChatModel } from '../llm';
import { getProviderModel } from '../utils/providerUtil';

export interface RapidOcrToolParameters extends ToolParams {
  model: string;
  prompt: string;
}

interface TextBox {
  box: number[][];
  score: number;
}

interface OcrResult {
  text: string;
  confidence: number;
  textBoxes: Array<{
    box: number[][];
    text: string;
    confidence: number;
  }>;
}

export class RapidOcrTool extends BaseTool {
  schema = z.object({
    filePath: z.string().describe('the path of the image file'),
  });

  name: string = 'ocr';

  description: string = 'an ocr tool that accurately extracts text from images';

  configSchema?: FormSchema[] = [
    {
      field: 'model',
      component: 'ProviderSelect',
      label: t('common.model'),
      required: true,
      componentProps: {
        type: 'ocr',
      },
    },
    {
      field: 'prompt',
      component: 'InputTextArea',
      label: t('common.prompt'),
    },
  ];

  model?: string;

  prompt?: string;

  defaultPrompt: string = [
    'Below is the image of one page of a document. Just return the plain text representation of this document as if you were reading it naturally.',
    'ALL tables should be presented in HTML format.',
    'If there are images or figures in the page, present them as "<Image>(left,top),(right,bottom)</Image>", (left,top,right,bottom) are the coordinates of the top-left and bottom-right corners of the image or figure.',
    'Present all titles and headings as H1 headings.',
    'Do not hallucinate.',
  ].join('\n');

  // private keys: string[] = [];

  constructor(params?: RapidOcrToolParameters) {
    super(params);
    this.model = params?.model;
    this.prompt = params?.prompt;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const prompt = this.prompt || this.defaultPrompt;
    if (!(isString(input.filePath) || fs.statSync(input.filePath).isFile())) {
      throw new Error('Please provide a valid file path');
    }
    const ext = path.extname(input.filePath).toLowerCase();
    if (
      !(
        ext == '.jpg' ||
        ext == '.jpeg' ||
        ext == '.png' ||
        ext == '.bmp' ||
        ext == '.tiff' ||
        ext == '.webp' ||
        ext == '.pdf'
      )
    ) {
      throw new Error('extension not supported');
    }
    if (ext == '.pdf') {
      const res = await convertPdfToImages(input.filePath, getTmpPath());
      if (res.length > 0) {
        const results = [];
        for (const image of res) {
          results.push(await this.winOcr(image));
        }
        const dir = path.dirname(res[0]);
        await fs.promises.rmdir(dir, { recursive: true });
        return results.join('\n\n');
      } else {
        throw new Error('Failed to convert pdf to images');
      }
    }
    if (this.model.endsWith('@local')) {
      if (process.platform === 'win32') {
        if (
          !fs.existsSync(
            path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'),
          )
        ) {
          return 'model not found';
        }
        try {
          return this.winOcr(input.filePath);
        } catch (err) {
          if (err.message) {
            throw err;
          }
          const out = iconv.decode(
            Buffer.from(err.stderr.length > 0 ? err.stderr : err.stdout),
            'cp936',
          );

          return out.trim();
        }
      } else if (process.platform === 'darwin') {
        try {
          //await this.initializeModels();
          await this.drawBoundingBoxes(
            input.filePath,
            '/Users/noah/Desktop/xxx.jpg',
          );
          // const result = await this.recognizeText(input.filePath);
          return '';
        } catch (error) {
          console.error('OCR failed:', error);
          return `OCR failed: ${error.message}`;
        }
      }
      return 'Unsupported platform';
    } else {
      const { provider, modelName } = getProviderModel(this.model);
      const model = await getChatModel(provider, modelName, { temperature: 0 });
      let imageBase64;
      if (existsSync(input.filePath)) {
        const image = await fs.promises.readFile(input.filePath);
        imageBase64 = image.toString('base64');
      }
      if (model) {
        const result = await model.invoke([
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ]);
        return result.text;
      }
      return 'Provider not found';
    }
  }

  public async pdfOcr(
    filePath: string,
    splitPage: boolean = true,
  ): Promise<string | string[]> {
    const res = await convertPdfToImages(filePath, getTmpPath());
    if (res.length > 0) {
      const results = [];
      for (const image of res) {
        results.push(await this.winOcr(image));
      }
      const dir = path.dirname(res[0]);
      await fs.promises.rmdir(dir, { recursive: true });
      if (splitPage) {
        return results;
      }
      return results.join('\n\n');
    } else {
      throw new Error('Failed to convert pdf to images');
    }
  }

  public async winOcr(imagePath: string) {
    if (isString(imagePath) || fs.statSync(imagePath).isFile()) {
      const json_res = (await new Promise((resolve, reject) => {
        const process = spawn('RapidOCR-json.exe', {
          cwd: path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'),
        });
        let output = null;
        process.stdin.write(
          `{"image_path": "${imagePath.replaceAll('\\', '/')}"}\n`,
        );
        process.stdout.on('data', (data) => {
          const text = data.toString();

          if (text.startsWith('{"code":')) {
            const j = JSON.parse(text);
            output = j;
            process.kill();
          }
          //process.kill();
        });

        process.stderr.on('data', (data) => {
          process.kill();
        });

        process.on('close', (code) => {
          if (output != null && output.code == 100) {
            resolve(output);
          } else {
            resolve(output);
          }
        });
      })) as any;
      if (json_res.code == 100) {
        return json_res.data.map((x) => x.text).join('');
      } else if (json_res.code == 101) {
        throw new Error(`Error: ${json_res.data}`);
      } else {
        return json_res.data;
      }
    } else {
      throw new Error('Please provide a valid file path');
    }
  }

  private async recognizeText(imagePath: string): Promise<OcrResult> {
    const imageBuffer = fs.readFileSync(imagePath);

    // 1. 图片预处理
    const { preprocessedImage, originalWidth, originalHeight } =
      await this.preprocessImage(imageBuffer);

    // 2. 文本检测
    const textBoxes = await this.detectText(
      preprocessedImage,
      originalWidth,
      originalHeight,
    );

    if (textBoxes.length === 0) {
      return { text: '', confidence: 0, textBoxes: [] };
    }

    // 3. 对每个文本框进行识别
    const results = [];
    let fullText = '';

    for (const box of textBoxes) {
      try {
        // 裁剪文本区域
        //const croppedImage = await this.cropImage(imageBuffer, box.box);

        // 文本方向分类
        // const rotatedImage = await this.classifyTextOrientation(croppedImage);

        // // 文本识别
        // const textResult = await this.recognizeTextFromCrop(rotatedImage);

        // if (textResult.text.trim()) {
        // }
        results.push({
          box: box.box,
          text: '', //textResult.text,
          confidence: 0, //textResult.confidence,
        });

        //fullText += `${textResult.text} `;
      } catch (error) {
        console.warn('Failed to process text box:', error);
      }
    }

    const avgConfidence =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        : 0;

    return {
      text: fullText.trim(),
      confidence: avgConfidence,
      textBoxes: results,
    };
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<{
    preprocessedImage: ort.Tensor;
    originalWidth: number;
    originalHeight: number;
  }> {
    const { data, info } = await Sharp(imageBuffer)
      .resize(640, 640, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const float32Data = new Float32Array(3 * info.height * info.width);

    // 转换为 NCHW 格式 (Channels, Height, Width)
    for (let c = 0; c < 3; c++) {
      for (let h = 0; h < info.height; h++) {
        for (let w = 0; w < info.width; w++) {
          const srcIdx = (h * info.width + w) * 3 + c;
          const dstIdx = c * info.height * info.width + h * info.width + w;
          float32Data[dstIdx] = data[srcIdx] / 255.0; // 归一化到 [0, 1]
        }
      }
    }

    const imageTensor = new ort.Tensor('float32', float32Data, [
      1,
      3,
      info.height,
      info.width,
    ]);

    const originalInfo = await Sharp(imageBuffer).metadata();

    return {
      preprocessedImage: imageTensor,
      originalWidth: originalInfo.width || 640,
      originalHeight: originalInfo.height || 640,
    };
  }

  private async detectText(
    imageTensor: ort.Tensor,
    originalWidth: number,
    originalHeight: number,
  ): Promise<TextBox[]> {
    if (!this.detSession) {
      throw new Error('Detection model not loaded');
    }

    const feeds = { x: imageTensor };
    const results = await this.detSession.run(feeds);

    // 获取输出张量
    const outputName = Object.keys(results)[0];
    const output = results[outputName];

    // 后处理检测结果
    return this.postProcessDetection(output, originalWidth, originalHeight);
  }

  private postProcessDetection(
    output: ort.Tensor,
    originalWidth: number,
    originalHeight: number,
  ): TextBox[] {
    const data = output.data as Float32Array;
    const [batchSize, channels, height, width] = output.dims;

    const textBoxes: TextBox[] = [];
    const scoreThreshold = 0.3;
    const boxThreshold = 0.5;
    const unClipRatio = 1.6;
    const maxSideThresh = 3.0; // 长边门限

    // 1. 创建二值化掩码
    const binaryMask = this.createBinaryMask(data, height, width, boxThreshold);

    // 2. 形态学膨胀
    const dilatedMask = this.dilate(binaryMask, width, height);

    // 3. 查找轮廓
    const contours = this.findContours(dilatedMask, width, height);

    // 4. 处理每个轮廓
    for (const contour of contours) {
      if (contour.length <= 2) {
        continue;
      }

      // 获取最小外接矩形
      const { minBox, maxSide } = this.getMinAreaRect(contour);
      if (maxSide < maxSideThresh) {
        continue;
      }

      // 计算轮廓评分
      const score = this.getScore(contour, data, width, height);
      if (score < scoreThreshold) {
        continue;
      }

      // Unclip操作扩展文本区域
      const unclippedBox = this.unclip(minBox, unClipRatio);
      if (!unclippedBox) {
        continue;
      }

      // 再次获取最小外接矩形
      const { minBox: finalMinBox, maxSide: finalMaxSide } =
        this.getMinAreaRect(unclippedBox);
      if (finalMaxSide < maxSideThresh + 2) {
        continue;
      }

      // 转换到原图坐标
      const scaleX = originalWidth / width;
      const scaleY = originalHeight / height;

      const finalBox = finalMinBox.map(([x, y]) => [
        Math.min(Math.max(x * scaleX, 0), originalWidth),
        Math.min(Math.max(y * scaleY, 0), originalHeight),
      ]);

      textBoxes.push({
        box: finalBox,
        score: score,
      });
    }

    return textBoxes.reverse(); // 匹配C#代码的逆序
  }

  /**
   * 创建二值化掩码
   */
  private createBinaryMask(
    data: Float32Array,
    height: number,
    width: number,
    threshold: number,
  ): Uint8Array {
    const mask = new Uint8Array(height * width);
    for (let i = 0; i < height * width; i++) {
      mask[i] = data[i] > threshold ? 255 : 0;
    }
    return mask;
  }

  /**
   * 形态学膨胀操作
   */
  private dilate(
    mask: Uint8Array,
    width: number,
    height: number,
    kernelSize: number = 2,
  ): Uint8Array {
    const dilated = new Uint8Array(height * width);
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        // 应用膨胀核
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const ny = y + ky;
            const nx = x + kx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = ny * width + nx;
              maxVal = Math.max(maxVal, mask[idx]);
            }
          }
        }

        dilated[y * width + x] = maxVal;
      }
    }

    return dilated;
  }

  /**
   * 改进的轮廓检测，使用边界跟踪算法
   */
  private findContours(
    mask: Uint8Array,
    width: number,
    height: number,
  ): number[][][] {
    const contours: number[][][] = [];
    const visited = new Set<number>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 255 && !visited.has(idx)) {
          const contour = this.traceContourBoundary(
            mask,
            width,
            height,
            x,
            y,
            visited,
          );
          if (contour.length > 2) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * 边界跟踪算法
   */
  private traceContourBoundary(
    mask: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>,
  ): number[][] {
    const contour: number[][] = [];
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    let x = startX;
    let y = startY;
    let dir = 0;

    do {
      const idx = y * width + x;
      if (!visited.has(idx)) {
        visited.add(idx);
        contour.push([x, y]);
      }

      // 查找下一个边界点
      let found = false;
      for (let i = 0; i < 8; i++) {
        const nextDir = (dir + i) % 8;
        const [dx, dy] = directions[nextDir];
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nextIdx = ny * width + nx;
          if (mask[nextIdx] === 255) {
            x = nx;
            y = ny;
            dir = (nextDir + 6) % 8; // 调整搜索方向
            found = true;
            break;
          }
        }
      }

      if (!found) break;

      // 防止无限循环
      if (contour.length > 1000) break;
    } while (!(x === startX && y === startY) || contour.length < 3);

    return contour;
  }

  /**
   * 获取最小外接矩形
   */
  private getMinAreaRect(contour: number[][]): {
    minBox: number[][];
    maxSide: number;
  } {
    if (contour.length < 3) {
      return { minBox: [], maxSide: 0 };
    }

    // 简化实现：计算凸包的最小外接矩形
    const hull = this.convexHull(contour);

    let minArea = Infinity;
    let bestBox: number[][] = [];
    let maxSide = 0;

    // 尝试不同的旋转角度
    for (let angle = 0; angle < 90; angle += 1) {
      const radians = (angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      // 旋转点
      const rotatedPoints = hull.map(([x, y]) => [
        x * cos - y * sin,
        x * sin + y * cos,
      ]);

      // 计算边界框
      let minX = rotatedPoints[0][0];
      let maxX = rotatedPoints[0][0];
      let minY = rotatedPoints[0][1];
      let maxY = rotatedPoints[0][1];

      for (const [x, y] of rotatedPoints) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }

      const width = maxX - minX;
      const height = maxY - minY;
      const area = width * height;

      if (area < minArea) {
        minArea = area;
        maxSide = Math.max(width, height);

        // 反向旋转得到原坐标系的矩形
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const corners = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
        ];

        bestBox = corners.map(([x, y]) => [
          (x - centerX) * cos + (y - centerY) * sin + centerX,
          -(x - centerX) * sin + (y - centerY) * cos + centerY,
        ]);

        // 重新映射到原始轮廓坐标系
        const avgX = contour.reduce((sum, p) => sum + p[0], 0) / contour.length;
        const avgY = contour.reduce((sum, p) => sum + p[1], 0) / contour.length;

        bestBox = bestBox.map(([x, y]) => [
          x - centerX + avgX,
          y - centerY + avgY,
        ]);
      }
    }

    return { minBox: bestBox, maxSide };
  }

  /**
   * 计算凸包（Graham扫描法）
   */
  private convexHull(points: number[][]): number[][] {
    if (points.length < 3) return points;

    // 找到最底下最左的点
    let start = 0;
    for (let i = 1; i < points.length; i++) {
      if (
        points[i][1] < points[start][1] ||
        (points[i][1] === points[start][1] && points[i][0] < points[start][0])
      ) {
        start = i;
      }
    }

    // 按极角排序
    const startPoint = points[start];
    const sortedPoints = points
      .filter((_, i) => i !== start)
      .sort((a, b) => {
        const angleA = Math.atan2(a[1] - startPoint[1], a[0] - startPoint[0]);
        const angleB = Math.atan2(b[1] - startPoint[1], b[0] - startPoint[0]);
        return angleA - angleB;
      });

    // Graham扫描
    const hull = [startPoint];
    for (const point of sortedPoints) {
      while (
        hull.length > 1 &&
        this.crossProduct(
          hull[hull.length - 2],
          hull[hull.length - 1],
          point,
        ) <= 0
      ) {
        hull.pop();
      }
      hull.push(point);
    }

    return hull;
  }

  /**
   * 计算叉积
   */
  private crossProduct(a: number[], b: number[], c: number[]): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  /**
   * 计算轮廓在原始预测图上的平均分数
   */
  private getScore(
    contour: number[][],
    predData: Float32Array,
    width: number,
    height: number,
  ): number {
    // 计算轮廓的边界框
    let minX = contour[0][0];
    let maxX = contour[0][0];
    let minY = contour[0][1];
    let maxY = contour[0][1];

    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // 确保边界在图像范围内
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(width - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(height - 1, Math.ceil(maxY));

    if (minX >= maxX || minY >= maxY) return 0;

    // 创建轮廓掩码
    const roiWidth = maxX - minX + 1;
    const roiHeight = maxY - minY + 1;
    const mask = new Uint8Array(roiWidth * roiHeight);

    // 填充轮廓内部
    const adjustedContour = contour.map(([x, y]) => [x - minX, y - minY]);
    this.fillPolygon(mask, adjustedContour, roiWidth, roiHeight);

    // 计算掩码区域内的平均分数
    let sum = 0;
    let count = 0;

    for (let y = 0; y < roiHeight; y++) {
      for (let x = 0; x < roiWidth; x++) {
        const maskIdx = y * roiWidth + x;
        if (mask[maskIdx] > 0) {
          const imgX = x + minX;
          const imgY = y + minY;
          const imgIdx = imgY * width + imgX;
          sum += predData[imgIdx];
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * 填充多边形内部
   */
  private fillPolygon(
    mask: Uint8Array,
    polygon: number[][],
    width: number,
    height: number,
  ): void {
    if (polygon.length < 3) return;

    // 简单的扫描线填充算法
    for (let y = 0; y < height; y++) {
      const intersections: number[] = [];

      // 找到扫描线与多边形边的交点
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        const [x1, y1] = polygon[i];
        const [x2, y2] = polygon[j];

        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
          if (y1 !== y2) {
            const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
            intersections.push(x);
          }
        }
      }

      // 排序交点
      intersections.sort((a, b) => a - b);

      // 填充交点之间的像素
      for (let i = 0; i < intersections.length; i += 2) {
        if (i + 1 < intersections.length) {
          const startX = Math.max(0, Math.floor(intersections[i]));
          const endX = Math.min(width - 1, Math.ceil(intersections[i + 1]));

          for (let x = startX; x <= endX; x++) {
            mask[y * width + x] = 255;
          }
        }
      }
    }
  }

  /**
   * Unclip操作：扩展文本区域
   */
  private unclip(box: number[][], unclipRatio: number): number[][] | null {
    if (box.length < 3) return null;

    // 计算多边形面积和周长
    const area = Math.abs(this.signedPolygonArea(box));
    const perimeter = this.polygonPerimeter(box);

    if (perimeter < 1.0) return null;

    // 计算扩展距离
    const distance = (area * unclipRatio) / perimeter;

    // 简化的多边形扩展：向外法线方向移动
    return this.expandPolygon(box, distance);
  }

  /**
   * 计算多边形面积（有向面积）
   */
  private signedPolygonArea(points: number[][]): number {
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area +=
        ((points[j][0] - points[i][0]) * (points[j][1] + points[i][1])) / 2;
    }

    return area;
  }

  /**
   * 计算多边形周长
   */
  private polygonPerimeter(points: number[][]): number {
    let perimeter = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }

    return perimeter;
  }

  /**
   * 扩展多边形
   */
  private expandPolygon(points: number[][], distance: number): number[][] {
    const n = points.length;
    const expandedPoints: number[][] = [];

    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;

      // 计算两条边的方向向量
      const v1 = [
        points[i][0] - points[prev][0],
        points[i][1] - points[prev][1],
      ];
      const v2 = [
        points[next][0] - points[i][0],
        points[next][1] - points[i][1],
      ];

      // 归一化
      const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

      if (len1 > 0) {
        v1[0] /= len1;
        v1[1] /= len1;
      }
      if (len2 > 0) {
        v2[0] /= len2;
        v2[1] /= len2;
      }

      // 计算角平分线方向（向外法线）
      const bisector = [
        -(v1[1] + v2[1]), // 垂直方向
        v1[0] + v2[0],
      ];

      const bisectorLen = Math.sqrt(
        bisector[0] * bisector[0] + bisector[1] * bisector[1],
      );
      if (bisectorLen > 0) {
        bisector[0] /= bisectorLen;
        bisector[1] /= bisectorLen;
      }

      // 沿法线方向扩展
      expandedPoints.push([
        points[i][0] + bisector[0] * distance,
        points[i][1] + bisector[1] * distance,
      ]);
    }

    return expandedPoints;
  }

  /**
   * 在图片上绘制文本边界框并保存
   * @param imagePath 输入图片路径
   * @param outputPath 输出图片路径
   * @returns 保存的图片路径
   */
  async drawBoundingBoxes(
    imagePath: string,
    outputPath: string,
  ): Promise<string> {
    try {
      // 执行OCR识别获取文本框
      const ocrResult = await this.recognizeText(imagePath);

      if (ocrResult.textBoxes.length === 0) {
        // 如果没有检测到文本框，直接复制原图
        const imageBuffer = fs.readFileSync(imagePath);
        await Sharp(imageBuffer).jpeg().toFile(outputPath);
        return outputPath;
      }

      // 读取原图
      const imageBuffer = fs.readFileSync(imagePath);
      const { width, height } = await Sharp(imageBuffer).metadata();

      // 创建SVG标记来绘制矩形框
      const svgOverlay = this.createSvgOverlay(
        ocrResult.textBoxes,
        width || 0,
        height || 0,
      );

      // 在图片上绘制矩形框
      await Sharp(imageBuffer)
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0,
          },
        ])
        .jpeg()
        .toFile(outputPath);

      console.log(
        `绘制了 ${ocrResult.textBoxes.length} 个文本框，图片已保存到: ${outputPath}`,
      );
      return outputPath;
    } catch (error) {
      console.error('绘制边界框失败:', error);
      throw error;
    }
  }

  /**
   * 创建SVG覆盖层来绘制矩形框
   */
  private createSvgOverlay(
    textBoxes: Array<{ box: number[][]; text: string; confidence: number }>,
    width: number,
    height: number,
  ): string {
    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    textBoxes.forEach((textBox, index) => {
      const box = textBox.box;

      // 计算矩形的边界
      const xs = box.map((p) => p[0]);
      const ys = box.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const rectWidth = maxX - minX;
      const rectHeight = maxY - minY;

      // 绘制矩形框
      svgContent += `<rect x="${minX}" y="${minY}" width="${rectWidth}" height="${rectHeight}"
                     fill="none" stroke="red" stroke-width="2" opacity="0.8"/>`;

      // 绘制文本标签（可选）
      const fontSize = Math.max(12, Math.min(rectHeight * 0.3, 16));
      svgContent += `<text x="${minX}" y="${minY - 5}" font-family="Arial" font-size="${fontSize}"
                     fill="red" font-weight="bold">${index + 1}</text>`;

      // 绘制识别到的文本（如果空间足够）
      if (rectHeight > 20 && textBox.text.length < 20) {
        const textFontSize = Math.max(10, Math.min(rectHeight * 0.4, 14));
        svgContent += `<text x="${minX + 2}" y="${minY + rectHeight - 5}" font-family="Arial"
                       font-size="${textFontSize}" fill="blue" opacity="0.8">${textBox.text}</text>`;
      }
    });

    svgContent += '</svg>';
    return svgContent;
  }

  dispose(): void {
    this.detSession?.release();
    this.clsSession?.release();
    this.recSession?.release();
  }
}
