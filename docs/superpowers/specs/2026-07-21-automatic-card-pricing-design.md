# Precificação automática do cartão

## Objetivo

Manter o `Preço PIX` da aba `Produtos` como a única entrada de preço para
sincronização e calcular o preço de cartão automaticamente para a InfinitePay.

## Decisão aprovada

O cálculo será para vendas em **3 parcelas sem juros**, com recebimento da
InfinitePay em **1 dia útil**. A taxa escolhida é **7,01%**.

Para preservar o mesmo valor líquido do PIX, o cartão será calculado em
centavos por `ceil(pix_cents * 10000 / (10000 - fee_basis_points))`. Arredondar
para cima evita que uma fração de centavo faça a loja receber menos que o PIX.
Por exemplo, R$ 480,00 no PIX resulta em R$ 516,19 no cartão.

## Fonte e persistência

O sincronizador do Google Sheets continuará lendo a planilha `Produtos`, mas
passará a consultar apenas as colunas `B` (ID da variação), `I` (Preço PIX),
`J` (estoque) e `L` (link). A coluna `H` (Preço) deixará de ser usada pelo
sincronizador.

Uma tabela interna de configuração terá uma única linha com:

- `card_fee_basis_points = 701`;
- `card_installment_count = 3`.

Ela não ficará acessível ao cliente público. Alterar a taxa futuramente exige
uma atualização pontual nessa configuração, sem reprocessar a planilha.

## Fluxo

1. O cliente altera somente o preço PIX e o estoque na planilha.
2. A sincronização horária valida o preço PIX e obtém a taxa centralizada.
3. O Supabase grava o PIX em `pix_price_cents` e o valor calculado em
   `price_cents`, tanto na variação quanto no produto agregado.
4. O site e o link de pagamento continuam usando `price_cents` para cartão e
   `pix_price_cents` para a informação do PIX.

## Falhas e validação

- Um preço PIX vazio ou inválido interrompe aquela execução e registra o erro
  de forma rastreável; não haverá mais desconto de 3% calculado a partir do
  preço de cartão da planilha.
- A taxa deve estar entre 0 e 9.999 pontos-base e a configuração de parcelas
  deve ser positiva.
- Testes de migração validarão a leitura de `B,I,J,L`, a taxa de 701 pontos-base,
  a fórmula com arredondamento para cima e a preservação da agenda horária e do
  acionamento manual.

## Fora de escopo

A taxa corresponde a 3x. A quantidade máxima de parcelas aceita no checkout
hospedado continua sendo configurada na conta InfinitePay e deve permanecer em
3x para corresponder ao texto exibido no site.
