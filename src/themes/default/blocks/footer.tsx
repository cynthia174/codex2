import { Link } from '@/core/i18n/navigation';
import {
  BrandLogo,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { Footer as FooterType } from '@/shared/types/blocks/landing';

export function Footer({ footer }: { footer: FooterType }) {
  const productGroup = footer.nav?.items?.[0];
  const productLinks = productGroup?.children ?? [];
  const agreementLinks = footer.agreement?.items ?? [];

  return (
    <footer
      id={footer.id}
      className={`bg-background shrink-0 border-t ${footer.className || ''}`}
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-6 md:grid-cols-[1.2fr_.8fr_1fr]">
        <div className="space-y-3">
          {footer.brand ? <BrandLogo brand={footer.brand} /> : null}
          <p className="text-muted-foreground text-sm">
            {footer.copyright || '© 2026 ProductPic AI. All rights reserved.'}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            {productGroup?.title || '产品'}
          </h2>
          <nav className="flex flex-col gap-2 text-sm">
            {productLinks.map((item, index) => (
              <Link
                key={`${item.title}-${index}`}
                href={item.url || ''}
                target={item.target || '_self'}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.title || ''}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {footer.show_theme !== false ? (
              <ThemeToggler type="button" />
            ) : null}
            {footer.show_locale !== false ? (
              <LocaleSelector type="button" />
            ) : null}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {agreementLinks.map((item, index) => (
              <Link
                key={`${item.title}-${index}`}
                href={item.url || ''}
                target={item.target || '_self'}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.title || ''}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
