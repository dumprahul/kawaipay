# Claude Prompt --- Kawaipay World ID Orb / Proof of Human Sandbox

## Objective

Build a **standalone test sandbox** for integrating World ID's **Proof
of Human (PoH)** using the **Orb-backed World ID flow**, so I can test
the complete verification flow independently before integrating it into
Kawaipay.

**Do not modify my existing Kawaipay project.** This sandbox must be a
separate, self-contained implementation whose only purpose is to prove
that the World ID integration works end-to-end.

The most important requirement:

> **The official current World ID / IDKit documentation is the source of
> truth.**

Before writing code, read the current official IDKit documentation
carefully and implement the current API exactly as documented. Do not
rely on old tutorials, outdated Worldcoin SDK examples, guessed APIs, or
deprecated integration patterns.

Official documentation: -
https://docs.world.org/world-id/idkit/integrate -
https://docs.world.org/world-id/idkit/credentials -
https://docs.world.org/world-id/idkit/verification-flows -
https://developer.world.org/

If the docs have changed from anything written in this prompt, **follow
the current official docs** and document the difference in the README.

------------------------------------------------------------------------

# 1. What I am trying to prove

Kawaipay is a creator-attention payment protocol.

A seller creates a campaign and funds an escrow. Creators can
participate in that campaign by creating a creator link. The problem is
that without Sybil resistance, the same person could potentially create:

-   Link 1 for Campaign A
-   Link 2 for Campaign A
-   Link 3 for Campaign A
-   etc.

That could create multiple payout opportunities against the same
seller-funded campaign.

The intended rule is:

### One verified human → one creator link per campaign

But:

### One verified human → many different campaigns is allowed

Example:

-   Alice verifies as a unique human.
-   Alice joins Campaign A → **allowed**, Link A is created.
-   Alice tries to create another link for Campaign A → **rejected**.
-   Alice joins Campaign B → **allowed**, Link B is created.
-   Alice joins Campaign C → **allowed**, Link C is created.
-   Bob joins Campaign A → **allowed**, because Bob is a different
    verified human.

This is the exact behavior I want the sandbox to demonstrate.

------------------------------------------------------------------------

# 2. Why Proof of Human is being used

Use **World ID Proof of Human** because the trust requirement is:

> "Is this creator a unique human?"

Kawaipay does **not** need:

-   the creator's real name
-   nationality
-   passport information
-   government identity
-   full biometric information

PoH is therefore intended to provide the minimum necessary
Sybil-resistance signal for creator participation.

The trust model is:

1.  **World ID / Proof of Human** → establishes unique-human
    verification.
2.  **Kawaipay application logic** → enforces one creator link per
    campaign.
3.  **Kawaipay's eventual Oracle + Sui escrow logic** → handles
    attention validation and payment rules.

For this sandbox, focus ONLY on the first two.

------------------------------------------------------------------------

# 3. IMPORTANT: Understand the distinction between World ID and the campaign rule

Do NOT implement this as:

> "One World ID human can only ever have one link."

That is WRONG for this project.

Do NOT globally block a verified human from participating in multiple
campaigns.

The actual constraint is:

``` text
UNIQUE(campaign, verified_creator)
```

Conceptually:

``` text
Alice + Campaign A = allowed once
Alice + Campaign A = rejected again

Alice + Campaign B = allowed
Alice + Campaign C = allowed

Bob + Campaign A = allowed
```

The World ID proof establishes the verified-human identity/uniqueness
signal.

The **application database/business rule** establishes the
campaign-specific uniqueness.

------------------------------------------------------------------------

# 4. Read the current IDKit documentation first

Before implementation, inspect the current official documentation for:

-   IDKit 4.x
-   Proof of Human
-   Orb-backed verification
-   `proofOfHuman`
-   RP signatures
-   `app_id`
-   `rp_id`
-   `action`
-   `signal`
-   `nonce`
-   `environment`
-   backend proof verification
-   uniqueness/nullifier handling
-   staging environment
-   World ID Simulator
-   verification failure/cancel flows

