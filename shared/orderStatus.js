export const fulfillmentTransitions = Object.freeze({
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
  cancelled: [],
  returned: []
});
