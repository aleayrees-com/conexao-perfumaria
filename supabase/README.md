# Supabase

Fundacao SQL para catalogo, pedidos e admin da Conexao Perfumaria.

## Migration inicial

- `migrations/20260521210000_initial_catalog_admin.sql`

Ela cria as tabelas `categories`, `products`, `product_variants`, `product_images`, `customers`, `orders` e `order_items`.

Decisoes principais:

- IDs internos usam UUID.
- IDs legados da Nuvemshop ficam em `products.nuvemshop_product_id`, `product_variants.nuvemshop_variant_id` e snapshots de `order_items`.
- Catalogo publico le apenas categorias ativas e produtos/variantes/imagens de produtos ativos com `published_at` no passado.
- Nao ha policies publicas de escrita; escrita deve passar por backend/server usando service role.
- SKUs ficam indexados, mas nao unicos, porque o catalogo legado tem repeticoes.

## Aplicar no projeto novo

Use somente o Supabase da Conexao Perfumaria. O importador bloqueia o project ref do AlfraOS por seguranca.

1. Configure as variaveis locais sem commitar:

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres.PROJECT_REF:SENHA@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
$env:SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SERVICE_ROLE_KEY"
```

Para o projeto `nhbopjnibuxfpkslbawf`, o host direto `db.PROJECT_REF.supabase.co` resolveu apenas IPv6 neste ambiente. O pooler IPv4 validado foi `aws-1-us-east-1.pooler.supabase.com:5432`.

2. Aplique o schema:

```powershell
npm run migrate:supabase
```

3. Valide o snapshot local sem tocar no banco:

```powershell
npm run import:supabase -- --dry-run
```

4. Importe produtos, variantes e imagens:

```powershell
npm run import:supabase
```

## Uso na loja

A loja le o catalogo pelo server em `src/lib/catalog.ts` quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem no ambiente. A chave service role nao vai para o browser porque o modulo e `server-only`.

Se as variaveis nao existirem ou o Supabase ficar indisponivel, a loja usa `src/data/products.json` como snapshot de emergencia.
