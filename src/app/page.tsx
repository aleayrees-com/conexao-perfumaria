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
      id: 'historia',
      bracket: '11 anos de historia',
      title: 'HISTORIA NA PERFUMARIA',
      tagline: 'Experiencias e conexoes que marcam e transformam vidas.',
      highlights: [
        'Qualidade que encanta',
        'Experiencias que ficam',
        'Conexao em cada detalhe',
      ],
      imageAlt: 'Banner de 11 anos de historia na perfumaria',
      imageUrl: '/brand/conexao-history-banner.jpeg',
      layout: 'image',
      searchLabel: 'Compre aqui',
      searchHref: '/produtos?disponivel=1',
      terms: ['perfume', 'arabes', 'arabe', 'lattafa', 'importado'],
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
      id: 'arabes',
      title: 'Perfumes Arabes',
      href: '/categoria/perfumes-arabes',
      label: 'Intensos e memoraveis',
      image: '/brand/category-cutouts/arabes.png',
    },
    {
      id: 'femininos',
      title: 'Femininos',
      href: '/produtos?busca=fem',
      label: 'Doces, florais e elegantes',
      image: '/brand/category-cutouts/femininos.png',
    },
    {
      id: 'masculinos',
      title: 'Masculinos',
      href: '/produtos?busca=masc',
      label: 'Marcantes e sofisticados',
      image: '/brand/category-cutouts/masculinos.png',
    },
    {
      id: 'decantes',
      title: 'Decantes',
      href: '/categoria/decantes-de-perfumes-arabes',
      label: 'Experimente antes de escolher',
      image: '/brand/category-cutouts/decantes.png',
    },
    {
      id: 'hidratantes',
      title: 'Hidratantes',
      href: '/produtos?busca=hidratante',
      label: 'Camadas de perfumacao',
      image: '/brand/category-cutouts/hidratantes.png',
    },
    {
      id: 'kits',
      title: 'Kits para Presentear',
      href: '/produtos?busca=kit',
      label: 'Prontos para surpreender',
      image: '/brand/category-cutouts/kits.png',
    },
  ] as const;
  const scentProfiles = [
    {
      description: 'Baunilha, frutas, flores e aquela presenca confortavel.',
      href: '/produtos?busca=doce',
      id: 'sweet',
      label: 'Perfil delicado',
      title: 'Amo perfumes doces',
      images: [
        '/brand/scent-profiles/sweet-1.png',
        '/brand/scent-profiles/sweet-2.png',
      ],
    },
    {
      description: 'Opcoes limpas para rotina, calor e banho tomado.',
      href: '/produtos?busca=fresco',
      id: 'fresh',
      label: 'Perfil leve',
      title: 'Amo perfumes frescos',
      images: [
        '/brand/scent-profiles/fresh-1.png',
        '/brand/scent-profiles/fresh-2.png',
      ],
    },
    {
      description: 'Arabes, amadeirados e fragrancias que ficam na memoria.',
      href: '/produtos?busca=intenso',
      id: 'intense',
      label: 'Perfil marcante',
      title: 'Amo perfumes marcantes',
      images: [
        '/brand/scent-profiles/intense-1.png',
        '/brand/scent-profiles/intense-2.png',
      ],
    },
  ] as const;
  const giftGuides = [
    {
      description: 'Decantes, 15ml, body splash e mimos para completar.',
      href: '/produtos?precoMax=15000&disponivel=1',
      id: 'under-150',
      image: '/brand/gift-guide-cutouts/under-150.png',
      label: 'Ate R$150',
      title: 'Lembrancas perfumadas',
    },
    {
      description: 'Perfumes, hidratantes e combinacoes com impacto.',
      href: '/produtos?precoMax=25000&disponivel=1',
      id: 'under-250',
      image: '/brand/gift-guide-cutouts/under-250.png',
      label: 'Ate R$250',
      title: 'Presente elegante',
    },
    {
      description: 'Arabes marcantes e kits para impressionar.',
      href: '/produtos?precoMax=35000&disponivel=1',
      id: 'under-350',
      image: '/brand/gift-guide-cutouts/under-350.png',
      label: 'Ate R$350',
      title: 'Escolha especial',
    },
  ] as const;
  const promoSlides = buildPromoSlides(products, featuredProducts);
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
              className={`home-category-card home-category-card-${category.id}`}
              href={category.href}
              key={category.title}
            >
              <div className="home-category-content">
                <span>{category.label}</span>
                <strong>{category.title}</strong>
                <small>Ver selecao</small>
              </div>
              <div className="home-category-visual" aria-hidden="true">
                <Image
                  alt=""
                  className="home-category-image"
                  height={220}
                  src={category.image}
                  width={220}
                />
              </div>
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
          {scentProfiles.map((profile) => (
            <Link
              className={`scent-profile-card scent-profile-card-${profile.id}`}
              href={profile.href}
              key={profile.id}
            >
              <span>{profile.label}</span>
              <strong>{profile.title}</strong>
              <small>{profile.description}</small>
              <div className="scent-profile-products" aria-hidden="true">
                {profile.images.map((imageUrl, index) => (
                  <Image
                    alt=""
                    className={`scent-profile-product scent-profile-product-${index + 1}`}
                    height={220}
                    key={imageUrl}
                    src={imageUrl}
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
            <Image
              alt=""
              className="about-store-image"
              height={800}
              src="/brand/conexao-history-story-banner.png"
              width={1600}
            />
          </div>
          <div>
            <p className="eyebrow">Conheca a Conexao</p>
            <h2>11 anos de historia conectando pessoas pelas fragrancias</h2>
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
          {giftGuides.map((guide) => (
            <Link
              className={`gift-guide-card gift-guide-card-${guide.id}`}
              href={guide.href}
              key={guide.id}
            >
              <div className="gift-guide-content">
                <span>{guide.label}</span>
                <strong>{guide.title}</strong>
                <small>{guide.description}</small>
              </div>
              <div className="gift-guide-visual" aria-hidden="true">
                <Image
                  alt=""
                  className="gift-guide-image"
                  height={220}
                  src={guide.image}
                  width={220}
                />
              </div>
            </Link>
          ))}
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
