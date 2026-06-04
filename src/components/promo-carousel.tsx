'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from 'react';

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
const autoPlayIntervalMs = 4500;
const interactionPauseMs = 7000;
const swipeThresholdPx = 42;
const maxDragPreviewPx = 96;
const touchGestureId = -1;

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
}

export function PromoCarousel({
  slides,
}: {
  readonly slides: readonly PromoSlide[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderHeight, setSliderHeight] = useState<number | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pauseUntilRef = useRef(0);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const suppressNextClickRef = useRef(false);
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    const activeSlideElement = slideRefs.current[activeIndex];

    if (!activeSlideElement) {
      return;
    }

    const measuredSlideElement = activeSlideElement;

    function updateSliderHeight(): void {
      setSliderHeight(
        Math.ceil(measuredSlideElement.getBoundingClientRect().height),
      );
    }

    const resizeObserver = new ResizeObserver(updateSliderHeight);

    updateSliderHeight();
    resizeObserver.observe(activeSlideElement);
    window.addEventListener('resize', updateSliderHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSliderHeight);
    };
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length < 2) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (reducedMotion.matches) {
      return;
    }

    const interval = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current || dragStateRef.current) {
        return;
      }

      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, autoPlayIntervalMs);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  if (!activeSlide) {
    return null;
  }

  function pauseAutoPlay(): void {
    pauseUntilRef.current = Date.now() + interactionPauseMs;
  }

  function move(offset: number): void {
    pauseAutoPlay();
    setDragOffset(0);
    setActiveIndex((currentIndex) =>
      slides.length === 0
        ? 0
        : (currentIndex + offset + slides.length) % slides.length,
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (slides.length < 2 || dragStateRef.current) {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.promo-arrow, .promo-dots button')
    ) {
      return;
    }

    pauseAutoPlay();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    const clampedOffset = Math.max(
      -maxDragPreviewPx,
      Math.min(maxDragPreviewPx, deltaX),
    );

    setDragOffset(clampedOffset);
  }

  function finishGesture(
    clientX: number,
    clientY: number,
    gestureId: number,
  ): void {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== gestureId) {
      return;
    }

    const deltaX = clientX - dragState.startX;
    const deltaY = clientY - dragState.startY;

    dragStateRef.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (
      Math.abs(deltaX) < swipeThresholdPx ||
      Math.abs(deltaX) < Math.abs(deltaY)
    ) {
      return;
    }

    suppressNextClickRef.current = true;
    move(deltaX < 0 ? 1 : -1);
  }

  function finishPointerGesture(event: PointerEvent<HTMLElement>): void {
    finishGesture(event.clientX, event.clientY, event.pointerId);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>): void {
    if (slides.length < 2 || dragStateRef.current) {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.promo-arrow, .promo-dots button')
    ) {
      return;
    }

    const firstTouch = event.touches[0];

    if (!firstTouch) {
      return;
    }

    pauseAutoPlay();
    dragStateRef.current = {
      pointerId: touchGestureId,
      startX: firstTouch.clientX,
      startY: firstTouch.clientY,
    };
    setIsDragging(true);
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>): void {
    const dragState = dragStateRef.current;
    const firstTouch = event.touches[0];

    if (!firstTouch || !dragState || dragState.pointerId !== touchGestureId) {
      return;
    }

    const deltaX = firstTouch.clientX - dragState.startX;
    const deltaY = firstTouch.clientY - dragState.startY;

    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    setDragOffset(
      Math.max(-maxDragPreviewPx, Math.min(maxDragPreviewPx, deltaX)),
    );
  }

  function finishTouchGesture(event: TouchEvent<HTMLElement>): void {
    const changedTouch = event.changedTouches[0];

    if (!changedTouch) {
      return;
    }

    finishGesture(changedTouch.clientX, changedTouch.clientY, touchGestureId);
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>): void {
    if (!suppressNextClickRef.current) {
      return;
    }

    if (!(event.target instanceof HTMLElement) || !event.target.closest('a')) {
      suppressNextClickRef.current = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  }

  function handleDragStart(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
  }

  const sliderTransform =
    dragOffset === 0
      ? `translateX(-${activeIndex * 100}%)`
      : `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`;
  const sliderStyle: CSSProperties = {
    height: sliderHeight === null ? undefined : `${sliderHeight}px`,
    transform: sliderTransform,
  };

  return (
    <section
      className={`promo-hero${isDragging ? ' dragging' : ''}`}
      aria-label="Campanha principal"
      onFocus={pauseAutoPlay}
      onClickCapture={handleClickCapture}
      onDragStart={handleDragStart}
      onPointerCancel={finishPointerGesture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onTouchCancel={finishTouchGesture}
      onTouchEnd={finishTouchGesture}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <div className="promo-slider" style={sliderStyle}>
        {slides.map((slide, index) => (
          <article
            aria-hidden={index !== activeIndex}
            className={`promo-slide ${slide.layout} ${slide.id}`}
            key={slide.id}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
          >
            {slide.layout === 'image' && slide.imageUrl ? (
              <Link
                className="promo-image-link"
                draggable={false}
                href={slide.searchHref}
                tabIndex={index === activeIndex ? undefined : -1}
              >
                <Image
                  alt={slide.imageAlt ?? slide.title}
                  draggable={false}
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
                            draggable={false}
                            href={`/produtos/${product.slug}`}
                            key={product.slug}
                            tabIndex={index === activeIndex ? undefined : -1}
                          >
                            <Image
                              alt={product.name}
                              draggable={false}
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
            onClick={() => {
              pauseAutoPlay();
              setActiveIndex(index);
            }}
          />
        ))}
      </div>
    </section>
  );
}