Pay particular attention to the current distinction between:

-   World ID 4.0 Proof of Human
-   legacy Orb flows
-   legacy `orbLegacy`
-   current `proofOfHuman`

Do not automatically use `orbLegacy` simply because an old example
contains it.

If the current documentation says that `proofOfHuman` is the correct
current preset and that it includes the appropriate Orb fallback/legacy
behavior, implement that current documented approach.

If the docs require a different approach for specifically testing an
Orb, follow the docs exactly and explain why.

------------------------------------------------------------------------

# 5. Technology

Use a simple modern stack:

-   Next.js
-   TypeScript
-   React
-   current stable IDKit 4.x packages documented by World
-   SQLite for the sandbox database
-   a lightweight ORM/query layer only if genuinely useful
-   Tailwind or simple CSS for UI

Keep the project intentionally small.

Do not introduce unnecessary infrastructure.

The purpose is to test World ID, not build a production application.

------------------------------------------------------------------------

# 6. Environment

The sandbox must use the **World ID staging environment** for testing.

Use the official World ID Simulator as described by the current
documentation.

Do NOT use production credentials or pretend that a simulated proof is a
production proof.

Create:

``` text
.env.example
```

with the exact environment variables required by the current
documentation.

At minimum, expect concepts such as:

``` env
WORLD_APP_ID=
WORLD_RP_ID=
RP_SIGNING_KEY=
WORLD_ENVIRONMENT=staging
```

But **do not blindly assume these are the exact required names or
values**. Confirm them against the current official documentation and
use the documented configuration.

Never expose the RP signing key to the browser.

Never put the signing key into client-side code.

------------------------------------------------------------------------

# 7. Core flow to implement

Build this complete flow:

``` text
Creator selects a campaign
        ↓
Clicks "Create Creator Link"
        ↓
Application checks whether this creator already has a link for this campaign
        ↓
If already linked:
    reject immediately
        ↓
Otherwise:
    request World ID Proof of Human
        ↓
World ID verification flow
        ↓
World ID returns proof
        ↓
Send proof to backend
        ↓
Backend verifies proof using official World verification endpoint/mechanism
        ↓
Backend establishes the verified-human identity according to current docs
        ↓
Backend checks:
    Has this verified human already created a link for this campaign?
        ↓
    YES → reject
    NO  → create creator link
        ↓
Show success
```

The important security point is:

**Do not trust a creator ID supplied by the browser as proof of
identity.**

The World verification result must be bound to the application-side
creator identity using the mechanism recommended by the current World ID
documentation.

If the docs recommend using a signal to bind a user identifier, campaign
context, wallet address, or another value, implement that correctly and
enforce the same value on the backend.

Do not invent your own security model if the docs provide one.

------------------------------------------------------------------------

# 8. Database model

Use SQLite.

Create a minimal schema along these conceptual lines, adapting
names/types to the implementation:

### campaigns

``` text
id
name
description
created_at
```

Seed at least:

``` text
Campaign A
Campaign B
Campaign C
```

### creators / verified humans

Store only what is actually required.

For example:

``` text
id
world_identity_reference
verified_at
```

If the current World ID documentation recommends storing a particular
nullifier representation or another identifier, follow the docs exactly.

Do NOT store raw biometric data.

Do NOT store personal identity information.

### creator_links

Conceptually:

``` text
id
campaign_id
creator_id
created_at
```

The critical database invariant is:

``` text
UNIQUE(campaign_id, creator_id)
```

This should be enforced at the database level, not only in frontend
JavaScript.

If the current World ID verification model means the stable identity
should be represented differently, adapt the schema while preserving the
same business invariant:

> one verified human can have at most one creator link for a given
> campaign.

------------------------------------------------------------------------

# 9. World ID action / signal design

This part is especially important.

Do NOT guess how World ID `action` and `signal` work.

Read the current documentation first.

Determine the correct design for:

