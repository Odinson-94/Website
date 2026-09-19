/* Session 01a0b8b9: published prices refresh without a site rebuild; never show draft defaults. */
(function () {
  'use strict';
  var root = document.getElementById('report-price-cards');
  var status = document.getElementById('report-price-status');
  if (!root || !status) return;
  var busy = false;
  var format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  var tokenFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 9 });
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
      var pounds = data.retail.packPriceMinor / 100 / data.retail.packCredits;
      var cash = new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP',maximumFractionDigits:6});
      var credit = document.getElementById('published-credit-prices');
      credit.replaceChildren(element('h3','Usage Credits'),element('p',cash.format(pounds) + ' per credit · ' + data.retail.packCredits + ' UC for ' + cash.format(data.retail.packPriceMinor/100) + '. Cash equivalents below use this top-up price; subscription allowances differ.'));
      var description = document.getElementById('credit-pack-description');
      if (description) description.textContent = 'Add ' + data.retail.packCredits + ' Usage Credits for ' + cash.format(data.retail.packPriceMinor/100) + '. Purchased top-ups persist until used and are consumed after the current monthly allowance.';
      document.querySelectorAll('[data-checkout-plan="payg-20"]').forEach(function(button){button.dataset.planLabel=data.retail.packCredits+' Usage Credits — '+cash.format(data.retail.packPriceMinor/100);button.disabled=false;});
      var tokens = document.getElementById('published-token-prices');
      var groups = {};
      data.tokenRates.filter(function(p){return p.component==='uncached_input'||p.component==='billable_output';}).forEach(function(p){var key=p.model+' · '+p.tier+' · '+p.context; if(!groups[key])groups[key]=[]; groups[key].push(p);});
      tokens.replaceChildren.apply(tokens,Object.keys(groups).map(function(key){var card=element('article','','usage-card');card.append(element('h3',key));groups[key].forEach(function(p){card.append(element('p',(p.component==='uncached_input'?'Input':'Output')+': '+tokenFormat.format(p.usageCreditsPerMillion)+' UC / 1M tokens ('+cash.format(p.usageCreditsPerMillion*pounds)+')'));});return card;}));
      var cards = Object.keys(data.products).sort(function(a, b) { return data.products[a].name.localeCompare(data.products[b].name); }).map(function (code) {
        var price = data.products[code];
        var card = element('article', '', 'usage-card');
        card.append(element('h3', price.name), element('strong', price.mode === 'report' ? format.format(price.usageCredits) + ' UC' : price.mode === 'usage' ? 'AI usage' : 'Included'), element('p', price.mode === 'report' ? 'Per ' + price.unit + ' · ' + cash.format(price.usageCredits*pounds) + ' top-up equivalent' : price.mode === 'usage' ? 'Charged for measured AI usage under your plan.' : 'No separate app fee. AI usage is metered.'));
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
      ['published-credit-prices','published-token-prices'].forEach(function(id){document.getElementById(id)?.replaceChildren();});
      document.querySelectorAll('[data-checkout-plan="payg-20"]').forEach(function(button){button.disabled=true;});
      status.textContent = 'App prices are temporarily unavailable. Please retry shortly.';
      console.error('[report_prices.display_failed]', error.name || 'Error');
    } finally { busy = false; }
  }
  document.getElementById('refresh-report-prices').addEventListener('click', load);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  load();
})();
