import { describe, expect, test } from 'vitest';

import { getPasswordVisibilityCopy } from './password-visibility';

describe('getPasswordVisibilityCopy', () => {
  test('offers to reveal a concealed password', () => {
    expect(getPasswordVisibilityCopy(false)).toEqual({
      label: 'Mostrar senha',
      type: 'password',
    });
  });

  test('offers to conceal a revealed password', () => {
    expect(getPasswordVisibilityCopy(true)).toEqual({
      label: 'Ocultar senha',
      type: 'text',
    });
  });
});
