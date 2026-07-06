export function clampGalleryImageIndex(
  selectedIndex: number,
  imageCount: number,
): number {
  if (imageCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(selectedIndex, 0), imageCount - 1);
}

export function getNextGalleryImageIndex(
  selectedIndex: number,
  imageCount: number,
): number {
  if (imageCount <= 1) {
    return 0;
  }

  return (clampGalleryImageIndex(selectedIndex, imageCount) + 1) % imageCount;
}

export function getPreviousGalleryImageIndex(
  selectedIndex: number,
  imageCount: number,
): number {
  if (imageCount <= 1) {
    return 0;
  }

  return (
    (clampGalleryImageIndex(selectedIndex, imageCount) - 1 + imageCount) %
    imageCount
  );
}
