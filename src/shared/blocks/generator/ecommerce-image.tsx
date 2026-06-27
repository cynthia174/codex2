'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Camera,
  Download,
  ImageIcon,
  Layers3,
  Loader2,
  Palette,
  Ratio,
  ShoppingBag,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { AITaskStatus } from '@/extensions/ai/types';
import {
  ImageUploader,
  ImageUploaderValue,
  LazyImage,
} from '@/shared/blocks/common';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import {
  ECOMMERCE_BACKGROUND_PRESETS,
  ECOMMERCE_CHANNEL_PRESETS,
  ECOMMERCE_COMPOSITION_PRESETS,
  ECOMMERCE_QUALITY_OPTIONS,
  ECOMMERCE_RATIO_OPTIONS,
  ECOMMERCE_STYLE_PRESETS,
  getEcommerceImageCost,
} from '@/shared/services/ecommerce-image';

interface BackendTask {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  taskInfo: string | null;
  taskResult: string | null;
}

interface GeneratedImage {
  id: string;
  url: string;
}

interface EcommerceImageDraft {
  version: 1;
  updatedAt: number;
  productName: string;
  productDescription: string;
  sellingPoints: string;
  audience: string;
  styleId: string;
  backgroundId: string;
  compositionId: string;
  channelId: string;
  size: string;
  quality: string;
  referenceImageUrls: string[];
}

const POLL_INTERVAL = 4500;
const GENERATION_TIMEOUT = 180000;
const DRAFT_STORAGE_KEY = 'productpic:ecommerce-image-draft:v1';
const DRAFT_MAX_AGE = 70 * 60 * 60 * 1000;

function readStoredDraft(): EcommerceImageDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) return null;

    const draft = JSON.parse(rawDraft) as EcommerceImageDraft;
    if (
      draft.version !== 1 ||
      !draft.updatedAt ||
      Date.now() - draft.updatedAt > DRAFT_MAX_AGE
    ) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    return draft;
  } catch {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

function clearStoredDraft() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  }
}

function parseJson(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractImageUrls(task: BackendTask) {
  const taskInfo = parseJson(task.taskInfo);
  const taskResult = parseJson(task.taskResult);

  const imageUrls = new Set<string>();

  const addUrl = (value: unknown) => {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      imageUrls.add(value);
    }
  };

  if (Array.isArray(taskInfo?.images)) {
    taskInfo.images.forEach((item: any) => {
      addUrl(item?.imageUrl || item?.url || item?.src);
    });
  }

  if (Array.isArray(taskResult?.results)) {
    taskResult.results.forEach(addUrl);
  }

  const output = taskResult?.output || taskResult?.images || taskResult?.data;
  if (Array.isArray(output)) {
    output.forEach((item: any) => {
      if (typeof item === 'string') {
        addUrl(item);
      } else {
        addUrl(item?.url || item?.imageUrl || item?.src);
      }
    });
  }

  return Array.from(imageUrls);
}

