# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# Deferred: Cash Basis P&L (bonus-adjusted view)

**Feature**: Toggle in the portfolio summary card between two P&L modes:
- **WACC basis** (current): bonus shares treated at Rs. 100 (correct for tax/capital gains)
- **Cash basis**: bonus shares treated as free (Rs. 0), showing actual rupees invested

**Why it's deferred**: Requires fetching transaction history per symbol — paginated API, expensive at sync time.

**API**: `POST https://webbackend.cdsc.com.np/api/meroShareView/myTransaction/`
- Same auth token as WACC (`Authorization: <JWT from MeroShare session>`)
- Body: `{ boid, clientCode, script, fromDate: null, toDate: null, requestTypeScript: true, page: 1, size: 200 }`
- Returns `{ totalItems, transactionView: [...] }` — paginated (size 200 is usually enough per symbol)

**Key response fields**:
- `historyDesc` prefix `CA-Bonus` → bonus share (zero cash cost)
- `historyDesc` prefix `CA-Rights` → rights issue (investor paid cash — no adjustment needed)
- `historyDesc` prefix `ON-DR` → on-market sell (debit from demat)
- `transCode: "2246"` = credit, `"2277"` = debit

**Calculation**:
```
bonusFraction = totalBonusQtyReceived / totalQtyReceived (all credits)
bonusSharesHeld = currentHolding × bonusFraction
cashBasisCost = wacc_totalCost − (bonusSharesHeld × 100)
cashBasisPL = currentMarketValue − cashBasisCost
```

**Storage**: Store `bonusQtyReceived` and `totalQtyReceived` per symbol in the existing cache alongside WACC data.
Fetch during MeroShare sync (same WebView session) — one extra call per symbol after WACC is done.
