import {
  fetchAddressByCep,
  normalizeCepInput,
  parseViaCepAddress,
} from '@/lib/cep-lookup';

describe('CEP lookup helpers', () => {
  it('normalizes CEP input to 8 digits', () => {
    expect(normalizeCepInput('21020-290')).toBe('21020290');
    expect(normalizeCepInput('21020290123')).toBe('21020290');
  });

  it('maps ViaCEP response to checkout address fields', () => {
    expect(
      parseViaCepAddress({
        bairro: 'Bonsucesso',
        localidade: 'Rio de Janeiro',
        logradouro: 'Rua Cardoso de Morais',
        uf: 'RJ',
      }),
    ).toEqual({
      city: 'Rio de Janeiro',
      neighborhood: 'Bonsucesso',
      state: 'RJ',
      street: 'Rua Cardoso de Morais',
    });
  });

  it('returns null when ViaCEP reports an unknown CEP', () => {
    expect(parseViaCepAddress({ erro: true })).toBeNull();
  });

  it('fetches a valid CEP using the ViaCEP endpoint', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            bairro: 'Sé',
            localidade: 'São Paulo',
            logradouro: 'Praça da Sé',
            uf: 'SP',
          }),
        ),
    );

    await expect(
      fetchAddressByCep({ cep: '01001-000', fetcher }),
    ).resolves.toEqual({
      city: 'São Paulo',
      neighborhood: 'Sé',
      state: 'SP',
      street: 'Praça da Sé',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01001000/json/',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
  });
});
