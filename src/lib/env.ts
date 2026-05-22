interface PublicEnv {
  readonly siteUrl: string;
  readonly whatsappNumber: string;
}

function readPublicEnv(): PublicEnv {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://conexaoperfumaria.com.br';
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '555521981024555';

  return {
    siteUrl,
    whatsappNumber,
  };
}

export const publicEnv = readPublicEnv();
