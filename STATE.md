# State

## Decisoes

- MVP fecha pedido por WhatsApp para fugir do bloqueio de pagamento da Nuvemshop.
- Catalogo inicial vem de scraping publico do `sitemap.xml` e JSON-LD das paginas.
- `src/data/products.json` permanece como snapshot de emergencia; Supabase sera a fonte operacional.
- Supabase da Conexao Perfumaria: `nhbopjnibuxfpkslbawf`.
- Pooler usado para migration: `aws-1-us-east-1.pooler.supabase.com:5432`.
- O numero de WhatsApp foi extraido da pagina de contato atual: `555521981024555`.

## Estado atual

- Schema aplicado no Supabase.
- Catalogo importado: 16 categorias, 392 produtos, 411 variacoes e 1214 imagens.
- Loja conectada ao Supabase pelo server em `src/lib/catalog.ts`, com fallback para `src/data/products.json`.
- Tabelas de operacao criadas e vazias para iniciar admin: `customers`, `orders`, `order_items`.

## Blockers

- Sem acesso administrativo/API da Nuvemshop nesta etapa.
- Frete e pagamento online ficam para a proxima fase.
