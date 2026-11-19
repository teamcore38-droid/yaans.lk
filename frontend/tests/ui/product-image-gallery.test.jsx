import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';
import ProductImageGalleryEditor from '../../src/components/ProductImageGalleryEditor.jsx';
import { apiRequest } from '../../src/utils/api.js';
vi.mock('../../src/utils/api.js', () => ({apiRequest: vi.fn()}));
const initial = ['https://example.com/front.jpg', 'https://example.com/back.jpg'];
function Editor({changed = () => {}, initialImages = initial, ...props}) {
  const [images, setImages] = useState(initialImages);
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

test('photo cards expose edit/upload buttons and move the main badge with the selected photo', async () => {
  render(<Editor/>); const user=userEvent.setup();
  const main=screen.getByRole('article',{name:'Photo 1'});
  expect(main).toHaveTextContent('Main image');
  expect(screen.getByRole('article',{name:'Photo 2'})).not.toHaveTextContent('Main image');
  const editClick=vi.spyOn(screen.getByLabelText('Replace image 2'),'click');
  await user.click(screen.getByRole('button',{name:'Edit image 2'}));expect(editClick).toHaveBeenCalledTimes(1);
  const addClick=vi.spyOn(screen.getByLabelText('Add product images'),'click');
  await user.click(screen.getByRole('button',{name:'Add photos'}));expect(addClick).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button',{name:'Make image 2 main'}));
  expect(screen.getByAltText('Product image 1')).toHaveAttribute('src',initial[1]);
  expect(screen.getAllByText('Main image')).toHaveLength(1);
  expect(screen.getByRole('group',{name:'Order photo 2'})).toBeInTheDocument();
});

test('eight-photo capacity blocks additions but permits replacement and removal', async () => {
  const images=Array.from({length:8},(_,i)=>`https://example.com/${i}.jpg`);
  apiRequest.mockResolvedValueOnce({url:'https://example.com/replacement.jpg'});
  render(<Editor initialImages={images}/>);const user=userEvent.setup();
  expect(screen.getByRole('button',{name:'Add photos'})).toBeDisabled();
  expect(screen.getByLabelText('Image URL')).toBeDisabled();
  expect(screen.getByRole('button',{name:'Edit image 8'})).toBeEnabled();
  await user.upload(screen.getByLabelText('Replace image 8'),photo('replacement.jpg'));
  await waitFor(()=>expect(screen.getByAltText('Product image 8')).toHaveAttribute('src','https://example.com/replacement.jpg'));
  await user.click(screen.getByRole('button',{name:'Remove image 8'}));
  expect(screen.getByRole('button',{name:'Add photos'})).toBeEnabled();
  expect(screen.getByText('Product images (7/8)')).toBeInTheDocument();
});

test.each([new File(['bad'],'bad.gif',{type:'image/gif'}),new File([new Uint8Array(4*1024*1024+1)],'large.jpg',{type:'image/jpeg'})])('invalid uploads retain photos and never send a request ($name)', async file => {
  render(<Editor/>);const user=userEvent.setup({applyAccept:false});
  await user.upload(screen.getByLabelText('Add product images'),file);
  expect(await screen.findByRole('alert')).toHaveTextContent('up to 4 MB');
  expect(apiRequest).not.toHaveBeenCalled();expect(screen.getAllByRole('img')).toHaveLength(2);
});

test('an incomplete upload response cannot replace the main image', async () => {
  apiRequest.mockResolvedValueOnce({});render(<Editor/>);
  await userEvent.setup().upload(screen.getByLabelText('Replace image 1'),photo('replacement.jpg'));
  expect(await screen.findByRole('alert')).toHaveTextContent('no image URL');
  expect(screen.getByAltText('Product image 1')).toHaveAttribute('src',initial[0]);
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
