import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronsDown, ChevronsUp } from 'lucide-react';
import CategoryQuadCard from './CategoryQuadCard.jsx';
import { imageUrl, isSafeImageUrl } from '../utils/images.js';

const DESKTOP_MEDIA = '(min-width: 1024px)';
const TABLET_MEDIA = '(min-width: 640px)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

function readInitialVisibleCount() {
  if (typeof window === 'undefined') return 1;
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia(DESKTOP_MEDIA).matches) return 3;
    if (window.matchMedia(TABLET_MEDIA).matches) return 2;
    return 1;
  }
  const width = Number(window.innerWidth) || 0;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_MEDIA).matches
  );
}

function readTransitionDurationMs(element) {
  if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return 0;
  }
  const raw = window.getComputedStyle(element).transitionDuration || '0';
  return raw
    .split(',')
    .map((entry) => {
      const value = entry.trim();
      const numeric = parseFloat(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return 0;
      return value.endsWith('ms') ? numeric : numeric * 1000;
    })
    .reduce((max, value) => Math.max(max, value), 0);
}

function categoryPreviewImage(category) {
  if (Array.isArray(category?.subCategories)) {
    const subTile = category.subCategories.find((tile) => isSafeImageUrl(tile?.imageUrl));
    if (subTile?.imageUrl) return subTile.imageUrl.trim();
  }
  if (isSafeImageUrl(category?.imageUrl)) return category.imageUrl.trim();
  return '';
}

