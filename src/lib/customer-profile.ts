export interface CheckoutCustomerProfileInput {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly marketingOptIn: boolean;
}

export interface CheckoutAddressProfileInput extends Record<string, unknown> {
  readonly cep: string;
  readonly street: string;
  readonly number: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly complement: string | null;
}

export interface CheckoutCustomerRecord {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly default_shipping_address: CheckoutAddressProfileInput;
  readonly marketing_opt_in: boolean;
}

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCustomerPhone(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length > 11) {
    return digits.slice(2);
  }

  return digits;
}

export function mergeMarketingOptIn(
  currentValue: boolean | null | undefined,
  requestedValue: boolean,
): boolean {
  return Boolean(currentValue) || requestedValue;
}

export function buildCheckoutCustomerRecord(input: {
  readonly customer: CheckoutCustomerProfileInput;
  readonly address: CheckoutAddressProfileInput;
}): CheckoutCustomerRecord {
  return {
    default_shipping_address: { ...input.address },
    email: normalizeCustomerEmail(input.customer.email),
    marketing_opt_in: input.customer.marketingOptIn,
    name: input.customer.name.trim(),
    phone: normalizeCustomerPhone(input.customer.phone),
  };
}
