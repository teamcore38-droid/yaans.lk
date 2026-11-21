import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import RateLimitNotice from '../../src/components/RateLimitNotice.jsx';
import { apiFailure } from '../../src/utils/retryAfter.js';

test('wait notice counts down, disappears and leaves no timer after unmount',async()=>{
  vi.useFakeTimers();const {unmount}=render(<RateLimitNotice/>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(()=>{apiFailure({status:429,headers:{get:()=> '3'}});});
  expect(screen.getByRole('status')).toHaveTextContent('wait 3 seconds');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(screen.getByRole('status')).toHaveTextContent('wait 2 seconds');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(vi.getTimerCount()).toBe(0);
  unmount();act(()=>{apiFailure({status:429,headers:{get:()=> '3'}});});expect(vi.getTimerCount()).toBe(0);
});

test('untrusted or excessive countdown events do not render a notice',()=>{
  render(<RateLimitNotice/>);
  for(const retryAt of [NaN,Infinity,0,Date.now()+172800000])act(()=>window.dispatchEvent(new CustomEvent('yaans:rate-limited',{detail:{retryAt}})));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
