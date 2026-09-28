# Currency — read when touching vehicle, rental contract, or payment amounts, totals, or rates


Two amounts, and only one is ever summed. (`_sum: { amount: true }` once added euros
to dollars and printed `$2.0M`, silently.)

- **`amount` + `currency`** is what the customer pays. Never converted in place.
  (`Vehicle.dailyRate`, `RentalContract.totalAmount`, `Payment.amount` — never
  `RentalContract.pricePerDay`, which is display-only and has no base/fx columns.)
- **`baseAmount` is the only column any total, chart, average or sort may touch**;
  `fxRate`/`fxRateAt` record how it got there.
- **`baseCurrency` says what `baseAmount` is denominated in** — without it a figure
  converted against a stale base is indistinguishable from a correct one.
  - **`countedWhere(base)` filters every money aggregate.** Counts are deliberately
    *not* filtered, so status groups read counts and sums from separate queries.
  - **`pendingWhere(base)`** = null `baseAmount` *or* wrong `baseCurrency`, and it
    **matches null explicitly** — `{ not: base }` is `NULL`, not true, for a null
    column, so such rows were invisible everywhere.
  - **Compose with `AND`, never spread** — it contains an `OR`, and so does each
    entity's own list `where`.
  - **Every writer of `baseAmount` writes `baseCurrency` in the same statement**:
    `ConversionService` and `prisma/seed.ts`.
  - **Only `Vehicle.dailyRate` is nullable.** `RentalContract.totalAmount` and
    `Payment.amount` are not — `ConversionService` reads `NULLABLE_AMOUNT` per entity
    and builds `amountPresentWhere(entity)` accordingly, rather than assuming every
    convertible column can hold a null.
- **The rate is resolved once and frozen.** `create`/`update` call
  `ConversionService.convertFields(entity, ...)` when `amount` *or* `currency`
  changes, reading the unchanged one back in the same call. Converting on read makes
  a closed quarter change value every morning.
- **A missing rate is a null, disclosed not zeroed** — it falls out of `_sum`
  automatically, and `unconverted(entity)` counts those rows so the UI can say *3
  contracts in CHF are not included*.
- **`fillMissing(entity)` never touches a converted row**; `rerateAll(entity)` is the
  only thing that overwrites a frozen rate, and only on a reporting-currency change.

**`ExchangeRate.rate` = units of `baseCurrency` per unit of `quoteCurrency`**, so
`baseAmount = amount × rate` everywhere. The feed quotes the other way; `RatesService`
inverts on ingest.

- **`MANUAL` beats `FETCHED`** (unique on `(base, quote, source)`), which makes the
  fetcher optional — Settings → Currencies is the manual path. `resolveRate` refuses a
  rate ≤ 0.
- **Re-rating deduplicates codes through a `Set`** — `currency` was free text, so
  ` usd ` and `USD` were two groups each updating every variant.
- **`MAX_AMOUNT_CENTS`** (`currency.contracts.ts`, shared by vehicles, rental
  contracts and payments) is what `Decimal(14, 2)` holds; `baseAmount` is
  `Decimal(24, 4)` so amount × rate still fits.
- **Reporting currency is `AppSetting.reportingCurrency`**, read only through
  `readReportingCurrency`.
- **Codes are validated against `isCurrencyCode` (`@crm/db/currency`), not a regex** —
  `z.string().length(3)` accepted `ZZZ`. `isWellFormedCurrency` is separate because
  `Intl` throws on non-three-letter input.
- **`CURRENCIES` is thirteen currencies and that is all this CRM supports** — USD, EUR,
  JPY, GBP, CNY, AUD, CAD, CHF, HKD, SGD, ZAR, XOF, XAF, in array order. `isCurrencyCode`
  is the single gate for the picker, the feed filter and the stored setting. A refresh
  **prunes** `FETCHED` rows outside the list and leaves `MANUAL` alone. XOF/XAF have
  `minorUnits: 0` — the CFA franc isn't subdivided in practice — and `open.er-api.com`
  may not quote them, so rates for those two are typically `MANUAL` (Settings →
  Currencies) rather than `FETCHED`.
- **`applyRate` rounds to the *reporting* currency's `minorUnitsOf`**, not to two. The
  ×100 cents transport cannot represent a three-decimal minor unit; nor can
  `Decimal(14, 2)`.

**Feed: `open.er-api.com`, keyless**, two attempts at 6s. **Check `result`, not just
the status** — an unsupported base returns HTTP 200 with `{"result":"error"}`. An
unreachable provider warns and returns `{ ok: false }`; only the interactive refresh
throws.

**The fetcher is in the API deliberately**: a daily rate decides nothing, and
`RentalContractsService`/`PaymentsService` need it *synchronously* to write
`baseAmount` in the same transaction. Any judgement about it belongs in `apps/agent`.

`POST /internal/sync/rates` is guarded by `CRON_SECRET` (`timingSafeEquals`) and
**fails closed when unset**. **A route is not a schedule** — add it to
`apps/api/vercel.json` in the same change or nothing runs it.

