import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Modeled directly after the second supplied reference image:
 * Clean white card with section headline + right arrow chevron,
 * and a 2x2 grid of sub-category image tiles with subtle neutral backgrounds.
 */
export default function CategoryQuadCard({ category }) {
  const tiles = (category.subCategories || []).slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition">
      <div>
        <Link
          to={`/products?category=${category.slug}`}
          className="flex items-center justify-between gap-2 group mb-3"
        >
          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
            {category.quadHeadline || category.name}
          </h3>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>

        {/* 2x2 Grid of Sub-Category Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.slug}
              to={`/products?category=${category.slug}&subCategory=${tile.slug}`}
              className="group block focus:outline-none"
            >
              <div
                className="aspect-square w-full rounded-lg overflow-hidden bg-[#F3F4F6] border border-slate-100 flex items-center justify-center"
                style={{ backgroundColor: tile.bgTint || '#F3F4F6' }}
              >
                <img
                  src={tile.imageUrl}
                  alt={tile.name}
                  loading="lazy"
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

      <Link
        to={`/products?category=${category.slug}`}
        className="mt-3 pt-2 border-t border-slate-100 inline-flex items-center text-xs font-semibold text-sky-700 hover:text-sky-800"
      >
        See all in {category.name}
      </Link>
    </div>
  );
}