-   `action`
-   `signal`
-   RP signature
-   campaign context
-   creator identity binding
-   nullifier/uniqueness handling

The application must correctly distinguish:

``` text
same human + same campaign
```

from:

``` text
same human + different campaign
```

Do not accidentally make the World ID configuration globally one-time if
that prevents the same verified creator from joining different
campaigns.

Likewise, do not weaken the proof by trusting a campaign ID or creator
ID that has not been cryptographically/contextually bound as recommended
by World.

Document the final design and why it satisfies:

``` text
one human → one link per campaign
one human → many campaigns
```

If there are multiple technically valid designs in the current docs,
choose the simplest one that preserves privacy and satisfies the rule,
and explain the choice.

------------------------------------------------------------------------

# 10. Required UI

Create a simple test dashboard.

It should make the World ID flow obvious.

Example:

## Header

``` text
Kawaipay × World ID
Proof of Human Sandbox
```

Subtitle:

``` text
Testing one-human-per-campaign creator participation
```

------------------------------------------------------------------------

## Campaign list

Show:

``` text
Campaign A
[Create Creator Link]

Campaign B
[Create Creator Link]

Campaign C
[Create Creator Link]
```

------------------------------------------------------------------------

## Verification status

Show:

``` text
World ID Status
○ Not verified
```

After successful verification:

``` text
✓ Proof of Human verified
```

Do not expose sensitive proof contents in the UI.

------------------------------------------------------------------------

## Creator links

Display created links like:

``` text
Your Creator Links

✓ Campaign A
  /c/alice-campaign-a

✓ Campaign B
  /c/alice-campaign-b
```

------------------------------------------------------------------------

# 11. Required test scenarios

The sandbox is NOT complete until all of these can be demonstrated.

## Test 1 --- First campaign participation

Use the World ID Simulator.

Verify Alice.

Create a link for Campaign A.

Expected:

``` text
SUCCESS
Creator link created for Campaign A
```

------------------------------------------------------------------------

## Test 2 --- Same human attempts Campaign A again

Alice attempts:

``` text
Campaign A → Create Creator Link
```

Expected:

``` text
REJECTED

You already have a creator link for this campaign.
One verified human can create only one creator link per campaign.
```

This is one of the most important tests.

------------------------------------------------------------------------

## Test 3 --- Same human joins Campaign B

Alice attempts:

``` text
Campaign B → Create Creator Link
```

Expected:

``` text
SUCCESS
Creator link created for Campaign B
```

This proves the system is NOT globally restricting the human to one
link.

------------------------------------------------------------------------

## Test 4 --- Same human joins Campaign C

Expected:

``` text
SUCCESS
```

------------------------------------------------------------------------

## Test 5 --- Different human joins Campaign A

Use a different World ID Simulator identity.

Bob joins Campaign A.

Expected:

``` text
SUCCESS
```

Therefore:

``` text
Alice + Campaign A → exists
Bob   + Campaign A → allowed
```

------------------------------------------------------------------------

## Test 6 --- Cancelled verification

Start World ID verification and cancel it.

Expected:

``` text
Verification cancelled.
No creator link was created.
```

The application must not create a creator link before successful backend
verification.

------------------------------------------------------------------------

## Test 7 --- Failed verification

If the simulator/current flow supports a failed/rejected verification
path, test it.

Expected:

``` text
Verification failed.
No creator link was created.
```

------------------------------------------------------------------------

## Test 8 --- Duplicate/replay protection

Test what happens when the same verified proof/result is submitted
again.

The backend must not create a second creator link.

Expected:

``` text
Rejected / already used / duplicate claim
```

Use the exact semantics recommended by current World ID documentation.

------------------------------------------------------------------------

# 12. Backend security requirements

Follow the current official IDKit docs exactly.

At minimum:

