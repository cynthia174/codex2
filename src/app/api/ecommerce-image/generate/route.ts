import { AIMediaType } from '@/extensions/ai/types';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask, NewAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getOrCreateLocalGuestUser, getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';
import {
  buildEcommerceImagePrompt,
  ECOMMERCE_IMAGE_MODEL,
  ECOMMERCE_IMAGE_PROVIDER,
  ECOMMERCE_IMAGE_SCENE,
  ECOMMERCE_RATIO_OPTIONS,
  getEcommerceImageCost,
} from '@/shared/services/ecommerce-image';

const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 800;
const MAX_REFERENCE_IMAGES = 14;
const allowAnonymousLocalMode =
  process.env.NEXT_PUBLIC_ALLOW_ANONYMOUS_ECOMMERCE_IMAGE === 'true';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeReferenceUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, MAX_REFERENCE_IMAGES)
    .map((url) => {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('invalid protocol');
        }
        return parsed.toString();
      } catch {
        throw new Error('reference image url is invalid');
      }
    });
}

function normalizeSize(size: string) {
  return (
    ECOMMERCE_RATIO_OPTIONS.find((item) => item.size === size)?.size ||
    ECOMMERCE_RATIO_OPTIONS[0].size
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const productName = asString(body.productName);
    const productDescription = asString(body.productDescription);
    const sellingPoints = asString(body.sellingPoints);
    const audience = asString(body.audience);
    const styleId = asString(body.styleId);
    const backgroundId = asString(body.backgroundId);
    const compositionId = asString(body.compositionId);
    const channelId = asString(body.channelId);
    const size = normalizeSize(asString(body.size) || '1:1');
    const quality = asString(body.quality) || '2K';
    const thinkingLevel = asString(body.thinkingLevel) || 'high';
    const referenceImageUrls = normalizeReferenceUrls(body.referenceImageUrls);

    if (!productName) {
      return respErr('product name is required');
    }

    if (productName.length > MAX_PRODUCT_NAME_LENGTH) {
      return respErr('product name is too long');
    }

    if (
      productDescription.length > MAX_DESCRIPTION_LENGTH ||
      sellingPoints.length > MAX_DESCRIPTION_LENGTH
    ) {
      return respErr('description is too long');
    }

    const user = await getUserInfo();
    const actorUser =
      user ||
      (allowAnonymousLocalMode ? await getOrCreateLocalGuestUser() : null);

    if (!actorUser) {
      return respErr('no auth, please sign in');
    }

    const costCredits = allowAnonymousLocalMode
      ? 0
      : getEcommerceImageCost(quality);
    const remainingCredits = allowAnonymousLocalMode
      ? Number.POSITIVE_INFINITY
      : await getRemainingCredits(actorUser.id);
    if (!allowAnonymousLocalMode && remainingCredits < costCredits) {
      return respErr('insufficient credits');
    }

    const aiService = await getAIService();
    const aiProvider = aiService.getProvider(ECOMMERCE_IMAGE_PROVIDER);
    if (!aiProvider) {
      return respErr('Evolink provider is not configured');
    }

    const prompt = buildEcommerceImagePrompt({
      productName,
      productDescription,
      sellingPoints,
      audience,
      styleId,
      backgroundId,
      compositionId,
      channelId,
    });

    const result = await aiProvider.generate({
      params: {
        mediaType: AIMediaType.IMAGE,
        model: ECOMMERCE_IMAGE_MODEL,
        prompt,
        options: {
          size,
          quality,
          image_urls: referenceImageUrls,
          thinking_level: thinkingLevel,
          image_search: false,
          web_search: false,
        },
      },
    });

    const newAITask: NewAITask = {
      id: getUuid(),
      userId: actorUser.id,
      mediaType: AIMediaType.IMAGE,
      provider: ECOMMERCE_IMAGE_PROVIDER,
      model: ECOMMERCE_IMAGE_MODEL,
      prompt,
      scene: ECOMMERCE_IMAGE_SCENE,
      options: JSON.stringify({
        productName,
        productDescription,
        sellingPoints,
        audience,
        styleId,
        backgroundId,
        compositionId,
        channelId,
        size,
        quality,
        thinkingLevel,
        referenceImageUrls,
      }),
      status: result.taskStatus,
      costCredits,
      taskId: result.taskId,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    };

    await createAITask(newAITask);

    return respData(newAITask);
  } catch (e: any) {
    console.log('ecommerce image generation failed:', e);
    return respErr(e.message || 'ecommerce image generation failed');
  }
}
