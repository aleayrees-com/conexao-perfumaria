import Image from 'next/image';
import Link from 'next/link';

import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { formatMoney, getInstallmentText } from '@/lib/money';
import type { Product } from '@/types/catalog';

export function ProductCard({ product }: { readonly product: Product }) {
  const imageUrl = product.imageUrls[0] ?? null;

  return (
    <article className="product-card">
      <Link className="product-image-link" href={`/produtos/${product.slug}`}>
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
        <Link href={`/produtos/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{product.category?.name ?? 'Curadoria Conexao'}</p>
        <div className="price-stack">
          <strong>{formatMoney(product.priceCents)}</strong>
          <span>{getInstallmentText(product.priceCents)}</span>
          {product.pixPriceCents ? (
            <small>{formatMoney(product.pixPriceCents)} no PIX</small>
          ) : null}
        </div>
        <ProductPurchasePanel product={product} />
      </div>
    </article>
  );
}
