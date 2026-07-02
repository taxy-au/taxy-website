// CGT discount calculator — AU accounting firms.
//
// Reflects Treasury Laws Amendment (Tax Reform No 1) Act 2026 (Act No. 49 of
// 2026, royal assent 26 June 2026; Schedule 1) and the Income Tax Rates
// Amendment (Tax Reform No 1) Act 2026. Core mechanics passed unchanged from
// the introduced bill:
//   - CGT discount replaced by cost-base indexation from 1 July 2027
//   - 30% minimum tax (new Div 119) on the post-1 July 2027 gain for
//     individuals, trusts and partnerships
//   - Pre-1985 assets caught for disposals on or after 1 July 2027 — for ALL
//     entities including companies (EM Table 1.2, row 2)
//   - Complying super funds (incl. SMSFs) and companies keep the existing
//     discount regime for post-1985 assets
//
// SPLIT MECHANISM (the key 2026-budget→legislation change). For an asset held
// across 1 July 2027, the Act does NOT pro-rata the gain by days. Instead an
// individual/trust is DEEMED to dispose of and reacquire the asset at its
// MARKET VALUE on 1 July 2027 (Sch 1 item 13, Subdiv 112-E, ss 112-155/165):
//   - Pre leg  (notional gain, deferred): MV@1Jul27 − cost base, OLD law, 50%
//     discount, no indexation. Not taxed in 2026/27 — assessed when realised.
//   - Post leg: proceeds − indexed(MV@1Jul27), NEW law, indexed cost base
//     (Div 960-M), subject to the 30% minimum tax.
// Default valuation = market value at 1 July 2027. The taxpayer may instead
// elect a ministerial apportionment method — see ASSUMPTIONS below.
//
// Right column renders one or two scenario cards depending on the entered
// dates and entity type:
//   - "Sell by 30 Jun 2027" — FLAT RATE DISCOUNT (card-pre)
//   - "Sell on [disposal date]" — MARKET-VALUE SPLIT / INDEXATION (card-post)

