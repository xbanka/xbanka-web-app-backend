# Obiex Trade & Rate Calculator Integration Guide

This guide outlines the workflow for integrating the cryptocurrency conversion and rate calculation features into the xbanka frontend.

## Overview
The backend abstracts the complexity of Obiex's canonical pairs and trade side detection. The frontend only needs to know which assets are swap-able and provide the source/target currencies.

---

## Step 1: Fetch Available Trade Pairs
Before allowing a user to select assets, fetch the list of tradeable pairs to know what combinations are supported by the provider.

**Endpoint:** `GET /wallet/assets/pairs`

**Response Format:**
```json
{
  "message": "Ok",
  "data": [
    {
      "source": { "code": "BNB", "name": "Binance Coin" },
      "target": { "code": "USDT", "name": "Tether" }
    },
    {
      "source": { "code": "USDT", "name": "Tether" },
      "target": { "code": "NGNX", "name": "Naira-stable" }
    }
  ]
}
```

## Step 2: Dropdown Cascading Logic (IMPORTANT)
To ensure the user only selects valid pairs, the "To" dropdown must dynamically update based on the "From" selection.

1.  **On Page Load**: Call `GET /wallet/assets/pairs` and store the `allPairs` array.
2.  **Populate "From"**: Use all unique currency codes from the list.
3.  **On "From" Selection (Asset A)**:
    *   Filter `allPairs` where `A` is either the `source` or `target`.
    *   The "To" dropdown should only display the **other** currency in those matching pairs.

**Frontend Example:**
```javascript
function getValidToCurrencies(selectedFrom, allPairs) {
  return allPairs
    .filter(pair => pair.source.code === selectedFrom || pair.target.code === selectedFrom)
    .map(pair => (pair.source.code === selectedFrom ? pair.target.code : pair.source.code));
}
```

---

## Step 3: The Rate Calculator (Live Estimation)
There are two versions of the Rate Calculator depending on where it is being used:

### A. For Public Landing Pages (Unauthenticated)
Use this when the user is NOT logged in. It requires a static internal API key.
**Endpoint:** `POST /internal/wallet/rate-calculator`
**Header:** `x-internal-key: fdf167f500f6ea62b949ab92243e3ae0376a766a`

### B. For User Dashboard (Authenticated)
Use this when the user IS logged in. It uses their standard JWT.
**Endpoint:** `POST /wallets/convert/check-rate`
**Header:** `Authorization: Bearer <JWT_TOKEN>`

**Common Request Body:**
```json
{
  "sourceCurrency": "USDT",
  "targetCurrency": "NGN",
  "amount": 100
}
```

**Response Highlights:**
- `rate`: The exchange rate between the two assets.
- `grossPayout`: Total amount of target currency before fees.
- `netPayout`: Amount the user will actually receive after the admin fee.
- `estimatedPrice`: A formatted string (e.g., `"1 USDT ≈ 1,445.50 NGN"`) for display.

---

## Step 3: Getting a Trade Quote
When the user clicks "Review" or "Proceed," call the Quote endpoint. This returns a finalized rate that is **locked for 30 seconds**.

**Endpoint:** `POST /wallet/convert/quote`

**Request Body:**
```json
{
  "sourceCurrency": "USDT",
  "targetCurrency": "NGN",
  "amount": 100
}
```

**Response Body:**
```json
{
  "quoteId": "internal-uuid-here",
  "rate": 1445.50,
  "netPayout": 144550.00,
  "expiresAt": "2026-04-05T10:55:00Z"
}
```

> [!IMPORTANT]
> **Expiry Countdown**: Display a 30-second timer to the user. If the timer hits zero, you must refresh the quote by calling this endpoint again to get a fresh rate.

---

## Step 4: Executing the Trade
Once the user confirms the quote (within the 30s window), send the `quoteId` to the execution endpoint.

**Endpoint:** `POST /wallet/convert/execute`

**Request Body:**
```json
{
  "quoteId": "internal-uuid-here",
  "sourceCurrency": "USDT",
  "targetCurrency": "NGN",
  "amount": 100
}
```

---

## FAQ & Constraints

### 1. Do I need to send "BUY" or "SELL"?
No. The backend automatically detects the correct trade side based on the Obiex canonical mapping. You only need to provide `sourceCurrency` (what they give) and `targetCurrency` (what they get).

### 2. Assets mapping
- **Internal NGN**: The backend maps this to `NGNX` for Obiex integration.
- **Minimums**: Check the `/wallet/assets/pairs` response for `minimumWithdrawal` or `minimumDeposit` if you want to provide frontend validation.

### 3. Error Handling
- `400 Bad Request`: Usually means "Trade pair not available" or the amount is below the provider's threshold.
- `404 Not Found`: The `quoteId` has expired or doesn't exist.
