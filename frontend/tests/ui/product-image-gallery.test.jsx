import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';
import ProductImageGalleryEditor from '../../src/components/ProductImageGalleryEditor.jsx';
import { apiRequest } from '../../src/utils/api.js';
vi.mock('../../src/utils/api.js', () => ({apiRequest: vi.fn()}));
const initial = ['https://example.com/front.jpg', 'https://example.com/back.jpg'];
function Editor({changed = () => {}, ...props}) {
  const [images, setImages] = useState(initial);
  return <ProductImageGalleryEditor images={images} onChange={next => {setImages(next); changed(next);}} endpoint="/seller/upload-image" {...props}/>;
}
const photo = name => new File(['photo'], name, {type:'image/jpeg'});

test('main image, order and individual removal preserve the other photos', async () => {
  const changed = vi.fn(); render(<Editor changed={changed}/>); const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name:'Make image 2 main'}));
  expect(changed).toHaveBeenLastCalledWith([...initial].reverse());
  await user.click(screen.getByRole('button', {name:'Move image 1 later'}));
  expect(changed).toHaveBeenLastCalledWith(initial);
  await user.click(screen.getByRole('button', {name:'Remove image 2'}));
  expect(changed).toHaveBeenLastCalledWith([initial[0]]);
});

test('multiple uploads append in order and replacement changes only the selected image', async () => {
  apiRequest.mockResolvedValueOnce({url:'https://example.com/three.jpg'}).mockResolvedValueOnce({url:'https://example.com/four.jpg'}).mockResolvedValueOnce({url:'https://example.com/replacement.jpg'});
  const changed=vi.fn();render(<Editor changed={changed}/>);const user=userEvent.setup();
  await user.upload(screen.getByLabelText('Add product images'), [photo('three.jpg'), photo('four.jpg')]);
  await waitFor(()=>expect(changed).toHaveBeenLastCalledWith([...initial,'https://example.com/three.jpg','https://example.com/four.jpg']));
  await user.upload(screen.getByLabelText('Replace image 2'), photo('replacement.jpg'));
  await waitFor(()=>expect(changed).toHaveBeenLastCalledWith([initial[0],'https://example.com/replacement.jpg','https://example.com/three.jpg','https://example.com/four.jpg']));
});

test('failed replacement keeps the saved photo and exposes an actionable error', async () => {
  apiRequest.mockRejectedValueOnce(new Error('Storage unavailable. Try again.'));
  const changed=vi.fn();render(<Editor changed={changed}/>);const user=userEvent.setup();
  await user.upload(screen.getByLabelText('Replace image 1'), photo('replacement.jpg'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByAltText('Product image 1')).toHaveAttribute('src',initial[0]);
});

test('a partial batch keeps successful uploads and does not discard existing photos', async () => {
  apiRequest.mockResolvedValueOnce({url:'https://example.com/three.jpg'}).mockRejectedValueOnce(new Error('Upload limit reached. Try later.'));
  const changed=vi.fn();render(<Editor changed={changed}/>);const user=userEvent.setup();
  await user.upload(screen.getByLabelText('Add product images'),[photo('three.jpg'),photo('four.jpg')]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload limit reached');
  expect(changed).toHaveBeenLastCalledWith([...initial,'https://example.com/three.jpg']);
  expect(screen.getAllByRole('img')).toHaveLength(3);
});

test('over-capacity uploads are rejected before requests and late results cannot modify a closed editor', async () => {
  const changed=vi.fn();const {unmount}=render(<Editor changed={changed}/>);const user=userEvent.setup();
  await user.upload(screen.getByLabelText('Add product images'),Array.from({length:7},(_,i)=>photo(`${i}.jpg`)));
  expect(await screen.findByRole('alert')).toHaveTextContent('eight');expect(apiRequest).not.toHaveBeenCalled();
  let resolve;apiRequest.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await user.upload(screen.getByLabelText('Replace image 1'),photo('replacement.jpg'));
  expect(screen.getByRole('button',{name:'Remove image 1'})).toBeDisabled();
  unmount();resolve({url:'https://example.com/late.jpg'});
  await Promise.resolve();expect(changed).not.toHaveBeenCalled();
});
