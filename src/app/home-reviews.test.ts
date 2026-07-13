import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(
  new URL('./globals.css', import.meta.url),
  'utf8',
);

describe('destaque dos feedbacks na home', () => {
  it('posiciona o feedback da Thais no centro do grid', () => {
    const leftReview = pageSource.indexOf(
      'Qualidade e variedade impressionantes',
    );
    const featuredReview = pageSource.indexOf('review-card-featured');
    const rightReview = pageSource.indexOf('Excelência no atendimento');

    expect(leftReview).toBeGreaterThan(-1);
    expect(featuredReview).toBeGreaterThan(leftReview);
    expect(rightReview).toBeGreaterThan(featuredReview);
  });

  it('identifica a Thais e vincula o perfil oficial informado', () => {
    expect(pageSource).toMatch(
      /review-card-featured[\s\S]*src="\/reviews\/feedback-1\.png"/,
    );
    expect(pageSource).toContain('Thais Vasconcellos');
    expect(pageSource).toContain('https://www.instagram.com/thaisrvv/');
    expect(pageSource).toContain('@thaisrvv');
  });

  it('usa a nova cliente no terceiro feedback, sem atribui-la a Thais', () => {
    expect(pageSource).toMatch(
      /src="\/reviews\/feedback-3-woman\.jpg"[\s\S]*Excelência no atendimento/,
    );
  });

  it('eleva o destaque no desktop e remove o deslocamento no celular', () => {
    expect(stylesSource).toMatch(
      /\.review-card-featured\s*\{[^}]*translateY\(-32px\)/s,
    );
    expect(stylesSource).toMatch(
      /@media \(max-width: 900px\)[\s\S]*\.review-card-featured\s*\{[^}]*transform:\s*none/s,
    );
  });
});
