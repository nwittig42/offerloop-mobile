# Support case file: StoreKit error 5 on all IAP purchases (TestFlight, sandbox)

Prepared 2026-07-30. Use for the Apple Technical Support Incident (TSI) and
the RevenueCat support ticket. Everything below is verified fact, not guess.

## Summary

All in-app purchase attempts in our TestFlight build fail immediately with
SKError 5, "The product is not available for purchase"
(PRODUCT_NOT_AVAILABLE_FOR_PURCHASE via RevenueCat). Product metadata and
prices FETCH correctly in the same session; only the purchase is refused.
Reproduced on two different devices with two different Apple Accounts.

## App and products

- App Store Connect app: Offerloop Staging, Apple ID 6795695227, bundle
  ai.offerloop.app.preview. New record, no version ever approved (created
  July 2026, never submitted for review).
- Products (all status Prepare for Submission, all with price, all-country
  availability, localization, and review screenshot set):
  - ai.offerloop.app.preview.credits.150, consumable, $2.99, Apple ID 6795713460
  - ai.offerloop.app.preview.credits.400, consumable, $5.99, Apple ID 6795713849
  - ai.offerloop.app.preview.credits.1000, consumable, $9.99, Apple ID 6795715322
  - ai.offerloop.app.preview.pro.monthly, auto-renew sub, $9.99, 7-day free
    intro offer, Apple ID 6795695708
  - ai.offerloop.app.preview.elite.monthly, auto-renew sub, $34.99, Apple ID 6795698123

## Environment

- Build: TestFlight internal testing, version 1.0.0 build 5 (also reproduced
  on build 4 and on an ad hoc internal-distribution build before that).
- SDK: react-native-purchases 10.5.0 (RevenueCat), reproduced with BOTH
  storeKitVersion STOREKIT_1 and STOREKIT_2 (default).
- Devices: iPhone 17 Pro (iOS 26.5.2, account holder's Apple Account,
  storefront USA) and a second tester's iPhone (different Apple Account,
  also USA). Same result on both.
- Paid Applications agreement: Active (through Jun 2027). Bank account:
  Active. U.S. W-9 tax form: Active (submitted Jul 25, 2026).

## Exact behavior

1. Purchases.getProducts / getOfferings succeed; all five products return
   with correct localized prices. UI renders live StoreKit prices.
2. Purchases.purchaseStoreProduct (or purchasePackage) fails in about one
   second with SKError 5 / "The product is not available for purchase."
   No payment sheet is shown.
3. RevenueCat error detail: code 5, readableErrorCode
   PRODUCT_NOT_AVAILABLE_FOR_PURCHASE, underlyingErrorMessage EMPTY.
4. Storefront confirmed USA at failure time via Purchases.getStorefront().
5. One notable exception: on the second tester's device, the VERY FIRST
   purchase attempt (before his Apple Account had authenticated in the App
   Store) DID present the payment sheet and asked for account sign-in. Our
   client timed out after 45 s during that sign-in detour. Every attempt
   after the account was authenticated fails instantly with error 5 again.
   The sheet has never appeared on the first device, whose account was
   already authenticated.

## Timeline of fixes already applied (none changed the outcome)

- Set explicit all-country Availability on every product (one consumable
  and both subscriptions initially had missing or US-only availability;
  fixed and Saved 2026-07-28/29, 24+ hours before the latest repro).
- Review screenshot and notes present on all five products.
- Forced StoreKit 1; then reverted to StoreKit 2. Same error both ways.
- Fresh binary (build 5), fresh provisioning, delete + reinstall, device
  reboot, different Apple Account, different physical device.
- Verified the purchasing Apple Accounts: real accounts (TestFlight flow,
  not sandbox testers), US storefront, no purchase restrictions.

## Questions for support

1. Why does StoreKit vend product metadata but refuse purchase with error 5
   for ALL products of this app in TestFlight, on multiple devices and
   accounts, when every App Store Connect prerequisite (agreement, banking,
   tax, availability, price, review metadata) is verifiably complete?
2. Is there an account-level or app-record-level gate (e.g., for apps with
   no previously approved version, or consumables never attached to a
   submission) that blocks TestFlight purchases and is not surfaced in App
   Store Connect? If so, what clears it?
3. Is there a known propagation delay longer than 48 hours for availability
   changes to reach the TestFlight purchase path?

## Where to file

- Apple TSI: https://developer.apple.com/support/technical/ (account holder
  signs in, cite app Apple ID 6795695227; attach this file's contents).
- App Review phone call already granted for the related 3.1.1 rejection on
  app 6789441106; mention the sandbox blocker there too.
- RevenueCat support: https://app.revenuecat.com > Help, project 083723e5,
  app app2707b1cad1; ask them to check server-side logs for the purchase
  attempts (app user IDs available on request) and whether they see the
  StoreKit underlying error our client does not.
