'use server';

import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-auth';
import {
  createAdminClient,
  insertAdminAuditLog,
  revalidateStorefrontCatalog,
} from '@/lib/admin-data';
import { createCatalogSlug } from '@/lib/catalog-slug';

function readCategoryField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readCategoryName(formData: FormData): string {
  const name = readCategoryField(formData, 'name');

  if (!name) {
    throw new Error('Nome da categoria vazio; informe um nome para salvar.');
  }

  return name;
}

async function finishCategoryUpdate(categoryId: string): Promise<void> {
  revalidateStorefrontCatalog();
  redirect(`/admin/categorias?updated=${categoryId}`);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const name = readCategoryName(formData);
  const client = createAdminClient();
  const response = await client
    .from('categories')
    .insert({
      is_active: true,
      name,
      slug: readCategoryField(formData, 'slug') || createCatalogSlug(name),
    })
    .select('id')
    .single();

  if (response.error) {
    throw new Error(
      `Falha ao criar a categoria "${name}": ${response.error.message}`,
    );
  }

  await insertAdminAuditLog(client, {
    actor,
    action: 'category_created',
    entityType: 'categories',
    entityId: response.data.id,
    metadata: { name },
  });
  await finishCategoryUpdate(response.data.id);
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const categoryId = readCategoryField(formData, 'categoryId');
  const name = readCategoryName(formData);
  const client = createAdminClient();
  const response = await client
    .from('categories')
    .update({
      is_active: readCategoryField(formData, 'isActive') === 'on',
      name,
      slug: readCategoryField(formData, 'slug') || createCatalogSlug(name),
    })
    .eq('id', categoryId);

  if (response.error) {
    throw new Error(
      `Falha ao atualizar a categoria "${categoryId}": ${response.error.message}`,
    );
  }

  await insertAdminAuditLog(client, {
    actor,
    action: 'category_updated',
    entityType: 'categories',
    entityId: categoryId,
    metadata: { name },
  });
  await finishCategoryUpdate(categoryId);
}
