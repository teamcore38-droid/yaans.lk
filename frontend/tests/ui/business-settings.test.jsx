import React from 'react';
import { act,render,screen,within,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect,test,vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BusinessSettingsTab from '../../src/pages/admin/BusinessSettingsTab.jsx';
import { DEFAULT_BUSINESS_SETTINGS } from '../../../shared/businessSettings.js';
import { useAnnouncementVisibility } from '../../src/hooks/useBusinessSettings.js';
import { apiRequest } from '../../src/utils/api.js';
vi.mock('../../src/utils/api.js',async original=>({...await original(),apiRequest:vi.fn()}));
const fresh=()=>structuredClone(DEFAULT_BUSINESS_SETTINGS);
test('draft edits require password, preview plain text and are published only in a separate explicit action',async()=>{
  let state={settings:fresh(),draft:fresh(),revision:0,version:0,history:[],hasDraft:false};
  apiRequest.mockImplementation(async(endpoint,options)=>{
    if(!options)return structuredClone(state);
    const body=JSON.parse(options.body);
    if(endpoint.endsWith('/draft')){state={...state,draft:body.settings,revision:1,hasDraft:true};return {revision:1,message:'Draft saved. Public settings are unchanged.'};}
    if(endpoint.endsWith('/publish')){state={...state,settings:state.draft,revision:2,version:1};return {message:'Business settings published.'};}
    return {};
  });
  render(<BusinessSettingsTab/>);const user=userEvent.setup();
  await screen.findByRole('heading',{name:'Business policies & storefront'});
  await user.click(screen.getByText('Identity',{selector:'summary'}));
  const name=screen.getByLabelText('identity.name');await user.clear(name);await user.type(name,'New Brand');
  expect(screen.getByRole('button',{name:'Save draft'})).toBeDisabled();
  await user.type(screen.getByLabelText('Business settings administrator password'),'Admin-passphrase!123');
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Public settings are unchanged');
  expect(state.settings.identity.name).toBe('Yaans.lk');expect(state.draft.identity.name).toBe('New Brand');
  expect(screen.getByLabelText('Business settings administrator password')).toHaveValue('');
  await user.click(screen.getByRole('button',{name:'Preview draft'}));
  expect(screen.getByRole('region',{name:'Business settings preview'})).toHaveTextContent('New Brand');
  await user.type(screen.getByLabelText('Business settings administrator password'),'Admin-passphrase!123');
  await user.click(screen.getByRole('button',{name:'Publish saved draft'}));
  await waitFor(()=>expect(state.settings.identity.name).toBe('New Brand'));
});
test('a stale settings error preserves the draft and does not claim publication succeeded',async()=>{
  const state={settings:fresh(),draft:fresh(),revision:1,version:0,history:[],hasDraft:true};
  apiRequest.mockImplementation(async(endpoint,options)=>{if(options)throw Object.assign(new Error('Settings changed. Reload before saving.'),{status:409});return state;});
  render(<BusinessSettingsTab/>);const user=userEvent.setup();await screen.findByRole('heading',{name:'Business policies & storefront'});
  await user.type(screen.getByLabelText('Business settings administrator password'),'Admin-passphrase!123');await user.click(screen.getByRole('button',{name:'Publish saved draft'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload before saving');expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('scheduled announcements become visible and expire without polling',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  function Notice(){const visible=useAnnouncementVisibility({enabled:true,startAt:'2026-01-01T00:00:05Z',endAt:'2026-01-01T00:00:10Z'});return <p>{visible?'Notice visible':'Notice hidden'}</p>;}
  render(<Notice/>);expect(screen.getByText('Notice hidden')).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(5010);});expect(screen.getByText('Notice visible')).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(5010);});expect(screen.getByText('Notice hidden')).toBeInTheDocument();
});
