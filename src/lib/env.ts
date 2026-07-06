interface PublicEnv {
  readonly siteUrl: string;
  readonly whatsappNumber: string;
  readonly gtmId: string | null;
  readonly gaMeasurementId: string | null;
  readonly metaPixelId: string | null;
  readonly clarityId: string | null;
}

function readPublicEnv(): PublicEnv {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://conexaoimportados.com.br';
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '555521981024555';
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() || null;
  const gaMeasurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID?.trim() || null;

  return {
    siteUrl,
    whatsappNumber,
    gtmId,
    gaMeasurementId,
    metaPixelId,
    clarityId,
  };
}

export const publicEnv = readPublicEnv();

export interface MetaCapiEnv {
  readonly pixelId: string;
  readonly graphApiVersion: string;
  readonly accessToken: string;
  readonly testEventCode: string | null;
}

export function readMetaCapiEnv(): MetaCapiEnv | null {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();

  if (!pixelId || !accessToken) {
    return null;
  }

  return {
    pixelId,
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0',
    accessToken,
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || null,
  };
}
