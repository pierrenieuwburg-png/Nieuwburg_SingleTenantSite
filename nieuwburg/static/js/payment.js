document.addEventListener('DOMContentLoaded', function() {
    const paymentForm = document.getElementById('payment-form');

    if (paymentForm) {
        // Read the data directly from the form's data attributes
        const publicKey = paymentForm.dataset.key;
        const quoteId = paymentForm.dataset.quoteId;
        const depositAmount = parseInt(paymentForm.dataset.amount, 10);

        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const payerName = document.getElementById('payer-name').value;
            const payerEmail = document.getElementById('payer-email').value;

            if (!payerName || !payerEmail) {
                alert('Please enter your full name and email address.');
                return;
            }

            const handler = PaystackPop.setup({
                key: publicKey,
                email: payerEmail,
                amount: depositAmount,
                currency: 'ZAR',
                ref: `quote_${quoteId}_${Math.floor((Math.random() * 1000000000) + 1)}`,
                metadata: {
                    quote_id: quoteId,
                    payer_name: payerName
                },
                callback: function(response) {
                    window.location.href = `/payment-callback?reference=${response.reference}`;
                },
                onClose: function() {
                    alert('Payment window closed.');
                }
            });
            
            handler.openIframe();
        });
    }
});