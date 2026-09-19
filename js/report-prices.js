/* Session 01a0b8b9: published prices refresh without a site rebuild; never show draft defaults. */
(function () {
  'use strict';
  var root = document.getElementById('report-price-cards');
  var status = document.getElementById('report-price-status');
  if (!root || !status) return;
  var busy = false;
  var names = { cable: ['Cable calculations', 'calculation'], sap: ['SAP', 'project, including all houses'], lighting: ['Lighting', 'project'] };
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
      if (!data.available) { root.replaceChildren(); status.textContent = 'Report prices will appear here when published.'; return; }
      var cards = Object.keys(names).map(function (code) {
        var price = data.products[code];
        var card = element('article', '', 'usage-card');
        card.append(element('h3', names[code][0]), element('strong', format.format(price.usageCredits) + ' UC'), element('p', 'Per ' + names[code][1]));
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
      status.textContent = 'Report prices are temporarily unavailable. Please retry shortly.';
      console.error('[report_prices.display_failed]', error.name || 'Error');
    } finally { busy = false; }
  }
  document.getElementById('refresh-report-prices').addEventListener('click', load);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  load();
})();
