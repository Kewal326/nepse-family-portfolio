# NEPSE Family Portfolio Notes

## Goal

Build a mobile-first portfolio app for MeroShare/NEPSE family accounts.

The main flow should be:

1. User opens app.
2. User logs in to MeroShare inside the app WebView.
3. App uses the logged-in WebView session to call MeroShare/CDSC backend APIs.
4. App fetches holdings, WACC cost basis, and purchase lots automatically.
5. App returns to home and shows only real consolidated holdings.

## Known APIs

### Account Details

`GET https://webbackend.cdsc.com.np/api/meroShare/ownDetail/`

Auth:

- `Authorization` header is a MeroShare JWT.
- Current app discovers the JWT from WebView storage at runtime.
- Do not hardcode or log this token.

Useful response fields:

- `demat`
- `clientCode`
- `boid`
- `username`
- `name`

### Portfolio Holdings

`POST https://webbackend.cdsc.com.np/api/meroShareView/myPortfolio/`

Known request body from Chrome DevTools:

```json
{
  "sortBy": "script",
  "demat": ["<demat from ownDetail>"],
  "clientCode": "<clientCode from ownDetail>",
  "page": 1,
  "size": 200,
  "sortAsc": true
}
```

Useful response fields:

- `meroShareMyPortfolio[]`
- `totalItems`
- `script`
- `scriptDesc`
- `currentBalance`
- `lastTransactionPrice`
- `previousClosingPrice`

Current issue:

- On phone WebView automatic sync, this endpoint is returning HTTP `404` with `Data not found`.
- The same request shape worked in laptop Chrome DevTools.
- Current code tries variants:
  - original request
  - numeric `clientCode`
  - plain `demat`
  - page-zero fallback

Next debugging step:

- Compare the exact sanitized request body from app logs against the laptop DevTools body.
- Check whether `ownDetail.clientCode` from the phone session matches the value used in Chrome.
- Check if MeroShare expects a currently selected BOID/account context before `myPortfolio`.

### WACC / Purchase Source

`POST https://webbackend.cdsc.com.np/api/myPurchase/search/wacc/`

Request body:

```json
{
  "demat": "<demat from ownDetail>",
  "scrip": "AHPC"
}
```

This works from the app.

Useful response fields:

- `waccSummaryResponse.averageBuyRate`
- `waccSummaryResponse.totalQuantity`
- `waccSummaryResponse.totalCost`
- `waccUpdateResponse[]`
- `waccUpdateResponse[].purchaseSource`
- `waccUpdateResponse[].transactionDate`
- `waccUpdateResponse[].transactionQuantity`
- `waccUpdateResponse[].rate`
- `waccUpdateResponse[].userPrice`

## Current App Behavior

Main file:

- `App.tsx`

Current behavior:

- Home screen no longer falls back to dummy holdings.
- `Start sync` opens MeroShare WebView.
- After login, app auto-starts full sync.
- Loader appears while pulling holdings/cost basis.
- On successful WACC loop, app returns home.
- Direct WACC API works for one symbol.
- Portfolio API is working in recent phone tests; WACC API then runs per imported holding.
- App now caches synced holdings, cost records, and purchase lots in phone storage so validation can continue after reload.
- Holding cards open a detail screen with cash-invested average-cost math and exact stored MeroShare rows.
- Sync screen is now full-screen MeroShare with only a floating Close button; detail view labels app-calculated vs MeroShare summary cost source and renders stored MeroShare data as tables.
- Cost basis priority: if MeroShare returns `waccSummaryResponse.averageBuyRate`, display that as the average cost and flag it as MeroShare WACC summary; app cash-invested math is kept only as secondary detail.
- App content has Android status-bar spacing; detail back is a small instant arrow and Android hardware back exits detail/sync screens. Detail view separates current holding quantity from MeroShare WACC quantity.

Security/logging:

- App should not hardcode JWT or demat.
- JWT is discovered at runtime inside WebView.
- `demat` comes from `ownDetail`.
- Logs sanitize `demat`, `token`, and `authorization` keys.

## Useful Commands

Start dev client:

```sh
npm run start:dev-client -- --clear
```

TypeScript check:

```sh
./node_modules/.bin/tsc --noEmit
```

Get laptop LAN IP:

```sh
ipconfig getifaddr en0
```

Check Metro:

```sh
curl -I http://localhost:8081
```
