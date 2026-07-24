'use client';

import { useId, useState } from 'react';

import { calculateCardPriceCents } from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

interface ProductPixPriceFieldProps {
  readonly defaultPixPriceCents: number;
  readonly inputName: string;
  readonly label?: string;
  readonly onPixPriceCentsChange?: (pixPriceCents: number) => void;
}

function readPriceCents(value: string): number {
  const parsedValue = Number.parseFloat(value.replace(',', '.'));

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.round(parsedValue * 100)
    : 0;
}

export function ProductPixPriceField({
  defaultPixPriceCents,
  inputName,
  label = 'Preço PIX',
  onPixPriceCentsChange,
}: ProductPixPriceFieldProps) {
  const [pixValue, setPixValue] = useState(
    (defaultPixPriceCents / 100).toFixed(2),
  );
  const cardPriceCents = calculateCardPriceCents(readPriceCents(pixValue));
  const cardOutputId = useId();

  return (
    <>
      <label>
        {label}
        <input
          aria-describedby={cardOutputId}
          inputMode="decimal"
          min="0"
          name={inputName}
          onChange={(event) => {
            const nextValue = event.target.value;

            setPixValue(nextValue);
            onPixPriceCentsChange?.(readPriceCents(nextValue));
          }}
          required
          step="0.01"
          type="number"
          value={pixValue}
        />
      </label>
      <label>
        Cartão (automático)
        <output id={cardOutputId}>{formatMoney(cardPriceCents)}</output>
      </label>
    </>
  );
}
