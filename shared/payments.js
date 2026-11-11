export function payoutEligible(sub) {
  return sub.paymentMethod === 'COD' && sub.fulfillmentStatus === 'delivered' &&
    sub.codCollectionStatus === 'remitted_to_platform' && sub.settlementStatus === 'eligible_for_payout' &&
    !!sub.paymentReceipt?.ledgerId && !sub.refund && !sub.payoutHoldReason;
}
