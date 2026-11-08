import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';

export const BANNER_CAROUSEL_CARDS = [
  {
    id: 'kitchen',
    title: 'Shop kitchen must-haves',
    category: 'Home & Kitchen',
    categorySlug: 'home-kitchen',
    link: '/products?category=home-kitchen',
    bgColor: '#DCEFE7', // Mint green from reference image 2
    textColor: '#0f172a',
    image: '/card1_kitchen.jpg',
    tagline: 'Cookware, appliances & dining essentials'
  },
  {
    id: 'beauty',
    title: 'Shop all things beauty',
    category: 'Ayurveda & Beauty',
    categorySlug: 'ayurveda-beauty',
    link: '/products?category=ayurveda-beauty',
    bgColor: '#FDE2DC', // Soft peach/blush from reference image 2
    textColor: '#0f172a',
    image: '/card2_beauty.jpg',
    tagline: 'Skincare, cosmetics & herbal wellness'
  },
  {
    id: 'fashion',
    title: 'Start looking sharp',
    category: 'Fashion & Handloom',
    categorySlug: 'fashion-handloom',
    link: '/products?category=fashion-handloom',
    bgColor: '#EDE9E3', // Soft warm stone/linen from reference image 2
    textColor: '#0f172a',
    image: '/card3_fashion.jpg',
    tagline: 'Handloom, casual wear & footwear'
  },
  {
    id: 'electronics',
    title: 'Plug in with electronics',
    category: 'Electronics & Tech',
    categorySlug: 'electronics',
    link: '/products?category=electronics',
    bgColor: '#DBEAFE', // Soft powder blue
    textColor: '#0f172a',
    image: '/card4_electronics.jpg',
    tagline: 'Headphones, smart gadgets & accessories'
  },
  {
    id: 'homemade',
    title: 'Authentic homemade finds',
    category: 'Homemade & Spices',
    categorySlug: 'homemade-pantry',
    link: '/products?homemade=true',
    bgColor: '#FEF3C7', // Soft warm golden amber
    textColor: '#0f172a',
    image: '/card5_homemade.jpg',
    tagline: 'Artisanal clayware, spices & kithul treacle'
  }
];

export default function BannerProductCarousel({
  activeCardIndex,
  onCardChange,
  isPaused,
  setIsPaused
}) {
  const trackRef = useRef(null);
  const [internalIdx, setInternalIdx] = useState(0);
  const [internalPaused, setInternalPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Allow either controlled or uncontrolled mode
  const currentIdx = activeCardIndex !== undefined ? activeCardIndex : internalIdx;
  const paused = isPaused !== undefined ? isPaused : internalPaused;

  const setIndex = useCallback(
    (newIdx) => {
      const bounded = (newIdx + BANNER_CAROUSEL_CARDS.length) % BANNER_CAROUSEL_CARDS.length;
      if (onCardChange) {
        onCardChange(bounded);
      } else {
        setInternalIdx(bounded);
      }
    },
    [onCardChange]
  );

  const setPauseState = useCallback(
    (val) => {
      if (setIsPaused) {
        setIsPaused(val);
      } else {
        setInternalPaused(val);
      }
    },
    [setIsPaused]
  );

  // Auto-scroll timer (advances every 3.2s when not paused)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setIndex(currentIdx + 1);
    }, 3200);

    return () => clearInterval(interval);
  }, [paused, currentIdx, setIndex]);

  // Smooth scroll to current card
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cardEl = track.children[currentIdx];
    if (cardEl) {
      const leftTarget = cardEl.offsetLeft - track.offsetLeft - 12;
      track.scrollTo({
        left: Math.max(0, leftTarget),
        behavior: 'smooth'
      });
    }
  }, [currentIdx]);

  const handlePrev = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIndex(currentIdx - 1);
  };

  const handleNext = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIndex(currentIdx + 1);
  };

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setPauseState(true)}
      onMouseLeave={() => setPauseState(false)}
      onTouchStart={() => setPauseState(true)}
      onTouchEnd={() => setPauseState(false)}
    >
      {/* Top micro-bar: Header label & Auto-play status pill */}
      <div className="flex items-center justify-between pb-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-wider text-slate-600">Featured Categories</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPauseState(!paused)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 hover:bg-white text-[10px] font-semibold text-slate-600 border border-slate-200 shadow-2xs transition"
            title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {paused ? (
              <>
                <Play className="w-2.5 h-2.5 fill-slate-600 text-slate-600" />
                <span>Paused</span>
              </>
            ) : (
              <>
                <Pause className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                <span className="text-emerald-700">Auto-scrolling</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Cards Scroll Track (Modeled directly on reference Image 2) */}
      <div className="relative group">
        <div
          ref={trackRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth no-scrollbar py-1 px-1 snap-x snap-mandatory cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {BANNER_CAROUSEL_CARDS.map((card, idx) => {
            const isActive = idx === currentIdx;
            return (
              <Link
                key={card.id}
                to={card.link}
                onClick={() => setIndex(idx)}
                className={`group/card relative shrink-0 snap-start rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 transform focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm hover:shadow-md ${
                  isActive ? 'ring-2 ring-slate-900/10 scale-[1.01]' : 'opacity-95 hover:opacity-100'
                }`}
                style={{
                  width: 'clamp(180px, 32vw, 220px)',
                  height: 'clamp(270px, 42vw, 310px)',
                  backgroundColor: card.bgColor
                }}
                title={`Browse ${card.category}`}
              >
                {/* High-fidelity category card matching Reference Image 2 */}
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover/card:scale-105"
                  loading="lazy"
                />

                {/* Hover overlay with Category Tag & Action Pill */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <span className="text-white text-xs font-bold leading-tight drop-shadow-sm">
                    {card.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 mt-0.5">
                    Shop collection <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Floating Navigation Arrows */}
        <button
          type="button"
          aria-label="Previous card"
          onClick={handlePrev}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md border border-slate-200/80 flex items-center justify-center transition-all opacity-85 hover:opacity-100 hover:scale-105 active:scale-95 z-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Next card"
          onClick={handleNext}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md border border-slate-200/80 flex items-center justify-center transition-all opacity-85 hover:opacity-100 hover:scale-105 active:scale-95 z-10"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Indicators & Jump Pills */}
      <div className="flex items-center justify-center gap-1.5 pt-2.5">
        {BANNER_CAROUSEL_CARDS.map((card, idx) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setIndex(idx)}
            aria-label={`Go to ${card.category}`}
            className={`h-1.5 transition-all duration-300 rounded-full ${
              idx === currentIdx
                ? 'w-6 bg-slate-900'
                : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
