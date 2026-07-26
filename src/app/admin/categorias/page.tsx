import { listAdminCategories } from '@/lib/admin-data';

import { createCategoryAction, updateCategoryAction } from './actions';

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Catálogo</p>
          <h1>Categorias</h1>
        </div>
      </div>

      <form
        action={createCategoryAction}
        className="admin-panel admin-filter-bar"
      >
        <input name="name" placeholder="Nova categoria" required />
        <input name="slug" placeholder="Slug (opcional)" />
        <button className="admin-primary-button" type="submit">
          Criar categoria
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td colSpan={4}>
                  <form
                    action={updateCategoryAction}
                    className="admin-inline-form"
                  >
                    <input
                      name="categoryId"
                      type="hidden"
                      value={category.id}
                    />
                    <input
                      aria-label={`Nome da categoria ${category.name}`}
                      defaultValue={category.name}
                      name="name"
                      required
                    />
                    <input
                      aria-label={`Slug da categoria ${category.name}`}
                      defaultValue={category.slug}
                      name="slug"
                      required
                    />
                    <label className="admin-checkbox">
                      <input
                        defaultChecked={category.isActive}
                        name="isActive"
                        type="checkbox"
                      />
                      Ativa
                    </label>
                    <button className="admin-ghost-button" type="submit">
                      Salvar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
