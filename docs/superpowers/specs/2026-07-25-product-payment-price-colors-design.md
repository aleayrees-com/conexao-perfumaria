# Destaque de preços por forma de pagamento

## Objetivo

Facilitar a leitura da condição mais vantajosa no catálogo da Conexão
Perfumaria, mantendo a linguagem visual da marca.

## Escopo aprovado

- O valor para pagamento via PIX recebe o verde de destaque e tamanho de fonte
  12% maior que o valor atual do PIX.
- O valor para pagamento no cartão recebe o roxo já presente na paleta da loja.
- Parcelamento, texto de apoio e ordem atual das informações não mudam.
- A regra vale para os cards do catálogo e para a página pública de produto,
  evitando que a condição de pagamento mude de aparência entre telas.

## Implementação

Os componentes de preço passarão a identificar explicitamente os valores de
PIX e cartão por classes semânticas. O CSS aplicará as duas cores e preservará
os tamanhos reduzidos usados em telas móveis, com escala proporcional para o
PIX. Não haverá alteração de dados, cálculo de descontos ou checkout.

## Validação

- Confirmar que PIX aparece verde e mais destacado quando o produto tiver
  preço PIX.
- Confirmar que o preço no cartão aparece em roxo.
- Confirmar que valores sem preço PIX continuam renderizando normalmente.
- Executar lint, testes existentes e build da aplicação.
