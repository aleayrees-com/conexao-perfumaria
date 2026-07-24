'use server';

import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-auth';
import {
  createAdminClient,
  insertAdminAuditLog,
  revalidateStorefrontCatalog,
} from '@/lib/admin-data';
import {
  createProductImageStoragePath,
  validateProductImageBatch,
} from '@/lib/admin-product-images';

const PRODUCT_IMAGE_BUCKET = 'conexao-product-images';

type ProductImageClient = ReturnType<typeof createAdminClient>;

function readActionString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readUploadedImageFiles(formData: FormData): File[] {
  return formData
    .getAll('images')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function readProductImageStoragePath(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);

  return markerIndex === -1
    ? null
    : decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
}

async function ensureProductImageBucket(
  client: ProductImageClient,
): Promise<void> {
  const bucket = await client.storage.getBucket(PRODUCT_IMAGE_BUCKET);

  if (bucket.data) {
    return;
  }

  const createdBucket = await client.storage.createBucket(
    PRODUCT_IMAGE_BUCKET,
    {
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      fileSizeLimit: '5242880',
      public: true,
    },
  );

  if (createdBucket.error) {
    throw new Error(
      `Falha ao preparar o armazenamento de imagens: ${createdBucket.error.message}`,
    );
  }
}

async function uploadProductImage(
  client: ProductImageClient,
  productId: string,
  image: File,
): Promise<string> {
  const path = createProductImageStoragePath(
    productId,
    image.name,
    randomUUID(),
  );
  const upload = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, await image.arrayBuffer(), { contentType: image.type });

  if (upload.error) {
    throw new Error(
      `Falha ao enviar a imagem "${image.name}": ${upload.error.message}`,
    );
  }

  return client.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

async function refreshProductEditor(productId: string): Promise<void> {
  revalidateStorefrontCatalog();
  redirect(`/admin/produtos/${productId}`);
}

async function assignNextProductImageAsPrimary(
  client: ProductImageClient,
  productId: string,
): Promise<void> {
  const nextImage = await client
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextImage.error) {
    throw new Error(
      `Falha ao localizar a nova imagem principal: ${nextImage.error.message}`,
    );
  }

  if (!nextImage.data) {
    return;
  }

  const updatedImage = await client
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', nextImage.data.id);

  if (updatedImage.error) {
    throw new Error(
      `Falha ao definir a nova imagem principal: ${updatedImage.error.message}`,
    );
  }
}

export async function uploadProductImagesAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId = readActionString(formData, 'productId');
  const images = readUploadedImageFiles(formData);
  validateProductImageBatch(images);
  const client = createAdminClient();
  await ensureProductImageBucket(client);
  const currentImages = await client
    .from('product_images')
    .select('sort_order,is_primary')
    .eq('product_id', productId);

  if (currentImages.error) {
    throw new Error(
      `Falha ao carregar imagens do produto "${productId}": ${currentImages.error.message}`,
    );
  }

  const maxSortOrder = Math.max(
    -1,
    ...(currentImages.data ?? []).map((image) => image.sort_order),
  );
  const hasPrimaryImage = (currentImages.data ?? []).some(
    (image) => image.is_primary,
  );
  const urls = await Promise.all(
    images.map((image) => uploadProductImage(client, productId, image)),
  );
  const insertedImages = await client.from('product_images').insert(
    urls.map((url, index) => ({
      alt_text: readActionString(formData, 'altText') || null,
      is_primary: !hasPrimaryImage && index === 0,
      product_id: productId,
      sort_order: maxSortOrder + index + 1,
      url,
    })),
  );

  if (insertedImages.error) {
    throw new Error(
      `Falha ao registrar imagens do produto "${productId}": ${insertedImages.error.message}`,
    );
  }

  await insertAdminAuditLog(client, {
    action: 'product_images_uploaded',
    entityType: 'products',
    entityId: productId,
    metadata: { imageCount: images.length },
  });
  await refreshProductEditor(productId);
}

export async function setPrimaryProductImageAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const imageId = readActionString(formData, 'imageId');
  const productId = readActionString(formData, 'productId');
  const client = createAdminClient();
  const clearPrimary = await client
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId);

  if (clearPrimary.error) {
    throw new Error(
      `Falha ao trocar a imagem principal: ${clearPrimary.error.message}`,
    );
  }

  const setPrimary = await client
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .eq('product_id', productId);

  if (setPrimary.error) {
    throw new Error(
      `Falha ao definir a imagem principal: ${setPrimary.error.message}`,
    );
  }

  await refreshProductEditor(productId);
}

export async function moveProductImageAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const imageId = readActionString(formData, 'imageId');
  const productId = readActionString(formData, 'productId');
  const direction = readActionString(formData, 'direction') === 'up' ? -1 : 1;
  const client = createAdminClient();
  const imageResponse = await client
    .from('product_images')
    .select('id,sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (imageResponse.error) {
    throw new Error(`Falha ao ordenar imagens: ${imageResponse.error.message}`);
  }

  const images = imageResponse.data ?? [];
  const imageIndex = images.findIndex((image) => image.id === imageId);
  const adjacentImage = images[imageIndex + direction];

  if (imageIndex === -1 || !adjacentImage) {
    await refreshProductEditor(productId);
    return;
  }

  const currentImage = images[imageIndex];
  const responses = await Promise.all([
    client
      .from('product_images')
      .update({ sort_order: adjacentImage.sort_order })
      .eq('id', currentImage.id),
    client
      .from('product_images')
      .update({ sort_order: currentImage.sort_order })
      .eq('id', adjacentImage.id),
  ]);

  const failure = responses.find((response) => response.error)?.error;

  if (failure) {
    throw new Error(`Falha ao salvar a ordem das imagens: ${failure.message}`);
  }

  await refreshProductEditor(productId);
}

export async function deleteProductImageAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const imageId = readActionString(formData, 'imageId');
  const productId = readActionString(formData, 'productId');
  const client = createAdminClient();
  const imageResponse = await client
    .from('product_images')
    .select('url,is_primary')
    .eq('id', imageId)
    .eq('product_id', productId)
    .maybeSingle();

  if (imageResponse.error || !imageResponse.data) {
    throw new Error(
      `Imagem "${imageId}" não encontrada no produto "${productId}".`,
    );
  }

  const deletedImage = await client
    .from('product_images')
    .delete()
    .eq('id', imageId)
    .eq('product_id', productId);

  if (deletedImage.error) {
    throw new Error(`Falha ao remover a imagem: ${deletedImage.error.message}`);
  }

  if (imageResponse.data.is_primary) {
    await assignNextProductImageAsPrimary(client, productId);
  }

  const storagePath = readProductImageStoragePath(imageResponse.data.url);

  if (storagePath) {
    const deletedFile = await client.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .remove([storagePath]);

    if (deletedFile.error) {
      throw new Error(
        `A imagem foi removida do produto, mas não do Storage: ${deletedFile.error.message}`,
      );
    }
  }

  await refreshProductEditor(productId);
}
