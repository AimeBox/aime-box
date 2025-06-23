import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { ChatMinimax } from '@langchain/community/chat_models/minimax';
import { OpenAI } from 'openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ChatOpenAI } from '@langchain/openai';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export class MinimaxProvider extends BaseProvider {
  name: string = ProviderType.MINIMAX;

  description: string;

  defaultApiBase: string = 'https://api.minimaxi.com/v1';

  apiKey: string;

  groupId: string;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.apiKey =
      this.provider.api_key || getEnvironmentVariable('MINIMAX_API_KEY');
    this.groupId =
      this.provider.config.groupId ||
      getEnvironmentVariable('MINIMAX_GROUP_ID');
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      modelName: modelName,
      configuration: {
        apiKey: this.apiKey,
        baseURL: this.provider.api_base || this.defaultApiBase,
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
    // return new ChatMinimax({
    //   model: modelName,
    //   apiKey: apiKey,
    //   streaming: options?.streaming,
    //   temperature: options?.temperature,
    //   topP: options?.top_p,
    //   minimaxApiKey: apiKey,
    // });
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const models = ['MiniMax-M1', 'MiniMax-Text-01', 'DeepSeek-R1'];

    return models
      .map((x) => {
        return {
          name: x,
          enable:
            this.provider.models.find((z) => z.name == x)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    return [];
  }

  async getTTSModels(): Promise<string[]> {
    return ['speech-02-hd', 'speech-02-turbo'];
  }

  async speech(modelName: string, text: string, config: any): Promise<Buffer> {
    const url = `${this.provider.api_base || this.defaultApiBase}/t2a_v2?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        text: text,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: config.speed,
          vol: 1,
          pitch: 0,
          emotion: config.emotion,
          english_normalization: config.english_normalization,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'wav',
        },
      }),
    });
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation audio fail: ${data.base_resp.status_msg}`);
    }
    const buffer = Buffer.from(data.data.audio, 'hex');
    return buffer;
  }

  async getVoice(voice_type: string) {
    const url = `${this.provider.api_base || this.defaultApiBase}/get_voice`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        voice_type: voice_type,
      }),
    });
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation audio fail: ${data.base_resp.status_msg}`);
    }
    const res = voice_type == 'all' ? data : data[voice_type];
    return JSON.stringify(res);
  }

  async cloneVoice(input: {
    filePath: string;
    voice_id?: string;
    accuracy?: number;
    need_noise_reduction?: boolean;
  }) {
    const url = `${this.provider.api_base || this.defaultApiBase}/files/upload?GroupId=${this.groupId}`;
    const formData = new FormData();
    formData.append('purpose', 'voice_clone');
    formData.append('file', fs.createReadStream(input.filePath));
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${this.apiKey}`,
        authority: 'api.minimaxi.com',
      },
      body: formData,
    });
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    let data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation audio fail: ${data.base_resp.status_msg}`);
    }
    const { file_id } = data.file;
    const _voice_id = input.voice_id || uuidv4();
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        file_id: file_id,
        voice_id: _voice_id,
        accuracy: input.accuracy || 0.7,
        need_noise_reduction:
          input.need_noise_reduction !== undefined
            ? input.need_noise_reduction
            : false,
      }),
    });
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation audio fail: ${data.base_resp.status_msg}`);
    }
    return `voice clone success voice_id: ${_voice_id}`;
  }

  async deleteVoice(input: {
    voice_type: 'voice_cloning' | 'voice_generation';
    voice_id: string;
  }) {
    const url = `${this.provider.api_base || this.defaultApiBase}/delete_voice?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        authority: 'api.minimaxi.com',
      },
      body: JSON.stringify(input),
    });
    if (!response.ok)
      throw new Error(`delete voice fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`delete voice fail: ${data.base_resp.status_msg}`);
    }

    return `delete voice success`;
  }

  async textToVideo(input: {
    prompt: string;
    model: 'MiniMax-Hailuo-02' | 'T2V-01-Director' | 'T2V-01';
    prompt_optimizer: boolean;
  }): Promise<string> {
    let url = `${this.provider.api_base || this.defaultApiBase}/video_generation`;
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok)
      throw new Error(`generation video fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
    }

    const { task_id } = data;
    let file_id;

    while (true) {
      url = `${this.provider.api_base || this.defaultApiBase}/query/video_generation?task_id=${task_id}`;
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!response.ok)
        throw new Error(`generation video fail: ${await response.text()}`);
      const data = await response.json();
      if (data.base_resp.status_code !== 0) {
        throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
      }
      const { status } = data;
      console.log(`task_id: ${task_id} status: ${status}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (status == 'Success') {
        file_id = data.file_id;
        break;
      } else if (status == 'Fail') {
        throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
      }
    }
    const download_url = await this.downloadFile(file_id);
    return download_url;
  }

  async imageToVideo(input: {
    prompt: string;
    model: 'I2V-01' | 'I2V-01-Director' | 'I2V-01-live';
    first_frame_image: string;
    subject_reference: string;
  }): Promise<string> {
    let url = `${this.provider.api_base || this.defaultApiBase}/video_generation`;
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok)
      throw new Error(`generation video fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
    }

    const { task_id } = data;
    let file_id;

    while (true) {
      url = `${this.provider.api_base || this.defaultApiBase}/query/video_generation?task_id=${task_id}`;
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok)
        throw new Error(`generation video fail: ${await response.text()}`);
      const data = await response.json();
      if (data.base_resp.status_code !== 0) {
        throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
      }
      const { status } = data;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log(`task_id: ${task_id} status: ${status}`);
      if (status == 'Success') {
        file_id = data.file_id;
        break;
      } else if (status == 'Fail') {
        throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
      }
    }
    const download_url = await this.downloadFile(file_id);
    return download_url;
  }

  async downloadFile(file_id: string): Promise<string> {
    const url = `${this.provider.api_base || this.defaultApiBase}/files/retrieve_content?GroupId=${this.groupId}&file_id=${file_id}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!response.ok)
      throw new Error(`generation video fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
    }

    const { download_url } = data.file;
    return download_url;
  }

  async imageGeneration(input: {
    prompt: string;
    model: 'image-01' | 'image-01-live' | string;
    aspect_ratio: string;
    n?: number;
    prompt_optimizer: boolean;
  }): Promise<string[]> {
    const url = `${this.provider.api_base || this.defaultApiBase}/image_generation`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        aspect_ratio: input.aspect_ratio,
        response_format: 'url',
        n: input.n || 1,
        prompt_optimizer: input.prompt_optimizer || true,
      }),
    });
    if (!response.ok)
      throw new Error(`generation video fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
    }

    const { image_urls } = data.data;
    return image_urls;
  }

  async listFile(): Promise<any> {
    const url = `${this.provider.api_base || this.defaultApiBase}/files/list?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!response.ok)
      throw new Error(`generation video fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation video fail: ${data.base_resp.status_msg}`);
    }
    return data.files;
  }
}
