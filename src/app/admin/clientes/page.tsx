import { listAdminCustomers } from '@/lib/admin-data';

export default async function AdminCustomersPage() {
  const customers = await listAdminCustomers();

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Relacionamento</p>
          <h1>Clientes</h1>
        </div>
      </div>

      <section className="admin-panel admin-value-toolbar">
        <div>
          <p>Base de clientes</p>
          <h2>{customers.length} clientes cadastrados na loja.</h2>
        </div>
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Marketing</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.email ?? '-'}</td>
                <td>{customer.phone ?? '-'}</td>
                <td>
                  <span
                    className={`admin-status admin-status-${customer.marketingOptIn ? 'active' : 'archived'}`}
                  >
                    {customer.marketingOptIn ? 'aceita' : 'não aceita'}
                  </span>
                </td>
                <td>
                  {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
