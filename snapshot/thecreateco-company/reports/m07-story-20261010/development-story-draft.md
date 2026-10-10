# Development story draft — Form image delivery

**A small routing fix makes image delivery more dependable in Form.** The image optimizer was treating `ASSETS` like a static-file fetcher, but in this Worker configuration `ASSETS` is the R2 bucket used by project assets. A local request to the optimizer therefore failed with a 500 (`env.ASSETS.fetch is not a function`).

The repair gives static files their own `STATIC` fetch binding while keeping `ASSETS` attached to R2. In the local emitted-Worker check, the same synthetic PNG that previously hit the error then returned **200 with its original 67 bytes**. This is a routing correction, not an image enhancement: with the optional Images service absent, Form passes the original image through; resizing and transcoding were not demonstrated.

**Status:** the narrow fix was independently reviewed and pushed in draft PR [#9](https://github.com/armonon/form-studio/pull/9). It has not been deployed, merged, or release-qualified. Hosted web and native checks did not start because of account payment/spending-limit annotations, so this is not evidence of a live fix or production behavior.

Evidence: [implementation and local verification report](../../core-product-lab/reports/form-worker-images-20261009T1140/README.md) · [independent scoped review](../../core-product-lab/reports/form-worker-images-20261009T1140/independent-review.md).
