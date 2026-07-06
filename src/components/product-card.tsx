import Image from 'next/image';
import Link from 'next/link';

import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { formatMoney, getInstallmentText } from '@/lib/money';
import { formatPortugueseDisplayText } from '@/lib/strings';
import type { Product } from '@/types/catalog';

export function ProductCard({
  product,
  variant = 'default',
}: {
  readonly product: Product;
  readonly variant?: 'default' | 'editorial';
}) {
  const imageUrl = product.imageUrls[0] ?? null;
  const productHref = `/produtos/${product.slug}`;

  return (
    <article
      className={
        variant === 'editorial' ? 'product-card editorial' : 'product-card'
      }
    >
      <Link className="product-image-link" href={productHref}>
        {imageUrl ? (
          <Image
            alt={product.name}
            className="product-image"
            height={420}
            src={imageUrl}
            width={420}
          />
        ) : (
          <div className="product-image placeholder" />
        )}
        <span className={product.available ? 'stock-pill' : 'stock-pill muted'}>
          {product.available ? 'Pronta entrega' : 'Consultar'}
        </span>
      </Link>
      <div className="product-card-body">
        <Link href={productHref}>
          <h3>{product.name}</h3>
        </Link>
        <p>
          {formatPortugueseDisplayText(
            product.category?.name ?? 'Curadoria Conexão',
          )}
        </p>
        <div className="price-stack">
          <strong>{formatMoney(product.priceCents)}</strong>
          <span>{getInstallmentText(product.priceCents)}</span>
          {product.pixPriceCents ? (
            <small>{formatMoney(product.pixPriceCents)} no PIX</small>
          ) : null}
        </div>
        {variant === 'editorial' ? (
          <Link className="product-card-link" href={productHref}>
            Comprar agora
          </Link>
        ) : (
          <ProductPurchasePanel product={product} />
        )}
      </div>
    </article>
  );
}
