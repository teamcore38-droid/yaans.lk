import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import ExploreCategoriesSection from '../../src/components/ExploreCategoriesSection.jsx';

const baseSection = {
  enabled: true,
  title: 'Explore Categories',
  mobileTitle: 'Explore Categories',
  subtitle: 'Tap any department or subcategory tile to filter products',
  limit: 12,
  position: 1
};

const sampleCategories = [
  'Accessories',
  'Ceramics',
  'Cane Products',
  'Home & Kitchen',
  'Fashion & Handloom',
  'Ayurveda & Beauty'
].map((name, index) => ({
  _id: `cat-${index + 1}`,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  quadHeadline: name,
  imageUrl: `https://res.cloudinary.com/demo/image/upload/v${index + 1}/categories/cover-${index + 1}.webp`,
  subCategories: Array.from({ length: 4 }, (_, tileIdx) => ({
    name: `${name} item ${tileIdx + 1}`,
    slug: `item-${tileIdx + 1}`,
    imageUrl: `https://res.cloudinary.com/demo/image/upload/v${index + 1}/categories/tile-${index + 1}-${tileIdx + 1}.webp`
  }))
}));

function stubViewportWidth(initialWidth) {
  let width = initialWidth;
  const listeners = new Map();

  const matchesQuery = (query) => {
    const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
    if (minMatch) return width >= Number(minMatch[1]);
    return false;
  };

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  });

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      const set = listeners.get(query);
      return {
        media: query,
        get matches() {
          return matchesQuery(query);
        },
        addEventListener: (_event, cb) => set.add(cb),
        removeEventListener: (_event, cb) => set.delete(cb),
        addListener: (cb) => set.add(cb),
        removeListener: (cb) => set.delete(cb)
      };
    })
  );

  return {
    setWidth(nextWidth) {
      width = nextWidth;
      window.innerWidth = nextWidth;
      for (const [query, callbacks] of listeners.entries()) {
        const matches = matchesQuery(query);
        for (const cb of callbacks) cb({ matches, media: query });
      }
    }
  };
}

