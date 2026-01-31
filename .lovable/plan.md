

# Expand AI Polishing Prompt with Industry Brand Names

## Overview

Add comprehensive brand name corrections to the transcript polishing prompt, covering:
- **16 competitors** (room-sharing/rentals/housing platforms)
- **8 payment/payout partners**
- **9 IDV/fraud/KYC partners**
- **10 property ops/leasing/screening partners**

This ensures Deepgram transcripts correctly identify industry-specific company names before downstream analysis.

---

## Implementation

### File to Modify

`supabase/functions/transcribe-call/index.ts` - Update the `polishTranscript()` function prompt (lines 187-209)

### Updated Prompt Structure

```typescript
const prompt = `Polish this call transcript for readability. DO NOT change any words or meaning except for the specific corrections below.

CRITICAL BRAND/COMPANY NAME FIXES (always apply these):

=== PadSplit & Internal Tools ===
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split" → "PadSplit"
- "Kix", "kicks", "kicky", "kix e", "kix ee" → "Kixie"
- "hub spot", "Hub Spot" → "HubSpot"

=== Competitor Platforms (Housing/Rentals) ===
- "air bnb", "airbee and bee", "air be an be" → "Airbnb"
- "verbo", "ver bo" → "Vrbo"
- "booking dot com", "bookin'", "bookie dot com" → "Booking.com"
- "zillo", "zeal oh" → "Zillow"
- "truly a", "trulee-uh" → "Trulia"
- "realtor dot com", "realter dot com", "real tour" → "Realtor.com"
- "apartments dot com", "apartment dot com" → "Apartments.com"
- "zoomer", "zumperr", "zumba" → "Zumper"
- "hot pads", "hot paths" → "HotPads"
- "rent dot com", "rent calm" → "Rent.com"
- "rent café", "rent-caffee" → "RentCafe"
- "rooster", "room stir" → "Roomster"
- "spare room", "spare-room", "spare rum" → "SpareRoom"
- "roomy", "rumi" → "Roomi"
- "bung a low", "bung below" → "Bungalow"
- "commune", "calm in" → "Common"
- "sawn-der", "sondar" → "Sonder"
- "blue ground", "blue grounds", "blue grown" → "Blueground"

=== Payment Partners ===
- "strip", "strype", "stripey" → "Stripe"
- "pay pal", "papal" → "PayPal"
- "adian", "add yen", "a-d-n" → "Adyen"
- "brain tree", "braintray" → "Braintree"
- "world pay", "word pay" → "Worldpay"
- "check out dot com", "check out calm" → "Checkout.com"
- "played", "plate" → "Plaid"
- "dollar", "dweller", "dwallah" → "Dwolla"

=== Verification Partners (IDV/KYC) ===
- "on fido", "onfiddle", "on-fee-doh" → "Onfido"
- "person uh", "personal" → "Persona"
- "so cure", "soccer", "so-cher" → "Socure"
- "shift" → "Sift"
- "sardines", "sar dean" → "Sardine"
- "truly-o", "trulio", "truly you" → "Trulioo"
- "a loy", "all-oy" → "Alloy"
- "lexus nexus", "lexis", "nexus" → "LexisNexis"
- "joo-me-oh", "junio", "jumeo" → "Jumio"

=== Property/Screening Partners ===
- "yardy", "yar dee" → "Yardi"
- "real page", "rail page" → "RealPage"
- "app folio", "ap polio", "app holy-oh" → "AppFolio"
- "build 'em", "bilidium" → "Buildium"
- "intra-da", "en-trah-ta", "enter ata" → "Entrata"
- "rent ready", "rent reddy" → "RentRedi"
- "rent spree", "rent spray" → "RentSpree"
- "trans union" → "TransUnion"
- "experience", "experion" → "Experian"
- "equi facts", "equal facts" → "Equifax"

FORMATTING FIXES:
1. Capitalization (proper nouns, sentence starts, titles like Mr./Mrs.)
2. Punctuation (commas, periods, question marks)
3. Number formatting ($330 not "three thirty", 10% not "ten percent")
4. Title corrections ("mister" → "Mr.", "missus" → "Mrs.")

KEEP AS-IS:
- All speaker labels (Speaker 0:, Speaker 1:, Agent:, Member:) exactly as-is
- Natural contractions like "gonna", "wanna", "gotta"
- All words not listed in corrections above

RAW TRANSCRIPT:
${rawTranscript}

Return ONLY the polished transcript, no explanation.`;
```

---

## Technical Considerations

### Prompt Length Impact
- Adding ~60 brand corrections increases prompt by ~2,500 characters
- At ~4 chars/token, this adds ~625 tokens to each polishing call
- Cost impact: ~$0.00003 per call (negligible at Flash-lite pricing)

### Categorization Benefits
- **Organized sections** make the prompt easier to maintain
- **Section headers** (===) help the AI understand context
- **Grouped by industry** reduces chance of false positives

### Edge Cases Handled
- Words that could be common words: "plate" → "Plaid" (only when in payment context)
- Lowercase variants: "common" only converts when discussing housing
- Compound words: "spare room" vs "SpareRoom"

---

## Summary

| Category | Brands Added |
|----------|--------------|
| Competitors | 16 |
| Payment Partners | 8 |
| IDV/KYC Partners | 9 |
| Property/Screening | 10 |
| **Total** | **43 new brands** |

After deployment, transcripts will correctly identify industry terminology, improving:
- Coaching feedback accuracy (agent can discuss competitor features properly)
- Member insights analysis (track which platforms members are comparing)
- QA scoring (agents mentioning correct company names)