export default function ExploreCategoriesSection({ categories = [], section }) {
  const [initialVisibleCount, setInitialVisibleCount] = useState(readInitialVisibleCount);
  const [expanded, setExpanded] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const extraPanelId = useId();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => setInitialVisibleCount(readInitialVisibleCount());
    sync();
    if (typeof window.matchMedia === 'function') {
      const desktopQuery = window.matchMedia(DESKTOP_MEDIA);
      const tabletQuery = window.matchMedia(TABLET_MEDIA);
      if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', sync);
        tabletQuery.addEventListener('change', sync);
        return () => {
          desktopQuery.removeEventListener('change', sync);
          tabletQuery.removeEventListener('change', sync);
        };
      }
      desktopQuery.addListener(sync);
      tabletQuery.addListener(sync);
      return () => {
        desktopQuery.removeListener(sync);
        tabletQuery.removeListener(sync);
      };
    }
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const configuredCategories = useMemo(() => {
    const safeCategories = Array.isArray(categories) ? categories : [];
    const limit = section?.limit;
    if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
      return safeCategories.slice(0, limit);
    }
    return safeCategories;
  }, [categories, section?.limit]);

  const primaryCategories = useMemo(
    () => configuredCategories.slice(0, initialVisibleCount),
    [configuredCategories, initialVisibleCount]
  );

  const hiddenCategories = useMemo(
    () => configuredCategories.slice(initialVisibleCount),
    [configuredCategories, initialVisibleCount]
  );

  const hiddenCount = hiddenCategories.length;

  const previewThumbnails = useMemo(
    () =>
      hiddenCategories
        .map((cat, index) => ({
          id: cat?._id || cat?.slug || `hidden-cat-${index}`,
          src: categoryPreviewImage(cat)
        }))
        .filter((item) => item.src)
        .slice(0, 3),
    [hiddenCategories]
  );

  useEffect(() => {
    if (hiddenCount === 0 && (expanded || panelMounted || panelOpen)) {
      setExpanded(false);
      setPanelMounted(false);
      setPanelOpen(false);
    }
  }, [hiddenCount, expanded, panelMounted, panelOpen]);

  useEffect(() => {
    if (expanded) {
      setPanelMounted(true);
      const durationMs = readTransitionDurationMs(panelRef.current);
      if (prefersReducedMotion() || !durationMs || typeof requestAnimationFrame !== 'function') {
        setPanelOpen(true);
        return undefined;
      }
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setPanelOpen(true));
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        if (innerFrame) cancelAnimationFrame(innerFrame);
      };
    }

    setPanelOpen(false);
    if (!panelMounted) return undefined;
    const durationMs = readTransitionDurationMs(panelRef.current);
    if (prefersReducedMotion() || !durationMs) {
      setPanelMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => setPanelMounted(false), Math.ceil(durationMs) + 80);
    return () => clearTimeout(timer);
  }, [expanded, panelMounted]);

  const handleToggle = () => {
    if (!expanded) {
      setPanelMounted(true);
      setExpanded(true);
    } else {
      setExpanded(false);
      setPanelOpen(false);
    }
  };

  const handleTransitionEnd = (event) => {
    if (
      !expanded &&
      event.target === event.currentTarget &&
      event.propertyName === 'grid-template-rows'
    ) {
      setPanelMounted(false);
    }
  };

  return (
    <section
      aria-label="Shop by Category"
      className="!mt-2 sm:!mt-2.5"
      hidden={!section.enabled}
      data-home-section="categories"
    >
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-1.5">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
            {section.title}
          </h2>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
            {section.subtitle}
          </p>
        </div>
        <Link
          to="/products"
          aria-label="View All Departments"
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
        >
          <span className="sm:hidden">View all</span>
          <span className="hidden sm:inline">View All Departments</span>{' '}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {primaryCategories.map((cat) => (
          <CategoryQuadCard key={cat._id || cat.slug} category={cat} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <>
          <div
            ref={panelRef}
            id={extraPanelId}
            data-open={panelOpen ? 'true' : 'false'}
            aria-hidden={!expanded}
            onTransitionEnd={handleTransitionEnd}
            className={`explore-categories-panel ${!expanded ? 'pointer-events-none' : ''}`}
          >
            <div className="explore-categories-panel-inner">
              {panelMounted && (
                <div className="pt-3 sm:pt-4 pb-0.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {hiddenCategories.map((cat) => (
                    <CategoryQuadCard key={cat._id || cat.slug} category={cat} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 sm:mt-2.5 flex justify-center">
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-controls={extraPanelId}
              className={`explore-categories-toggle group inline-flex items-center rounded-full text-white font-bold text-xs sm:text-[13px] tracking-[0.01em] transition-all duration-200 select-none ${
                expanded
                  ? 'w-full sm:w-auto sm:min-w-[240px] justify-center gap-1.5 px-5 py-2 min-h-[38px] sm:min-h-[40px]'
                  : 'w-full sm:w-auto sm:min-w-[330px] justify-between sm:justify-center gap-2 sm:gap-3 pl-1.5 pr-3 sm:pl-2 sm:pr-4 py-1 sm:py-1.5 min-h-[38px] sm:min-h-[42px]'
              }`}
            >
              {!expanded ? (
                <>
                  <span
                    aria-hidden="true"
                    data-testid="hidden-categories-preview"
                    className="flex items-center -space-x-2 shrink-0"
                  >
                    {previewThumbnails.map((thumb) => (
                      <img
                        key={thumb.id}
                        src={imageUrl(thumb.src, 96)}
                        alt=""
                        width="28"
                        height="28"
                        loading="lazy"
                        decoding="async"
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border-[1.5px] border-white/95 bg-white shadow-xs shrink-0"
                      />
                    ))}
                    <span className="relative z-10 inline-flex items-center justify-center min-w-[1.5rem] h-6 sm:min-w-[1.75rem] sm:h-7 px-1 rounded-full bg-black/45 border-[1.5px] border-white/90 text-[10px] font-extrabold text-white leading-none tabular-nums">
                      +{hiddenCount}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span className="truncate">
                      Explore {hiddenCount} More {hiddenCount === 1 ? 'Category' : 'Categories'}
                    </span>
                    <ChevronsDown
                      aria-hidden="true"
                      className="w-4 h-4 shrink-0 text-white/95 transition-transform duration-200 group-hover:translate-y-0.5"
                    />
                  </span>
                </>
              ) : (
                <>
                  <span className="whitespace-nowrap">Show Less Categories</span>
                  <ChevronsUp
                    aria-hidden="true"
                    className="w-4 h-4 shrink-0 text-white/95 transition-transform duration-200 group-hover:-translate-y-0.5"
                  />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
