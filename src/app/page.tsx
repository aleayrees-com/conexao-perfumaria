import Image from 'next/image';
import Link from 'next/link';

import { ProductCard } from '@/components/product-card';
import { PromoCarousel, type PromoSlide } from '@/components/promo-carousel';
import { SectionHeading, StoreSection } from '@/components/store-layout';
import {
  getCategorySummaries,
  getFeaturedProducts,
  getProducts,
} from '@/lib/catalog';
import { selectHomeFeaturedProducts } from '@/lib/home-curation';
import { formatMoney } from '@/lib/money';
import type { Product } from '@/types/catalog';

export const revalidate = 60;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productMatchesTerms(
  product: Product,
  terms: readonly string[],
): boolean {
  const searchable = normalizeText(
    [
      product.name,
      product.description,
      product.category?.name ?? '',
      product.category?.slug ?? '',
    ].join(' '),
  );

  return terms.some((term) => searchable.includes(normalizeText(term)));
}

function pickBannerProducts({
  fallbackProducts,
  products,
  terms,
}: {
  readonly fallbackProducts: readonly Product[];
  readonly products: readonly Product[];
  readonly terms: readonly string[];
}): readonly Product[] {
  const matchedProducts = products.filter(
    (product) => product.imageUrls[0] && productMatchesTerms(product, terms),
  );
  const baseProducts =
    matchedProducts.length > 0 ? matchedProducts : fallbackProducts;

  return baseProducts.filter((product) => product.imageUrls[0]).slice(0, 1);
}

function pickScentProfileProducts({
  fallbackProducts,
  limit = 2,
  products,
  terms,
}: {
  readonly fallbackProducts: readonly Product[];
  readonly limit?: number;
  readonly products: readonly Product[];
  readonly terms: readonly string[];
}): readonly Product[] {
  const matchedProducts = products.filter(
    (product) =>
      product.available &&
      product.imageUrls[0] &&
      productMatchesTerms(product, terms),
  );
  const baseProducts =
    matchedProducts.length >= limit
      ? matchedProducts
      : matchedProducts.concat(fallbackProducts);
  const selectedProducts: Product[] = [];

  for (const product of baseProducts) {
    if (selectedProducts.length >= limit) {
      break;
    }

    if (
      product.imageUrls[0] &&
      !selectedProducts.some((selected) => selected.slug === product.slug)
    ) {
      selectedProducts.push(product);
    }
  }

  return selectedProducts;
}