-   RP signatures must be generated server-side.
-   RP signing key must remain server-side.
-   Proofs must be verified server-side.
-   Do not trust frontend verification state.
-   Do not create a creator link until backend verification succeeds.
-   Enforce campaign uniqueness server-side.
-   Enforce campaign uniqueness at the database level.
-   Prevent duplicate submissions.
-   Validate the expected World ID environment.
-   Validate action/context according to the current docs.
-   Validate signal/context according to the current docs.
-   Store nullifiers/identity references exactly as recommended by the
    current docs.
-   Never log raw sensitive proof payloads unnecessarily.
-   Never store biometric data.

------------------------------------------------------------------------

# 13. API routes

Create clean backend endpoints.

Use the current documented architecture, but the sandbox will likely
need equivalents of:

``` text
POST /api/rp-signature
POST /api/verify-proof
POST /api/campaigns/:campaignId/create-link
GET  /api/campaigns
GET  /api/creator-links
```

Do not blindly implement these exact routes if the current architecture
makes a better structure.

The important thing is that the security-sensitive operations happen on
the backend.

------------------------------------------------------------------------

# 14. Verification endpoint

The current World documentation describes forwarding the complete IDKit
result to the World Developer verification endpoint.

Implement the current documented verification flow.

Do not:

-   manually decode or modify proof fields unnecessarily
-   invent a local cryptographic verifier
-   fake successful verification
-   hardcode successful responses
-   bypass the World Developer verification endpoint

If the current documentation has changed the endpoint or verification
SDK, use the current documented mechanism instead.

------------------------------------------------------------------------

# 15. Error handling

Make errors very visible during testing.

Examples:

``` text
World ID configuration missing

RP signature generation failed

World ID verification cancelled

World ID verification failed

Proof verification failed

Proof environment mismatch

Creator already has a link for this campaign

Duplicate verification

Campaign not found

Database constraint violation
```

Show user-friendly messages in the UI.

Also log useful server-side debugging information without exposing
secrets or unnecessary proof data.

------------------------------------------------------------------------

# 16. Developer/test mode

Because this is a sandbox, add a clear development status panel.

For example:

``` text
Environment: STAGING

World App ID: configured ✓
RP ID: configured ✓
RP signing key: configured ✓
World ID verification: ready ✓
Database: connected ✓
```

Do NOT display secret values.

If credentials are missing, tell me exactly what is missing and how to
configure it according to the official docs.

------------------------------------------------------------------------

# 17. README requirements

Create a complete README explaining:

## What this sandbox proves

Explain:

> Kawaipay uses World ID Proof of Human at the creator campaign
> participation step to prevent the same verified human from creating
> multiple creator links for the same seller campaign.

Also explicitly explain:

> The same verified human may participate in multiple different
> campaigns.

------------------------------------------------------------------------

## Architecture

Include a small diagram:

``` text
Creator
   ↓
World ID / Proof of Human
   ↓
Backend verification
   ↓
Verified human identity
   ↓
Campaign uniqueness check
   ↓
Creator Link
```

------------------------------------------------------------------------

## Why Proof of Human

Explain why PoH is the minimum sufficient credential.

------------------------------------------------------------------------

## World ID vs Kawaipay responsibility

Make this distinction explicit:

``` text
World ID:
"Is this a unique human?"

Kawaipay:
"Has this verified human already claimed a creator link for this campaign?"
```

------------------------------------------------------------------------

## Setup

Give exact steps:

1.  Install dependencies.
2.  Create World Developer Portal app.
3.  Obtain required `app_id`.
4.  Obtain required `rp_id`.
5.  Configure RP signing key.
6.  Configure `.env`.
7.  Start the application.
8.  Open the app.
9.  Use World ID Simulator.
10. Run all test scenarios.

All setup instructions must match the current official World
documentation.

------------------------------------------------------------------------

## Testing

Document every required test case and expected result.

------------------------------------------------------------------------

## Integration notes

Create:

``` text
KAWAIPAY_INTEGRATION.md
```

This should explain how the sandbox implementation can later be
transferred into the real Kawaipay architecture.

Include:

