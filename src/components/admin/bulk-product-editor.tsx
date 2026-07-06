'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  applyMoneyOperation,
  type BulkMoneyMode,
} from '@/lib/admin-product-bulk';

import {
  applyBulkProductAction,
  importProductCsvAction,
} from '@/app/admin/produtos/edicao-em-massa/actions';

interface BulkProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly status: string;
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly pixPriceCents: number | null;
  readonly totalStock: number;
  readonly isAvailable: boolean;
}

interface BulkCategory {
  readonly id: string;
  readonly name: string;
}

interface BulkProductEditorProps {
  readonly products: readonly BulkProduct[];
  readonly categories: readonly BulkCategory[];
}

type BulkOperation =
  | 'set_status'
  | 'set_category'
  | 'adjust_price'
  | 'adjust_stock'
  | 'set_availability';

type MoneyField = 'price' | 'pix' | 'compare';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function centsToMoney(value: number | null): string {
  return value === null ? '-' : `R$ ${(value / 100).toFixed(2)}`;
}

function moneyInputToValue(mode: BulkMoneyMode, input: string): number | null {
  if (mode === 'clear') {
    return null;
  }

  const parsedValue = Number.parseFloat(input.replace(',', '.'));

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  if (mode === 'increase_percent' || mode === 'decrease_percent') {
    return parsedValue;
  }

  return Math.round(parsedValue * 100);
}

function getMoneyFieldValue(
  product: BulkProduct,
  field: MoneyField,
): number | null {
  if (field === 'pix') {
    return product.pixPriceCents;
  }

  if (field === 'compare') {
    return product.compareAtPriceCents;
  }

  return product.priceCents;
}

function getPreviewText({
  availability,
  categoryName,
  moneyField,
  moneyMode,
  moneyValue,
  operation,
  product,
  statusValue,
  stockMode,
  stockValue,
}: {
  readonly availability: string;
  readonly categoryName: string;
  readonly moneyField: MoneyField;
  readonly moneyMode: BulkMoneyMode;
  readonly moneyValue: string;
  readonly operation: BulkOperation;
  readonly product: BulkProduct;
  readonly statusValue: string;
  readonly stockMode: string;
  readonly stockValue: string;
}): string {
  if (operation === 'set_status') {
    return `${product.status} -> ${statusValue}`;
  }

  if (operation === 'set_category') {
    return `${product.categoryName} -> ${categoryName || 'Sem categoria'}`;
  }

  if (operation === 'adjust_price') {
    const current = getMoneyFieldValue(product, moneyField);
    const next = applyMoneyOperation(current, {
      mode: moneyMode,
      value: moneyInputToValue(moneyMode, moneyValue),
    });

    return `${centsToMoney(current)} -> ${centsToMoney(next)}`;
  }

  if (operation === 'adjust_stock') {
    const value = Number.parseInt(stockValue || '0', 10);
    const next =
      stockMode === 'increase'
        ? product.totalStock + value
        : stockMode === 'decrease'
          ? Math.max(0, product.totalStock - value)
          : value;

    return `${product.totalStock} un. -> ${next} un.`;
  }

  return `${product.isAvailable ? 'Disponível' : 'Indisponível'} -> ${
    availability === 'available' ? 'Disponível' : 'Indisponível'
  }`;
}

