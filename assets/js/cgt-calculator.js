// CGT discount calculator — AU accounting firms.
//
// Reflects the 12 May 2026 Federal Budget:
//   - CGT discount replaced by cost-base indexation from 1 July 2027
//   - 30% minimum tax on the indexed (post-1 July 2027) gain for individuals,
//     trusts and partnerships
//   - Pre-1985 assets caught for disposals on or after 1 July 2027
//   - Companies and complying super funds (incl. SMSFs) excluded — they stay
//     on the existing discount regime
//
// Right column renders one or two scenario cards depending on the entered
// dates and entity type:
//   - "Sell by 30 Jun 2027" — FLAT RATE DISCOUNT (card-pre)
//   - "Sell on [disposal date]" — 2026 BUDGET INDEXATION (card-post)
// Hybrid math pro-rates the GAIN (not cost base/proceeds) per the
// announcement's no-revaluation-at-1-Jul-2027 stance.

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

  const INDEXABLE = { individual: true, trust: true, smsf: false, company: false };

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

  const RATE_LABEL = {
    individual: 'Income details',
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

  const refs = {
    pill:            $('result-pill'),
    inflationField:  $('inflation-field'),
    cardPre:         $('card-pre'),
    cardPost:        $('card-post'),
    pTitle:          $('card-pre-title'),
    pSub:            $('card-pre-sub'),
    pGain:           $('cmp-p-gain'),
    pRowDiscount:    $('cmp-p-row-discount'),
    pDiscountLabel:  $('cmp-p-discount-label'),
    pDiscount:       $('cmp-p-discount'),
    pTaxable:        $('cmp-p-taxable'),
    pRate:           $('cmp-p-rate'),
    pTax:            $('cmp-p-tax'),
    nTitle:          $('card-post-title'),
    nSub:            $('card-post-sub'),
    nGain:           $('cmp-n-gain'),
    nRowDiscount:    $('cmp-n-row-discount'),
    nDiscountLabel:  $('cmp-n-discount-label'),
    nDiscount:       $('cmp-n-discount'),
    nDiscountDetail: $('cmp-n-discount-detail'),
    nRowIndexation:  $('cmp-n-row-indexation'),
    nIndexationLabel:$('cmp-n-indexation-label'),
    nIndexation:     $('cmp-n-indexation'),
    nIndexationDetail: $('cmp-n-indexation-detail'),
    nTaxable:        $('cmp-n-taxable'),
    nRate:           $('cmp-n-rate'),
    nTax:            $('cmp-n-tax'),
    nFootnote:       $('cmp-n-footnote'),
    workingBody:     $('working-body'),
  };

  // --- Formatters -----------------------------------------------------------

  const moneyFmt = new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
  });
  const fmtMoney = (n) => moneyFmt.format(Math.round(n));
  const fmtMoneyNeg = (n) => {
    if (n <= 0) return fmtMoney(n);
    return `(${fmtMoney(n)})`;
  };
  const fmtPct = (n) => new Intl.NumberFormat('en-AU', {
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

  // Intl en-AU short renders June/July/Sept as 4-letter forms; en-GB renders
  // Sept the same way. Manual table keeps card titles uniformly 3-letter
  // (matches the hardcoded "30 Jun 2027" in the hybrid pre-card).
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate = (d) =>
    `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;

  // --- Dynamic UI -----------------------------------------------------------

  const renderRateOptions = (clientType) => {
    const opts = RATE_OPTIONS[clientType] || RATE_OPTIONS.individual;
    taxRateSel.innerHTML = opts.map((o) =>
      `<option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>`
    ).join('');
    taxRateLabel.textContent = RATE_LABEL[clientType] || 'Income details';
  };

  // --- Scenario computers ---------------------------------------------------

  const scenarioDiscount = (proceeds, costBase, days, client, rate) => {
    const gross = proceeds - costBase;
    const heldOverYear = days > 365;
    const baseDiscount = CLIENT_DISCOUNT[client] ?? 0;
    const discount = (gross > 0 && heldOverYear) ? baseDiscount : 0;
    const discountAmount = Math.max(0, gross) * discount;
    const taxable = Math.max(0, gross) - discountAmount;
    return {
      kind: 'discount',
      gross, discount, discountAmount, taxable,
      tax: taxable * rate,
      heldOverYear,
    };
  };

  const scenarioIndexed = (proceeds, costBase, days, effectiveRate, inflation) => {
    const years  = days > 0 ? days / 365.25 : 0;
    const factor = years > 0 ? Math.pow(1 + inflation, years) : 1;
    const indexedBase = costBase * factor;
    const indexedAdjustment = indexedBase - costBase;
    const gross  = proceeds - costBase;
    const heldOverYear = days > 365;
    const taxable = heldOverYear ? Math.max(0, proceeds - indexedBase) : Math.max(0, gross);
    return {
      kind: 'indexed',
      gross, factor, indexedBase, indexedAdjustment, taxable, years,
      tax: taxable * effectiveRate,
      heldOverYear,
    };
  };

  // Hybrid — pro-rates the GAIN, not cost base/proceeds. Per the announcement,
  // there's no scope to revalue assets at 1 July 2027, so we compute each
  // regime as if it applied to the whole holding then attribute portions to
  // pre/post by days.
  const scenarioHybrid = (proceeds, costBase, preDays, postDays, client, rate, indexedRate, inflation) => {
    const totalDays = preDays + postDays;
    const preFrac   = preDays  / totalDays;
    const postFrac  = postDays / totalDays;
    const gross     = proceeds - costBase;

    const baseDiscount  = CLIENT_DISCOUNT[client] ?? 0;
    const heldOverYear  = totalDays > 365;
    const discountRate  = (gross > 0 && heldOverYear) ? baseDiscount : 0;
    const discountTaxable = Math.max(0, gross) * (1 - discountRate);
    const discountAmount  = Math.max(0, gross) * discountRate;

    const years        = totalDays > 0 ? totalDays / 365.25 : 0;
    const factor       = years > 0 ? Math.pow(1 + inflation, years) : 1;
    const indexedBase  = costBase * factor;
    const indexedGain  = heldOverYear ? Math.max(0, proceeds - indexedBase) : Math.max(0, gross);
    const indexedAdjustment = Math.max(0, indexedBase - costBase);

    const prePortion  = discountTaxable * preFrac;
    const postPortion = indexedGain     * postFrac;
    const taxable     = prePortion + postPortion;

    const preTax  = prePortion  * rate;
    const postTax = postPortion * indexedRate;

    return {
      kind: 'hybrid',
      gross,
      preDays, postDays, preFrac, postFrac, totalDays,
      discountTaxable, discountAmount, discountRate,
      factor, years, indexedBase, indexedGain, indexedAdjustment,
      prePortion, postPortion,
      preTax, postTax,
      taxable,
      tax: preTax + postTax,
    };
  };

  const scenarioPreCgtCaught = (proceeds, costBase, totalDays, postDays, indexedRate, inflation) => {
    // Pre-portion exempt, post-portion indexed.
    const postFrac = postDays / totalDays;
    const years    = totalDays > 0 ? totalDays / 365.25 : 0;
    const factor   = years > 0 ? Math.pow(1 + inflation, years) : 1;
    const indexedBase = costBase * factor;
    const indexedAdjustment = Math.max(0, indexedBase - costBase);
    const indexedGain = Math.max(0, proceeds - indexedBase);
    const taxable = indexedGain * postFrac;
    return {
      kind: 'pre-cgt-caught',
      gross: proceeds - costBase,
      postFrac, factor, years, indexedBase, indexedGain, indexedAdjustment,
      taxable,
      tax: taxable * indexedRate,
    };
  };

  // --- Render helpers -------------------------------------------------------

  const setPill = (text, klass) => {
    if (!text) { refs.pill.hidden = true; return; }
    refs.pill.hidden = false;
    refs.pill.textContent = text;
    refs.pill.className   = `calc__pill ${klass || ''}`.trim();
  };

  const setPreCard = (state) => {
    if (!state) { refs.cardPre.hidden = true; return; }
    refs.cardPre.hidden = false;
    refs.pTitle.textContent = state.title;
    refs.pSub.textContent   = state.sub;
    refs.pGain.textContent  = fmtMoney(state.gain);
    refs.pRowDiscount.hidden = !state.discountLabel;
    if (state.discountLabel) {
      refs.pDiscountLabel.textContent = state.discountLabel;
      refs.pDiscount.textContent      = fmtMoneyNeg(state.discountAmount || 0);
    }
    refs.pTaxable.textContent = fmtMoney(state.taxable);
    refs.pRate.textContent    = state.rateLabel || fmtPct(state.rate || 0);
    refs.pTax.textContent     = fmtMoney(state.tax);
  };

  const setPostCard = (state) => {
    if (!state) { refs.cardPost.hidden = true; return; }
    refs.cardPost.hidden = false;
    refs.nTitle.textContent = state.title;
    refs.nSub.textContent   = state.sub;
    refs.nGain.textContent  = fmtMoney(state.gain);

    // displayMode: 'contribution' shows positive $ (this portion adds to net
    // taxable); 'reduction' shows ($X) (this amount subtracts from gross).
    const fmt = (amount, mode) => mode === 'contribution' ? fmtMoney(amount) : fmtMoneyNeg(amount);

    refs.nRowDiscount.hidden = !state.discountLabel;
    if (state.discountLabel) {
      refs.nDiscountLabel.textContent = state.discountLabel;
      refs.nDiscount.textContent      = fmt(state.discountAmount || 0, state.discountMode);
      refs.nDiscountDetail.innerHTML  = state.discountDetailHTML || '';
    }

    refs.nRowIndexation.hidden = !state.indexationLabel;
    if (state.indexationLabel) {
      refs.nIndexationLabel.textContent = state.indexationLabel;
      refs.nIndexation.textContent      = fmt(state.indexationAmount || 0, state.indexationMode);
      refs.nIndexationDetail.innerHTML  = state.indexationDetailHTML || '';
    }

    refs.nTaxable.textContent = fmtMoney(state.taxable);
    refs.nRate.textContent    = state.rateLabel || fmtPct(state.rate || 0);
    refs.nTax.textContent     = fmtMoney(state.tax);

    if (state.rateFootnote) {
      refs.nFootnote.hidden      = false;
      refs.nFootnote.textContent = state.rateFootnote;
    } else {
      refs.nFootnote.hidden      = true;
      refs.nFootnote.textContent = '';
    }

    refs.cardPost.classList.toggle('is-current', !!state.isCurrent);
  };

  // --- Working block --------------------------------------------------------

  const workRow = (label, value, extra = '') =>
    `<div class="work-row${extra}"><span>${label}</span><span>${value}</span></div>`;
  const workTotalRow = (label, value) => workRow(label, value, ' work-row--total');

  // Body contents for the "+ Inputs" disclosure. Form fields (proceeds, cost
  // base, dates) aren't repeated. Callers add days pre/post + indexation
  // factor when those are relevant for the scenario.
  const wHoldingPeriod = (inputs) =>
    workRow('Holding period', `${inputs.days.toLocaleString('en-AU')} days (${(inputs.days/365.25).toFixed(1)} years)`);

  const wGrossGain = (inputs) =>
    workRow('Gross gain', `${fmtMoney(inputs.proceeds)} − ${fmtMoney(inputs.costBase)} = ${fmtMoney(inputs.gross)}`);

  const wIndexationFactor = (inputs, factor) => {
    const inflationPct = (inputs.inflation * 100).toFixed(2);
    const yrs = (inputs.days / 365.25).toFixed(1);
    return workRow('Indexation factor', `(1 + ${inflationPct}%)^${yrs} = × ${factor.toFixed(3)}`);
  };

  const baseInputs = wHoldingPeriod;

  // --- Calculate ------------------------------------------------------------

  const calculate = () => {
    const client    = clientSel.value;
    const costBase  = parseMoney(costBaseInput.value);
    const proceeds  = parseMoney(proceedsInput.value);
    const days      = daysBetween(acqDateInput.value, disposalInput.value);
    const rate      = parseFloat(taxRateSel.value) || 0;
    const inflation = (parseFloat(inflationInput.value) || 0) / 100;
    const indexable = !!INDEXABLE[client];
    const indexedRate = indexable ? Math.max(rate, MIN_TAX) : rate;
    const minTaxHit   = indexable && rate < MIN_TAX;
    const gross = proceeds - costBase;

    // Date validation
    if (days === null) {
      setPill('Enter acquisition & disposal dates', 'calc__pill--warn');
      setPreCard(null); setPostCard(null);
      refs.inflationField.hidden = true;
      refs.workingBody.innerHTML = '';
      return;
    }
    if (days <= 0) {
      setPill('Disposal date must be after acquisition date', 'calc__pill--warn');
      setPreCard(null); setPostCard(null);
      refs.inflationField.hidden = true;
      refs.workingBody.innerHTML = '';
      // Hide the Show working disclosure entirely in this error state.
      document.getElementById('calc-working').hidden = true;
      return;
    }
    document.getElementById('calc-working').hidden = false;

    const acqDate  = new Date(acqDateInput.value);
    const dispDate = new Date(disposalInput.value);
    const acqMs    = acqDate.getTime();
    const dispMs   = dispDate.getTime();
    const cutoffMs = CUTOFF.getTime();
    const preDays  = Math.max(0, (Math.min(dispMs, cutoffMs) - acqMs) / 86_400_000);
    const postDays = Math.max(0, (dispMs - Math.max(acqMs, cutoffMs)) / 86_400_000);
    const isPreCgtAcq = acqDate < PRE_CGT;
    const dispDateLabel = fmtDate(dispDate);

    const inputs = { acqDate, dispDate, days, costBase, proceeds, gross, inflation, rate, indexedRate, minTaxHit };
    const wInputs = baseInputs(inputs);

    // --- Edge cases (single-card) ---

    // Pre-1985 exempt
    if (isPreCgtAcq && (!indexable || dispMs < cutoffMs)) {
      setPill('Pre-CGT — acquired before 20 September 1985, exempt', 'calc__pill');
      refs.inflationField.hidden = true;
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Pre-CGT exempt',
        gain: gross,
        discountLabel: 'Pre-CGT exemption',
        discountAmount: Math.max(0, gross),
        taxable: 0,
        rateLabel: 'n/a',
        tax: 0,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // Pre-1985 caught (indexable, disposal on/after cutoff)
    if (isPreCgtAcq) {
      setPill('Pre-1985 asset caught from 1 July 2027 — cost-base methodology subject to consultation', 'calc__pill--warn');
      refs.inflationField.hidden = false;
      const result = scenarioPreCgtCaught(proceeds, costBase, days, postDays, indexedRate, inflation);
      const preFrac = 1 - result.postFrac;
      const preExempt = gross * preFrac;
      const indexDetail = [
        workRow('Years held',        result.years.toFixed(1)),
        workRow('Indexation factor', `× ${result.factor.toFixed(3)}`),
        workRow('Cost base uplift',  fmtMoney(result.indexedAdjustment)),
        workRow(`× ${Math.round(postDays).toLocaleString('en-AU')}/${Math.round(days).toLocaleString('en-AU')}`, fmtMoney(result.indexedAdjustment * result.postFrac)),
      ].join('');
      setPostCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Indexation on post 1 July 2027 portion',
        isCurrent: true,
        gain: gross,
        discountLabel: 'Pre 1 July 2027 portion (exempt)',
        discountAmount: preExempt,
        discountDetailHTML: workRow('Pre-1985 asset', `Gain accrued before 1 July 2027 remains exempt: ${fmtMoney(gross)} × ${(preFrac * 100).toFixed(1)}% = ${fmtMoney(preExempt)}.`),
        indexationLabel: 'Post 1 July 2027 indexation adj.',
        indexationAmount: result.indexedAdjustment * result.postFrac,
        indexationDetailHTML: indexDetail,
        taxable: result.taxable,
        rateLabel: `${fmtPct(indexedRate)}*`,
        tax: result.tax,
        rateFootnote: '* Pre 1 July 2027 portion exempt (pre-CGT); post portion at the higher of the entity’s marginal rate or 30%.',
      });
      setPreCard(null);
      refs.workingBody.innerHTML = wInputs +
        workRow('Days pre 1 July 2027',  Math.round(preDays).toLocaleString('en-AU')) +
        workRow('Days post 1 July 2027', Math.round(postDays).toLocaleString('en-AU')) +
        wGrossGain(inputs) +
        wIndexationFactor(inputs, result.factor);
      return;
    }

    // Capital loss
    if (gross < 0) {
      setPill(`Capital loss — ${fmtMoney(Math.abs(gross))} carry-forward`, 'calc__pill--loss');
      refs.inflationField.hidden = true;
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Capital loss',
        gain: gross,
        discountLabel: null,
        taxable: 0,
        rateLabel: 'n/a',
        tax: 0,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // Zero gain
    if (gross === 0) {
      setPill('No capital gain', 'calc__pill--warn');
      refs.inflationField.hidden = true;
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'No gain',
        gain: 0,
        discountLabel: null,
        taxable: 0,
        rateLabel: 'n/a',
        tax: 0,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // Sub-12-month — no discount, no indexation, full gain taxed
    if (days <= 365) {
      setPill(null);
      refs.inflationField.hidden = true;
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'No discount',
        gain: gross,
        discountLabel: null,
        taxable: gross,
        rate,
        tax: gross * rate,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // Non-indexable (SMSF, Company) — single card, flat discount path
    if (!indexable) {
      const result = scenarioDiscount(proceeds, costBase, days, client, rate);
      setPill(null);
      refs.inflationField.hidden = true;
      const discountPct = (result.discount * 100).toFixed(result.discount === 1/3 ? 2 : 0);
      const sub = client === 'company' ? 'No discount' : 'Flat rate discount';
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub,
        gain: gross,
        discountLabel: client === 'company' ? '0% discount (companies excluded)' : `${discountPct}% discount`,
        discountAmount: result.discountAmount,
        taxable: result.taxable,
        rate,
        tax: result.tax,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // --- Indexable scenarios (individual/trust) ---
    setPill(null);

    // Disposal pre 1 July 2027 → discount only, no card-post
    if (postDays === 0) {
      const result = scenarioDiscount(proceeds, costBase, days, client, rate);
      refs.inflationField.hidden = true;
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Flat rate discount',
        gain: gross,
        discountLabel: '50% discount',
        discountAmount: result.discountAmount,
        taxable: result.taxable,
        rate,
        tax: result.tax,
      });
      setPostCard(null);
      refs.workingBody.innerHTML = wInputs + wGrossGain(inputs);
      return;
    }

    // Acquired post 1 July 2027 → indexation only, no card-pre
    if (preDays === 0) {
      const result = scenarioIndexed(proceeds, costBase, days, indexedRate, inflation);
      refs.inflationField.hidden = false;
      const indexDetail = [
        workRow('Years held',        result.years.toFixed(1)),
        workRow('Indexation factor', `× ${result.factor.toFixed(3)}`),
        workRow('Indexed cost base', fmtMoney(result.indexedBase)),
      ].join('');
      setPostCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Indexation',
        isCurrent: true,
        gain: gross,
        discountLabel: null,
        indexationLabel: 'Indexation cost base adjustment',
        indexationAmount: result.indexedAdjustment,
        indexationDetailHTML: indexDetail,
        taxable: result.taxable,
        rateLabel: minTaxHit ? `${fmtPct(indexedRate)} (30% min)` : fmtPct(indexedRate),
        tax: result.tax,
      });
      setPreCard(null);
      refs.workingBody.innerHTML = wInputs +
        wGrossGain(inputs) +
        wIndexationFactor(inputs, result.factor);
      return;
    }

    // --- Hybrid: dates straddle 1 July 2027 — two cards ---
    refs.inflationField.hidden = false;

    const sDisc = scenarioDiscount(proceeds, costBase, days, client, rate);
    const sHyb  = scenarioHybrid(proceeds, costBase, preDays, postDays, client, rate, indexedRate, inflation);

    // Card 1 — pure-discount hypothetical ("Sell by 30 Jun 2027")
    setPreCard({
      title: 'Sell by 30 Jun 2027',
      sub: 'Flat rate discount',
      gain: sDisc.gross,
      discountLabel: '50% discount',
      discountAmount: sDisc.discountAmount,
      taxable: sDisc.taxable,
      rate,
      tax: sDisc.tax,
    });

    // Card 2 — at entered dates, hybrid (pre-discount + post-indexation)
    const preDaysStr  = Math.round(sHyb.preDays).toLocaleString('en-AU');
    const postDaysStr = Math.round(sHyb.postDays).toLocaleString('en-AU');
    const totalDaysStr = Math.round(sHyb.totalDays).toLocaleString('en-AU');

    // Reduction framing: row values shown as ($X), summing with gross to give
    // net taxable. preReduction = gross × 50% × preFrac (50% of pre-portion of
    // gain). postReduction = indexed-CB uplift × postFrac.
    const preReduction  = sHyb.discountAmount * sHyb.preFrac;
    const postReduction = sHyb.indexedAdjustment * sHyb.postFrac;

    const discountDetail = [
      workRow('Gross × 50%',                       fmtMoney(sHyb.discountAmount)),
      workRow(`× ${preDaysStr}/${totalDaysStr}`,   fmtMoney(preReduction)),
    ].join('');

    const indexationDetail = [
      workRow('Years held',        sHyb.years.toFixed(1)),
      workRow('Indexation factor', `× ${sHyb.factor.toFixed(3)}`),
      workRow('Cost base uplift',  fmtMoney(sHyb.indexedAdjustment)),
      workRow(`× ${postDaysStr}/${totalDaysStr}`, fmtMoney(postReduction)),
    ].join('');

    setPostCard({
      title: `Sell on ${dispDateLabel}`,
      sub: 'Hybrid',
      isCurrent: true,
      gain: sHyb.gross,
      discountLabel: 'Pre 1 July 2027 discount',
      discountAmount: preReduction,
      discountDetailHTML: discountDetail,
      indexationLabel: 'Post 1 July 2027 indexation adj.',
      indexationAmount: postReduction,
      indexationDetailHTML: indexationDetail,
      taxable: sHyb.taxable,
      rateLabel: `${fmtPct(Math.max(rate, indexedRate))}*`,
      tax: sHyb.tax,
      rateFootnote: '* Pre 1 July 2027 portion at the entity’s marginal rate; post portion at the higher of the marginal rate or 30%.',
    });

    // Inputs body: holding period + days pre/post (replaces timeline)
    // + gross gain formula + indexation factor formula.
    refs.workingBody.innerHTML = wInputs +
      workRow('Days pre 1 July 2027',  preDaysStr) +
      workRow('Days post 1 July 2027', postDaysStr) +
      wGrossGain(inputs) +
      wIndexationFactor(inputs, sHyb.factor);
  };

  // --- Wire up --------------------------------------------------------------

  clientSel.addEventListener('change', () => {
    renderRateOptions(clientSel.value);
    calculate();
  });
  form.addEventListener('input',  calculate);
  form.addEventListener('change', calculate);
  inflationInput.addEventListener('input', calculate);

  renderRateOptions(clientSel.value);
  calculate();
})();
