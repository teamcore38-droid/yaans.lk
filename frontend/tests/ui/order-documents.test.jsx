import React from 'react';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import OrderDocuments from '../../src/components/OrderDocuments.jsx';
import OrderEmailStatus from '../../src/pages/admin/OrderEmailStatus.jsx';
import {apiRequest} from '../../src/utils/api.js';
vi.mock('../../src/utils/api.js',async original=>({...await original(),apiRequest:vi.fn()}));
const doc={_id:'sub1:invoice',kind:'invoice',title:'Commercial invoice',number:'YLK-2026-1-S1-INVOICE',issuedAt:'2026-11-14',issuer:{name:'Seller One',address:'Colombo'},customer:{recipientName:'Customer',addressLine1:'One Street',city:'Colombo'},items:[{title:'Saved product',quantity:2,lineTotalLkr:200}],subtotalLkr:200,deliveryLkr:100,totalLkr:300};
test('documents load only on demand and preserve guest access headers for viewing',async()=>{
  apiRequest.mockImplementation(async path=>path.endsWith('/sub1%3Ainvoice')?{document:doc}:{documents:[doc]});
  HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();
  render(<OrderDocuments orderId="order1" accessToken="secret-code"/>);const user=userEvent.setup();
  expect(apiRequest).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'View invoices & documents'}));
  expect(apiRequest).toHaveBeenCalledWith('/documents/orders/order1',expect.objectContaining({headers:{'X-Order-Access-Token':'secret-code'},cache:'no-store'}));
  await user.click(await screen.findByRole('button',{name:`View ${doc.number}`}));
  await waitFor(()=>expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled());
  expect(document.body.textContent).toContain('Saved product');expect(document.body.textContent).toContain('not a tax invoice');
});
test('seller documents use only the package route and errors remain visible',async()=>{
  apiRequest.mockRejectedValueOnce(new Error('You can only view documents for your own packages.'));
  render(<OrderDocuments packageId="sub1"/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'View invoices & documents'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('own packages');expect(apiRequest).toHaveBeenCalledWith('/documents/packages/sub1',expect.anything());
});
test('email administration exposes setup gaps and does not send automatically on page load',async()=>{
  apiRequest.mockResolvedValue({ready:false,enabled:false,counts:{pending:2,attention:1}});
  render(<OrderEmailStatus/>);expect(apiRequest).not.toHaveBeenCalled();const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Check email delivery status'}));
  expect(await screen.findByRole('status')).toHaveTextContent('setup required');expect(screen.getByRole('button',{name:'Process queued emails'})).toBeDisabled();
});
