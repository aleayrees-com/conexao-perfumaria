import {
  clampGalleryImageIndex,
  getNextGalleryImageIndex,
} from '@/lib/product-gallery';

describe('product gallery helpers', () => {
  it('cycles through product images every autoplay tick', () => {
    expect(getNextGalleryImageIndex(0, 3)).toBe(1);
    expect(getNextGalleryImageIndex(1, 3)).toBe(2);
    expect(getNextGalleryImageIndex(2, 3)).toBe(0);
  });

  it('keeps the selected image inside the available image list', () => {
    expect(clampGalleryImageIndex(2, 2)).toBe(1);
    expect(clampGalleryImageIndex(-1, 2)).toBe(0);
    expect(clampGalleryImageIndex(4, 0)).toBe(0);
  });
});
