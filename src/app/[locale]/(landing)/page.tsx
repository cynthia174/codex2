import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common';
import { EcommerceImageGenerator } from '@/shared/blocks/generator';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { getMetadata } from '@/shared/lib/seo';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export const revalidate = 3600;
export const generateMetadata = getMetadata({
  metadataKey: 'pages.index.metadata',
  canonicalUrl: '/',
});

function HeroSection({ section }: { section: Section }) {
  const highlights = (section.highlights as string[]) || [];

  return (
    <section
      id="hero"
      className={cn('pt-24 pb-10 md:pt-32 md:pb-14', section.className)}
    >
      <div className="container">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            {section.badge && (
              <Badge variant="secondary">{section.badge}</Badge>
            )}
          </div>

          <div className="mt-6 space-y-5">
            <h1 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {section.title}
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg leading-8 text-balance">
              {section.description}
            </p>
          </div>

          {highlights.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="border-border bg-background px-3 py-1 text-sm"
                >
                  {item}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {section.buttons?.map((button) => (
              <Button
                asChild
                key={button.title}
                size={button.size || 'default'}
                variant={button.variant || 'default'}
                className="px-5"
              >
                <Link href={button.url ?? ''} target={button.target ?? '_self'}>
                  {button.icon ? (
                    <SmartIcon name={button.icon as string} />
                  ) : null}
                  <span>{button.title}</span>
                </Link>
              </Button>
            ))}
          </div>

          {section.tip && (
            <p className="text-muted-foreground mt-5 max-w-2xl text-sm leading-6">
              {section.tip}
            </p>
          )}
        </div>

        <div className="mt-12" id="studio">
          <EcommerceImageGenerator className="py-0" />
        </div>
      </div>
    </section>
  );
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');

  // get page data
  const page = t.raw('page');
  const hero = (page.sections?.hero || {}) as Section;

  return <HeroSection section={hero} />;
}