export function BulkProductEditor({
  products,
  categories,
}: BulkProductEditorProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [operation, setOperation] = useState<BulkOperation>('adjust_price');
  const [statusValue, setStatusValue] = useState('active');
  const [categoryValue, setCategoryValue] = useState('');
  const [moneyField, setMoneyField] = useState<MoneyField>('price');
  const [moneyMode, setMoneyMode] = useState<BulkMoneyMode>('set');
  const [moneyValue, setMoneyValue] = useState('');
  const [stockMode, setStockMode] = useState('set');
  const [stockValue, setStockValue] = useState('0');
  const [availability, setAvailability] = useState('available');
  const [confirmText, setConfirmText] = useState('');
  const [confirmImportText, setConfirmImportText] = useState('');

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(`${product.name} ${product.slug}`).includes(
          normalizedSearch,
        );
      const matchesStatus = status ? product.status === status : true;
      const matchesCategory = categoryId
        ? product.categoryId === categoryId
        : true;
      const matchesStock =
        stock === 'in_stock'
          ? product.totalStock > 0
          : stock === 'out_of_stock'
            ? product.totalStock <= 0
            : true;

      return matchesSearch && matchesStatus && matchesCategory && matchesStock;
    });
  }, [categoryId, products, search, status, stock]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds],
  );
  const selectedCategoryName =
    categories.find((category) => category.id === categoryValue)?.name ?? '';
  const targetIds = selectedProducts.map((product) => product.id).join('|');
  const previewProducts = selectedProducts.slice(0, 10);

  function selectFilteredProducts() {
    setSelectedIds(new Set(filteredProducts.map((product) => product.id)));
  }

  function toggleProduct(productId: string) {
    const nextIds = new Set(selectedIds);

    if (nextIds.has(productId)) {
      nextIds.delete(productId);
    } else {
      nextIds.add(productId);
    }

    setSelectedIds(nextIds);
  }

  return (
    <div className="admin-bulk-layout">
      <section className="admin-panel admin-bulk-panel admin-bulk-value-guide">
        <div>
          <p>Fluxo recomendado</p>
          <h2>Ajuste valores com revisão antes de salvar no catálogo.</h2>
        </div>
        <ol>
          <li>Filtre e selecione os produtos.</li>
          <li>Escolha se vai alterar preço, PIX, estoque ou status.</li>
          <li>Confira a prévia e digite APLICAR para confirmar.</li>
        </ol>
      </section>

      <section className="admin-panel admin-bulk-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Selecionar produtos</h2>
            <p>
              {filteredProducts.length} filtrados / {selectedProducts.length}{' '}
              selecionados
            </p>
          </div>
          <div className="admin-bulk-actions">
            <button
              className="admin-ghost-button"
              onClick={selectFilteredProducts}
              type="button"
            >
              Selecionar produtos
            </button>
            <button
              className="admin-ghost-button"
              onClick={() => setSelectedIds(new Set())}
              type="button"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="admin-bulk-filters">
          <label>
            Busca
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou slug"
              value={search}
            />
          </label>
          <label>
            Status
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="draft">Rascunho</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <label>
            Categoria
            <select
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estoque
            <select
              onChange={(event) => setStock(event.target.value)}
              value={stock}
            >
              <option value="">Todos</option>
              <option value="in_stock">Com estoque</option>
              <option value="out_of_stock">Sem estoque</option>
            </select>
          </label>
        </div>

        <div className="admin-bulk-list">
          {filteredProducts.slice(0, 160).map((product) => (
            <label key={product.id}>
              <input
                checked={selectedIds.has(product.id)}
                onChange={() => toggleProduct(product.id)}
                type="checkbox"
              />
              <span>
                <strong>{product.name}</strong>
                <small>
                  {product.categoryName} · {product.status} ·{' '}
                  {centsToMoney(product.priceCents)} · {product.totalStock} un.
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="admin-panel admin-bulk-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Aplicar alteração</h2>
            <p>Prévia de até 10 produtos antes de confirmar</p>
          </div>
        </div>

        <form action={applyBulkProductAction} className="admin-bulk-form">
          <input name="productIds" type="hidden" value={targetIds} />
          <label>
            Tipo de alteração
            <select
              name="operation"
              onChange={(event) =>
                setOperation(event.target.value as BulkOperation)
              }
              value={operation}
            >
              <option value="set_status">Alterar status</option>
              <option value="set_category">Alterar categoria</option>
              <option value="adjust_price">Ajustar valores/preços</option>
              <option value="adjust_stock">Ajustar estoque</option>
              <option value="set_availability">Disponibilidade</option>
            </select>
          </label>

          {operation === 'set_status' ? (
            <label>
              Novo status
              <select
                name="status"
                onChange={(event) => setStatusValue(event.target.value)}
                value={statusValue}
              >
                <option value="active">Ativo</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>
          ) : null}

          {operation === 'set_category' ? (
            <label>
              Nova categoria
              <select
                name="categoryId"
                onChange={(event) => setCategoryValue(event.target.value)}
                value={categoryValue}
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {operation === 'adjust_price' ? (
            <div className="admin-bulk-inline-grid">
              <label>
                Campo
                <select
                  name="moneyField"
                  onChange={(event) =>
                    setMoneyField(event.target.value as MoneyField)
                  }
                  value={moneyField}
                >
                  <option value="price">Preço de venda</option>
                  <option value="pix">Preço PIX</option>
                  <option value="compare">Preço de comparação</option>
                </select>
              </label>
              <label>
                Modo
                <select
                  name="moneyMode"
                  onChange={(event) =>
                    setMoneyMode(event.target.value as BulkMoneyMode)
                  }
                  value={moneyMode}
                >
                  <option value="set">Definir valor</option>
                  <option value="increase_percent">Aumentar %</option>
                  <option value="decrease_percent">Reduzir %</option>
                  <option value="increase_amount">Aumentar R$</option>
                  <option value="decrease_amount">Reduzir R$</option>
                  <option value="clear">Limpar</option>
                </select>
              </label>
              <label>
                Valor
                <input
                  name="moneyValue"
                  onChange={(event) => setMoneyValue(event.target.value)}
                  placeholder={moneyMode.includes('percent') ? '10' : '99,90'}
                  value={moneyValue}
                />
              </label>
            </div>
          ) : null}

          {operation === 'adjust_stock' ? (
            <div className="admin-bulk-inline-grid">
              <label>
                Modo
                <select
                  name="stockMode"
                  onChange={(event) => setStockMode(event.target.value)}
                  value={stockMode}
                >
                  <option value="set">Definir</option>
                  <option value="increase">Aumentar</option>
                  <option value="decrease">Reduzir</option>
                </select>
              </label>
              <label>
                Quantidade
                <input
                  min={0}
                  name="stockValue"
                  onChange={(event) => setStockValue(event.target.value)}
                  type="number"
                  value={stockValue}
                />
              </label>
            </div>
          ) : null}

          {operation === 'set_availability' ? (
            <label>
              Nova disponibilidade
              <select
                name="availability"
                onChange={(event) => setAvailability(event.target.value)}
                value={availability}
              >
                <option value="available">Disponível</option>
                <option value="unavailable">Indisponível</option>
              </select>
            </label>
          ) : null}

          <div className="admin-bulk-preview">
            {previewProducts.length === 0 ? (
              <p>Nenhum produto selecionado.</p>
            ) : (
              previewProducts.map((product) => (
                <article key={product.id}>
                  <strong>{product.name}</strong>
                  <span>
                    {getPreviewText({
                      availability,
                      categoryName: selectedCategoryName,
                      moneyField,
                      moneyMode,
                      moneyValue,
                      operation,
                      product,
                      statusValue,
                      stockMode,
                      stockValue,
                    })}
                  </span>
                </article>
              ))
            )}
          </div>

          <label>
            Confirmação
            <input
              name="confirmText"
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Digite APLICAR"
              value={confirmText}
            />
          </label>

          <button
            className="admin-primary-button"
            disabled={
              selectedProducts.length === 0 || confirmText !== 'APLICAR'
            }
            type="submit"
          >
            Aplicar em {selectedProducts.length} produtos
          </button>
        </form>
      </section>

      <section className="admin-panel admin-bulk-panel admin-bulk-csv">
        <div className="admin-panel-header">
          <div>
            <h2>CSV</h2>
            <p>Exportar, editar em planilha e importar de volta</p>
          </div>
          <Link
            className="admin-primary-button"
            href="/admin/produtos/edicao-em-massa/export"
            prefetch={false}
          >
            Exportar CSV
          </Link>
        </div>

        <form action={importProductCsvAction} className="admin-bulk-form">
          <label>
            Arquivo CSV editado
            <input accept=".csv,text/csv" name="csvFile" required type="file" />
          </label>
          <label>
            Confirmação
            <input
              name="confirmImportText"
              onChange={(event) => setConfirmImportText(event.target.value)}
              placeholder="Digite IMPORTAR"
              value={confirmImportText}
            />
          </label>
          <button
            className="admin-primary-button"
            disabled={confirmImportText !== 'IMPORTAR'}
            type="submit"
          >
            Importar CSV
          </button>
        </form>
      </section>
    </div>
  );
}