(function () {
  'use strict';

  const form = document.getElementById('cgt-calc-form');
  if (!form) return;

  // --- ASSUMPTIONS — pending supporting instruments -------------------------
  //
  // The Act is law; these are the levers to revisit when the supporting
  // legislative instruments are made (apportionment method, CPI series).
  // Engine structure below is built so only this block (and the inflation
  // input) needs touching.
  //
  //   1. SPLIT_METHOD — 'market-value' is the Act's default (deemed disposal
  //      at MV@1Jul27). The alternative — an apportionment method "determined
  //      by the Minister by legislative instrument" (EM 1.110) — is NOT yet
  //      made, so it is not modelled. When released, add it as a second method
  //      here and a toggle on the form.
  //   2. Indexation series — Div 960-M (s 960-275) sets the indexation factor
  //      off CPI. No published CPI covers post-1 July 2027 yet, so we project a
  //      single editable inflation rate (RBA 2.5% target default).
  //   3. Company pre-1985 catch — the Act catches pre-1985 gains for all
  //      entities, but the deemed-disposal/indexation machinery in Subdiv 112-E
  //      is written for individuals/trusts. Company cost-base mechanics for the
  //      post-2027 leg are not spelled out; left as a flagged edge.
  //   4. Residential elections (modelled via the Asset type input). New
  //      residential dwellings (s 115-102) and full-60% affordable housing
  //      (s 115-125(6)) KEEP the discount by default — no 1 Jul 27 deemed
  //      split, no 30% min tax (carve-outs in the deemed-disposal provision
  //      (1)(e) and s 119-5(2)(b)-(c)) — with an irrevocable elect-out into
  //      indexation (s 103-25 timing; individuals or trustees, not
  //      companies/super). "New residential dwelling" criteria await the
  //      s 26-160(4) ministerial instrument (unmade) — that option renders
  //      with an "indicative" warning pill until it's made. Affordable
  //      housing assumes full-period affordable use (flat 60%); the day-based
  //      proration of the uplift is not modelled.
  const SPLIT_METHOD = 'market-value';

  // Retained-discount rates by asset type (indexable entities only).
  const ASSET_DISCOUNT = { 'new-dwelling': 0.50, 'affordable': 0.60 };

  const ASSET_HINTS = {
    'new-dwelling': 'Which dwellings qualify as "new" is still to be set by legislative instrument (s 26-160(4)) — results for this asset type are indicative until it’s released.',
    'affordable': 'Assumes affordable housing through a registered provider for the whole ownership period. The up-to-60% discount prorates by days of affordable use — partial-use figures will differ.',
  };

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

  const clientSel        = $('client-type');
  const assetSel         = $('asset-type');
  const electCheck       = $('elect-indexation');
  const acqDateInput     = $('acq-date');
  const disposalInput    = $('disposal-date');
  const costBaseInput    = $('cost-base');
  const proceedsInput    = $('proceeds');
  const marketValueInput = $('market-value');
  const taxRateSel       = $('tax-rate');
  const taxRateLabel     = $('tax-rate-label');
  const inflationInput   = $('inflation');

  const refs = {
    pill:            $('result-pill'),
    inflationField:  $('inflation-field'),
    mvField:         $('mv-field'),
    assetField:      $('asset-field'),
    assetHint:       $('asset-hint'),
    electField:      $('elect-field'),
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
  // (matches the hardcoded "30 Jun 2027" in the straddle pre-card).
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

  // Straddle (post-1985 asset held across 1 July 2027). Market-value split per
  // the Act: deemed disposal at MV@1Jul27 (Subdiv 112-E).
  //   - Pre leg:  (MV − cost base), old law, 50% discount, no indexation.
  //   - Post leg: proceeds − indexed(MV), new law, indexed over POST period.
  // 12-month test uses the FULL holding period — the deemed disposal is
  // disregarded for the discount-eligibility rule (EM 1.56–1.57).
  const scenarioStraddleMV = (proceeds, costBase, marketValue, totalDays, postDays, client, rate, indexedRate, inflation) => {
    const gross        = proceeds - costBase;
    const heldOverYear = totalDays > 365;

    // Pre leg — notional gain on the deemed disposal (deferred to realisation).
    const baseDiscount  = CLIENT_DISCOUNT[client] ?? 0;
    const preGain       = marketValue - costBase;
    const discountRate  = (preGain > 0 && heldOverYear) ? baseDiscount : 0;
    const discountAmount = Math.max(0, preGain) * discountRate;
    const preTaxable    = Math.max(0, preGain) - discountAmount;

    // Post leg — indexation runs on MV over the post-1 July 2027 period only.
    const postYears  = postDays > 0 ? postDays / 365.25 : 0;
    const factor     = postYears > 0 ? Math.pow(1 + inflation, postYears) : 1;
    const indexedMV  = marketValue * factor;
    const indexedAdjustment = Math.max(0, indexedMV - marketValue);
    const postGain   = Math.max(0, proceeds - indexedMV);
    // Reduction actually applied by indexation = post-leg gain before
    // indexation minus after. Capped so it can zero the post leg but not push
    // it negative — keeps the card rows reconciling (gross − disc − idx = net).
    const indexationReduction = Math.max(0, proceeds - marketValue) - postGain;

    const preTax  = preTaxable * rate;
    const postTax = postGain   * indexedRate;

    return {
      kind: 'straddle-mv',
      gross, marketValue, totalDays, postDays, postYears,
      preGain, discountRate, discountAmount, preTaxable,
      factor, indexedMV, indexedAdjustment, indexationReduction, postGain,
      preTax, postTax,
      taxable: preTaxable + postGain,
      tax: preTax + postTax,
    };
  };

  const scenarioPreCgtCaught = (proceeds, costBase, marketValue, postDays, indexedRate, inflation) => {
    // Pre-1985 asset caught at 1 July 2027. Pre-portion (MV − cost base) is
    // exempt (pre-CGT); MV@1Jul27 anchors the indexed post leg.
    const preExempt  = marketValue - costBase;
    const postYears  = postDays > 0 ? postDays / 365.25 : 0;
    const factor     = postYears > 0 ? Math.pow(1 + inflation, postYears) : 1;
    const indexedMV  = marketValue * factor;
    const indexedAdjustment = Math.max(0, indexedMV - marketValue);
    const postGain   = Math.max(0, proceeds - indexedMV);
    // Capped reduction (see scenarioStraddleMV) — keeps the card reconciling.
    const indexationReduction = Math.max(0, proceeds - marketValue) - postGain;
    return {
      kind: 'pre-cgt-caught',
      gross: proceeds - costBase,
      marketValue, preExempt, postYears, factor, indexedMV, indexedAdjustment,
      indexationReduction, postGain,
      taxable: postGain,
      tax: postGain * indexedRate,
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

  // Indexation factor for the market-value split — runs over the post-1 July
  // 2027 period only (years derived from postDays, not the full holding).
  const wIndexationFactorPost = (inputs, factor, postDays) => {
    const inflationPct = (inputs.inflation * 100).toFixed(2);
    const yrs = (postDays / 365.25).toFixed(1);
    return workRow('Post-2027 indexation factor', `(1 + ${inflationPct}%)^${yrs} = × ${factor.toFixed(3)}`);
  };

  const wMarketValue = (marketValue) =>
    workRow('Market value 1 Jul 2027', fmtMoney(marketValue));

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
    const marketValue = parseMoney(marketValueInput.value);

    // Asset type only exists for indexable entities — the s 115-102/115-125
    // elections are made by individuals or trustees, not companies/super.
    const assetType     = indexable ? assetSel.value : 'other';
    const resDiscount   = ASSET_DISCOUNT[assetType];
    const isResidential = resDiscount !== undefined;
    refs.assetField.hidden = !indexable;
    refs.assetHint.hidden  = !(indexable && isResidential);
    if (isResidential) refs.assetHint.textContent = ASSET_HINTS[assetType];

    // Market-value field only matters for straddle / pre-1985-caught states;
    // hidden by default, revealed by those two branches below. Elect toggle
    // likewise — revealed once dates show the election is available.
    refs.mvField.hidden = true;
    refs.electField.hidden = true;

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

    // Elect-out into indexation is only a live choice when the retained
    // discount would otherwise apply to a post-cutoff discount gain. A checked
    // box is ignored while the toggle is hidden (e.g. affordable disposals
    // before the cutoff still get their 60%).
    const electAvailable = isResidential && !isPreCgtAcq && postDays > 0 && days > 365 && gross > 0;
    refs.electField.hidden = !electAvailable;
    const electIndexation = electAvailable && electCheck.checked;

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

    // Pre-1985 caught (indexable, disposal on/after cutoff). MV@1Jul27 anchors
    // the post leg; pre-portion (MV − cost base) is exempt.
    if (isPreCgtAcq) {
      setPill('Pre-1985 asset caught from 1 July 2027 — taxed on the post-2027 gain (market-value basis)', 'calc__pill--warn');
      refs.inflationField.hidden = false;
      refs.mvField.hidden = false;
      const result = scenarioPreCgtCaught(proceeds, costBase, marketValue, postDays, indexedRate, inflation);
      const indexDetail = [
        workRow('Market value 1 Jul 2027', fmtMoney(result.marketValue)),
        workRow('Post-2027 years',         result.postYears.toFixed(1)),
        workRow('Indexation factor',       `× ${result.factor.toFixed(3)}`),
        workRow('Indexed cost base',       fmtMoney(result.indexedMV)),
      ].join('');
      setPostCard({
        title: `Sell on ${dispDateLabel}`,
        sub: 'Indexation on post 1 July 2027 portion',
        isCurrent: true,
        gain: gross,
        discountLabel: 'Pre 1 July 2027 portion (exempt)',
        discountAmount: result.preExempt,
        discountDetailHTML: workRow('Pre-1985 asset', `Gain accrued before 1 July 2027 remains exempt: market value ${fmtMoney(result.marketValue)} − cost base ${fmtMoney(costBase)} = ${fmtMoney(result.preExempt)}.`),
        indexationLabel: 'Post 1 July 2027 indexation adj.',
        indexationAmount: result.indexationReduction,
        indexationDetailHTML: indexDetail,
        taxable: result.taxable,
        rateLabel: `${fmtPct(indexedRate)}*`,
        tax: result.tax,
        rateFootnote: '* Pre 1 July 2027 portion exempt (pre-CGT); post portion at the higher of the entity’s marginal rate or 30%.',
      });
      setPreCard(null);
      refs.workingBody.innerHTML = wInputs +
        wMarketValue(result.marketValue) +
        workRow('Days post 1 July 2027', Math.round(postDays).toLocaleString('en-AU')) +
        wGrossGain(inputs) +
        wIndexationFactorPost(inputs, result.factor, postDays);
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

    // --- Residential elections (s 115-102 / s 115-125) — retained discount ---
    // Default path under the Act: the discount continues (50% new dwelling,
    // 60% affordable), with no 1 July 2027 deemed split and no 30% minimum
    // tax (deemed-disposal carve-out (1)(e); s 119-5(2)(b)-(c)). Electing
    // indexation falls through to the ordinary paths below. New-dwelling
    // disposals before the cutoff take the ordinary 50% path — s 115-102
    // only matters for events on or after 1 July 2027.
    if (isResidential && !electIndexation && (postDays > 0 || assetType === 'affordable')) {
      const discountAmount = gross * resDiscount;
      const taxable = gross - discountAmount;
      const pct = Math.round(resDiscount * 100);
      refs.inflationField.hidden = true;
      if (assetType === 'new-dwelling') {
        setPill('"New residential dwelling" criteria are pending a legislative instrument (s 26-160(4)) — treat this result as indicative.', 'calc__pill--warn');
      } else {
        setPill('Assumes affordable housing for the full ownership period — the 60% discount prorates by days of affordable use.', 'calc__pill');
      }
      setPreCard({
        title: `Sell on ${dispDateLabel}`,
        sub: postDays > 0 ? 'Retained discount — no 1 July 2027 split' : 'Affordable housing discount',
        gain: gross,
        discountLabel: assetType === 'affordable' ? `${pct}% discount (s 115-125)` : `${pct}% discount (s 115-102)`,
        discountAmount,
        taxable,
        rate,
        tax: taxable * rate,
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

    // --- Straddle: dates straddle 1 July 2027 — two cards ---
    // Card 2 splits the gain at the 1 July 2027 market value (deemed disposal).
    refs.inflationField.hidden = false;
    refs.mvField.hidden = false;

    // The two-leg split is well-defined only when the 1 July 2027 market value
    // sits between the cost base and the proceeds — then both legs are gains.
    // Outside that band one leg is a notional capital loss; netting it against
    // the other leg (loss-ordering vs the discount and the 30% floor) isn't
    // modelled, so the figure can overstate. Flag it rather than mislead.
    if (marketValue < costBase || marketValue > proceeds) {
      setPill('Market value is outside the cost base–proceeds range — a notional capital loss arises on one leg that this calculator doesn’t net. Treat the split as indicative.', 'calc__pill--warn');
    }

    const sDisc = scenarioDiscount(proceeds, costBase, days, client, rate);
    const sStr  = scenarioStraddleMV(proceeds, costBase, marketValue, days, postDays, client, rate, indexedRate, inflation);

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

    // Card 2 — at entered dates: market-value split (pre-discount + post-index).
    // Reduction framing: row values shown as ($X), summing with gross to give
    // net taxable. preReduction = 50% of the pre-1 Jul 2027 notional gain
    // (MV − cost base); postReduction = indexation uplift on MV. These two
    // reductions and the gross satisfy: gross − pre − post = net taxable.
    const postDaysStr = Math.round(sStr.postDays).toLocaleString('en-AU');
    const discountPct = (sStr.discountRate * 100).toFixed(0);
    const preReduction  = sStr.discountAmount;
    const postReduction = sStr.indexationReduction;

    const discountDetail = [
      workRow('Notional gain to 1 Jul 2027', `${fmtMoney(marketValue)} − ${fmtMoney(costBase)} = ${fmtMoney(sStr.preGain)}`),
      workRow(`× ${discountPct}% discount`,  fmtMoney(preReduction)),
    ].join('');

    const indexationDetail = [
      workRow('Market value 1 Jul 2027', fmtMoney(sStr.marketValue)),
      workRow('Post-2027 years',         sStr.postYears.toFixed(1)),
      workRow('Indexation factor',       `× ${sStr.factor.toFixed(3)}`),
      workRow('Indexed cost base',       fmtMoney(sStr.indexedMV)),
    ].join('');

    setPostCard({
      title: `Sell on ${dispDateLabel}`,
      sub: 'Market-value split',
      isCurrent: true,
      gain: sStr.gross,
      discountLabel: 'Pre 1 July 2027 discount',
      discountAmount: preReduction,
      discountDetailHTML: discountDetail,
      indexationLabel: 'Post 1 July 2027 indexation adj.',
      indexationAmount: postReduction,
      indexationDetailHTML: indexationDetail,
      taxable: sStr.taxable,
      rateLabel: `${fmtPct(Math.max(rate, indexedRate))}*`,
      tax: sStr.tax,
      rateFootnote: '* Pre 1 July 2027 portion at the entity’s marginal rate (deferred to realisation); post portion at the higher of the marginal rate or 30%.',
    });

    // Inputs body: holding period + market value + post-2027 days
    // + gross gain formula + post-period indexation factor.
    refs.workingBody.innerHTML = wInputs +
      wMarketValue(marketValue) +
      workRow('Days post 1 July 2027', postDaysStr) +
      wGrossGain(inputs) +
      wIndexationFactorPost(inputs, sStr.factor, postDays);
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