function SelectControl({
  label,
  value,
  onValueChange,
  icon,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label>{label}</Label>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export function EcommerceImageGenerator({ className }: { className?: string }) {
  const t = useTranslations('ai.ecommerce-image.generator');
  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();
  const allowAnonymousLocalMode =
    process.env.NEXT_PUBLIC_ALLOW_ANONYMOUS_ECOMMERCE_IMAGE === 'true';

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [audience, setAudience] = useState('');
  const [styleId, setStyleId] = useState<string>(ECOMMERCE_STYLE_PRESETS[0].id);
  const [backgroundId, setBackgroundId] = useState<string>(
    ECOMMERCE_BACKGROUND_PRESETS[0].id
  );
  const [compositionId, setCompositionId] = useState<string>(
    ECOMMERCE_COMPOSITION_PRESETS[0].id
  );
  const [channelId, setChannelId] = useState<string>(
    ECOMMERCE_CHANNEL_PRESETS[0].id
  );
  const [size, setSize] = useState<string>(ECOMMERCE_RATIO_OPTIONS[0].size);
  const [quality, setQuality] = useState('2K');
  const [referenceImageItems, setReferenceImageItems] = useState<
    ImageUploaderValue[]
  >([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const draft = readStoredDraft();
    if (draft) {
      setProductName(draft.productName || '');
      setProductDescription(draft.productDescription || '');
      setSellingPoints(draft.sellingPoints || '');
      setAudience(draft.audience || '');
      setStyleId(draft.styleId || ECOMMERCE_STYLE_PRESETS[0].id);
      setBackgroundId(draft.backgroundId || ECOMMERCE_BACKGROUND_PRESETS[0].id);
      setCompositionId(
        draft.compositionId || ECOMMERCE_COMPOSITION_PRESETS[0].id
      );
      setChannelId(draft.channelId || ECOMMERCE_CHANNEL_PRESETS[0].id);
      setSize(draft.size || ECOMMERCE_RATIO_OPTIONS[0].size);
      setQuality(draft.quality || '2K');
      setReferenceImageUrls(
        Array.isArray(draft.referenceImageUrls)
          ? draft.referenceImageUrls
              .filter(
                (url) => typeof url === 'string' && /^https?:\/\//.test(url)
              )
              .slice(0, 14)
          : []
      );
    }

    setIsDraftReady(true);
  }, []);

  const persistDraft = useCallback(() => {
    if (typeof window === 'undefined') return;

    const hasUserContent = Boolean(
      productName.trim() ||
        productDescription.trim() ||
        sellingPoints.trim() ||
        audience.trim() ||
        referenceImageUrls.length
    );

    if (!hasUserContent) {
      clearStoredDraft();
      return;
    }

    const draft: EcommerceImageDraft = {
      version: 1,
      updatedAt: Date.now(),
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
      referenceImageUrls,
    };

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    audience,
    backgroundId,
    channelId,
    compositionId,
    productDescription,
    productName,
    quality,
    referenceImageUrls,
    sellingPoints,
    size,
    styleId,
  ]);

  useEffect(() => {
    if (!isDraftReady) return;

    const timer = window.setTimeout(persistDraft, 200);
    return () => window.clearTimeout(timer);
  }, [isDraftReady, persistDraft]);

  const costCredits = useMemo(() => getEcommerceImageCost(quality), [quality]);
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const isReferenceUploading = useMemo(
    () => referenceImageItems.some((item) => item.status === 'uploading'),
    [referenceImageItems]
  );
  const hasReferenceUploadError = useMemo(
    () => referenceImageItems.some((item) => item.status === 'error'),
    [referenceImageItems]
  );
  const canGenerate =
    Boolean(productName.trim()) &&
    !isGenerating &&
    !isReferenceUploading &&
    !hasReferenceUploadError &&
    productName.length <= 120;
  const isAuthPending = !allowAnonymousLocalMode && (!isMounted || isCheckSign);

  const handleReferenceImagesChange = useCallback(
    (items: ImageUploaderValue[]) => {
      setReferenceImageItems(items);
      setReferenceImageUrls(
        items
          .filter((item) => item.status === 'uploaded' && item.url)
          .map((item) => item.url as string)
      );
    },
    []
  );

  const resetTask = useCallback(() => {
    setTaskId(null);
    setTaskStatus(null);
    setProgress(0);
    setStartedAt(null);
    setIsGenerating(false);
  }, []);

  const statusLabel = useMemo(() => {
    switch (taskStatus) {
      case AITaskStatus.PENDING:
        return t('status.pending');
      case AITaskStatus.PROCESSING:
        return t('status.processing');
      case AITaskStatus.SUCCESS:
        return t('status.success');
      case AITaskStatus.FAILED:
        return t('status.failed');
      default:
        return '';
    }
  }, [taskStatus, t]);

  const pollTask = useCallback(
    async (id: string) => {
      if (startedAt && Date.now() - startedAt > GENERATION_TIMEOUT) {
        toast.error(t('errors.timeout'));
        resetTask();
        return true;
      }

      try {
        const resp = await fetch('/api/ai/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: id }),
        });

        const { code, message, data } = await resp.json();
        if (!resp.ok || code !== 0) {
          throw new Error(message || t('errors.query_failed'));
        }

        const task = data as BackendTask;
        const currentStatus = task.status as AITaskStatus;
        const taskResult = parseJson(task.taskResult);
        const taskProgress =
          typeof taskResult?.progress === 'number' ? taskResult.progress : null;
        const imageUrls = extractImageUrls(task);

        setTaskStatus(currentStatus);

        if (typeof taskProgress === 'number') {
          setProgress(Math.min(Math.max(taskProgress, 20), 99));
        } else if (currentStatus === AITaskStatus.PROCESSING) {
          setProgress((prev) => Math.min(prev + 12, 85));
        } else {
          setProgress((prev) => Math.max(prev, 25));
        }

        if (imageUrls.length > 0) {
          setGeneratedImages(
            imageUrls.map((url, index) => ({
              id: `${task.id}-${index}`,
              url,
            }))
          );
        }

        if (currentStatus === AITaskStatus.SUCCESS) {
          clearStoredDraft();
          setProgress(100);
          setIsGenerating(false);
          setTaskId(null);
          setStartedAt(null);
          await fetchUserCredits();
          toast.success(t('messages.generated'));
          return true;
        }

        if (currentStatus === AITaskStatus.FAILED) {
          const taskInfo = parseJson(task.taskInfo);
          toast.error(taskInfo?.errorMessage || t('errors.generate_failed'));
          resetTask();
          await fetchUserCredits();
          return true;
        }

        return false;
      } catch (error: any) {
        toast.error(error.message || t('errors.query_failed'));
        resetTask();
        await fetchUserCredits();
        return true;
      }
    },
    [fetchUserCredits, resetTask, startedAt, t]
  );

  useEffect(() => {
    if (!taskId || !isGenerating) return;

    let cancelled = false;

    const tick = async () => {
      if (!cancelled) {
        const completed = await pollTask(taskId);
        if (completed) cancelled = true;
      }
    };

    tick();

    const timer = setInterval(tick, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isGenerating, pollTask, taskId]);

  const handleRequestSignIn = useCallback(() => {
    persistDraft();
    setIsShowSignModal(true);
  }, [persistDraft, setIsShowSignModal]);

  const handleGenerate = async () => {
    if (!user && !allowAnonymousLocalMode) {
      handleRequestSignIn();
      return;
    }

    if (!allowAnonymousLocalMode && remainingCredits < costCredits) {
      toast.error(t('errors.insufficient_credits'));
      return;
    }

    setGeneratedImages([]);
    setIsGenerating(true);
    setTaskStatus(AITaskStatus.PENDING);
    setProgress(15);
    setStartedAt(Date.now());

    try {
      const resp = await fetch('/api/ecommerce-image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
          thinkingLevel: 'high',
          referenceImageUrls,
        }),
      });

      const { code, message, data } = await resp.json();
      if (!resp.ok || code !== 0) {
        throw new Error(message || t('errors.generate_failed'));
      }

      setTaskId(data.id);
      setProgress(25);
      if (user) {
        await fetchUserCredits();
      }
    } catch (error: any) {
      toast.error(error.message || t('errors.generate_failed'));
      resetTask();
    }
  };

  const handleDownload = async (image: GeneratedImage) => {
    try {
      setDownloadingId(image.id);
      const resp = await fetch(
        `/api/proxy/file?url=${encodeURIComponent(image.url)}`
      );
      if (!resp.ok) {
        throw new Error(t('errors.download_failed'));
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
      toast.success(t('messages.downloaded'));
    } catch (error: any) {
      toast.error(error.message || t('errors.download_failed'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className={cn('py-8 md:py-10', className)}>
      <div className="container">
        <div className="grid gap-6 xl:grid-cols-[minmax(420px,520px)_minmax(0,1fr)]">
          <Card className="self-start">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('title')}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('subtitle')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="space-y-2">
                <Label htmlFor="product-name">{t('form.product')}</Label>
                <Input
                  id="product-name"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  maxLength={120}
                  placeholder={t('form.product_placeholder')}
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{t('form.product_hint')}</span>
                  <span>{productName.length} / 120</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">
                  {t('form.description')}
                </Label>
                <Textarea
                  id="product-description"
                  value={productDescription}
                  onChange={(event) =>
                    setProductDescription(event.target.value)
                  }
                  className="min-h-24"
                  placeholder={t('form.description_placeholder')}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="selling-points">
                    {t('form.selling_points')}
                  </Label>
                  <Textarea
                    id="selling-points"
                    value={sellingPoints}
                    onChange={(event) => setSellingPoints(event.target.value)}
                    className="min-h-20"
                    placeholder={t('form.selling_points_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience">{t('form.audience')}</Label>
                  <Textarea
                    id="audience"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    className="min-h-20"
                    placeholder={t('form.audience_placeholder')}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <SelectControl
                  label={t('style.title')}
                  value={styleId}
                  onValueChange={setStyleId}
                  icon={<Palette className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_STYLE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {t(`style.options.${preset.id}.title`)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl
                  label={t('background.title')}
                  value={backgroundId}
                  onValueChange={setBackgroundId}
                  icon={<ImageIcon className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_BACKGROUND_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {t(`background.options.${preset.id}.title`)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl
                  label={t('composition.title')}
                  value={compositionId}
                  onValueChange={setCompositionId}
                  icon={<Layers3 className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_COMPOSITION_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {t(`composition.options.${preset.id}.title`)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl
                  label={t('channel.title')}
                  value={channelId}
                  onValueChange={setChannelId}
                  icon={<Camera className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_CHANNEL_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {t(`channel.options.${preset.id}.title`)}
                    </SelectItem>
                  ))}
                </SelectControl>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectControl
                  label={t('ratio.title')}
                  value={size}
                  onValueChange={setSize}
                  icon={<Ratio className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_RATIO_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.size}>
                      {t(`ratio.options.${option.id}`)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl
                  label={t('quality.title')}
                  value={quality}
                  onValueChange={setQuality}
                  icon={<Sparkles className="text-muted-foreground size-4" />}
                >
                  {ECOMMERCE_QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.quality}>
                      {option.quality}
                    </SelectItem>
                  ))}
                </SelectControl>
              </div>

              <div className="space-y-2">
                <ImageUploader
                  title={t('form.references')}
                  allowMultiple
                  maxImages={14}
                  maxSizeMB={10}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  uploadUrl="/api/ecommerce-image/upload-reference"
                  wideDropzone
                  defaultPreviews={referenceImageUrls}
                  emptyHint={t('form.references_placeholder')}
                  messages={{
                    drop: t('form.references_drop'),
                    upload: t('form.references_upload'),
                    uploading: t('form.references_uploading'),
                    failed: t('form.references_failed'),
                    maxSize: t('form.references_limit'),
                    replace: t('form.references_replace'),
                    remove: t('form.references_remove'),
                  }}
                  onChange={handleReferenceImagesChange}
                />
                {hasReferenceUploadError && (
                  <p className="text-destructive text-xs">
                    {t('form.references_error')}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {isAuthPending ? (
                  <Button className="w-full" size="lg" disabled>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t('actions.checking')}
                  </Button>
                ) : user || allowAnonymousLocalMode ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('actions.generating')}
                      </>
                    ) : (
                      <>
                        <WandSparkles className="mr-2 size-4" />
                        {t('actions.generate')}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleRequestSignIn}
                  >
                    <WandSparkles className="mr-2 size-4" />
                    {t('actions.sign_in')}
                  </Button>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary">
                    {allowAnonymousLocalMode
                      ? '本地模式可直接生成'
                      : t('credits.cost', { credits: costCredits })}
                  </span>
                  <span>
                    {allowAnonymousLocalMode
                      ? '无需登录'
                      : t('credits.remaining', {
                          credits: isMounted ? remainingCredits : 0,
                        })}
                  </span>
                </div>

                {!allowAnonymousLocalMode &&
                  isMounted &&
                  user &&
                  remainingCredits < costCredits && (
                    <Link href="/pricing">
                      <Button variant="outline" className="w-full">
                        {t('actions.buy_credits')}
                      </Button>
                    </Link>
                  )}
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[520px] self-start">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                    <Box className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {t('preview.title')}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {t('preview.subtitle')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{quality}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              {isGenerating && (
                <div className="space-y-2 rounded-md border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>{statusLabel || t('status.pending')}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {generatedImages.length > 0 ? (
                <div
                  className={
                    generatedImages.length === 1
                      ? 'grid grid-cols-1 gap-5'
                      : 'grid gap-5 md:grid-cols-2'
                  }
                >
                  {generatedImages.map((image) => (
                    <div key={image.id} className="space-y-3">
                      <div className="relative overflow-hidden rounded-md border bg-black/5">
                        <LazyImage
                          src={image.url}
                          alt={t('preview.image_alt')}
                          className="h-auto w-full"
                        />
                        <div className="absolute right-2 bottom-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleDownload(image)}
                            disabled={downloadingId === image.id}
                            title={t('actions.download')}
                          >
                            {downloadingId === image.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-md border border-dashed text-center">
                  <div className="bg-muted mb-4 flex size-16 items-center justify-center rounded-full">
                    <ImageIcon className="text-muted-foreground size-9" />
                  </div>
                  <p className="text-sm font-medium">{t('preview.empty')}</p>
                  <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                    {t('preview.empty_hint')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
