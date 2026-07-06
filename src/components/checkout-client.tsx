'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { useCart } from '@/components/cart-provider';
import { fetchAddressByCep, normalizeCepInput } from '@/lib/cep-lookup';
import {
  buildCheckoutPayload,
  createPaymentCheckout,
  type CheckoutAddressPayload,
  type CheckoutCustomerPayload,
  type CheckoutShippingOptionPayload,
} from '@/lib/checkout-request';
import { formatMoney } from '@/lib/money';
import { STORE_PICKUP_SHIPPING_QUOTE } from '@/lib/store-pickup';
import { trackEcommerceEvent } from '@/lib/tracking';

type CustomerTextField = Exclude<
  keyof CheckoutCustomerPayload,
  'marketingOptIn'
>;
type AddressField = keyof CheckoutAddressPayload;
type FulfillmentMode = 'shipping' | 'pickup';

const EMPTY_CUSTOMER: CheckoutCustomerPayload = {
  name: '',
  email: '',
  phone: '',
  marketingOptIn: false,
};

const EMPTY_ADDRESS: CheckoutAddressPayload = {
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  complement: '',
};

function formatDeliveryWindow(
  minDays: number | null,
  maxDays: number | null,
): string {
  if (minDays !== null && maxDays !== null) {
    if (minDays === 0 && maxDays === 0) {
      return 'Sem envio';
    }

    return minDays === maxDays
      ? `${minDays} dia útil`
      : `${minDays} a ${maxDays} dias úteis`;
  }

  if (maxDays !== null) {
    return `até ${maxDays} dias úteis`;
  }

  return 'Prazo a confirmar';
}

