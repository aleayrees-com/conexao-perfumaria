import { CheckoutClient } from '@/components/checkout-client';

export const metadata = {
  title: 'Checkout rapido',
  description:
    'Revise seu carrinho e envie o pedido para a Conexao Perfumaria pelo WhatsApp.',
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
