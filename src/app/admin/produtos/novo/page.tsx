import Link from 'next/link';

import { ProductPixPriceField } from '@/components/admin/product-pix-price-field';
import { listAdminCategories } from '@/lib/admin-data';

import { createProductAction } from '../actions';

export default async function NewAdminProductPage() {
  const categories = await listAdminCategories();

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Catálogo</p>
          <h1>Cadastrar produto</h1>
        </div>
        <Link className="admin-ghost-button" href="/admin/produtos">
          Voltar aos produtos
        </Link>
      </div>

      <form action={createProductAction} className="admin-editor">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Informações do produto</h2>
              <p>
                Depois de salvar, você poderá enviar várias imagens direto aqui.
              </p>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Slug (opcional)
              <input name="slug" placeholder="gerado a partir do nome" />
            </label>
            <label>
              Categoria
              <select name="categoryId" defaultValue="">
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
              <select name="status" defaultValue="draft">
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
              </select>
            </label>
            <label className="admin-field-wide">
              Descrição
              <textarea name="description" rows={6} />
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Preço e estoque inicial</h2>
              <p>
                O PIX é a referência; o valor do cartão recebe 7,54%
                automaticamente.
              </p>
            </div>
          </div>
          <div className="admin-form-grid">
            <ProductPixPriceField
              defaultPixPriceCents={0}
              inputName="pixPrice"
            />
            <label>
              Preço de comparação (opcional)
              <input
                inputMode="decimal"
                min="0"
                name="compareAtPrice"
                step="0.01"
                type="number"
              />
            </label>
            <label>
              Estoque inicial
              <input defaultValue={0} min={0} name="stock" type="number" />
            </label>
            <label>
              SKU (opcional)
              <input name="sku" />
            </label>
            <label>
              Nome da variação
              <input defaultValue="Padrão" name="variantLabel" />
            </label>
          </div>
        </section>

        <div className="admin-save-bar">
          <button className="admin-primary-button" type="submit">
            Cadastrar e adicionar imagens
          </button>
        </div>
      </form>
    </section>
  );
}