export function CheckoutClient() {
  const { clearCart, items, updateQuantity } = useCart();
  const [customer, setCustomer] =
    useState<CheckoutCustomerPayload>(EMPTY_CUSTOMER);
  const [address, setAddress] = useState<CheckoutAddressPayload>(EMPTY_ADDRESS);
  const [shippingQuotes, setShippingQuotes] = useState<
    readonly CheckoutShippingOptionPayload[]
  >([]);
  const [fulfillmentMode, setFulfillmentMode] =
    useState<FulfillmentMode>('shipping');
  const [selectedShippingId, setSelectedShippingId] = useState('');
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [cepLookupMessage, setCepLookupMessage] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const subtotalCents = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.unitPriceCents * item.quantity,
        0,
      ),
    [items],
  );
  const normalizedAddressCep = normalizeCepInput(address.cep);
  const selectedShippingQuote =
    fulfillmentMode === 'pickup'
      ? STORE_PICKUP_SHIPPING_QUOTE
      : (shippingQuotes.find((quote) => quote.id === selectedShippingId) ??
        null);
  const visibleShippingQuotes =
    fulfillmentMode === 'pickup'
      ? [STORE_PICKUP_SHIPPING_QUOTE]
      : shippingQuotes;
  const totalCents = subtotalCents + (selectedShippingQuote?.priceCents ?? 0);

  function resetShippingQuotes(): void {
    setShippingQuotes([]);
    setSelectedShippingId('');
  }

  function updateCustomerField(field: CustomerTextField, value: string): void {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function selectFulfillmentMode(mode: FulfillmentMode): void {
    setFulfillmentMode(mode);
    setErrorMessage(null);

    if (mode === 'pickup') {
      setSelectedShippingId(STORE_PICKUP_SHIPPING_QUOTE.id);
      return;
    }

    setSelectedShippingId(shippingQuotes[0]?.id ?? '');
  }

  function updateAddressField(field: AddressField, value: string): void {
    const normalizedCep =
      field === 'cep' ? normalizeCepInput(value) : address.cep;

    setAddress((current) => ({
      ...current,
      [field]:
        field === 'cep'
          ? normalizedCep
          : field === 'state'
            ? value.toUpperCase().slice(0, 2)
            : value,
    }));

    if (field === 'cep') {
      if (normalizedCep.length !== 8) {
        setCepLookupMessage(null);
        setIsLookingUpCep(false);
      }

      resetShippingQuotes();
    }
  }

  useEffect(() => {
    if (fulfillmentMode === 'pickup') {
      return;
    }

    if (normalizedAddressCep.length !== 8) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      async function fillAddressFromCep(): Promise<void> {
        setIsLookingUpCep(true);
        setCepLookupMessage(null);

        try {
          const cepAddress = await fetchAddressByCep({
            cep: normalizedAddressCep,
            signal: controller.signal,
          });

          if (!cepAddress) {
            setCepLookupMessage(
              'CEP não encontrado. Preencha o endereço manualmente.',
            );
            return;
          }

          setAddress((current) =>
            current.cep === normalizedAddressCep
              ? {
                  ...current,
                  city: cepAddress.city,
                  neighborhood: cepAddress.neighborhood,
                  state: cepAddress.state,
                  street: cepAddress.street,
                }
              : current,
          );
          setCepLookupMessage('Endereço preenchido pelo CEP.');
        } catch (error: unknown) {
          if (controller.signal.aborted) {
            return;
          }

          setCepLookupMessage(
            error instanceof Error
              ? 'Não consegui buscar esse CEP agora.'
              : 'Preencha o endereço manualmente.',
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsLookingUpCep(false);
          }
        }
      }

      void fillAddressFromCep();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fulfillmentMode, normalizedAddressCep]);

  function updateCartQuantity(variantId: number, quantity: number): void {
    updateQuantity(variantId, quantity);
    resetShippingQuotes();
  }

  async function calculateShipping(): Promise<void> {
    if (fulfillmentMode === 'pickup') {
      setSelectedShippingId(STORE_PICKUP_SHIPPING_QUOTE.id);
      setErrorMessage(null);
      return;
    }

    if (normalizeCepInput(address.cep).length !== 8) {
      setErrorMessage('Informe um CEP válido para calcular o frete.');
      return;
    }

    setIsQuoting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationCep: address.cep,
          items: buildCheckoutPayload(items),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        readonly quotes?: readonly CheckoutShippingOptionPayload[];
        readonly error?: string;
      } | null;

      if (!response.ok || !data?.quotes?.length) {
        throw new Error(data?.error ?? 'Não foi possível calcular o frete.');
      }

      setShippingQuotes(data.quotes);
      setSelectedShippingId(data.quotes[0]?.id ?? '');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível calcular o frete agora.',
      );
    } finally {
      setIsQuoting(false);
    }
  }

  async function openPaymentCheckout(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedShippingQuote) {
      setErrorMessage('Escolha uma opção de entrega antes de pagar.');
      return;
    }

    const normalizedCep = normalizeCepInput(address.cep);
    const checkoutAddress: CheckoutAddressPayload | undefined =
      fulfillmentMode === 'pickup'
        ? undefined
        : {
            ...address,
            cep: normalizedCep,
            state: address.state.toUpperCase().slice(0, 2),
            complement: address.complement?.trim() || undefined,
          };

    if (fulfillmentMode !== 'pickup' && normalizedCep.length !== 8) {
      setErrorMessage('Informe um CEP válido antes de pagar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { checkoutUrl, tracking } = await createPaymentCheckout(items, {
        customer,
        ...(checkoutAddress ? { address: checkoutAddress } : {}),
        shippingOption: selectedShippingQuote,
      });

      if (tracking) {
        trackEcommerceEvent('begin_checkout', tracking);
      }

      window.location.assign(checkoutUrl);
    } catch {
      setErrorMessage(
        'Não consegui iniciar o pagamento agora. Tenta de novo em instantes.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="checkout-shell">
        <div className="empty-state wide">
          <p>Seu carrinho está vazio. Escolha uma fragrância para começar.</p>
          <Link className="button" href="/produtos">
            Abrir catálogo
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="checkout-shell">
      <form
        className="checkout-card"
        onSubmit={(event) => void openPaymentCheckout(event)}
      >
        <div>
          <p className="eyebrow">Pedido assistido</p>
          <h1>Revise seu pedido e finalize com segurança</h1>
          <p>
            Informe seus dados, escolha o frete e siga para o pagamento com Pix
            ou cartão.
          </p>
        </div>

        <div className="checkout-grid">
          <div className="checkout-lines">
            {items.map((item) => (
              <article className="checkout-line" key={item.variantId}>
                {item.imageUrl ? (
                  <Image
                    alt=""
                    className="cart-line-image"
                    height={88}
                    src={item.imageUrl}
                    width={88}
                  />
                ) : (
                  <div className="cart-line-image placeholder" />
                )}
                <div>
                  <h2>{item.productName}</h2>
                  <p>{item.variantLabel}</p>
                  <span>{formatMoney(item.unitPriceCents)}</span>
                </div>
                <input
                  aria-label={`Quantidade de ${item.productName}`}
                  min={1}
                  type="number"
                  value={item.quantity}
                  onChange={(event) =>
                    updateCartQuantity(
                      item.variantId,
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />
              </article>
            ))}
          </div>

          <div className="checkout-form-panel">
            <fieldset className="checkout-fieldset">
              <legend>Contato</legend>
              <label>
                Nome completo
                <input
                  autoComplete="name"
                  required
                  value={customer.name}
                  onChange={(event) =>
                    updateCustomerField('name', event.target.value)
                  }
                />
              </label>
              <label>
                Telefone
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  value={customer.phone}
                  onChange={(event) =>
                    updateCustomerField('phone', event.target.value)
                  }
                />
              </label>
              <label className="checkout-field-wide">
                E-mail
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={customer.email}
                  onChange={(event) =>
                    updateCustomerField('email', event.target.value)
                  }
                />
              </label>
              <label className="checkout-consent checkout-field-wide">
                <input
                  checked={customer.marketingOptIn}
                  type="checkbox"
                  onChange={(event) =>
                    setCustomer((current) => ({
                      ...current,
                      marketingOptIn: event.target.checked,
                    }))
                  }
                />
                <span>
                  Quero receber ofertas, novidades e recomendações da Conexão
                  Perfumaria.
                </span>
              </label>
            </fieldset>

            <fieldset className="checkout-fieldset checkout-fulfillment-fieldset">
              <legend>Forma de entrega</legend>
              <label className="checkout-consent">
                <input
                  checked={fulfillmentMode === 'shipping'}
                  name="fulfillmentMode"
                  type="radio"
                  value="shipping"
                  onChange={() => selectFulfillmentMode('shipping')}
                />
                <span>Receber em endereço</span>
              </label>
              <label className="checkout-consent">
                <input
                  checked={fulfillmentMode === 'pickup'}
                  name="fulfillmentMode"
                  type="radio"
                  value="pickup"
                  onChange={() => selectFulfillmentMode('pickup')}
                />
                <span>Retirar em loja</span>
              </label>
            </fieldset>

            {fulfillmentMode === 'shipping' ? (
              <fieldset className="checkout-fieldset">
                <legend>Entrega</legend>
                <label>
                  CEP
                  <input
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={address.cep}
                    onChange={(event) =>
                      updateAddressField('cep', event.target.value)
                    }
                  />
                  {isLookingUpCep || cepLookupMessage ? (
                    <span className="checkout-field-hint">
                      {isLookingUpCep ? 'Buscando CEP...' : cepLookupMessage}
                    </span>
                  ) : null}
                </label>
                <label>
                  Estado
                  <input
                    autoComplete="address-level1"
                    maxLength={2}
                    required
                    value={address.state}
                    onChange={(event) =>
                      updateAddressField('state', event.target.value)
                    }
                  />
                </label>
                <label className="checkout-field-wide">
                  Rua
                  <input
                    autoComplete="address-line1"
                    required
                    value={address.street}
                    onChange={(event) =>
                      updateAddressField('street', event.target.value)
                    }
                  />
                </label>
                <label>
                  Número
                  <input
                    autoComplete="address-line2"
                    required
                    value={address.number}
                    onChange={(event) =>
                      updateAddressField('number', event.target.value)
                    }
                  />
                </label>
                <label>
                  Bairro
                  <input
                    required
                    value={address.neighborhood}
                    onChange={(event) =>
                      updateAddressField('neighborhood', event.target.value)
                    }
                  />
                </label>
                <label>
                  Cidade
                  <input
                    autoComplete="address-level2"
                    required
                    value={address.city}
                    onChange={(event) =>
                      updateAddressField('city', event.target.value)
                    }
                  />
                </label>
                <label>
                  Complemento
                  <input
                    value={address.complement ?? ''}
                    onChange={(event) =>
                      updateAddressField('complement', event.target.value)
                    }
                  />
                </label>
              </fieldset>
            ) : null}

            <div className="checkout-shipping-panel">
              <div>
                <strong>
                  {fulfillmentMode === 'pickup' ? 'Retirada' : 'Frete'}
                </strong>
                <span>
                  {fulfillmentMode === 'pickup'
                    ? 'Retire na loja após a confirmação do pedido.'
                    : 'Calcule pelo CEP antes de pagar.'}
                </span>
              </div>
              {fulfillmentMode === 'shipping' ? (
                <button
                  className="button ghost"
                  type="button"
                  disabled={isQuoting}
                  onClick={() => void calculateShipping()}
                >
                  {isQuoting ? 'Calculando...' : 'Calcular frete'}
                </button>
              ) : null}
              {visibleShippingQuotes.length > 0 ? (
                <div className="checkout-shipping-options">
                  {visibleShippingQuotes.map((quote) => (
                    <label key={quote.id}>
                      <input
                        checked={selectedShippingId === quote.id}
                        name="shippingOption"
                        type="radio"
                        value={quote.id}
                        onChange={() => setSelectedShippingId(quote.id)}
                      />
                      <span>
                        <strong>{quote.serviceName}</strong>
                        <small>
                          {formatMoney(quote.priceCents)} ·{' '}
                          {formatDeliveryWindow(
                            quote.deliveryMinDays,
                            quote.deliveryMaxDays,
                          )}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="checkout-total">
          <span>Subtotal</span>
          <strong>{formatMoney(subtotalCents)}</strong>
        </div>
        <div className="checkout-total compact">
          <span>Frete</span>
          <strong>
            {selectedShippingQuote
              ? formatMoney(selectedShippingQuote.priceCents)
              : 'A calcular'}
          </strong>
        </div>
        <div className="checkout-total">
          <span>Total</span>
          <strong>{formatMoney(totalCents)}</strong>
        </div>

        {errorMessage ? <p className="checkout-error">{errorMessage}</p> : null}

        <div className="checkout-actions">
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Preparando...' : 'Finalizar e pagar'}
          </button>
          <button className="button ghost" type="button" onClick={clearCart}>
            Limpar carrinho
          </button>
        </div>
      </form>
    </section>
  );
}
