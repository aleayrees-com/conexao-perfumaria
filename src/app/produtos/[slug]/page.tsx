import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductGallery } from '@/components/product-gallery';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { getProductBySlug, getProducts } from '@/lib/catalog';
import { formatMoney, getInstallmentText } from '@/lib/money';
import { formatPortugueseDisplayText } from '@/lib/strings';

interface ProductPageProps {
  readonly params: Promise<{
    readonly slug: string;
  }>;
}

export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: 'Produto não encontrado',
    };
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.imageUrls[0] ? [product.imageUrls[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <section className="product-page">
      <ProductGallery
        imageUrls={product.imageUrls}
        productName={product.name}
      />

      <div className="product-detail">
        <p className="eyebrow">
          {formatPortugueseDisplayText(
            product.category?.name ?? 'Curadoria Conexão',
          )}
        </p>
        <h1>{product.name}</h1>
        <div className="detail-price">
          <strong>{formatMoney(product.priceCents)}</strong>
          <span>{getInstallmentText(product.priceCents)}</span>
          {product.pixPriceCents ? (
            <small>{formatMoney(product.pixPriceCents)} no PIX</small>
          ) : null}
        </div>
        <p>{formatPortugueseDisplayText(product.description)}</p>
        <div className="stock-note">
          <span>
            {product.available ? 'Pronta entrega' : 'Consultar estoque'}
          </span>
          <strong>{product.totalStock} un.</strong>
        </div>
        <ProductPurchasePanel product={product} />
      </div>
    </section>
  );
}
