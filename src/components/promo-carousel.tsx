'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export interface PromoSlideProduct {
  readonly imageUrl: string;
  readonly name: string;
  readonly slug: string;
}

export interface PromoSlide {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly bracket: string;
  readonly tagline: string;
  readonly highlights: readonly string[];
  readonly imageAlt?: string;
  readonly imageUrl?: string;
  readonly layout: 'image' | 'showcase';
  readonly searchLabel: string;
  readonly searchHref: string;
  readonly priceLabel: string;
  readonly priceDetail: string;
  readonly products: readonly PromoSlideProduct[];
}

const heroModelImage = '/brand/conexao-hero-model.png';

export function PromoCarousel({
  slides,
}: {
  readonly slides: readonly PromoSlide[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  if (!activeSlide) {
    return null;
  }

  function move(offset: number): void {
    setActiveIndex((currentIndex) =>
      slides.length === 0
        ? 0
        : (currentIndex + offset + slides.length) % slides.length,
    );
  }

  return (
    <section className="promo-hero" aria-label="Campanha principal">
      <div
        className="promo-slider"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <article
            aria-hidden={index !== activeIndex}
            className={`promo-slide ${slide.layout} ${slide.id}`}
            key={slide.id}
          >
            {slide.layout === 'image' && slide.imageUrl ? (
              <Link
                className="promo-image-link"
                href={slide.searchHref}
                tabIndex={index === activeIndex ? undefined : -1}
              >
                <Image
                  alt={slide.imageAlt ?? slide.title}
                  height={836}
                  priority={index === 0}
                  sizes="(max-width: 900px) calc(100vw - 48px), 1360px"
                  src={slide.imageUrl}
                  width={1600}
                />
              </Link>
            ) : (
              <>
                <div className="promo-copy" aria-live="polite">
                  <span>{slide.kicker}</span>
                  <strong>
                    {slide.title}
                    <small>{slide.bracket}</small>
                  </strong>
                  <p>{slide.tagline}</p>
                  <ul className="promo-highlights">
                    {slide.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                  <Link
                    className="promo-search"
                    href={slide.searchHref}
                    tabIndex={index === activeIndex ? undefined : -1}
                  >
                    {slide.searchLabel}
                  </Link>
                </div>
                <div className="promo-visual">
                  <div className="promo-portrait" aria-hidden="true">
                    <Image
                      alt=""
                      height={1280}
                      loading="eager"
                      sizes="(max-width: 900px) 54vw, 360px"
                      src={heroModelImage}
                      width={960}
                    />
                  </div>
                  <div
                    className="promo-stage"
                    aria-label="Produtos em destaque"
                  >
                    <div className="promo-price">
                      <span>a partir de:</span>
                      <strong>{slide.priceLabel}</strong>
                      <small>{slide.priceDetail}</small>
                    </div>
                    <div className="promo-products">
                      {slide.products.length > 0 ? (
                        slide.products.map((product) => (
                          <Link
                            className="promo-product"
                            href={`/produtos/${product.slug}`}
                            key={product.slug}
                            tabIndex={index === activeIndex ? undefined : -1}
                          >
                            <Image
                              alt={product.name}
                              height={560}
                              sizes="(max-width: 640px) 74vw, (max-width: 1200px) 340px, 380px"
                              src={product.imageUrl}
                              width={420}
                            />
                          </Link>
                        ))
                      ) : (
                        <div
                          className="promo-product-empty"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <button
        className="promo-arrow left"
        type="button"
        aria-label="Banner anterior"
        onClick={() => move(-1)}
      >
        ‹
      </button>
      <button
        className="promo-arrow right"
        type="button"
        aria-label="Proximo banner"
        onClick={() => move(1)}
      >
        ›
      </button>
      <div className="promo-dots" aria-label="Escolher banner">
        {slides.map((slide, index) => (
          <button
            aria-label={`Mostrar banner ${index + 1}: ${slide.bracket}`}
            aria-pressed={index === activeIndex}
            key={slide.id}
            type="button"
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}
