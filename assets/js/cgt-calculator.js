// CGT discount calculator — AU accounting firms.
//
// Reflects the 12 May 2026 Federal Budget:
//   - CGT discount replaced by cost-base indexation from 1 July 2027
//   - 30% minimum tax on the indexed (post-cutoff) gain for individuals & trusts
//   - Pre-1985 assets caught for disposals on or after 1 July 2027
//   - Companies and complying super funds (incl. SMSFs) excluded — they stay
//     on the existing discount regime
//
// Inflation defaults to the RBA 2.5% target and is editable inline; final
// rules will use ABS CPI.

(function () {
  'use strict';

  const form = document.getElementById('cgt-calc-form');
  if (!form) return;

  // --- Constants ------------------------------------------------------------

  const CUTOFF  = new Date('2027-07-01');
  const PRE_CGT = new Date('1985-09-20');
  const MIN_TAX = 0.30;

  const CLIENT_DISCOUNT = {
    individual: 0.50,
    trust:      0.50,
    smsf:       1 / 3,
    company:    0,
  };

  // Clients the new indexation + 30% minimum regime applies to. Per the
  // Budget Papers (12 May 2026) the changes apply to "individuals, trusts
  // and partnerships". Companies and complying super funds (incl. SMSFs)
  // stay on the existing discount method.
  const INDEXABLE = { individual: true, trust: true, smsf: false, company: false };

  // Bracket / phase / rate options per client. Labels are the bracket name
  // only — the actual % is shown read-only in a sibling display cell.
  const RATE_OPTIONS = {
    individual: [
      { value: 0.16, label: 'Under $45,000' },
      { value: 0.30, label: '$45,001 – $135,000', selected: true },
      { value: 0.37, label: '$135,001 – $190,000' },
      { value: 0.45, label: 'Over $190,000' },
    ],
    trust: [
      { value: 0.16, label: 'Under $45,000' },
      { value: 0.30, label: '$45,001 – $135,000', selected: true },
      { value: 0.37, label: '$135,001 – $190,000' },
      { value: 0.45, label: 'Over $190,000' },
    ],
    company: [
      { value: 0.25, label: 'Base rate entity', selected: true },
      { value: 0.30, label: 'Other companies' },
    ],
    smsf: [
      { value: 0.15, label: 'Accumulation', selected: true },
      { value: 0.00, label: 'Pension' },
    ],
  };

  // Selector-side label changes by client; the right-hand "Tax rate" cell
  // stays constant.
  const RATE_LABEL = {
    individual: 'Client income bracket',
    trust:      'Beneficiary income bracket',
    company:    'Company tax rate',
    smsf:       'SMSF phase',
  };

  // --- Element refs ---------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  const clientSel      = $('client-type');
  const acqDateInput   = $('acq-date');
  const disposalInput  = $('disposal-date');
  const costBaseInput  = $('cost-base');
  const proceedsInput  = $('proceeds');
  const taxRateSel     = $('tax-rate');
  const taxRateLabel   = $('tax-rate-label');
  const inflationInput = $('inflation');

  const out = {
    discountAmount: $('result-discount-amount'),
    headline:       $('result-tax'),
    pill:          $('result-pill'),
    method:        $('result-method'),
    holding:       $('result-holding'),
    gross:         $('result-gross'),
    rowInflation:  $('row-inflation'),
    rowFactor:     $('row-factor'),
    labelFactor:   $('label-factor'),
    factor:        $('result-factor'),
    rowSplit:      $('row-split'),
    split:         $('result-split'),
    taxable:       $('result-taxable'),
    rate:          $('result-rate'),
    rowMinTax:     $('row-min-tax'),
    net:           $('result-net'),
  };

  // --- Formatters -----------------------------------------------------------

  const moneyFmt = new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
  });
  const fmtMoney = (n) => moneyFmt.format(Math.round(n));
  const fmtPct   = (n) => new Intl.NumberFormat('en-AU', {
    style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);

  const parseMoney = (raw) => {
    if (!raw) return 0;
    const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const daysBetween = (acqISO, dispISO) => {
    const a = new Date(acqISO), d = new Date(dispISO);
    if (Number.isNaN(a.getTime()) || Number.isNaN(d.getTime())) return null;
    return Math.floor((d - a) / 86_400_000);
  };

  // --- Dynamic UI ----------------------------------------------------------

  const renderRateOptions = (clientType) => {
    const opts = RATE_OPTIONS[clientType] || RATE_OPTIONS.individual;
    taxRateSel.innerHTML = opts.map((o) =>
      `<option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>`
    ).join('');
    taxRateLabel.textContent = RATE_LABEL[clientType] || 'Tax rate';
  };

  // --- Math ----------------------------------------------------------------

  const computeDiscount = (proceeds, costBase, days, client, rate) => {
    const gross = proceeds - costBase;
    const heldOverYear = days > 365;
    const baseDiscount = CLIENT_DISCOUNT[client] ?? 0;
    const discount = (gross > 0 && heldOverYear) ? baseDiscount : 0;
    const taxable = Math.max(0, gross) * (1 - discount);
    return { gross, taxable, discount, tax: taxable * rate };
  };

  const computeIndexed = (proceeds, costBase, days, rate, inflation) => {
    const years  = days > 0 ? days / 365.25 : 0;
    const factor = years > 0 ? Math.pow(1 + inflation, years) : 1;
    const indexedBase = costBase * factor;
    const realGain    = Math.max(0, proceeds - indexedBase);
    return {
      gross: proceeds - costBase,
      taxable: realGain,
      factor,
      indexedBase,
      tax: realGain * rate,
    };
  };

  const clearValues = () => {
    [out.discountAmount, out.headline, out.method, out.holding, out.gross,
     out.taxable, out.rate, out.net]
      .forEach((el) => { el.textContent = '—'; });
  };

  // --- Calculate -----------------------------------------------------------

  const calculate = () => {
    const client    = clientSel.value;
    const costBase  = parseMoney(costBaseInput.value);
    const proceeds  = parseMoney(proceedsInput.value);
    const days      = daysBetween(acqDateInput.value, disposalInput.value);
    const rate      = parseFloat(taxRateSel.value) || 0;
    const inflation = (parseFloat(inflationInput.value) || 0) / 100;
    const indexable = !!INDEXABLE[client];

    // Reset method-specific rows by default.
    out.rowInflation.hidden = true;
    out.rowFactor.hidden    = true;
    out.rowSplit.hidden     = true;
    out.rowMinTax.hidden    = true;

    // Date validation.
    if (days === null) {
      out.pill.hidden = false;
      out.pill.textContent = 'Enter acquisition & disposal dates';
      out.pill.className   = 'calc__pill calc__pill--warn';
      clearValues();
      return;
    }
    if (days <= 0) {
      out.pill.hidden = false;
      out.pill.textContent = 'Disposal date must be after acquisition date';
      out.pill.className   = 'calc__pill calc__pill--warn';
      clearValues();
      return;
    }

    // Grandfathering classification.
    const acqMs    = new Date(acqDateInput.value).getTime();
    const dispMs   = new Date(disposalInput.value).getTime();
    const cutoffMs = CUTOFF.getTime();

    const preDays  = Math.max(0, (Math.min(dispMs, cutoffMs) - acqMs) / 86_400_000);
    const postDays = Math.max(0, (dispMs - Math.max(acqMs, cutoffMs)) / 86_400_000);

    let method;       // 'pre-cgt' | 'pre-cgt-caught' | 'discount' | 'indexed' | 'hybrid'
    let result;

    const acqDate     = new Date(acqDateInput.value);
    const isPreCgtAcq = acqDate < PRE_CGT;
    // Indexed gains attract a 30% floor on the rate for individuals & trusts.
    const indexedRate = indexable ? Math.max(rate, MIN_TAX) : rate;
    const minTaxHit   = indexable && rate < MIN_TAX;

    if (isPreCgtAcq && (!indexable || dispMs < cutoffMs)) {
      // Fully exempt: pre-1985 acquisition disposed before 1 July 2027,
      // or held by a client outside the new regime (company / super fund).
      method = 'pre-cgt';
      result = { gross: proceeds - costBase, taxable: 0, tax: 0, discount: 0 };
    } else if (isPreCgtAcq) {
      // Pre-1985 asset caught: gain pre-1 July 2027 exempt, post-cutoff portion
      // taxed under indexation. Cost-base methodology is yet to be confirmed in
      // the legislation; this pro-rates the user's entered cost base by days.
      method = 'pre-cgt-caught';
      const totalDays = preDays + postDays;
      const postCB    = costBase * (postDays / totalDays);
      const postProc  = proceeds * (postDays / totalDays);
      const postR = computeIndexed(postProc, postCB, postDays, indexedRate, inflation);
      result = {
        gross:    proceeds - costBase,
        taxable:  postR.taxable,
        tax:      postR.tax,
        preDays, postDays,
        discount: 0,
        factor:   postR.factor,
      };
    } else if (!indexable || postDays === 0) {
      // Companies & complying super funds stay on the discount regime
      // regardless of the cutoff; same when the disposal is entirely pre-cutoff.
      method = 'discount';
      result = computeDiscount(proceeds, costBase, days, client, rate);
    } else if (preDays === 0) {
      method = 'indexed';
      result = computeIndexed(proceeds, costBase, days, indexedRate, inflation);
    } else {
      method = 'hybrid';
      const totalDays = preDays + postDays;
      const preCB     = costBase * (preDays  / totalDays);
      const postCB    = costBase * (postDays / totalDays);
      const preProc   = proceeds * (preDays  / totalDays);
      const postProc  = proceeds * (postDays / totalDays);
      const preR  = computeDiscount(preProc, preCB, days, client, rate);
      const postR = computeIndexed(postProc, postCB, postDays, indexedRate, inflation);
      result = {
        gross:    proceeds - costBase,
        taxable:  preR.taxable + postR.taxable,
        tax:      preR.tax + postR.tax,
        preDays, postDays,
        discount: preR.discount,
        factor:   postR.factor,
      };
    }

    const net = proceeds - costBase - result.tax;

    // --- Render ----------------------------------------------------------

    // Method label
    let methodLabel;
    if (method === 'pre-cgt')              methodLabel = 'Pre-CGT exempt';
    else if (method === 'pre-cgt-caught')  methodLabel = 'Pre-1985 caught (post 1 Jul 2027)';
    else if (method === 'hybrid')          methodLabel = 'Hybrid';
    else if (method === 'indexed')         methodLabel = 'Indexation';
    else if (result.gross <= 0 || days <= 365 || client === 'company') {
      methodLabel = 'No discount';
    } else                                 methodLabel = 'Flat discount rate';
    out.method.textContent = methodLabel;

    // Status pill (edge cases only)
    if (method === 'pre-cgt') {
      out.pill.hidden = false;
      out.pill.textContent = 'Pre-CGT — acquired before 20 Sept 1985, exempt';
      out.pill.className   = 'calc__pill';
    } else if (method === 'pre-cgt-caught') {
      out.pill.hidden = false;
      out.pill.textContent = 'Pre-1985 asset caught from 1 Jul 2027 — cost-base methodology subject to consultation';
      out.pill.className   = 'calc__pill calc__pill--warn';
    } else if (result.gross < 0) {
      out.pill.hidden = false;
      out.pill.textContent = `Capital loss — ${fmtMoney(Math.abs(result.gross))} carry-forward`;
      out.pill.className   = 'calc__pill calc__pill--loss';
    } else if (result.gross === 0) {
      out.pill.hidden = false;
      out.pill.textContent = 'No capital gain';
      out.pill.className   = 'calc__pill calc__pill--warn';
    } else {
      out.pill.hidden = true;
    }

    out.holding.textContent  = `${days.toLocaleString('en-AU')} days`;
    out.gross.textContent    = fmtMoney(result.gross);
    out.taxable.textContent  = fmtMoney(result.taxable);
    out.headline.textContent = fmtMoney(result.tax);
    out.rate.textContent     = fmtPct(rate);
    out.net.textContent      = fmtMoney(net);

    // Discount amount: dollars of the capital gain not subject to tax under
    // whichever method applies. = gross − taxable, floored at zero so capital
    // losses don't render as a "discount".
    const discountAmount = Math.max(0, result.gross - result.taxable);
    out.discountAmount.textContent = fmtMoney(discountAmount);

    // Method-specific intermediate rows.
    if (method === 'indexed') {
      out.rowInflation.hidden     = false;
      out.rowFactor.hidden        = false;
      out.labelFactor.textContent = 'Indexation factor';
      out.factor.textContent      = `× ${result.factor.toFixed(4)}`;
    }
    if (method === 'hybrid' || method === 'pre-cgt-caught') {
      out.rowSplit.hidden    = false;
      out.split.textContent  = `${Math.round(result.preDays)} / ${Math.round(result.postDays)} days`;
      out.rowInflation.hidden     = false;
      out.rowFactor.hidden        = false;
      out.labelFactor.textContent = 'Indexation factor (post-cutoff)';
      out.factor.textContent      = `× ${result.factor.toFixed(4)}`;
    }

    // 30% minimum tax indicator for individuals & trusts whose marginal rate
    // is below the floor and where indexation has been applied.
    const indexedMethods = method === 'indexed' || method === 'hybrid' || method === 'pre-cgt-caught';
    out.rowMinTax.hidden = !(minTaxHit && indexedMethods && result.taxable > 0);
  };

  // --- Wire up --------------------------------------------------------------

  clientSel.addEventListener('change', () => {
    renderRateOptions(clientSel.value);
    calculate();
  });
  form.addEventListener('input',  calculate);
  form.addEventListener('change', calculate);

  // Inflation lives in the result aside, not the form — listen separately.
  inflationInput.addEventListener('input', calculate);

  // Init
  renderRateOptions(clientSel.value);
  calculate();
})();
