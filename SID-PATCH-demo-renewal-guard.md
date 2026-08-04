# Patch for Sid: suppress subscription renewals on App Review demo accounts

Companion to SID-HANDOFF-2026-08-03.md. Web repo, branch staging/mobile-field.
Small, self-contained, please ship to the staging service as soon as you can.

## Why

The applereview@offerloop.ai demo account carries a stale sandbox Pro
subscription from QA on 2026-07-31. It auto-renews DAILY at 19:50:50 UTC, and
each RENEWAL event re-upgrades the account to Pro through the webhook. A Pro
account hides the Pro and Elite offers in the app, which is exactly what got
build 15 rejected under 2.1(b). Rylan currently has a scheduled job resetting
the account every day at 12:52 PM PT; this patch makes that unnecessary and
prevents the whole class of problem (any future QA purchase on the demo
account would recreate it).

Design choice: suppress ONLY the RENEWAL event type for demo uids. A fresh
INITIAL_PURCHASE by the reviewer must still upgrade the account so they can
verify the subscription flow end to end, and EXPIRATION must still downgrade.
Only the stale subscription's heartbeat is blocked.

## Change 1: backend/app/config.py

Add (near the other IAP config):

```python
# Firebase uids of App Review demo accounts. Stale sandbox subscriptions on
# these accounts auto-renew and would re-upgrade the tier daily, hiding the
# subscription offers from the reviewer (cause of the 2026-08-03 2.1(b)
# rejection). Renewals for these uids are suppressed in the RevenueCat
# webhook; fresh purchases and expirations still apply.
REVIEW_DEMO_UIDS = frozenset(
    u.strip() for u in os.environ.get('REVIEW_DEMO_UIDS', '').split(',') if u.strip()
)
```

## Change 2: backend/app/services/revenuecat_service.py

Add REVIEW_DEMO_UIDS to the existing `from app.config import (...)` block.

In classify_event, directly AFTER the environment check (the
`if expect_production != (environment == 'PRODUCTION')` block, currently step
2) and BEFORE the pack handling, insert:

```python
    # 2b. App Review demo accounts: a stale QA subscription auto-renews in
    #     sandbox and would re-upgrade the account daily. Suppress only the
    #     renewal heartbeat; a fresh INITIAL_PURCHASE by the reviewer still
    #     upgrades, and EXPIRATION still downgrades.
    if uid in REVIEW_DEMO_UIDS and event_type == 'RENEWAL':
        return decision('ignore', 'review_demo_renewal_suppressed', uid=uid)
```

## Change 3: test in backend/tests/test_revenuecat_webhook.py

```python
def test_review_demo_renewal_suppressed(monkeypatch):
    from app.services import revenuecat_service as svc
    demo = 'DPiaCKOnHghLl4CwzrCZd2N7cOp2'
    monkeypatch.setattr(svc, 'REVIEW_DEMO_UIDS', frozenset({demo}))
    base = {'app_user_id': demo, 'environment': 'SANDBOX',
            'product_id': 'ai.offerloop.app.preview.pro.monthly'}

    renewal = svc.classify_event({**base, 'type': 'RENEWAL'}, expect_production=False)
    assert renewal.action == 'ignore'
    assert renewal.reason == 'review_demo_renewal_suppressed'

    # A fresh purchase by the reviewer must still work.
    purchase = svc.classify_event({**base, 'type': 'INITIAL_PURCHASE'}, expect_production=False)
    assert purchase.action == 'sync_subscription'

    # Expiry must still downgrade.
    expiry = svc.classify_event({**base, 'type': 'EXPIRATION'}, expect_production=False)
    assert expiry.action == 'sync_subscription'

    # Other accounts are untouched.
    other = svc.classify_event({**base, 'type': 'RENEWAL', 'app_user_id': 'someone-else'},
                               expect_production=False)
    assert other.action == 'sync_subscription'
```

## Deploy

1. On the offerloop-staging Render service (srv-d93d0fcvikkc73a1igmg), add env
   var REVIEW_DEMO_UIDS=DPiaCKOnHghLl4CwzrCZd2N7cOp2. Saving via the dashboard
   auto-deploys; via the API you must POST a deploy afterward.
2. Optionally set the same var on offerloop-mobile-prod for symmetry. Sandbox
   renewals never reach it (environment check), so it is defense in depth, not
   a requirement.
3. After deploy, the next daily renewal (19:50 UTC) should log
   "RENEWAL → ignore (review_demo_renewal_suppressed)" instead of a tier sync.
   Tell Rylan once you see that, so he can remove his scheduled reset:
   launchctl bootout gui/$(id -u)/ai.offerloop.demo-reset

## While you are in the file

The webhook replays on 2026-08-03 and 08-04 both returned tierSource "event",
meaning fetch_subscriber_tier (the authoritative RevenueCat REST read) is
returning None on staging. Likely REVENUECAT_API_KEY is missing or wrong on
the service. Details and why it matters are in SID-HANDOFF-2026-08-03.md.
