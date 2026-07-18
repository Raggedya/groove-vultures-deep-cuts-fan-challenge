# Running a Deep Cuts artist batch

## What you do

1. Attach one CSV containing the artist list.
2. Send this single instruction: **Run the Deep Cuts batch.**

That is all. Deep Cuts validates, researches, builds, tests, publishes and records each artist independently. An artist that cannot be proved safely is rejected without stopping the others.

## Where the results appear

- Completed live links: `reports/LATEST_BATCH_SUMMARY.md`
- Rejected artists and the exact reason: `reports/REJECTED_ARTISTS.csv`
- Detailed evidence: `reports/SOURCE_AUDIT.csv`
- Deployment results: `reports/DEPLOYMENT_RESULTS.csv`

## If the process is interrupted

Send: **Resume the Deep Cuts batch.** It continues from the latest safe checkpoint rather than starting again.

## How you know it succeeded

The final summary reports the numbers processed, published, rejected and technically failed. A published artist has a live URL and a passed post-deployment status. Rejection means the 98% evidence standard was not met; it does not mean the batch crashed.