test('mobile starts collapsed to the first category card, previews hidden categories, and toggles cleanly', async () => {
  stubViewportWidth(393);
  render(
    <MemoryRouter>
      <ExploreCategoriesSection categories={sampleCategories} section={baseSection} />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: 'Explore Categories' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View All Departments' })).toHaveAttribute('href', '/products');
  expect(screen.getByRole('region', { name: 'Accessories subcategories' })).toBeInTheDocument();
  for (const hiddenName of ['Ceramics', 'Cane Products', 'Home & Kitchen', 'Fashion & Handloom', 'Ayurveda & Beauty']) {
    expect(screen.queryByRole('region', { name: `${hiddenName} subcategories` })).not.toBeInTheDocument();
  }

  const toggle = screen.getByRole('button', { name: 'Explore 5 More Categories' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const preview = within(toggle).getByTestId('hidden-categories-preview');
  expect(preview).toHaveTextContent('+5');
  const previewImgs = [...preview.querySelectorAll('img')];
  expect(previewImgs).toHaveLength(3);
  expect(previewImgs.map((img) => img.getAttribute('src'))).toEqual([
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v2/categories/tile-2-1.webp',
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v3/categories/tile-3-1.webp',
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v4/categories/tile-4-1.webp'
  ]);
  for (const img of previewImgs) {
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  }

  const user = userEvent.setup();
  await user.click(toggle);

  const collapse = screen.getByRole('button', { name: 'Show Less Categories' });
  expect(collapse).toHaveAttribute('aria-expanded', 'true');
  expect(within(collapse).queryByTestId('hidden-categories-preview')).not.toBeInTheDocument();
  for (const cat of sampleCategories) {
    expect(screen.getByRole('region', { name: `${cat.name} subcategories` })).toBeInTheDocument();
  }

  await user.click(collapse);
  expect(screen.getByRole('button', { name: 'Explore 5 More Categories' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('region', { name: 'Accessories subcategories' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Ceramics subcategories' })).not.toBeInTheDocument();
});

test('desktop starts collapsed to the first row of 3 category cards and previews the remaining hidden categories', async () => {
  stubViewportWidth(1280);
  render(
    <MemoryRouter>
      <ExploreCategoriesSection categories={sampleCategories} section={baseSection} />
    </MemoryRouter>
  );

  for (const visibleName of ['Accessories', 'Ceramics', 'Cane Products']) {
    expect(screen.getByRole('region', { name: `${visibleName} subcategories` })).toBeInTheDocument();
  }
  for (const hiddenName of ['Home & Kitchen', 'Fashion & Handloom', 'Ayurveda & Beauty']) {
    expect(screen.queryByRole('region', { name: `${hiddenName} subcategories` })).not.toBeInTheDocument();
  }

  const toggle = screen.getByRole('button', { name: 'Explore 3 More Categories' });
  const preview = within(toggle).getByTestId('hidden-categories-preview');
  expect(preview).toHaveTextContent('+3');
  const previewImgs = [...preview.querySelectorAll('img')];
  expect(previewImgs).toHaveLength(3);
  expect(previewImgs.map((img) => img.getAttribute('src'))).toEqual([
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v4/categories/tile-4-1.webp',
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v5/categories/tile-5-1.webp',
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_96/v6/categories/tile-6-1.webp'
  ]);

  const user = userEvent.setup();
  await user.click(toggle);
  expect(screen.getByRole('button', { name: 'Show Less Categories' })).toHaveAttribute('aria-expanded', 'true');
  for (const cat of sampleCategories) {
    expect(screen.getByRole('region', { name: `${cat.name} subcategories` })).toBeInTheDocument();
  }
});

test('adapts visible row count across mobile, tablet and desktop breakpoint changes and omits button when nothing is hidden', () => {
  const viewport = stubViewportWidth(393);
  render(
    <MemoryRouter>
      <ExploreCategoriesSection categories={sampleCategories.slice(0, 3)} section={baseSection} />
    </MemoryRouter>
  );

  expect(screen.getByRole('button', { name: 'Explore 2 More Categories' })).toBeInTheDocument();

  act(() => viewport.setWidth(768));
  expect(screen.getByRole('region', { name: 'Accessories subcategories' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Ceramics subcategories' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Cane Products subcategories' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Explore 1 More Category' })).toBeInTheDocument();

  act(() => viewport.setWidth(1280));
  expect(screen.getByRole('region', { name: 'Cane Products subcategories' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Explore .* More/ })).not.toBeInTheDocument();
});

test('respects section limit and filters unsafe preview image URLs while keeping labels plain text', () => {
  stubViewportWidth(393);
  const categoriesWithUnsafePreview = [
    sampleCategories[0],
    {
      _id: 'unsafe-1',
      name: '<img src=x onerror=alert(1)>',
      slug: 'unsafe-one',
      imageUrl: 'javascript:alert(1)',
      subCategories: [{ name: 'Bad', slug: 'bad', imageUrl: 'data:image/svg+xml,<svg/>' }]
    },
    {
      _id: 'safe-fallback',
      name: 'Safe Cover Only',
      slug: 'safe-cover',
      imageUrl: '/brand/yaans-mark-dark.png',
      subCategories: [{ name: 'Http', slug: 'http', imageUrl: 'http://insecure.invalid/photo.jpg' }]
    },
    sampleCategories[3]
  ];

  render(
    <MemoryRouter>
      <ExploreCategoriesSection
        categories={categoriesWithUnsafePreview}
        section={{ ...baseSection, limit: 3 }}
      />
    </MemoryRouter>
  );

  const toggle = screen.getByRole('button', { name: 'Explore 2 More Categories' });
  const preview = within(toggle).getByTestId('hidden-categories-preview');
  expect(preview).toHaveTextContent('+2');
  const previewImgs = [...preview.querySelectorAll('img')];
  expect(previewImgs).toHaveLength(1);
  expect(previewImgs[0]).toHaveAttribute('src', '/brand/yaans-mark-dark.png');
  expect(document.querySelector('img[src^="javascript:"]')).toBeNull();
  expect(document.querySelector('img[src^="data:"]')).toBeNull();
  expect(document.querySelector('img[src^="http://"]')).toBeNull();
});
