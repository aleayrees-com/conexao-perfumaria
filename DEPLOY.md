# Deploy

Projeto Next.js + TypeScript para subir em qualquer cloud Node compatível.

## Runtime

- Node 24
- npm 11

## Variáveis

Obrigatórias para ler o catálogo do Supabase:

```text
SUPABASE_URL=https://nhbopjnibuxfpkslbawf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://seu-dominio.com.br
NEXT_PUBLIC_WHATSAPP_NUMBER=555521981024555
```

Sem `SUPABASE_SERVICE_ROLE_KEY`, a loja usa `src/data/products.json` como fallback.

## Comandos

```text
npm ci
npm run build
npm start
```

## Observações

- Não commitar `.env` real.
- Girar a `SUPABASE_SERVICE_ROLE_KEY` antes do deploy definitivo.
- O domínio final deve apontar para a cloud escolhida, não para Workers.
