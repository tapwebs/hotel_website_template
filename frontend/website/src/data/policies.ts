// Hotel policies (DESIGN-PLAN §2). Cancellation window is unconfirmed: never state a rule.

export const policies = [
  { title: 'Check-in', value: '11:00 AM', detail: 'Early arrival? Message us and we will try to have your room ready.' },
  { title: 'Check-out', value: '11:00 AM', detail: 'Ask at reception if you need to stay a little longer.' },
  { title: 'Photo ID', value: 'Required', detail: 'A government-issued photo ID for every adult guest at check-in.' },
  { title: 'Payment', value: 'Cash, UPI, cards', detail: 'All major payment methods are accepted at the hotel.' },
  { title: 'Children', value: 'Welcome', detail: 'Families are welcome. An extra bed is available on request.' },
  { title: 'Visitors', value: 'Allowed', detail: 'Guests may receive visitors.' },
  {
    title: 'Cancellation',
    value: 'Contact the hotel',
    detail: 'Contact the hotel for cancellation and refund terms.',
  },
] as const
