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

interface ProductImageActionFieldsProps {
  readonly imageId: string;
  readonly productId: string;
}

interface ProductImageCardProps {
  readonly image: AdminProductImage;
  readonly imageCount: number;
  readonly imageIndex: number;
  readonly productId: string;
}

interface ProductImageOrderActionProps extends ProductImageActionFieldsProps {
  readonly direction: 'down' | 'up';
  readonly disabled: boolean;
}

function ProductImageFormFields({ productId }: { readonly productId: string }) {
  return <input name="productId" type="hidden" value={productId} />;
}

function ProductImageActionFields({
  imageId,
  productId,
}: ProductImageActionFieldsProps) {
  return (
    <>
      <ProductImageFormFields productId={productId} />
      <input name="imageId" type="hidden" value={imageId} />
    </>
  );
}

function PrimaryImageAction({
  imageId,
  productId,
}: ProductImageActionFieldsProps) {
  return (
    <form action={setPrimaryProductImageAction}>
      <ProductImageActionFields imageId={imageId} productId={productId} />
      <button className="admin-image-primary-button" type="submit">
        Definir como principal
      </button>
    </form>
  );
}

function ProductImageOrderAction({
  direction,
  disabled,
  imageId,
  productId,
}: ProductImageOrderActionProps) {
  const isMovingBack = direction === 'up';

  return (
    <form action={moveProductImageAction}>
      <ProductImageActionFields imageId={imageId} productId={productId} />
      <input name="direction" type="hidden" value={direction} />
      <button
        aria-label={
          isMovingBack ? 'Mover foto para trás' : 'Mover foto para frente'
        }
        className="admin-image-order-button"
        disabled={disabled}
        type="submit"
      >
        {isMovingBack ? '←' : '→'}
      </button>
    </form>
  );
}

function DeleteProductImageAction({
  imageId,
  productId,
}: ProductImageActionFieldsProps) {
  return (
    <form action={deleteProductImageAction}>
      <ProductImageActionFields imageId={imageId} productId={productId} />
      <button className="admin-image-delete-button" type="submit">
        Remover
      </button>
    </form>
  );
}

function ProductImageActions({
  image,
  imageCount,
  imageIndex,
  productId,
}: ProductImageCardProps) {
  return (
    <div className="admin-image-actions">
      {image.isPrimary ? (
        <span className="admin-image-primary-state">Imagem principal</span>
      ) : (
        <PrimaryImageAction imageId={image.id} productId={productId} />
      )}
      <ProductImageOrderAction
        direction="up"
        disabled={imageIndex === 0}
        imageId={image.id}
        productId={productId}
      />
      <ProductImageOrderAction
        direction="down"
        disabled={imageIndex === imageCount - 1}
        imageId={image.id}
        productId={productId}
      />
      <DeleteProductImageAction imageId={image.id} productId={productId} />
    </div>
  );
}

function ProductImagePreview({ image }: { readonly image: AdminProductImage }) {
  return (
    <div className="admin-image-preview">
      {/* External legacy image URLs do not share one safe optimizer host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={image.altText ?? 'Imagem do produto'} src={image.url} />
      {image.isPrimary ? (
        <span className="admin-image-cover-badge">Principal</span>
      ) : null}
    </div>
  );
}

function ProductImageCard({
  image,
  imageCount,
  imageIndex,
  productId,
}: ProductImageCardProps) {
  const cardClassName = image.isPrimary
    ? 'admin-product-image-card is-primary'
    : 'admin-product-image-card';

  return (
    <article className={cardClassName}>
      <ProductImagePreview image={image} />
      <div className="admin-image-card-content">
        <div>
          <span className="admin-image-position">Foto {imageIndex + 1}</span>
          <p>{image.altText ?? 'Sem descrição adicional'}</p>
        </div>
        <ProductImageActions
          image={image}
          imageCount={imageCount}
          imageIndex={imageIndex}
          productId={productId}
        />
      </div>
    </article>
  );
}

function ProductImageManagerHeading({
  imageCount,
}: {
  readonly imageCount: number;
}) {
  return (
    <div className="admin-image-manager-header">
      <div>
        <p className="admin-eyebrow">Galeria do produto</p>
        <h2>Fotos do produto</h2>
        <span>
          A primeira foto é exibida como principal na vitrine da loja.
        </span>
      </div>
      <strong className="admin-image-count">
        {imageCount} {imageCount === 1 ? 'foto' : 'fotos'}
      </strong>
    </div>
  );
}

function ProductImageFileField() {
  return (
    <label className="admin-image-file-field">
      <span>Adicionar fotos</span>
      <input
        accept="image/jpeg,image/png,image/webp"
        multiple
        name="images"
        required
        type="file"
      />
      <small>JPEG, PNG ou WebP · até 5 MB por foto · até 8 por envio</small>
    </label>
  );
}

function ProductImageAltTextField() {
  return (
    <label className="admin-image-alt-field">
      <span>
        Descrição da imagem <em>opcional</em>
      </span>
      <input name="altText" placeholder="Ex.: frasco do perfume" />
      <small>Ajuda clientes e mecanismos de busca a entenderem a foto.</small>
    </label>
  );
}

function ProductImageUploadForm({ productId }: { readonly productId: string }) {
  return (
    <form
      action={uploadProductImagesAction}
      className="admin-image-upload-form"
    >
      <ProductImageFormFields productId={productId} />
      <ProductImageFileField />
      <ProductImageAltTextField />
      <button className="admin-primary-button" type="submit">
        Enviar fotos
      </button>
    </form>
  );
}

function ProductImageGallery({ images, productId }: ProductImageManagerProps) {
  if (images.length === 0) {
    return (
      <div className="admin-image-empty-state">
        <strong>Adicione a primeira foto do produto</strong>
        <span>Ela será marcada automaticamente como imagem principal.</span>
      </div>
    );
  }

  return (
    <div className="admin-image-grid">
      {images.map((image, imageIndex) => (
        <ProductImageCard
          image={image}
          imageCount={images.length}
          imageIndex={imageIndex}
          key={image.id}
          productId={productId}
        />
      ))}
    </div>
  );
}

/**
 * Organizes product photos, their display order, and the storefront cover.
 *
 * @example <ProductImageManager images={[]} productId="product-1" />
 */
export function ProductImageManager({
  images,
  productId,
}: ProductImageManagerProps) {
  return (
    <section className="admin-panel admin-image-manager">
      <ProductImageManagerHeading imageCount={images.length} />
      <ProductImageUploadForm productId={productId} />
      <ProductImageGallery images={images} productId={productId} />
    </section>
  );
}
