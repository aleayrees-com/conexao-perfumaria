export interface ProductImageUploadCandidate {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_COUNT = 8;
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function createImageFileSlug(fileName: string): string {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? '';
  const baseName = fileName.slice(
    0,
    Math.max(0, fileName.length - extension.length),
  );
  const slug = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'imagem'}${extension}`;
}

export function validateProductImageBatch(
  images: readonly ProductImageUploadCandidate[],
): void {
  if (images.length === 0 || images.length > MAX_PRODUCT_IMAGE_COUNT) {
    throw new Error(
      `Image batch has "${images.length}" files; upload between 1 and ${MAX_PRODUCT_IMAGE_COUNT}.`,
    );
  }

  for (const image of images) {
    if (!supportedImageTypes.has(image.type)) {
      throw new Error(`Image "${image.name}" must be JPEG, PNG, or WebP.`);
    }

    if (image.size > MAX_PRODUCT_IMAGE_BYTES) {
      throw new Error(`Image "${image.name}" exceeds the 5 MB upload limit.`);
    }
  }
}

export function createProductImageStoragePath(
  productId: string,
  fileName: string,
  token: string,
): string {
  return `${productId}/${token}-${createImageFileSlug(fileName)}`;
}