function getMinimumPrice(products: readonly Product[]): number | null {
  const prices = products
    .map((product) => product.priceCents)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function toPromoSlideProduct(product: Product) {
  return {
    imageUrl: product.imageUrls[0] ?? '',
    name: product.name,
    slug: product.slug,
  };
}

function buildPromoSlides(
  products: readonly Product[],
  featuredProducts: readonly Product[],
): readonly PromoSlide[] {
  const fallbackProducts = featuredProducts.filter(
    (product) => product.imageUrls[0],
  );
  const slideInputs = [
    {
      id: 'aniversario',
      bracket: '2 anos de Conexao',
      title: 'MES DE ANIVERSARIO',
      tagline: 'Brindes, surpresas e sorteio durante todo o mes de junho.',
      highlights: ['Dia dos Namorados', 'Compre e ganhe', 'Sorteio especial'],
      imageAlt: 'Banner de aniversario de 2 anos da Conexao Perfumaria',
      imageUrl: '/brand/conexao-anniversary-banner.jpeg',
      layout: 'image',
      searchLabel: 'Comprar agora',
      searchHref: '/produtos?disponivel=1',
      terms: ['presente', 'combo', 'kit', 'perfume', 'arabes', 'arabe'],
    },
    {
      id: 'namorados',
      bracket: 'Dia dos Namorados',
      title: 'PRESENTE QUE MARCA',
      tagline: 'Fragrancias e kits para transformar junho em lembranca boa.',
      highlights: ['Ate R$150', 'Ate R$250', 'Ate R$350'],
      imageAlt: 'Banner de Dia dos Namorados da Conexao Perfumaria',
      imageUrl: '/brand/conexao-valentines-banner.png',
      layout: 'image',
      searchLabel: 'Ver presentes',
      searchHref: '/produtos?disponivel=1&busca=presente',
      terms: ['kit', 'combo', 'presente', 'hidratante', 'yara'],
    },
  ] as const;

  return slideInputs.map((slideInput) => {
    const slideProducts = pickBannerProducts({
      fallbackProducts,
      products,
      terms: slideInput.terms,
    });
    const minimumPrice = getMinimumPrice(slideProducts);

    return {
      id: slideInput.id,
      kicker: 'Conexao Perfumaria',
      title: slideInput.title,
      bracket: slideInput.bracket,
      tagline: slideInput.tagline,
      highlights: slideInput.highlights,
      imageAlt: 'imageAlt' in slideInput ? slideInput.imageAlt : undefined,
      imageUrl: 'imageUrl' in slideInput ? slideInput.imageUrl : undefined,
      layout: slideInput.layout,
      searchLabel: slideInput.searchLabel,
      searchHref: slideInput.searchHref,
      priceLabel: minimumPrice ? formatMoney(minimumPrice) : 'consultar',
      priceDetail: 'Compra finalizada com atendimento no WhatsApp',
      products: slideProducts.map(toPromoSlideProduct),
    };
  });
}

export default async function HomePage() {
  const [products, fallbackFeaturedProducts, categorySummaries] =
    await Promise.all([
      getProducts(),
      getFeaturedProducts(16),
      getCategorySummaries(),
    ]);
  const homeFeaturedProducts = selectHomeFeaturedProducts(products, 8);
  const fallbackProducts = fallbackFeaturedProducts.filter(
    (product) => product.available && product.imageUrls[0],
  );
  const featuredProducts =
    homeFeaturedProducts.length > 0
      ? homeFeaturedProducts
      : fallbackProducts.slice(0, 8);
  const categories = [
    {
      title: 'Perfumes Arabes',
      href: '/categoria/perfumes-arabes',
      label: 'Intensos e memoraveis',
    },
    {
      title: 'Femininos',
      href: '/produtos?busca=fem',
      label: 'Doces, florais e elegantes',
    },
    {
      title: 'Masculinos',
      href: '/produtos?busca=masc',
      label: 'Marcantes e sofisticados',
    },
    {
      title: 'Decantes',
      href: '/categoria/decantes-de-perfumes-arabes',
      label: 'Experimente antes de escolher',
    },
    {
      title: 'Hidratantes',
      href: '/produtos?busca=hidratante',
      label: 'Camadas de perfumacao',
    },
    {
      title: 'Kits para Presentear',
      href: '/produtos?busca=kit',
      label: 'Prontos para surpreender',
    },
  ] as const;
  const scentProfiles = [
    {
      description: 'Baunilha, frutas, flores e aquela presenca confortavel.',
      href: '/produtos?busca=doce',
      id: 'sweet',
      label: 'Perfil delicado',
      terms: ['yara', 'vanilla', 'baunilha', 'rosa', 'rose', 'doce', 'floral'],
      title: 'Amo perfumes doces',
    },
    {
      description: 'Opcoes limpas para rotina, calor e banho tomado.',
      href: '/produtos?busca=fresco',
      id: 'fresh',
      label: 'Perfil leve',
      terms: ['fresh', 'fresco', 'blue', 'aqua', 'garden', 'splash', 'light'],
      title: 'Amo perfumes frescos',
    },
    {
      description: 'Arabes, amadeirados e fragrancias que ficam na memoria.',
      href: '/produtos?busca=intenso',
      id: 'intense',
      label: 'Perfil marcante',
      terms: ['asad', 'khamrah', 'fakhar', 'ameerat', 'oud', 'arab', 'intenso'],
      title: 'Amo perfumes marcantes',
    },
  ] as const;
  const promoSlides = buildPromoSlides(products, featuredProducts);
  const scentProfileCards = scentProfiles.map((profile) => ({
    ...profile,
    products: pickScentProfileProducts({
      fallbackProducts: featuredProducts,
      products,
      terms: profile.terms,
    }),
  }));
  const totalAvailable = categorySummaries.reduce(
    (total, category) => total + category.availableCount,
    0,
  );

  return (
    <div className="home-page">
      <div className="site-celebration-balloons" aria-hidden="true">
        <span className="site-balloon site-balloon-one" />
        <span className="site-balloon site-balloon-two" />
        <span className="site-balloon site-balloon-three" />
        <span className="site-balloon site-balloon-four" />
      </div>
      <PromoCarousel slides={promoSlides} />

      <StoreSection variant="featured">
        <SectionHeading
          actionHref="/produtos"
          actionLabel="Ver tudo"
          eyebrow="Os queridinhos da Conexao"
          title="Perfumes queridinhos da loja"
        />
        <div className="product-grid">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              variant="editorial"
            />
          ))}
        </div>
      </StoreSection>

      <StoreSection>
        <SectionHeading
          eyebrow="Categorias"
          title="Escolha pelo caminho mais facil"
        />
        <div className="home-category-grid">
          {categories.map((category) => (
            <Link
              className="home-category-card"
              href={category.href}
              key={category.title}
            >
              <span>{category.label}</span>
              <strong>{category.title}</strong>
              <small>Ver selecao</small>
            </Link>
          ))}
        </div>
      </StoreSection>

      <StoreSection>
        <SectionHeading
          eyebrow="Nao sabe qual escolher?"
          title="Comece pelo perfil da fragrancia"
        />
        <div className="scent-profile-grid">
          {scentProfileCards.map((profile) => (
            <Link
              className={`scent-profile-card scent-profile-card-${profile.id}`}
              href={profile.href}
              key={profile.id}
            >
              <span>{profile.label}</span>
              <strong>{profile.title}</strong>
              <small>{profile.description}</small>
              <div className="scent-profile-products" aria-hidden="true">
                {profile.products.map((product, index) => (
                  <Image
                    alt=""
                    className={`scent-profile-product scent-profile-product-${index + 1}`}
                    height={220}
                    key={product.slug}
                    src={product.imageUrls[0] ?? ''}
                    width={220}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>
      </StoreSection>

      <StoreSection muted>
        <div className="about-store">
          <div className="about-store-photo" aria-hidden="true">
            <span>CONEXÃO</span>
          </div>
          <div>
            <p className="eyebrow">Conheca a Conexao</p>
            <h2>
              Ha 2 anos ajudamos clientes a encontrar fragrancias que marcam
              momentos.
            </h2>
            <ul>
              <li>Loja fisica com atendimento personalizado</li>
              <li>Enviamos para todo Brasil</li>
              <li>Produtos originais e selecao conferida</li>
              <li>Compra assistida pelo WhatsApp</li>
            </ul>
          </div>
        </div>
      </StoreSection>

      <StoreSection>
        <SectionHeading
          eyebrow="Avaliacoes reais"
          title="O que vende melhor e a confianca"
        />
        <div className="review-grid">
          <article>
            <span>WhatsApp</span>
            <p>
              Atendimento rapido, explicaram as diferencas e me ajudaram a
              escolher um presente.
            </p>
          </article>
          <article>
            <span>Instagram</span>
            <p>
              Chegou bem embalado, cheiro maravilhoso e ainda veio com carinho
              no detalhe.
            </p>
          </article>
          <article>
            <span>Loja fisica</span>
            <p>
              Gostei porque pude falar o estilo que eu queria e sair com uma
              opcao certeira.
            </p>
          </article>
        </div>
      </StoreSection>

      <StoreSection muted>
        <SectionHeading
          eyebrow="Dia dos Namorados"
          title="Presentes por faixa de valor"
        />
        <div className="gift-guide-grid">
          <Link href="/produtos?precoMax=15000&disponivel=1">
            <span>Ate R$150</span>
            <strong>Lembrancas perfumadas</strong>
            <small>Decantes, 15ml, body splash e mimos para completar.</small>
          </Link>
          <Link href="/produtos?precoMax=25000&disponivel=1">
            <span>Ate R$250</span>
            <strong>Presente elegante</strong>
            <small>Perfumes, hidratantes e combinacoes com impacto.</small>
          </Link>
          <Link href="/produtos?precoMax=35000&disponivel=1">
            <span>Ate R$350</span>
            <strong>Escolha especial</strong>
            <small>Arabes marcantes e kits para impressionar.</small>
          </Link>
        </div>
      </StoreSection>

      <section className="promise-strip" aria-label="Vantagens">
        <article>
          <span>Loja fisica</span>
          <strong>Atendimento de perto</strong>
          <p>
            Voce fala com a equipe antes de fechar e tira duvidas do presente.
          </p>
        </article>
        <article>
          <span>{totalAvailable}+ disponiveis</span>
          <strong>Pronta entrega real</strong>
          <p>O site mostra opcoes para escolher sem esperar semanas.</p>
        </article>
        <article>
          <span>Todo Brasil</span>
          <strong>Envios e entregas</strong>
          <p>Compra guiada pelo WhatsApp com valores conferidos no servidor.</p>
        </article>
      </section>
    </div>
  );
}
