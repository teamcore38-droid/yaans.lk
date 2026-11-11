import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import CashReconciliation, { PaymentEvidenceForm } from '../../src/pages/admin/CashReconciliation.jsx';
import { payoutEligible } from '../../../shared/payments.js';

test('delivery and legacy remittance flags cannot make an unverified package payable', () => {
  const sub = { paymentMethod: 'COD', fulfillmentStatus: 'delivered', codCollectionStatus: 'remitted_to_platform', settlementStatus: 'eligible_for_payout' };
  expect(payoutEligible(sub)).toBe(false);
  expect(payoutEligible({ ...sub, paymentReceipt: { ledgerId: 'verified-receipt' } })).toBe(true);
  expect(payoutEligible({ ...sub, paymentReceipt: { ledgerId: 'verified-receipt' }, payoutHoldReason: 'return_requested' })).toBe(false);
});

test('recording a financial transaction keeps one submission in flight and retains evidence after failure', async () => {
  let fail;
  const onRecord = vi.fn(() => new Promise((_resolve, reject) => { fail = reject; }));
  render(<PaymentEvidenceForm label="Confirm platform receipt" expectedAmount={1350} onRecord={onRecord} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Actual bank or courier reference'), 'BANK-TEST-123');
  await user.type(screen.getByLabelText('Confirmed amount (LKR)'), '1350');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Confirm platform receipt' }));
  fireEvent.submit(screen.getByRole('form'));
  expect(onRecord).toHaveBeenCalledTimes(1);
  expect(onRecord).toHaveBeenCalledWith({ bankReference: 'BANK-TEST-123', amountLkr: 1350, notes: '' });
  fail(new Error('Verify the bank statement first.'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Actual bank or courier reference')).toHaveValue('BANK-TEST-123');
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
});

test('returned goods show a refund action while a requested return waits for receipt of the goods', () => {
  const sub = { _id: 'sub-test', subOrderNumber: 'TEST-S1', sellerName: 'Test seller', paymentMethod: 'COD',
    fulfillmentStatus: 'return_requested', codCollectionStatus: 'remitted_to_platform', settlementStatus: 'held_for_return',
    grossTotalLkr: 1350, paymentReceipt: { amountLkr: 1350, reference: 'BANK-RECEIVED', ledgerId: 'receipt' } };
  const props = { subOrders: [sub], showToast: vi.fn(), fetchOverview: vi.fn() };
  const view = render(<CashReconciliation {...props} />);
  expect(screen.queryByRole('button', { name: 'Record completed customer refund' })).not.toBeInTheDocument();
  view.rerender(<CashReconciliation {...props} subOrders={[{ ...sub, fulfillmentStatus: 'returned' }]} />);
  expect(screen.getByRole('button', { name: 'Record completed customer refund' })).toBeVisible();
});
