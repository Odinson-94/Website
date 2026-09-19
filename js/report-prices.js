/* Session 01a0b8b9: published prices refresh without a site rebuild; never show draft defaults. */
(function () {
  'use strict';
  var root = document.getElementById('report-price-cards');
  var status = document.getElementById('report-price-status');
  if (!root || !status) return;
  var busy = false;
  var format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  function element(tag, text, className) {
    var node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  async function load() {
    if (busy) return;
    busy = true;
    try {
      var response = await fetch('/api/billing/report-prices', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Prices unavailable');
      var data = await response.json();
      if (!data.available) { root.replaceChildren(); delete root.dataset.priceVersion; status.textContent = 'App prices will appear here when published.'; return; }
      var cards = Object.keys(data.products).sort(function(a, b) { return data.products[a].name.localeCompare(data.products[b].name); }).map(function (code) {
        var price = data.products[code];
        var card = element('article', '', 'usage-card');
        card.append(element('h3', price.name), element('strong', price.mode === 'report' ? format.format(price.usageCredits) + ' UC' : price.mode === 'usage' ? 'AI usage' : 'Included'), element('p', price.mode === 'report' ? 'Per ' + price.unit : price.mode === 'usage' ? 'Charged for measured AI usage under your plan.' : 'No separate app fee. AI usage is metered.'));
        if (price.batches.length) {
          var list = document.createElement('ul');
          price.batches.forEach(function (tier) {
            list.append(element('li', 'Batch of ' + tier.quantity + ': ' + format.format(tier.usageCredits) + ' UC each (' + format.format(tier.quantity * tier.usageCredits) + ' UC total)'));
          });
          card.append(list);
        }
        return card;
      });
      root.replaceChildren.apply(root, cards);
      status.textContent = 'Published prices · version ' + data.version + '. Identical report re-downloads are free.';
      root.dataset.priceVersion = String(data.version);
    } catch (error) {
      root.replaceChildren(); delete root.dataset.priceVersion;
      status.textContent = 'App prices are temporarily unavailable. Please retry shortly.';
      console.error('[report_prices.display_failed]', error.name || 'Error');
    } finally { busy = false; }
  }
  document.getElementById('refresh-report-prices').addEventListener('click', load);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  load();
})();