-   what files/components are reusable
-   what database concepts are reusable
-   what environment variables are required
-   what World ID backend logic is reusable
-   how campaign-scoped creator uniqueness maps to Kawaipay
-   what must be changed when moving from SQLite to the real backend
-   what must be changed when moving from staging to production
-   security considerations

------------------------------------------------------------------------

# 18. Important implementation constraints

### DO

-   Read the current official docs before coding.
-   Use the current IDKit 4.x API.
-   Prefer `proofOfHuman` if that is what the current docs specify.
-   Use the World ID Simulator/staging environment for testing.
-   Verify proofs on the backend.
-   Keep RP signing keys server-side.
-   Bind the proof to the correct application context.
-   Enforce `(campaign, verified human)` uniqueness.
-   Test both successful and unsuccessful flows.
-   Make the implementation genuinely functional.

### DO NOT

-   Use outdated Worldcoin tutorials as the primary source.
-   Assume old SDK APIs still work.
-   blindly use `orbLegacy` if current docs recommend `proofOfHuman`.
-   fake World ID verification.
-   hardcode a successful proof.
-   put secrets in frontend code.
-   make one verified human globally limited to one campaign.
-   let the browser decide whether verification succeeded.
-   rely only on frontend checks for duplicate campaigns.
-   store biometric information.
-   modify the actual Kawaipay codebase.

------------------------------------------------------------------------

# 19. Acceptance criteria

The sandbox is complete only if:

### World ID

-   [ ] Current IDKit 4.x is used.
-   [ ] Current Proof of Human flow is implemented.
-   [ ] Orb-backed verification can be tested through the supported
    current World flow / simulator.
-   [ ] RP signature is generated server-side.
-   [ ] RP signing key never reaches the browser.
-   [ ] Proof is verified server-side.
-   [ ] Staging environment works.
-   [ ] World ID Simulator can complete the flow.

### Kawaipay business rule

-   [ ] One human can create one link for Campaign A.
-   [ ] Same human cannot create a second link for Campaign A.
-   [ ] Same human can create a link for Campaign B.
-   [ ] Same human can create a link for Campaign C.
-   [ ] Different human can create a link for Campaign A.
-   [ ] Database enforces campaign-scoped uniqueness.
-   [ ] Cancelled verification creates no link.
-   [ ] Failed verification creates no link.
-   [ ] Duplicate/replayed verification cannot create another link.

### Documentation

-   [ ] README explains the architecture.
-   [ ] README explains World ID's role.
-   [ ] README explains the campaign-scoped uniqueness rule.
-   [ ] README contains setup instructions.
-   [ ] README contains test cases.
-   [ ] `KAWAIPAY_INTEGRATION.md` exists.
-   [ ] Any deviations from the current World docs are explicitly
    documented.

------------------------------------------------------------------------

# 20. Final instruction to Claude

Do not start by immediately writing code.

First:

1.  Read the current official World ID IDKit documentation.
2.  Identify the exact current API for Proof of Human.
3.  Identify the exact current Orb-related behavior and whether the
    current `proofOfHuman` preset is the correct route.
4.  Identify the current RP signature flow.
5.  Identify the current backend verification flow.
6.  Identify the current uniqueness/nullifier semantics.
7.  Decide how the campaign context and creator identity should be
    bound.
8.  Then implement the sandbox.

If something in this prompt conflicts with the current official World
documentation, **the official documentation wins**.

At the end, give me:

1.  A working sandbox.
2.  Exact setup instructions.
3.  Exact commands to run it.
4.  The test sequence I should follow in the World ID Simulator.
5.  A short explanation of how the implementation enforces:

``` text
ONE HUMAN
    ↓
MANY CAMPAIGNS
    ↓
BUT ONLY ONE CREATOR LINK
PER CAMPAIGN
```

6.  A short section called:

``` text
World ID Documentation Decisions
```

where you list the important implementation choices and cite/link the
exact official documentation pages that justified them.

Do not claim that the integration works until you have actually tested
the relevant flows locally.
