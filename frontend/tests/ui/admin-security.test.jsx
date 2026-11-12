import React from 'react';
import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { expect,test,vi } from 'vitest';
import AdminLoginPage from '../../src/pages/AdminLoginPage.jsx';
import AdminMfaSettings from '../../src/pages/admin/AdminMfaSettings.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import { apiRequest } from '../../src/utils/api.js';

vi.mock('../../src/context/MarketplaceContext.jsx',async original=>({...await original(),useMarketplace:vi.fn()}));
vi.mock('../../src/utils/api.js',async original=>({...await original(),apiRequest:vi.fn()}));

test('administrator login waits for the authenticator before navigating',async()=>{
  const adminLogin=vi.fn().mockResolvedValueOnce({requiresMfa:true,challengeToken:'synthetic-challenge'}).mockResolvedValueOnce({user:{role:'admin'}});
  useMarketplace.mockReturnValue({user:null,adminLogin,logout:vi.fn(),showToast:vi.fn()});
  render(<MemoryRouter initialEntries={['/admin/login']}><Routes><Route path="/admin/login" element={<AdminLoginPage/>}/><Route path="/admin" element={<h1>Authenticated console</h1>}/></Routes></MemoryRouter>);
  const user=userEvent.setup();await user.type(screen.getByPlaceholderText('admin@yaans.lk'),'admin@test.invalid');await user.type(screen.getByPlaceholderText('••••••••••••'),'Test administrator passphrase');
  await user.click(screen.getByRole('button',{name:'Sign In to Admin Console'}));
  expect(screen.queryByRole('heading',{name:'Authenticated console'})).not.toBeInTheDocument();
  await user.type(await screen.findByLabelText('Authenticator or recovery code'),'123456');await user.click(screen.getByRole('button',{name:'Sign In to Admin Console'}));
  await screen.findByRole('heading',{name:'Authenticated console'});
  expect(adminLogin).toHaveBeenLastCalledWith('admin@test.invalid','','synthetic-challenge','123456');
});

test('authenticator setup requires confirmation and shows recovery codes only after success',async()=>{
  const refreshUser=vi.fn(),showToast=vi.fn();
  apiRequest.mockResolvedValueOnce({secret:'SYNTHETICSETUPKEY',issuer:'Test issuer',account:'admin@test.invalid'})
    .mockResolvedValueOnce({recoveryCodes:['synthetic-recovery-code']});
  render(<AdminMfaSettings user={{role:'admin',mfaEnabled:false}} refreshUser={refreshUser} showToast={showToast}/>);
  const user=userEvent.setup();await user.type(screen.getByLabelText('Current password'),'Test administrator passphrase');await user.click(screen.getByRole('button',{name:'Set up authenticator'}));
  await screen.findByLabelText('Authenticator setup key');expect(screen.queryByText('synthetic-recovery-code')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Six-digit authenticator code'),'123456');await user.click(screen.getByRole('button',{name:'Enable authenticator'}));
  await screen.findByText('synthetic-recovery-code');await waitFor(()=>expect(refreshUser).toHaveBeenCalled());
  expect(screen.queryByLabelText('Authenticator setup key')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'I saved my recovery codes'}));expect(screen.queryByText('synthetic-recovery-code')).not.toBeInTheDocument();
});
