import {
  AIConfigs,
  AIGenerateParams,
  AIMediaType,
  AIProvider,
  AITaskResult,
  AITaskStatus,
} from './types';

type EvolinkTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

function getErrorMessage(result: any) {
  return (
    result?.error?.message ||
    result?.message ||
    result?.error ||
    'Evolink request failed'
  );
}

function mapTaskStatus(status?: string): AITaskStatus {
  switch (status as EvolinkTaskStatus) {
    case 'completed':
      return AITaskStatus.SUCCESS;
    case 'processing':
      return AITaskStatus.PROCESSING;
    case 'failed':
      return AITaskStatus.FAILED;
    case 'pending':
    default:
      return AITaskStatus.PENDING;
  }
}

function normalizeTaskInfo(data: any) {
  const results = Array.isArray(data?.results) ? data.results : [];

  return {
    images: results.map((url: string, index: number) => ({
      id: `${data?.id || 'evolink'}-${index}`,
      imageType: 'ecommerce-product',
      imageUrl: url,
    })),
    status: data?.status,
    progress: data?.progress,
    errorCode: data?.error?.code,
    errorMessage: data?.error?.message,
  };
}

export class EvolinkProvider implements AIProvider {
  readonly name = 'evolink';

  configs: AIConfigs;

  private baseUrl: string;

  constructor(configs: AIConfigs) {
    this.configs = configs;
    this.baseUrl = configs.baseUrl || 'https://api.evolink.ai';
  }

  private async request(path: string, init: RequestInit = {}) {
    if (!this.configs.apiKey) {
      throw new Error('evolink_api_key is not set');
    }

    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.configs.apiKey}`,
        ...(init.headers || {}),
      },
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error(getErrorMessage(data));
    }

    return data;
  }

  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    if (params.mediaType !== AIMediaType.IMAGE) {
      throw new Error('Evolink currently supports image generation only');
    }

    const options = params.options || {};
    const imageUrls = options.image_urls || options.image_input;
    const callbackUrl =
      params.callbackUrl && params.callbackUrl.startsWith('https://')
        ? params.callbackUrl
        : undefined;

    const payload: Record<string, any> = {
      model: params.model || 'gemini-3.1-flash-image-preview',
      prompt: params.prompt,
      size: options.size || '1:1',
      quality: options.quality || '2K',
      model_params: {
        thinking_level: options.thinking_level || 'high',
        ...(typeof options.web_search === 'boolean'
          ? { web_search: options.web_search }
          : {}),
        ...(typeof options.image_search === 'boolean'
          ? { image_search: options.image_search }
          : {}),
      },
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    };

    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      payload.image_urls = imageUrls;
    }

    const data = await this.request('/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!data?.id) {
      throw new Error('Evolink did not return a task id');
    }

    return {
      taskId: data.id,
      taskStatus: mapTaskStatus(data.status),
      taskInfo: normalizeTaskInfo(data),
      taskResult: data,
    };
  }

  async query({ taskId }: { taskId: string }): Promise<AITaskResult> {
    const data = await this.request(`/v1/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
    });

    if (!data?.id) {
      throw new Error('Evolink task not found');
    }

    return {
      taskId: data.id,
      taskStatus: mapTaskStatus(data.status),
      taskInfo: normalizeTaskInfo(data),
      taskResult: data,
    };
  }
}
