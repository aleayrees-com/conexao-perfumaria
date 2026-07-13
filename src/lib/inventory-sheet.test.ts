import { describe, expect, it } from 'vitest';

import {
  InventorySheetError,
  parseInventoryCsv,
} from '../../supabase/functions/_shared/inventory-sheet';

describe('parseInventoryCsv', () => {
  it('reads inventory by normalized headers regardless of column order', () => {
    const csv = [
      'Produto,Unidades na loja,ID Variação',
      'Perfume A,2,123',
      'Perfume B,0,456',
    ].join('\r\n');

    expect(parseInventoryCsv(csv)).toEqual({
      scannedRows: 2,
      rows: [
        { nuvemshopVariantId: 123, stock: 2, sourceRow: 2 },
        { nuvemshopVariantId: 456, stock: 0, sourceRow: 3 },
      ],
    });
  });

  it('parses quoted commas, escaped quotes, CRLF, accents, and blank SKU values', () => {
    const csv = [
      'ID Produto,ID Variação,SKU,Produto,Unidades na loja',
      '1,123,,"Perfume, edição ""Especial""",4',
    ].join('\r\n');

    expect(parseInventoryCsv(csv).rows).toEqual([
      { nuvemshopVariantId: 123, stock: 4, sourceRow: 2 },
    ]);
  });

  it('ignores fully blank trailing rows', () => {
    const csv = 'ID Variação,Unidades na loja\n123,1\n,\n  ,  \n';

    expect(parseInventoryCsv(csv)).toEqual({
      scannedRows: 1,
      rows: [{ nuvemshopVariantId: 123, stock: 1, sourceRow: 2 }],
    });
  });

  it.each([
    {
      name: 'missing variation header',
      csv: 'Produto,Unidades na loja\nPerfume,1',
      message: 'Cabeçalho obrigatório ausente: ID Variação.',
    },
    {
      name: 'missing stock header',
      csv: 'ID Variação,Produto\n123,Perfume',
      message: 'Cabeçalho obrigatório ausente: Unidades na loja.',
    },
    {
      name: 'duplicate variation header',
      csv: 'ID Variação,ID VARIACAO,Unidades na loja\n123,123,1',
      message: 'Cabeçalho duplicado: ID Variação.',
    },
    {
      name: 'duplicate stock header',
      csv: 'ID Variação,Unidades na loja,UNIDADES NA LOJA\n123,1,1',
      message: 'Cabeçalho duplicado: Unidades na loja.',
    },
  ])('rejects $name', ({ csv, message }) => {
    expect(() => parseInventoryCsv(csv)).toThrowError(message);
  });

  it.each([
    {
      name: 'blank variation id',
      csv: 'ID Variação,Unidades na loja\n,1',
      message: 'ID Variação inválido na linha 2.',
    },
    {
      name: 'non-integer variation id',
      csv: 'ID Variação,Unidades na loja\n12.5,1',
      message: 'ID Variação inválido na linha 2.',
    },
    {
      name: 'zero variation id',
      csv: 'ID Variação,Unidades na loja\n0,1',
      message: 'ID Variação inválido na linha 2.',
    },
    {
      name: 'blank stock',
      csv: 'ID Variação,Unidades na loja\n123,',
      message: 'Unidades na loja inválido na linha 2.',
    },
    {
      name: 'decimal stock',
      csv: 'ID Variação,Unidades na loja\n123,1.5',
      message: 'Unidades na loja inválido na linha 2.',
    },
    {
      name: 'negative stock',
      csv: 'ID Variação,Unidades na loja\n123,-1',
      message: 'Unidades na loja inválido na linha 2.',
    },
  ])('rejects $name', ({ csv, message }) => {
    expect(() => parseInventoryCsv(csv)).toThrowError(message);
  });

  it('rejects duplicate variation IDs with the source row', () => {
    const csv = 'ID Variação,Unidades na loja\n123,1\n123,2';

    expect(() => parseInventoryCsv(csv)).toThrowError(
      'ID Variação duplicado na linha 3: 123.',
    );
  });

  it('rejects an unclosed quoted field', () => {
    const csv = 'ID Variação,Unidades na loja,Produto\n123,1,"Perfume';

    expect(() => parseInventoryCsv(csv)).toThrow(InventorySheetError);
  });

  it('rejects an empty CSV', () => {
    expect(() => parseInventoryCsv('')).toThrowError('CSV de estoque vazio.');
  });
});
