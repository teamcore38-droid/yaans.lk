import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';
import CategoryQuadCard from '../../src/components/CategoryQuadCard.jsx';

const category = {
  name: 'Fashion', slug: 'fashion', quadHeadline: 'Shop fashion',
  subCategories: Array.from({ length: 7 }, (_, i) => ({
    name: `Subcategory ${i + 1}`, slug: `subcategory-${i + 1}`, imageUrl: `/images/subcategory-${i + 1}.webp`
  }))
};

test.each([0, 2, 3, 4, 7])('%i configured subcategories remain accessible in order', count => {
  render(<MemoryRouter><CategoryQuadCard category={{ ...category, subCategories: category.subCategories.slice(0, count) }} /></MemoryRouter>);
  const region = screen.getByRole('region', { name: 'Fashion subcategories' });
  expect(within(region).queryAllByRole('link').map(link => link.getAttribute('aria-label')))
    .toEqual(category.subCategories.slice(0, count).map(tile => tile.name));
  expect(Boolean(screen.queryByText('Swipe'))).toBe(count > 3);
  expect(screen.getByRole('link', { name: 'See all in Fashion' })).toHaveAttribute('href', '/products?category=fashion');
});

test('a subcategory beyond the old four-tile limit opens its parent and subcategory filter', async () => {
  function Destination() { return <p>{useLocation().search}</p>; }
  render(<MemoryRouter><Routes>
    <Route path="/" element={<CategoryQuadCard category={category} />} />
    <Route path="/products" element={<Destination />} />
  </Routes></MemoryRouter>);
  await userEvent.setup().click(screen.getByRole('link', { name: 'Subcategory 6', exact: true }));
  expect(screen.getByText('?category=fashion&subCategory=subcategory-6')).toBeInTheDocument();
});

test('query values are encoded and category labels remain plain text', () => {
  const label = '<script>alert(1)</script>';
  render(<MemoryRouter><CategoryQuadCard category={{ ...category, slug: 'fashion&unexpected=true',
    subCategories: [{ name: label, slug: 'bags&category=other', imageUrl: '/images/bags.webp' }] }} /></MemoryRouter>);
  const link = screen.getByRole('link', { name: label, exact: true });
  expect(link).toHaveAttribute('href', '/products?category=fashion%26unexpected%3Dtrue&subCategory=bags%26category%3Dother');
  expect(link.querySelector('script')).toBeNull();
  expect(link).toHaveTextContent(label);
});

test('additional tiles retain lazy responsive images without eager loading', () => {
  render(<MemoryRouter><CategoryQuadCard category={category} /></MemoryRouter>);
  const images = within(screen.getByRole('region')).getAllByRole('img');
  expect(images).toHaveLength(7);
  for (const image of images) {
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image.getAttribute('sizes')).toContain('calc((100vw - 74px) / 3)');
    expect(image).not.toHaveAttribute('fetchpriority', 'high');
  }
});

test('categories without configured subcategories still show their department links', () => {
  render(<MemoryRouter><CategoryQuadCard category={{ name: 'Empty department', slug: 'empty' }} /></MemoryRouter>);
  expect(within(screen.getByRole('region')).queryAllByRole('link')).toHaveLength(0);
  expect(screen.getByRole('link', { name: 'See all in Empty department' })).toHaveAttribute('href', '/products?category=empty');
});
