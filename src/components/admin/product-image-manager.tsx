import type { AdminProductImage } from '@/lib/admin-data';

import {
  deleteProductImageAction,
  moveProductImageAction,
  setPrimaryProductImageAction,
  uploadProductImagesAction,
} from '@/app/admin/produtos/image-actions';

interface ProductImageManagerProps {
  readonly images: readonly AdminProductImage[];
  readonly productId: string;
}

function ProductImageFormFields({ productId }: { readonly productId: string }) {
  return <input name="productId" type="hidden" value={productId} />;
}

export function ProductImageManager({
  images,
  productId,
}: ProductImageManagerProps) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Imagens do produto</h2>
          <p>Envie até 8 fotos JPEG, PNG ou WebP (máximo de 5 MB cada).</p>
        </div>
      </div>

      <form
        action={uploadProductImagesAction}
        className="admin-image-upload-form"
      >
        <ProductImageFormFields productId={productId} />
        <label>
          Selecionar imagens
          <input
            accept="image/jpeg,image/png,image/webp"
            multiple
            name="images"
            required
            type="file"
          />
        </label>
        <label>
          Texto alternativo (opcional)
          <input name="altText" placeholder="Ex.: frasco do perfume" />
        </label>
        <button className="admin-primary-button" type="submit">
          Enviar imagens
        </button>
      </form>

      {images.length === 0 ? (
        <p className="admin-empty-state">Ainda não há imagens neste produto.</p>
      ) : (
        <div className="admin-image-grid">
          {images.map((image) => (
            <article className="admin-product-image-card" key={image.id}>
              {/* External legacy image URLs do not share one safe optimizer host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={image.altText ?? 'Imagem do produto'} src={image.url} />
              <p>
                {image.isPrimary
                  ? 'Imagem principal'
                  : `Posição ${image.sortOrder + 1}`}
              </p>
              <div className="admin-image-actions">
                <form action={setPrimaryProductImageAction}>
                  <ProductImageFormFields productId={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <button className="admin-ghost-button" type="submit">
                    Principal
                  </button>
                </form>
                <form action={moveProductImageAction}>
                  <ProductImageFormFields productId={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <input name="direction" type="hidden" value="up" />
                  <button className="admin-ghost-button" type="submit">
                    Subir
                  </button>
                </form>
                <form action={moveProductImageAction}>
                  <ProductImageFormFields productId={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <input name="direction" type="hidden" value="down" />
                  <button className="admin-ghost-button" type="submit">
                    Descer
                  </button>
                </form>
                <form action={deleteProductImageAction}>
                  <ProductImageFormFields productId={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <button className="admin-danger-button" type="submit">
                    Remover
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
