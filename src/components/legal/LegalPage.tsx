import { Fragment, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import {
  getLegalDocument,
  LEGAL_CONTACT_EMAIL,
  type LegalDocumentKind,
} from "@/content/legal-documents";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

const relatedDocuments: Array<{ kind: LegalDocumentKind; to: string }> = [
  { kind: "privacy", to: "/privacy" },
  { kind: "consent", to: "/personal-data-consent" },
  { kind: "terms", to: "/terms" },
];

const pageTitles: Record<LegalDocumentKind, { en: string; ru: string }> = {
  privacy: {
    en: "TeamFlow AI — Privacy Policy",
    ru: "TeamFlow AI — Политика обработки персональных данных",
  },
  consent: {
    en: "TeamFlow AI — Personal Data Consent",
    ru: "TeamFlow AI — Согласие на обработку персональных данных",
  },
  terms: {
    en: "TeamFlow AI — Terms of Use",
    ru: "TeamFlow AI — Условия использования",
  },
};

function LegalText({ children }: { children: string }) {
  const parts = children.split(LEGAL_CONTACT_EMAIL);

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? (
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="break-all font-medium text-primary underline underline-offset-4"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export function LegalPage({ kind }: { kind: LegalDocumentKind }) {
  const { lang, t } = useI18n();
  const document = getLegalDocument(lang, kind);

  useEffect(() => {
    window.document.title = pageTitles[kind][lang];
  }, [kind, lang]);

  return (
    <PublicPageShell>
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-5 sm:px-8">
          <BrandLogo className="shrink-0" />
          <LanguageSwitcher className="ml-auto shrink-0 [&_button]:min-h-9 [&_button]:min-w-9" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("legal.backHome")}
        </Link>

        <article className="mt-6 break-words">
          <header className="border-b border-border pb-7">
            <p className="text-sm font-medium text-primary">{document.updated}</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              {document.intro}
            </p>
          </header>

          <nav
            className="my-8 rounded-lg border border-border bg-card p-5"
            aria-label={t("legal.contents")}
          >
            <h2 className="text-sm font-semibold text-foreground">{t("legal.contents")}</h2>
            <ol className="mt-3 grid gap-x-8 gap-y-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              {document.sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#section-${index + 1}`}
                    className="outline-none transition hover:text-primary hover:underline focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-9">
            {document.sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-24">
                <h2 className="text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-[15px] leading-7 text-muted-foreground">
                    <LegalText>{paragraph}</LegalText>
                  </p>
                ))}
                {section.items ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-primary">
                    {section.items.map((item) => (
                      <li key={item}>
                        <LegalText>{item}</LegalText>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <footer className="mt-12 border-t border-border pt-7">
          <p className="text-sm font-semibold text-foreground">{t("legal.related")}</p>
          <nav
            className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm"
            aria-label={t("legal.related")}
          >
            {relatedDocuments
              .filter((item) => item.kind !== kind)
              .map((item) => (
                <Link
                  key={item.kind}
                  to={item.to}
                  className="text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {getLegalDocument(lang, item.kind).shortTitle}
                </Link>
              ))}
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="max-w-full break-all text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
          </nav>
        </footer>
      </main>
    </PublicPageShell>
  );
}
