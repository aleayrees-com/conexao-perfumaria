import { listAdminCategories } from '@/lib/admin-data';

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

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.name}</td>
                <td>{category.slug}</td>
                <td>
                  <span
                    className={
                      category.isActive
                        ? 'admin-status admin-status-active'
                        : 'admin-status admin-status-archived'
                    }
                  >
                    {category.isActive ? 'ativa' : 'inativa'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
