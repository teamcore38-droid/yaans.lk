import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import BannerManagementTab from '../../src/pages/admin/BannerManagementTab.jsx';
import { apiRequest } from '../../src/utils/api.js';

vi.mock('../../src/utils/api.js', async original => ({ ...await original(), apiRequest: vi.fn() }));
beforeEach(() => apiRequest.mockReset());

const shared = '/banners/shared.webp';
const banner = { id: 'test-banner', title: 'Test banner', imageUrl: shared, mobileImageUrl: shared, active: true, ctaLink: '/products' };
const photo = name => new File(['photo'], name, { type: 'image/png' });
const urlField = device => screen.getByRole('textbox', { name: `${device} banner image URL` });
const uploadField = device => screen.getByLabelText(`Upload ${device.toLowerCase()} banner`);
function editor(changes = {}) {
  const showToast = vi.fn(), fetchOverview = vi.fn();
  const view = render(<BannerManagementTab bannersState={[{ ...banner, ...changes }]} categories={[]} showToast={showToast} fetchOverview={fetchOverview} />);
  return { ...view, user: userEvent.setup(), showToast, fetchOverview };
}

test.each(['Desktop', 'Mobile'])('%s uploads preserve the other image, including banners previously sharing an image', async device => {
  apiRequest.mockResolvedValueOnce({ url: '/banners/replacement.png' }).mockResolvedValueOnce({});
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField(device), photo('replacement.png'));
  expect(urlField(device)).toHaveValue('/banners/replacement.png');
  const other = device === 'Desktop' ? 'Mobile' : 'Desktop';
  expect(urlField(other)).toHaveValue(shared);
  const [, upload] = apiRequest.mock.calls[0];
  expect(upload.body.get('image').name).toBe('replacement.png');
  expect(upload.signal.aborted).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  const payload = JSON.parse(apiRequest.mock.calls[1][1].body);
  expect(payload[device === 'Desktop' ? 'imageUrl' : 'mobileImageUrl']).toBe('/banners/replacement.png');
  expect(payload[device === 'Desktop' ? 'mobileImageUrl' : 'imageUrl']).toBe(shared);
});

test('URL edits are independent and sharing requires an explicit copy action', async () => {
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.clear(urlField('Mobile'));
  await user.type(urlField('Mobile'), '/banners/mobile.png');
  expect(urlField('Desktop')).toHaveValue(shared);
  await user.click(screen.getByRole('button', { name: 'Copy from Mobile' }));
  expect(urlField('Desktop')).toHaveValue('/banners/mobile.png');
  await user.clear(urlField('Desktop'));
  await user.type(urlField('Desktop'), '/banners/desktop.png');
  expect(urlField('Mobile')).toHaveValue('/banners/mobile.png');
  await user.click(screen.getByRole('button', { name: 'Copy from Desktop' }));
  expect(urlField('Mobile')).toHaveValue('/banners/desktop.png');
  expect(apiRequest).not.toHaveBeenCalled();
});

test.each(['', '/mobile_hero_banner.jpg'])('editing and saving preserves the existing mobile reference %j', async mobileImageUrl => {
  apiRequest.mockResolvedValueOnce({});
  const { user } = editor({ mobileImageUrl });
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  expect(urlField('Mobile')).toHaveValue(mobileImageUrl);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toMatchObject({ imageUrl: shared, mobileImageUrl });
});

test.each(['Desktop', 'Mobile'])('a new %s-only upload leaves the other field empty when saved', async device => {
  apiRequest.mockResolvedValueOnce({ url: '/banners/new.png' }).mockResolvedValueOnce({});
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Add New Banner Card' }));
  await user.type(screen.getByPlaceholderText('e.g., Electronics & Gadgets, Ceylon Tea & Spices'), 'New banner');
  await user.upload(uploadField(device), photo('new.png'));
  const other = device === 'Desktop' ? 'Mobile' : 'Desktop';
  expect(urlField(other)).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Create Banner Card' }));
  expect(apiRequest.mock.calls[1][0]).toBe('/admin/banners');
  expect(JSON.parse(apiRequest.mock.calls[1][1].body)[device === 'Desktop' ? 'mobileImageUrl' : 'imageUrl']).toBe('');
});

test('simultaneous device uploads remain independent when responses arrive in reverse order', async () => {
  let finishDesktop, finishMobile;
  apiRequest.mockImplementationOnce(() => new Promise(done => { finishDesktop = done; }))
    .mockImplementationOnce(() => new Promise(done => { finishMobile = done; }));
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField('Desktop'), photo('desktop.png'));
  await user.upload(uploadField('Mobile'), photo('mobile.png'));
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  await act(async () => finishMobile({ url: '/banners/mobile.png' }));
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  await act(async () => finishDesktop({ url: '/banners/desktop.png' }));
  expect(urlField('Desktop')).toHaveValue('/banners/desktop.png');
  expect(urlField('Mobile')).toHaveValue('/banners/mobile.png');
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
});

test.each([new Error('Image storage unavailable. Try again.'), {}])('failed uploads retain both images and allow retry (%j)', async result => {
  if (result instanceof Error) apiRequest.mockRejectedValueOnce(result);
  else apiRequest.mockResolvedValueOnce(result);
  apiRequest.mockResolvedValueOnce({ url: '/banners/retried.png' });
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField('Mobile'), photo('retry.png'));
  expect(await screen.findByRole('alert')).toHaveTextContent(result.message || 'no URL returned');
  expect(urlField('Desktop')).toHaveValue(shared);
  expect(urlField('Mobile')).toHaveValue(shared);
  await user.upload(uploadField('Mobile'), photo('retry.png'));
  expect(urlField('Mobile')).toHaveValue('/banners/retried.png');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([
  new File(['unsupported'], 'photo.heic', { type: 'image/heic' }),
  new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
])('unsupported or oversized files are rejected before making a request ($name)', async file => {
  editor(); const user = userEvent.setup({ applyAccept: false });
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField('Mobile'), file);
  expect(await screen.findByRole('alert')).toHaveTextContent('up to 4 MB');
  expect(apiRequest).not.toHaveBeenCalled();
  expect(urlField('Mobile')).toHaveValue(shared);
});

test('closing aborts uploads and late results cannot change a newly opened banner', async () => {
  let finish;
  apiRequest.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const { user, showToast } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField('Mobile'), photo('late.png'));
  const signal = apiRequest.mock.calls[0][1].signal;
  await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(signal.aborted).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Add New Banner Card' }));
  await act(async () => finish({ url: '/banners/late.png' }));
  expect(urlField('Desktop')).toHaveValue('');
  expect(urlField('Mobile')).toHaveValue('');
  expect(showToast).not.toHaveBeenCalled();
});

test('unmount aborts outstanding uploads without reporting a stale success', async () => {
  let finish;
  apiRequest.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const { user, unmount, showToast } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await user.upload(uploadField('Mobile'), photo('late.png'));
  const signal = apiRequest.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ url: '/banners/late.png' }));
  expect(showToast).not.toHaveBeenCalled();
});

test('a new URL restores a preview previously hidden by an image load failure', async () => {
  const { user } = editor();
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  fireEvent.error(screen.getByAltText('Mobile Banner Preview'));
  expect(screen.getByAltText('Mobile Banner Preview')).not.toBeVisible();
  await user.clear(urlField('Mobile'));
  await user.type(urlField('Mobile'), '/banners/new.png');
  await waitFor(() => expect(screen.getByAltText('Mobile Banner Preview')).toBeVisible());
});
