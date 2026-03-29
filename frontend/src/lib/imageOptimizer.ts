/**
 * Image optimization utilities for CloudFront
 * 
 * Usage:
 * const optimizedUrl = getOptimizedImageUrl(originalUrl, { width: 400, quality: 70 })
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
}

export function getOptimizedImageUrl(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  // If it's not a CloudFront URL, return as-is
  if (!url.includes('cloudfront.net')) {
    return url;
  }

  const params = new URLSearchParams();
  
  // Add optimization parameters
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.quality) params.append('quality', options.quality.toString());
  if (options.format) params.append('format', options.format);
  
  // If no options provided, use defaults
  if (params.toString() === '') {
    params.append('width', '800');
    params.append('quality', '80');
    params.append('format', 'auto');
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * Get responsive image srcSet for different screen sizes
 */
export function getImageSrcSet(baseUrl: string): string {
  const sizes = [400, 800, 1200];
  return sizes
    .map(size => `${getOptimizedImageUrl(baseUrl, { width: size })} ${size}w`)
    .join(', ');
}

/**
 * Hook for optimized images with lazy loading
 */
export function useOptimizedImage(
  url: string,
  options: ImageOptimizationOptions = {}
) {
  return getOptimizedImageUrl(url, options);
}
