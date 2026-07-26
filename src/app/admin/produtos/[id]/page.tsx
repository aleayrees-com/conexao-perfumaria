import { notFound } from 'next/navigation';

import { ProductImageManager } from '@/components/admin/product-image-manager';
import { ProductPixPriceField } from '@/components/admin/product-pix-price-field';
import { listAdminCategories, getAdminProduct } from '@/lib/admin-data';
import { calculateCardPriceCents } from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

import { updateProductDetailAction } from '../actions';

interface AdminProductPageProps {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

function centsToInput(value: number | null): string {
  return value === null ? '' : (value / 100).toFixed(2);
}

export default async function AdminProductPage({
  params,
}: AdminProductPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    listAdminCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const productPixPriceCents = product.pixPriceCents ?? product.priceCents;

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Editor de produto</p>
          <h1>{product.name}</h1>
        </div>
      </div>

      <form className="admin-editor" action={updateProductDetailAction}>
        <input name="productId" type="hidden" value={product.id} />

        <section className="admin-panel admin-value-editor-summary">
          <div>
            <p>Valores atuais</p>
            <h2>
              PIX: {formatMoney(productPixPriceCents)} · Cartão:{' '}
              {formatMoney(calculateCardPriceCents(productPixPriceCents))}
            </h2>
          </div>
          <span>{product.totalStock} unidades em estoque</span>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Geral</h2>
          </div>
          <div className="admin-form-grid">
            <label>
              Nome
              <input name="name" required defaultValue={product.name} />
            </label>
            <label>
              Slug
              <input name="slug" required defaultValue={product.slug} />
            </label>
            <label>
              Categoria
              <select name="categoryId" defaultValue={product.categoryId ?? ''}>
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={product.status}>
                <option value="active">Ativo</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>
            <label className="admin-field-wide">
              Descrição
              <textarea
                name="description"
                rows={6}
                defaultValue={product.description}
              />
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Valores de venda</h2>
              <p>
                O PIX é editável; o cartão é atualizado em 7,54%
                automaticamente.
              </p>
            </div>
          </div>
          <div className="admin-form-grid">
            <ProductPixPriceField
              defaultPixPriceCents={productPixPriceCents}
              inputName="pixPrice"
            />
            <label>
              Preço de comparação
              <input
                name="compareAtPrice"
                defaultValue={centsToInput(product.compareAtPriceCents)}
              />
            </label>
            <label>
              Publicado em
              <input
                name="publishedAt"
                type="datetime-local"
                defaultValue={
                  product.publishedAt ? product.publishedAt.slice(0, 16) : ''
                }
              />
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Envio</h2>
              <p>Medidas usadas para calcular frete automático.</p>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              Peso unitário (g)
              <input
                min={1}
                name="shippingWeightGrams"
                type="number"
                defaultValue={product.shippingWeightGrams}
              />
            </label>
            <label>
              Altura (cm)
              <input
                min={1}
                name="shippingHeightCm"
                type="number"
                defaultValue={product.shippingHeightCm}
              />
            </label>
            <label>
              Largura (cm)
              <input
                min={1}
                name="shippingWidthCm"
                type="number"
                defaultValue={product.shippingWidthCm}
              />
            </label>
            <label>
              Comprimento (cm)
              <input
                min={1}
                name="shippingLengthCm"
                type="number"
                defaultValue={product.shippingLengthCm}
              />
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Variações, valores e estoque</h2>
              <p>Quando existir variação, ela também precisa ter preço.</p>
            </div>
          </div>
          <div className="admin-variant-list">
            {product.variants.map((variant) => {
              const variantPixPriceCents =
                variant.pixPriceCents ?? variant.priceCents;

              return (
                <fieldset key={variant.id}>
                  <input name="variantId" type="hidden" value={variant.id} />
                  <legend>{variant.label}</legend>
                  <label>
                    Rotulo
                    <input
                      name={`variantLabel:${variant.id}`}
                      defaultValue={variant.label}
                    />
                  </label>
                  <label>
                    SKU
                    <input
                      name={`variantSku:${variant.id}`}
                      defaultValue={variant.sku ?? ''}
                    />
                  </label>
                  <ProductPixPriceField
                    defaultPixPriceCents={variantPixPriceCents}
                    inputName={`variantPixPrice:${variant.id}`}
                  />
                  <label>
                    Estoque
                    <input
                      min={0}
                      name={`variantStock:${variant.id}`}
                      type="number"
                      defaultValue={variant.stock}
                    />
                  </label>
                  <label className="admin-checkbox">
                    <input
                      name={`variantAvailable:${variant.id}`}
                      type="checkbox"
                      defaultChecked={variant.isAvailable}
                    />
                    Disponível
                  </label>
                </fieldset>
              );
            })}
          </div>
        </section>

        <div className="admin-save-bar">
          <button className="admin-primary-button" type="submit">
            Salvar produto
          </button>
        </div>
      </form>

      <ProductImageManager images={product.images} productId={product.id} />
    </section>
  );
}
