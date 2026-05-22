# Conexao Perfumaria

Loja independente em Next.js + TypeScript para vender fora do checkout bloqueado da Nuvemshop.

## Stack

- Node 24
- Next.js 16
- React 19
- TypeScript 5.9
- ESLint
- Vitest
- Prettier
- Supabase

## Estrategia

- Importar catalogo publico da Nuvemshop via `sitemap.xml` e paginas de produto.
- Gerar `src/data/products.json` como backup/migracao inicial.
- Usar Supabase como fonte operacional para catalogo, estoque, pedidos e admin.
- Ler catalogo do Supabase no server; cair para o JSON local quando env/banco estiver indisponivel.
- Usar carrinho local e fechamento de pedido por WhatsApp.
- Manter a camada de checkout isolada para plugar gateway depois.
