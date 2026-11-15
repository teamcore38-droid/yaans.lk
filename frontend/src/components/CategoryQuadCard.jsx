import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { imageUrl, imageSrcSet } from '../utils/images.js';

// Phones show three tiles in a native scrolling row; larger screens keep the 2x2 card.
export default function CategoryQuadCard({ category }) {
  const tiles = category.subCategories || [];
  const categoryQuery = `category=${encodeURIComponent(category.slug)}`;

  return (
    <div className="min-w-0 bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition">
      <div className="min-w-0">
        <Link
          to={`/products?${categoryQuery}`}
          className="flex items-center justify-between gap-2 group mb-2 sm:mb-3"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
            {category.quadHeadline || category.name}
          </h3>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>

        <div
          role="region"
          aria-label={`${category.name} subcategories`}
          tabIndex={0}
          className="grid min-w-0 grid-flow-col auto-cols-[calc((100%_-_1.5rem)/3)] gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory no-scrollbar rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:overflow-visible"
        >
          {tiles.map((tile, index) => (
            <Link
              key={tile.slug}
              to={`/products?${categoryQuery}&subCategory=${encodeURIComponent(tile.slug)}`}
              aria-label={tile.name}
              title={tile.name}
              className={`group block min-w-0 snap-start rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-700 ${index >= 4 ? 'sm:hidden' : ''}`}
            >
              <div
                className="aspect-square w-full rounded-lg overflow-hidden bg-[#F3F4F6] border border-slate-100 flex items-center justify-center"
                style={{ backgroundColor: tile.bgTint || '#F3F4F6' }}
              >
                <img
                  src={imageUrl(tile.imageUrl, 480)}
                  srcSet={imageSrcSet(tile.imageUrl, [160, 240, 320, 480])}
                  sizes="(max-width: 639px) calc((100vw - 74px) / 3), (max-width: 1023px) 22vw, 180px"
                  alt={tile.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="mt-1.5 text-xs font-medium text-slate-800 group-hover:text-sky-700 truncate">
                {tile.name}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-1 sm:mt-3 sm:pt-2 border-t border-slate-100 flex min-w-0 items-center justify-between gap-2">
        <Link
          to={`/products?${categoryQuery}`}
          title={`See all in ${category.name}`}
          className="min-w-0 truncate py-1 sm:py-0 text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          See all in {category.name}
        </Link>
        {tiles.length > 3 && <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-500 sm:hidden">Swipe <span aria-hidden="true">↔</span></span>}
      </div>
    </div>
  );
}
