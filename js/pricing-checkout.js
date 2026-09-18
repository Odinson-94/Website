(function () {
  'use strict';

  var banner = document.getElementById('checkout-banner');
  var allowedPlans = new Set(['everyday', 'standard', 'business', 'payg-20']);

  function show(message) {
    if (!banner) return;
    banner.dataset.visible = 'true';
    banner.textContent = message;
  }

  async function beginCheckout(planCode, button) {
    if (!allowedPlans.has(planCode)) return;
    if (button) {
      button.disabled = true;
      button.textContent = 'Opening Stripe\u2026';
    }
    try {
      var response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ plan_code: planCode })
      });
      if (response.status === 401) {
        var returnPath = '/pricing/?checkout_plan=' + encodeURIComponent(planCode);
        window.location.assign('/api/billing/handoff-start?return=' + encodeURIComponent(returnPath));
        return;
      }
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok || !body.url || !/^https:\/\/checkout\.stripe\.com\//.test(body.url)) {
        throw new Error(body.error || 'Checkout could not be started.');
      }
      window.location.assign(body.url);
    } catch (error) {
      show(error.message || 'Checkout could not be started.');
      if (button) {
        button.disabled = false;
        button.textContent = button.getAttribute('data-original-label') || 'Choose plan';
      }
    }
  }

  document.querySelectorAll('[data-checkout-plan]').forEach(function (button) {
    button.setAttribute('data-original-label', button.textContent);
    button.addEventListener('click', function () {
      beginCheckout(button.getAttribute('data-checkout-plan') || '', button);
    });
  });

  var params = new URLSearchParams(window.location.search);
  var pendingPlan = params.get('checkout_plan') || '';
  if (allowedPlans.has(pendingPlan)) {
    history.replaceState(null, '', window.location.pathname);
    show('Your Adelphos sign-in is confirmed. Opening secure Stripe Checkout\u2026');
    beginCheckout(pendingPlan, null);
  } else if (params.get('checkout') === 'success') {
    show('Stripe has received your checkout. Adelphos applies the plan or top-up only after the signed Stripe confirmation is verified.');
  } else if (params.get('checkout') === 'cancelled') {
    show('Checkout was cancelled. No billing change was made.');
  }
})();
