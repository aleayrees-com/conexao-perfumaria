'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  clampGalleryImageIndex,
  getNextGalleryImageIndex,
  getPreviousGalleryImageIndex,
} from '@/lib/product-gallery';

interface ProductGalleryProps {
  readonly productName: string;
  readonly imageUrls: readonly string[];
}

export function ProductGallery({
  productName,
  imageUrls,
}: ProductGalleryProps) {
  const images = useMemo(
    () => Array.from(new Set(imageUrls.filter((imageUrl) => imageUrl.trim()))),
    [imageUrls],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const safeSelectedIndex = clampGalleryImageIndex(
    selectedIndex,
    images.length,
  );
  const selectedImage = images[safeSelectedIndex] ?? null;

  const goToNextImage = useCallback(() => {
    setSelectedIndex((currentIndex) =>
      getNextGalleryImageIndex(currentIndex, images.length),
    );
  }, [images.length]);

  const goToPreviousImage = useCallback(() => {
    setSelectedIndex((currentIndex) =>
      getPreviousGalleryImageIndex(currentIndex, images.length),
    );
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1 || isLightboxOpen) {
      return;
    }

    const intervalId = window.setInterval(goToNextImage, 5000);

    return () => window.clearInterval(intervalId);
  }, [goToNextImage, images.length, isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false);
        return;
      }

      if (event.key === 'ArrowRight') {
        goToNextImage();
        return;
      }

      if (event.key === 'ArrowLeft') {
        goToPreviousImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextImage, goToPreviousImage, isLightboxOpen]);

  if (!selectedImage) {
    return (
      <div className="product-gallery">
        <div className="product-main-image-frame placeholder" />
      </div>
    );
  }

  return (
    <div className="product-gallery">
      <button
        aria-label={`Ampliar imagem de ${productName}`}
        className="product-main-image-button"
        type="button"
        onClick={() => setIsLightboxOpen(true)}
      >
        <span className="product-main-image-frame">
          <Image
            alt={productName}
            className="product-main-image"
            height={720}
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src={selectedImage}
            width={720}
          />
        </span>
      </button>

      {images.length > 1 ? (
        <div aria-label="Imagens do produto" className="thumb-row">
          {images.map((imageUrl, index) => (
            <button
              aria-label={`Selecionar imagem ${index + 1} de ${productName}`}
              aria-current={index === safeSelectedIndex ? 'true' : undefined}
              className={`thumb-button${index === safeSelectedIndex ? ' is-active' : ''}`}
              key={imageUrl}
              type="button"
              onClick={() => setSelectedIndex(index)}
            >
              <Image
                alt=""
                className="thumb-image"
                height={140}
                sizes="120px"
                src={imageUrl}
                width={140}
              />
            </button>
          ))}
        </div>
      ) : null}

      {isLightboxOpen ? (
        <div
          aria-label={`Imagem ampliada de ${productName}`}
          aria-modal="true"
          className="product-image-lightbox"
          role="dialog"
        >
          <button
            aria-label="Fechar imagem ampliada"
            className="lightbox-close"
            type="button"
            onClick={() => setIsLightboxOpen(false)}
          >
            ×
          </button>
          {images.length > 1 ? (
            <button
              aria-label="Imagem anterior"
              className="lightbox-nav lightbox-prev"
              type="button"
              onClick={goToPreviousImage}
            >
              ‹
            </button>
          ) : null}
          <div className="product-image-lightbox-frame">
            <Image
              alt={productName}
              className="product-image-lightbox-image"
              fill
              sizes="100vw"
              src={selectedImage}
            />
          </div>
          {images.length > 1 ? (
            <button
              aria-label="Próxima imagem"
              className="lightbox-nav lightbox-next"
              type="button"
              onClick={goToNextImage}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
