import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { getProductBySlug, getProducts } from '@/lib/catalog';
import { formatMoney, getInstallmentText } from '@/lib/money';

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
      title: 'Produto nao encontrado',
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

  const imageUrl = product.imageUrls[0] ?? null;
  const extraImages = product.imageUrls.slice(1, 5);

  return (
    <section className="product-page">
      <div className="product-gallery">
        {imageUrl ? (
          <Image
            alt={product.name}
            className="product-main-image"
            height={720}
            priority
            src={imageUrl}
            width={720}
          />
        ) : (
          <div className="product-main-image placeholder" />
        )}
        {extraImages.length > 0 ? (
          <div className="thumb-row">
            {extraImages.map((image) => (
              <Image
                alt=""
                className="thumb-image"
                height={120}
                key={image}
                src={image}
                width={120}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="product-detail">
        <p className="eyebrow">
          {product.category?.name ?? 'Curadoria Conexao'}
        </p>
        <h1>{product.name}</h1>
        <div className="detail-price">
          <strong>{formatMoney(product.priceCents)}</strong>
          <span>{getInstallmentText(product.priceCents)}</span>
          {product.pixPriceCents ? (
            <small>{formatMoney(product.pixPriceCents)} no PIX</small>
          ) : null}
        </div>
        <p>{product.description}</p>
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
