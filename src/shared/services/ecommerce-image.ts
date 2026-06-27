export const ECOMMERCE_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
export const ECOMMERCE_IMAGE_PROVIDER = 'evolink';
export const ECOMMERCE_IMAGE_SCENE = 'ecommerce-product-image';

export const ECOMMERCE_STYLE_PRESETS = [
  {
    id: 'marketplace-clean',
    prompt:
      'premium marketplace catalog photography, clean commercial lighting, product-forward, crisp edges, accurate materials',
  },
  {
    id: 'luxury-editorial',
    prompt:
      'luxury editorial product photography, refined styling, expensive materials, elegant negative space, premium brand campaign',
  },
  {
    id: 'dtc-minimal',
    prompt:
      'modern direct-to-consumer brand photography, minimal composition, soft shadows, contemporary ecommerce aesthetic',
  },
  {
    id: 'social-ad',
    prompt:
      'high-performing social ad creative, thumb-stopping composition, strong visual hierarchy, polished lifestyle detail',
  },
  {
    id: 'natural-organic',
    prompt:
      'natural organic product photography, fresh tactile materials, realistic lifestyle scene, warm daylight, trustworthy feel',
  },
  {
    id: 'tech-premium',
    prompt:
      'premium technology product render photography, precise reflections, sleek materials, controlled studio lighting',
  },
] as const;

export const ECOMMERCE_BACKGROUND_PRESETS = [
  {
    id: 'pure-white',
    prompt:
      'seamless pure white ecommerce background with subtle contact shadow, marketplace-ready',
  },
  {
    id: 'soft-gradient',
    prompt:
      'soft neutral gradient studio background, gentle depth, clean surface, refined shadow',
  },
  {
    id: 'stone-marble',
    prompt:
      'warm stone or marble surface, premium countertop styling, subtle texture, natural reflections',
  },
  {
    id: 'home-lifestyle',
    prompt:
      'tasteful home lifestyle setting, realistic room detail, product naturally staged as the focal point',
  },
  {
    id: 'botanical',
    prompt:
      'fresh botanical setting, leaves or natural props used sparingly, clean brand-safe composition',
  },
  {
    id: 'urban-neon',
    prompt:
      'modern urban studio background with controlled color accents, cinematic reflections, premium contrast',
  },
  {
    id: 'holiday-campaign',
    prompt:
      'seasonal campaign background, festive but restrained props, giftable commercial product scene',
  },
  {
    id: 'outdoor-sun',
    prompt:
      'bright outdoor daylight setting, natural shadows, clean aspirational lifestyle atmosphere',
  },
] as const;

export const ECOMMERCE_COMPOSITION_PRESETS = [
  {
    id: 'center-hero',
    prompt:
      'centered hero product composition, full product visible, balanced margins, professional PDP main image',
  },
  {
    id: 'three-quarter',
    prompt:
      'three-quarter angle view, product depth visible, elegant perspective, realistic contact shadow',
  },
  {
    id: 'flat-lay',
    prompt:
      'premium flat lay composition, organized props, clean spacing, product remains dominant',
  },
  {
    id: 'macro-detail',
    prompt:
      'close-up macro product detail, sharp material texture, shallow depth of field, premium craftsmanship focus',
  },
  {
    id: 'bundle-scene',
    prompt:
      'product bundle or packaging scene, primary item plus tasteful supporting props, clear hierarchy',
  },
] as const;

export const ECOMMERCE_CHANNEL_PRESETS = [
  {
    id: 'amazon',
    prompt:
      'optimized for Amazon or marketplace listing, clean, trustworthy, product clearly readable, no clutter',
  },
  {
    id: 'shopify',
    prompt:
      'optimized for Shopify product detail page, premium brand image, conversion-focused hero visual',
  },
  {
    id: 'instagram',
    prompt:
      'optimized for Instagram or paid social, visually striking, lifestyle-oriented, scroll-stopping crop',
  },
  {
    id: 'xiaohongshu',
    prompt:
      'optimized for Xiaohongshu style commerce, editorial lifestyle feeling, tasteful props, polished lighting',
  },
] as const;

export const ECOMMERCE_RATIO_OPTIONS = [
  { id: '1:1', size: '1:1' },
  { id: '4:5', size: '4:5' },
  { id: '3:4', size: '3:4' },
  { id: '16:9', size: '16:9' },
] as const;

export const ECOMMERCE_QUALITY_OPTIONS = [
  { id: '1K', quality: '1K', credits: 3 },
  { id: '2K', quality: '2K', credits: 5 },
  { id: '4K', quality: '4K', credits: 9 },
] as const;

type Preset = {
  id: string;
  prompt: string;
};

function findPreset<T extends readonly Preset[]>(presets: T, id?: string) {
  return presets.find((preset) => preset.id === id) || presets[0];
}

export function getEcommerceImageCost(quality?: string) {
  return (
    ECOMMERCE_QUALITY_OPTIONS.find((item) => item.quality === quality)
      ?.credits || ECOMMERCE_QUALITY_OPTIONS[1].credits
  );
}

export function buildEcommerceImagePrompt({
  productName,
  productDescription,
  sellingPoints,
  audience,
  styleId,
  backgroundId,
  compositionId,
  channelId,
}: {
  productName: string;
  productDescription?: string;
  sellingPoints?: string;
  audience?: string;
  styleId?: string;
  backgroundId?: string;
  compositionId?: string;
  channelId?: string;
}) {
  const style = findPreset(ECOMMERCE_STYLE_PRESETS, styleId);
  const background = findPreset(ECOMMERCE_BACKGROUND_PRESETS, backgroundId);
  const composition = findPreset(ECOMMERCE_COMPOSITION_PRESETS, compositionId);
  const channel = findPreset(ECOMMERCE_CHANNEL_PRESETS, channelId);

  return [
    'Create one professional ecommerce product image for a real online store.',
    `Product to sell: ${productName.trim()}.`,
    productDescription?.trim()
      ? `Product details: ${productDescription.trim()}.`
      : '',
    sellingPoints?.trim()
      ? `Key selling points to imply visually: ${sellingPoints.trim()}.`
      : '',
    audience?.trim() ? `Target buyer: ${audience.trim()}.` : '',
    `Style direction: ${style.prompt}.`,
    `Background direction: ${background.prompt}.`,
    `Composition direction: ${composition.prompt}.`,
    `Channel direction: ${channel.prompt}.`,
    [
      'Commercial requirements:',
      'make the product the unmistakable focal point',
      'use realistic proportions, believable shadows, and clean reflections',
      'avoid distorted packaging, melted geometry, duplicate products, fake labels, watermarks, UI elements, badges, prices, discount stickers, unreadable text, or random brand logos',
      'do not invent regulated claims or certification marks',
      'leave enough clean space for marketplace cropping',
      'high-end studio quality, sharp focus, photorealistic, ready for ecommerce use',
    ].join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}
