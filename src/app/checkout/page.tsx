import { CheckoutClient } from '@/components/checkout-client';

export const metadata = {
  title: 'Checkout rápido',
  description:
    'Revise seu carrinho e pague com Pix ou cartão pela InfinitePay.',
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
