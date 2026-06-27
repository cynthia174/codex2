import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { EcommerceImageGenerator } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'ai.ecommerce-image.metadata',
  canonicalUrl: '/ai-ecommerce-image-generator',
});

export default async function AiEcommerceImageGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('ai.ecommerce-image');

  const page: DynamicPage = {
    title: t.raw('page.title'),
    description: t.raw('page.description'),
    sections: {
      generator: {
        component: <EcommerceImageGenerator />,
      },
    },
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
