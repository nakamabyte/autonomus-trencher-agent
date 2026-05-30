// Mock implementation of Coinbase x402 Micropayments protocol
// In a real environment, this would verify the L402 macaroon and lightning/crypto payments.

export function x402(config) {
  return function (req, res, next) {
    const authHeader = req.headers.authorization || '';

    // If no L402 header is provided, return 402 Payment Required
    if (!authHeader.startsWith('L402')) {
      const invoice = `mock_invoice_${Date.now()}_${config.price}_${config.currency}`;
      const macaroon = `mock_macaroon_${Date.now()}`;
      
      res.status(402)
         .set('WWW-Authenticate', `L402 macaroon="${macaroon}", invoice="${invoice}"`)
         .json({
           error: 'Payment Required',
           message: `Please pay ${config.price} ${config.currency} to ${config.recipient || config.paymentRecipient}`,
           network: config.network,
           invoice
         });
      return;
    }

    // Mock validation of payment
    // In production, we would decode the macaroon, check payment proof (preimage), etc.
    req.x402_paid = true;
    next();
  };
}
