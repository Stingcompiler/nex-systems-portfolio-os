import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Container } from "@/components/ui/container";
import { TrackBox } from "@/features/track/track-box";
import { getSeoSettings, getSiteSettings } from "@/lib/api/queries";
import type { Locale } from "@/lib/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: "track" }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);
  return buildMetadata({
    locale: locale as Locale,
    path: "/track",
    title: t("title"),
    description: t("intro"),
    settings,
    seoSettings,
  });
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("track");

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-h1 font-semibold">{t("title")}</h1>
        <p className="mt-3 text-muted">{t("intro")}</p>
        <TrackBox className="mt-8" />
      </div>
    </Container>
  );
}
