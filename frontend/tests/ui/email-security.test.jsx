import React, { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import VerifyEmailPage from '../../src/pages/VerifyEmailPage.jsx';
import EmailSecuritySettings from '../../src/components/EmailSecuritySettings.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import { apiRequest } from '../../src/utils/api.js';

vi.mock('../../src/context/MarketplaceContext.jsx',async original=>({...await original(),useMarketplace:vi.fn()}));
vi.mock('../../src/utils/api.js',async original=>({...await original(),apiRequest:vi.fn()}));
beforeEach(()=>{window.history.replaceState(null,'','/');useMarketplace.mockReturnValue({user:null,refreshUser:vi.fn()});});

test('verification survives StrictMode, removes the secret from the address bar and waits for password confirmation',async()=>{
  const token='synthetic-link-token';window.history.replaceState(null,'','/verify-email#token='+token);
  apiRequest.mockResolvedValue({role:'customer',message:'Email verified and account created. Sign in to continue.'});
  render(<StrictMode><MemoryRouter><VerifyEmailPage/></MemoryRouter></StrictMode>);
  expect(window.location.hash).toBe('');expect(apiRequest).not.toHaveBeenCalled();
  const user=userEvent.setup();await user.type(screen.getByLabelText('Your Yaans.lk password'),'A private registration passphrase');await user.click(screen.getByRole('button',{name:'Confirm email address'}));
  await screen.findByText('Email verified and account created. Sign in to continue.');
  expect(apiRequest).toHaveBeenCalledWith('/auth/verify-email',{method:'POST',body:JSON.stringify({verificationToken:token,password:'A private registration passphrase'})});
  expect(screen.getByRole('link',{name:'Continue to sign in'})).toHaveAttribute('href','/login');
  expect(localStorage.getItem('yaans_token')).toBeNull();expect(screen.queryByLabelText('Your Yaans.lk password')).not.toBeInTheDocument();
});

test('a failed confirmation keeps the form usable and does not claim verification succeeded',async()=>{
  window.history.replaceState(null,'','/verify-email#token=expired-token');apiRequest.mockRejectedValue(new Error('Link expired. Request a new link.'));
  render(<MemoryRouter><VerifyEmailPage/></MemoryRouter>);const user=userEvent.setup();
  await user.type(screen.getByLabelText('Your Yaans.lk password'),'A private passphrase');await user.click(screen.getByRole('button',{name:'Confirm email address'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Link expired');expect(screen.getByRole('button',{name:'Confirm email address'})).toBeEnabled();
  expect(screen.queryByRole('link',{name:'Continue to sign in'})).not.toBeInTheDocument();
});

test('administrator confirmation directs the owner through the dedicated login and refreshes the expired session',async()=>{
  window.history.replaceState(null,'','/verify-email#token=admin-token');const refreshUser=vi.fn().mockRejectedValue({status:401});
  useMarketplace.mockReturnValue({user:{role:'admin'},refreshUser});apiRequest.mockResolvedValue({role:'admin',emailChanged:true,message:'Email changed. Sign in again.'});
  render(<MemoryRouter><VerifyEmailPage/></MemoryRouter>);const user=userEvent.setup();
  await user.type(screen.getByLabelText('Your Yaans.lk password'),'An administrator passphrase');await user.click(screen.getByRole('button',{name:'Confirm email address'}));
  expect(await screen.findByRole('link',{name:'Continue to sign in'})).toHaveAttribute('href','/admin/login');await waitFor(()=>expect(refreshUser).toHaveBeenCalled());
});

test('email settings keep the old login visible and send the current password for a pending replacement',async()=>{
  const refreshUser=vi.fn().mockResolvedValue({});apiRequest.mockResolvedValue({requiresEmailVerification:true,message:'Confirm the link in your new inbox.'});
  render(<EmailSecuritySettings user={{email:'old@test.invalid',emailVerified:true,pendingEmail:'pending@test.invalid'}} refreshUser={refreshUser}/>);
  expect(screen.getByText(/old@test.invalid — Verified/)).toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('Waiting for confirmation at pending@test.invalid');
  const user=userEvent.setup();await user.type(screen.getByLabelText('New login email (optional)'),'next@test.invalid');await user.type(screen.getByLabelText('Current password for email verification'),'A private passphrase');
  await user.click(screen.getByRole('button',{name:'Request email change'}));await screen.findByText('Confirm the link in your new inbox.');
  expect(apiRequest).toHaveBeenCalledWith('/auth/update-credentials',{method:'PUT',body:JSON.stringify({currentPassword:'A private passphrase',newEmail:'next@test.invalid'})});
  expect(screen.getByLabelText('Current password for email verification')).toHaveValue('');expect(refreshUser).toHaveBeenCalled();
});

test('legacy account can request ownership verification without changing its login',async()=>{
  apiRequest.mockResolvedValue({message:'Check your inbox.'});const refreshUser=vi.fn().mockResolvedValue({});
  render(<EmailSecuritySettings user={{email:'legacy@test.invalid',emailVerified:false}} refreshUser={refreshUser} allowChange={false}/>);
  const user=userEvent.setup();await user.type(screen.getByLabelText('Current password for email verification'),'A private passphrase');await user.click(screen.getByRole('button',{name:'Send verification email'}));
  await screen.findByText('Check your inbox.');expect(apiRequest).toHaveBeenCalledWith('/auth/email-verification',{method:'POST',body:JSON.stringify({currentPassword:'A private passphrase'})});
});
