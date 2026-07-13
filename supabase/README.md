# Supabase

Fundacao SQL para catalogo, pedidos e admin da Conexao Perfumaria.

## Migrations

- `migrations/20260521210000_initial_catalog_admin.sql`
- `migrations/20260614090000_admin_ecommerce_tracking.sql`
- `migrations/20260713170000_inventory_sheet_sync.sql`

A primeira cria as tabelas `categories`, `products`, `product_variants`, `product_images`, `customers`, `orders` e `order_items`.

A segunda adiciona suporte ao admin/e-commerce: IDs publicos independentes da Nuvemshop, `admin_profiles`, `admin_audit_logs`, `order_events`, `tracking_events` e a RPC `refresh_product_stock`.

A terceira adiciona a sincronizacao transacional do estoque da planilha, o historico `inventory_sync_runs` e as funcoes de agendamento do Cron.

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

2. Aplique as migrations em ordem:

```powershell
npm run migrate:supabase
```

O script cria `public.schema_migrations` para nao reaplicar arquivos ja executados.

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

## Sincronizacao de estoque pela planilha

A fonte operacional e a aba `Produtos` da planilha Google nativa:

- planilha: `1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4`;
- aba: `Produtos` (`sheetId` `257370644`);
- identidade: `ID Variacao`;
- quantidade: `Unidades na loja`.

A Edge Function `sync-inventory` baixa o CSV publico, valida o snapshot completo e chama a RPC `sync_inventory_snapshot`. O site continua lendo somente o Supabase e nao precisa de alteracao.

### Ordem de publicacao

1. Aplique as migrations com a conexao local configurada:

```powershell
npm run migrate:supabase
```

2. Publique a Edge Function mantendo a verificacao JWT ativa:

```powershell
npx supabase functions deploy sync-inventory --project-ref nhbopjnibuxfpkslbawf
```

3. Execute o primeiro teste sem gravar estoque:

```powershell
$headers = @{
  Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
  apikey = $env:SUPABASE_SERVICE_ROLE_KEY
  'Content-Type' = 'application/json'
}

Invoke-RestMethod `
  -Method Post `
  -Uri "$env:SUPABASE_URL/functions/v1/sync-inventory" `
  -Headers $headers `
  -Body '{"dryRun":true}'
```

4. Revise todas as diferencas. Somente depois execute uma sincronizacao real trocando o corpo para `{"dryRun":false}`.

5. No Vault do Supabase, crie os secrets:

- `inventory_sync_project_url`: URL do projeto Supabase;
- `inventory_sync_service_role_key`: chave service role do projeto.

6. Ative o agendamento de cinco minutos somente apos validar a execucao real:

```sql
select public.schedule_inventory_sync_cron();
```

### Pausa imediata

Desative o Cron sem remover a funcao ou os dados:

```sql
select public.unschedule_inventory_sync_cron();
```

O historico fica em `public.inventory_sync_runs`. Nenhuma execucao deve registrar chaves, cabecalhos de autorizacao ou o CSV completo.
