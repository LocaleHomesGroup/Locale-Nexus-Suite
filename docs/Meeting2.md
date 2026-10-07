# Meeting 2 - CRM Dash Sync Acceptance and Go Live (Operations Team)

**Date:** October 6, 2026 (Tuesday)
**Duration:** ~54 minutes
**Attendees:** Jerry Delos Santos (AI & Growth), Jan Kane Reroma (AI & Growth), Shannan Murray (Locale Homes, Workflow & Compliance), Alison Carter (Sales Operations), with Larnie Clark (Sales Operations Manager) in the room
**Recording:** 54 mins (no highlights), [Fathom call 848118663](https://fathom.video/calls/848118663)

---

## Summary

The call was meant to be acceptance and go-live for the CRM Dash Sync. **Go-live is held until
Shannan is back from three weeks' leave.** Alison and Shannan only got a short time to test.
Alison had been off all last week and spent Monday on inductions for four new reps. Shannan found
on Monday afternoon that the test environment had lost the attachments changes. Jerry said he had
pushed over the previous version, and that this is fixed now. Shannan did not want Alison and
Larnie carrying the go-live while they also cover her work: *"I don't want you to have to be
responsible for the hyper care of a deployment."* Alison agreed: *"I'd prefer you to be the one."*

**The live data migration goes ahead anyway.** Jerry and Kane will mirror the real Monday and
HubSpot data into Launchpad so the other modules, Sales and reporting first, can be built on real
data. Shannan was fine with that running in the background. Jerry then said *"we're not putting a
cut over because it's always syncing"*, meaning edits in any of the three systems flow to the
other two. That does not fit with a held go-live. See
[the go-live section](#go-live-held-until-shannan-returns-the-live-data-migration-continues).

Most of the call was Jerry demoing Launchpad across all its dashboards. He credited Kane for the
interface (*"It's not new... it's the same, but it's way better. And I'd like to thank Kane for
this"*) and introduced Kane to the Operations team as the person working with him on Launchpad.
The demo produced the following:

- **Sales view asks from Alison:** group My clients by builder, put every appointment in one place
  with a one-click outcome, and show the rep's week of appointments and forecast.
- **Rapid Costing is parked as its own project.** Shannan said it, together with ups and downs and
  HomeScope, touches *"everybody's money"*. She wants proper requirements, sign-off and testing
  when she is back. Jerry proposed rebuilding HomeScope inside Launchpad.
- **Any discount needs manager approval today.** Jerry's demo used a threshold. A policy session
  with Sean and the sales managers is needed.
- **Deal submissions need a validity period per document type.** An LOE that is too old has been
  rejected by builders.
- **Pipeline value cannot come from HubSpot's amount field.** That field is the build amount, not
  what Locale or the rep earns.
- **A Doc formatter and pricing test is booked for Friday October 9 at 12:00** with Alison and
  Larnie.

Alison also reported a bug: on job 99149 she could not send a contract upload to Monday (*"no
sub-item at job level"*). Jerry will check the log. The file-sync spec suggests a likely cause. See
[the bug section](#the-contract-upload-on-job-99149).

---

## The demo, dashboard by dashboard

Jerry walked the Switch view from Home through each dashboard. He said logins will be
**role-based** (RBAC): *"whoever logs in is based on his profile"*. For example, a salesperson
would not see Jobs in construction on Home.

| Dashboard / screen | What Jerry showed or said | Reaction |
|---|---|---|
| Operations › CRM Dash Sync | What Ops have been testing | Go-live held, see below |
| Operations › Inbound capture | Builders' Excel updates uploaded here. The builder portal scrape, which Andre built, lands here too: job updates and photos. Ops approve, then it syncs to the live data. Polled *"every five minutes... I even feel that's too much"* | No objection. Alison later wanted it used for per-builder reporting |
| Operations › Review queue | The four milestones that move money (*"slab down, plate height"*) go to a separate review, then *"this will create a Xero draft invoice for Aled to approve"* | Shannan: *"Awesome."* |
| Operations › Audit log, Submissions review | Logs every Dash Sync change. Submissions review is where Ops check deal submissions | See Deal submissions |
| Sales › Overview, Pipeline | A rep's own deals. HubSpot's saved filters will be built in so reps *"don't need to go to HubSpot and create their own filters"*. Mobile friendly | See Sales view |
| Sales › My clients | Won clients in pre-construction or construction, from Monday, with to-dos and job details | Alison: *"that pretty much mirrors what they would be seeing in"* HubSpot |
| Sales › My week | The rep's weekly forecast commitment, which feeds the manager's KPIs | Alison wants the week's appointments here too |
| Sales › Rapid Costing | Built from the spreadsheet. Uploads design guidelines (*"the LDP"*), and AI says what has to be included. Discount drives commission and approval | Parked, see Rapid Costing |
| Sales › Deal submissions | Required documents per builder (MOVE 10, Forma 10, La Vida 9, New Era 10 or 11, New Choice 12). Upload, review, submit for Ops review | See Deal submissions |
| Operations › Pricing, Doc formatter | Upload a builder price list (Forma's), extract it, edit, export Locale's price list, send a price change report to Sean, publish with versions. Variation price schedule and templates | Shannan: *"it's so good"*. Test booked Friday |
| Client portal | Kane's idea, which Jerry was *"a bit hesitant"* about at first. Every signed client gets a login and their own view of the build | Shannan: *"can you imagine for wealth, if they have this as an investment portfolio?"* |
| Developer portal | The builder's view. Jerry: *"it might be a long shot"* | Alison wants a per-builder overview, see Reporting |
| Employee portal | Daily hours, invoices (*"We send invoices offshore"*), history, profile and ID badge | Alison asked about Xero. See Employee portal |

Shannan's verdict on the whole demo: *"There's some really good, like, bones here for, like, what
we ultimately want."*

## Go-live held until Shannan returns, the live data migration continues

> **Jerry:** *"what I'll be doing together with Kane is we'll go ahead and move the or mirror the
> live data into Launchpad but we won't be using it not unless you guys would say let's go use it"*
>
> **Shannan:** *"if it goes live and you guys are working out how to deal with it... and also having
> to deal with what I'm going to assume is the very, very many, like, sync errors because of the
> mismatching data across the CRMs. I don't want to put that on you."*
>
> **Alison:** *"So if that's all right, Jerry, we can hold off going live with this data sync until
> Shannan's back."* **Jerry:** *"Sure."*

**Timing.** Alison said Shannan *"goes on leave next week for three weeks"*, and she flies out the
night of Friday October 9. Neither of them gave a return date. Expect early November at the
earliest.

**What carries on in the meantime.** Jerry: *"I'll continue with the live data migration so that we
can use that for the other modules because we need the data."* Shannan: *"that's fine if that's
going in the background as well so that it all gets tidied up and comes out in the wash."*

**The ambiguity to settle before the migration runs.** Jerry then described the migration as
always syncing in every direction:

> *"we're not putting a cut over because it's always syncing... even if you do Launchpad edits,
> it'll sync to Monday and HubSpot. If you edit HubSpot, it'll sync to Monday and Launchpad."*

The hold only means something if Launchpad is **not sending** to Monday and HubSpot while Shannan is
away. Shannan's own words (*"it's still going to update that data in there anyway"*) describe the
mirror reading in, not Launchpad writing out. The documented plan in
[OPERATIONS-DASHBOARD.md § 9, "The intended cutover"](OPERATIONS-DASHBOARD.md) is staged for this
reason. Production starts with sending off, then a watch mode with Jerry, Alison and Shannan going
through Sync health together. Monday is switched on next, and HubSpot the following day. **Not
decided on the call:** whether sending stays off during the hold. Read *"no cut over"* as Jerry's
description of the steady state, not as a decision to skip the staged switch-on.

## The contract upload on job 99149

> **Alison:** *"I'd gone through and I'd made sure that all the tasks up until signed contract were
> completed. And then I've selected the file type as contract. And then I've dropped in just a PDF...
> But then it wouldn't let me select Monday. Because it says no sub-item at job level."*

She then pressed the sync button because she couldn't tick Monday. A contract would normally land
on *"signed contracts or even contracts received... prelim contract documents"*. Jerry: *"there's a
log here so I can check this... this should be an easy fix."*

**Likely cause, unverified against the live build.** Jerry's
[File sync spec](../../Locale_Launchpad-main/docs/FILE-SYNC-SPEC.md) (v4, 15 September) routes each
file type to a milestone's subitem, not to the job:

| File type | Monday subitem | HubSpot |
|---|---|---|
| Contract | Contracts received | no |
| Signed Contract | Contracts signed | Attachments card |

A file uploaded from the **job-level** Files panel has no subitem to land on, which matches the
message Alison saw. Two things to check in the log:

1. **She uploaded from the job level rather than from the milestone.** In the local copy of Jerry's
   repo, the job-level panel only offers Titles (`src/app/jobs/[id]/job-files.tsx`, lines 180 to
   199). Alison's build offered Contract there with a Monday option, and the exact message *"no
   sub-item at job level"* is not in the local copy. **The live build is newer than the local
   copy**, so this is a reading of the spec, not of the code she ran.
2. **She chose "Contract", not "Signed Contract",** on a job already past signed contract. Contract
   goes to Contracts received and never to HubSpot. If the file was the signed contract, that type
   choice also matters.

**Job number:** Alison first said *"99419"*, then Jerry read it back as *"99149"* and she
confirmed *"99"* and *"149"*. Recorded as **99149**, with 99419 as the other reading.

## Sales view: clients by builder, appointment outcomes, and the week

Alison is moving into sales (Jerry: *"Especially you, Ali, because you're going to be in sales"*),
and she gave the sales asks:

- **Group My clients by builder.** *"it would be great if for this page where they could see their
  clients in pre-construction, construction that can be grouped by builder."* Jerry: *"That's a
  really great idea."*
- **Appointment outcomes from one place.** This is the biggest pain:
  > *"for a rep to update a meeting outcome, so whether or not the client attended, whether they
  > cancelled, whether it was a no-show, whether they rescheduled, it's about five or six clicks to
  > try to find that meeting... So most of the reps just don't do it."*

  She wants every upcoming appointment in one list, with an outcome drop-down: attended or held,
  scheduled, cancelled, no-show, rescheduled. Jerry: *"the data is just from HubSpot, but we can
  customise this."*
- **My week shows the week's appointments** as well as the forecast.
- **Split of sources.** Jerry framed it as Pipeline = HubSpot, My clients = Monday. Alison:
  *"Exactly."*

**HubSpot stays for sales, for now.** Kane asked how a parallel run would end with Launchpad as
the source of truth, and whether HubSpot is tied to external portals.
> **Alison:** *"At the moment, the sales team only use HubSpot for tracking their clients from
> inquiry through to actually signing them up. So I'm not sure if we would move away from HubSpot
> for that purpose."*

She walked through that path. An inquiry arrives as a HubSpot contact, with its source data (ads
clicked, site views). The rep moves the lead status through trying to contact and contacted. A
booked appointment turns the contact into a deal, which then runs through appointments to signing.
**Provisional, not a decision:** sales keeps HubSpot for inquiry to signing, and Launchpad reads
it. Jerry moved the detail to a separate session with Alison, Shannan and Kane: *"what I'm trying to
just show right now is the bigger picture."*

## Rapid Costing, discounts, ups and downs: parked as its own project

**Discount approval.** Jerry's demo had a threshold. Above it, a discount needs a company
contribution and so a manager's approval. In his worked example, $6,000 was split half from the rep
and half from the company. He asked *"Is my logic correct?"*
> **Alison:** *"Pretty much any discount at the moment would need manager approval... we're still
> getting the sales managers to sign off on every single sort of up and down sheet we have, whether
> there's a giveaway or not."* Then: *"we might have to sit around with Sean and the managers and
> work out something for that."*

**Variations are missing,** and the screen is closer to ups and downs than to the rapid. Alison
asked where the variations a rep enters in the rapid would go. Shannan: *"this is replicating like
[ups and] downs more than it is the rapid pricing."*

**Shannan's case for treating it separately:**
> *"with the changes that we're making to HomeScope, because we were planning on discontinuing the
> use of the rapid anyway, at what point do we say the rapid's done, we trust what's in HomeScope?"*
>
> *"I just had one recently where a $6,000 discount was given post the compliance process. And
> because I never got told, the system never got updated with it."*
>
> *"right now when we're talking about say like the Dash Sync... the worst thing that kind of
> happens is I just revert back to using the CRMs as I currently do. Whereas the worst thing that
> happens if we roll out something like this is that everybody's money gets messed up."*

She had already sent Jerry a preliminary plan for ups and downs, built on a log of manual cost
changes made in HomeScope. She will write proper requirements when she is back. She wants scope,
sign-off and testing by several SMEs: *"I don't want to half make it."*

**Jerry's proposal: rebuild HomeScope in Launchpad.** HomeScope *"is built through AWS. It's kind
of old school... it's not secure and then it doesn't have our branding."* In Launchpad, quotes
would produce their PDF on the spot, and costing would be built in, *"and then we'll get rid of the
rapid costing."* **Parked:** *"Let's put that in another, probably, next quarter. Or hopefully
within the year."*

## Deal submissions: validity periods per document

The rep picks the builder, uploads that builder's mandatory documents and submits. Ops verify each
document in Submissions review. The documents include the signed PPA, sketch, Rapid Costing tool,
O&A (offer and acceptance for the land contract) and title or anticipated title date. There are
automated checks: file name convention, buyer name against the deal, signature on the final page,
dated within validity period. Approval generates the form.

**The validity period differs by document**, and nobody has set the periods yet:
> **Alison:** *"It depends on the document, really, like an LOE, for example. I think we've got, it
> has to be within three months."*
>
> **Shannan:** *"Genuinely, I don't even check the date on an LOE, other than if it's a re-sign."*
>
> **Alison:** *"I usually do, because I've had builders come back to them before and go, this LOE is
> way outdated, and with... interest rates going up... this may no longer be valid."* And *"even with
> deposit receipts, they could have paid us an engagement fee four months ago."*

Ops do not apply this check the same way today: Alison checks LOE dates and Shannan does not.
Jerry: *"We can add that."* **Owed:** a period for each document type, set with Alison.

**SharePoint, an idea only.** After approval, Launchpad could save the documents straight to the
builder's SharePoint, *"after you guys have reviewed it."* No one agreed or declined.

**Testing while Shannan is away.** Alison: *"deal submissions is definitely a one for us... Larnie
and I can help start doing some testing and overview, but I would want Shannan to have a full
overview and be able to test as thoroughly as possible once she gets back."*

## Pricing and Doc formatter: test on Friday October 9

Jerry said the Doc formatter is *"like 90% done"*. Upload a builder price list. It extracts the
designs and base prices, flags gaps (*"Allowance... not found"*) and shows what changed since the
last version. Downloading gives Locale's price list. Publishing keeps versions. A price change
report goes to Sean in one click.

- **Reps need to see the published price list,** so Pricing belongs in Sales as well. Alison
  confirmed reps need it once the changes are done.
- **Teams notification on publish.** Alison asked whether this moves it out of Teams. Jerry: *"we
  can still simultaneously do it in Teams... Like once you submit, it can message directly in
  Teams."* Shannan: *"not having to update it in multiple different places... and then also just a
  notification going out to the reps rather than like compiling it... if it does it for you, that's
  so good."*
- **Renamed designs need templates.** Alison: *"We've got three builders that we changed their
  design names. So if we ever get a new design from any of those builders, we need to actually give
  them a new name."* Jerry will make templates for them. **The three builders were not named.**

**Test session:** Friday October 9, 12:00, with Jerry, Alison and Larnie. Alison was free from 11:30
and Jerry proposed 12. Shannan has been doing the pricing lately and was fine with Alison and Larnie
taking it. *"I need to make sure I get everything like tidied up so that you guys aren't inheriting
a huge mess while I go."* Alison is not sure some prices are being captured properly: *"there were
things I wasn't really sure of that were being captured properly there."* **The time zone was not
said,** most likely Perth time.

## Reporting: a per-builder view and pipeline value

**Per-builder overview.** Alison suggested it from the Developer portal:
> *"even for us to be able to capture everything that's happening with one builder in the page... we
> can just go into this and go, cool, we've got 87 clients in pre-construction with Forma, we've got
> 75 in construction, we've got this many waiting formal finance."*

The figures were illustrative. Jerry would put it under Operations reporting, fed by HubSpot and
Inbound capture. Alison wants management to have it too: *"Are we going to have a management
section?"*

**Pipeline value is wrong if it comes from HubSpot's amount field:**
> **Alison:** *"that's not really our active pipeline value because the build amount is not what we
> get or what the sales rep gets... We'd almost need to do a calculation based on how many deals the
> rep have... times their commission amount... For us as a leadership team... we would need to
> times however many deals by our commission amount that we have with the building companies."*

There are two figures: a rep's pipeline (their deals × the rep's commission) and Locale's pipeline
(deals × Locale's commission from the builder). Jerry asked whether ups and downs affect it, and
Alison said yes: *"whatever the commissions is, it would have to affect any ups and downs as well."*
Jerry needs the calculations: *"I need the logic behind it, like the calculations."*

Jerry's next priority after the migration: *"the dashboards, reporting dashboards for leadership
management and the KPIs to be put here in Launchpad and at the same time, deal submissions,
hopefully."*

## Employee portal: invoices, Xero and notifications

Alison asked whether a rep who invoices from their own Xero could link it. Jerry said yes and no:
Xero has APIs, but linking every rep's own account *"is going to be a lot"*. Alison doesn't need
the link itself. She wants the rep to see where their invoice is:
> *"sometimes it doesn't [get paid], because maybe there might be back and forth confirming it up
> and down, but there's been no correspondence. So the rep doesn't get paid... if there's a way even
> like the rep could get a notification going, your invoice has been received, your invoice has been
> approved."*

Jerry pointed to Accounting's Pay run, where invoices arrive at the Invoices step and Aled
approves. Kane added a notification when a bonus or commission is added. Jerry: *"your commission
has been added. You should receive it on your next invoice."* Kane had also suggested an admin
page that manages the third-party connections (Xero, the builder portals) in one place. That was
not taken up.

## Marketing and lead response time

Jerry will talk to Kellie in Marketing about lead routing. Alison described how it works today:
paid-ads leads go into HubSpot, and a workflow assigns them to whoever the sales managers have put
*"on inquiry"* for that day.

Shannan wants the response time on fresh inquiries tracked. HubSpot only gives an average:
> **Alison:** *"if they've had one client that they missed and it took them three days, then their
> average is going to blow out... I don't think they've ever really run a report that's been like
> individually."*

Jerry: it goes in the sales manager view, *"updated real time"*.

## Kane's suggestion: a Global Master List for clients and builders

> **Kane:** *"similar to Global Master List for employees, we might want to have a Global Master List
> for clients and builders. So we can set them up."* **Jerry:** *"Yep. I got that. I have that list
> again."*

It came up during the renamed-designs template discussion. Jerry has the list, and nobody set a
date.

---

## Decisions Made

1. **The CRM Dash Sync does not go live until Shannan is back** from three weeks' leave. She leaves
   after Friday October 9. Proposed by Shannan, agreed by Alison and Jerry.
2. **The live Monday and HubSpot data migration into Launchpad continues during the hold,** so the
   other modules can be built on real data. Shannan agreed.
3. **Rapid Costing, ups and downs, and the HomeScope rebuild are one separate project, parked**
   until next quarter (*"hopefully within the year"*). Shannan writes requirements when she is
   back. It needs formal scope, sign-off and multi-SME testing before release.
4. **Doc formatter and pricing test: Friday October 9, 12:00,** with Jerry, Alison and Larnie.
5. **Alison and Larnie test Deal submissions while Shannan is away,** and Shannan does the full test
   when she is back.

**Not decided:**

- Whether Launchpad's sending to Monday and HubSpot stays off during the hold.
- The discount approval policy.
- The validity period for each document type.
- The pipeline value formula.
- Whether HubSpot ever stops being the sales system.
- Whether to link reps' own Xero accounts.
- The SharePoint auto-upload.
- Which three builders need renamed-design templates.

## Action Items / Next Steps

Owners were mostly not named on the call. Where Jerry said *"we"* about Launchpad build work, the
row is Jerry and Kane, because Jerry introduced Kane as working with him on it. Kane to correct
any of these.

| # | Owner | Action | Status |
|---|---|---|---|
| 1 | Jerry, Kane | Mirror live Monday and HubSpot data into Launchpad for the other modules. Do not go live with Dash Sync until Shannan is back (Fathom) | Open. Settle first whether sending stays off, see the go-live section |
| 2 | Jerry | Check the log for Alison's contract upload on job 99149 (Monday not selectable, *"no sub-item at job level"*) and report back to her (Fathom) | Open. Likely cause in the bug section |
| 3 | Jerry | Doc formatter and pricing test with Alison and Larnie (Fathom) | **Scheduled: Friday October 9, 12:00** |
| 4 | Alison, Larnie | Test Deal submissions while Shannan is away | Open |
| 5 | Shannan | Test the Dash Sync after this call. Own the go-live review when back | Open until October 9, then Blocked (away) |
| 6 | Jerry, Kane | Sales view: My clients grouped by builder; all appointments in one list with an outcome drop-down; My week shows the week's appointments beside the forecast (Fathom) | Open |
| 7 | Jerry | Book a detailed sales-view session with Alison, Shannan and Kane (Fathom) | Open, undated |
| 8 | Alison or Jerry | Discount approval policy session with Sean O'Neill and the sales managers (Fathom). Alison raised it, and nobody was named to book it | Open, undated |
| 9 | Shannan | Requirements for the Rapid Costing replacement, ups and downs, and the HomeScope rebuild | Parked to next quarter. Blocked (away) |
| 10 | Jerry, Alison | Set a validity period for each submission document type (LOE about 3 months per Alison; deposit receipts). Add the automated checks (Fathom) | Open |
| 11 | Jerry | Save approved submission documents to the builder's SharePoint (Fathom) | Idea only, not agreed |
| 12 | Jerry | Teams message to reps when pricing is published. Show published pricing in Sales (Fathom) | Open |
| 13 | Jerry | Doc formatter templates for the three builders whose design names Locale renames (Fathom) | Open. Alison to name the three builders |
| 14 | Jerry, Kane, Alison | Pipeline value logic (rep: deals × rep commission; Locale: deals × builder commission; both net of ups and downs). Then management and operations reporting, including a per-builder overview (Fathom) | Open. Blocked on Alison's formula |
| 15 | Kane | Employee portal: notify the rep when their invoice is received and approved, and when a commission or bonus is added (Fathom) | Open |
| 16 | Jerry | Talk to Kellie (Marketing) about lead routing (Fathom) | Open |
| 17 | Jerry, Kane | Live lead response time for each rep (not an average) in the sales manager view (Fathom) | Open |
| 18 | Jerry | Global Master List for clients and builders, from the list Jerry has | Open, undated |

---

## Verification

**Checked the same day, against this repo and the local copy of Jerry's repo
(`Desktop/Locale_Launchpad-main`):**

- *"no sub-item at job level"*: **The local copy does not contain this message.** File sync v4
  routes Contract to Contracts received and Signed Contract to Contracts signed, and the local
  job-level panel only offers Titles. The live build Alison tested is newer, so the cause above is
  likely, not confirmed.
- *"there won't be any manual thing anymore"* and *"always syncing"*: these describe the goal. The
  documented go-live is staged, with sending off first
  ([OPERATIONS-DASHBOARD.md § 9](OPERATIONS-DASHBOARD.md)). Nothing in this repo shows sending is
  on in production.
- The client portal as Kane's idea: **true.** It is `/client` in this repo.
- The employee ID badge Jerry looked for: **it exists** (`IdBadge` in
  [EmployeeProfile.tsx](../src/components/modules/employee/EmployeeProfile.tsx)).
- Invoices arriving at Pay run's Invoices step: **true in the prototype** (Accounting › Pay run:
  Rate, Invoices, Validation, Dispatch). There are no received or approved notifications to the
  rep yet.

**Not verifiable from here:**

- The builder portal scrape polling every five minutes. Andre's scraper is not in either repo.
- That the attachments regression in the test environment is fixed.
- Shannan's return date.
- That HubSpot has no external portal dependencies. Kane asked, and Alison answered only about
  sales use.

---

## Reference Notes

### Transcription artifacts

| As transcribed | Actually |
|---|---|
| *"ALED"*, *"A-Lit"* | **Aled** (Aled Smith, Company Accountant in the org seed), who approves draft invoices and staff invoices |
| *"I think it was Ailid. I think was you, Ali"* | Aled or Ali (Alison); Jerry wasn't sure himself. Ambiguous |
| *"zero draft invoice"*, *"their own zero"* | **Xero** |
| *"Hopspot"* | **HubSpot** |
| *"club down"*, *"slap down"* | **slab down** (a milestone) |
| *"fetched by the parlor"* | fetched by the **portal** (the builder portal scrape) |
| *"Don't For Matter"*, *"Not for matter"*, *"For your formatter"* | **Doc formatter** |
| *"Builder Priceless"*, *"Home Builder Priceless"* | **price list** |
| *"former product list"*, *"the former"* | **Forma** (the builder) |
| *"rapid casting tool"* | **Rapid Costing tool** |
| *"replicating like something down"* | Read as **ups and downs**. Partly garbled |
| *"PBA Path, Sign, Sketch"* | The **signed PPA** and sketch. Jerry later reads *"Signed PPA"* off the screen |
| *"O&A"* | **Offer and acceptance** for the land contract (Shannan explained it on the call) |
| *"the Vita"*, *"LaVita"* | **La Vida**. This repo spells it *Levita* in `operations/submissions/data.ts` and *La Vida* everywhere else. See below |
| *"New Era, L10"* | New Era's document count, probably **10** or 11. Unclear |
| *"stink errors"* | **sync errors** |
| *"serums"* | **CRMs** |
| *"unconstruction"* | **in construction** |
| *"Arnie"*, *"Larnie"* | **Larnie** (Larnie Clark) |
| *"Kelly"* | **Kellie** (Kellie Rowe, Marketing Lead in the prototype seed). Spelling unconfirmed |
| *"Sean"*, *"Shane"* | **Sean** (Sean O'Neill, Head of Sales). *"Shane"* at 34:48 is probably Sean too |
| *"Yas"*, *"Yasmin"* | Yasmin, whose file the price list is based on. Probably Yasmin Georgiadis; unconfirmed |
| *"Let's say I'm Oumi"* | **Oumi Kapila**, a rep in the Locale Homes Sales team (`TEAMS` in `sales/data.ts`) |
| *"Fathom doesn't have a sub-item"*, *"Sab..."* | Garbled. Jerry checking whether the Monday item has a sub-item |
| *"I Cheney The sales manager is allocated"* | Garbled. The sales manager allocates whoever is *"on inquiry"* that day |
| *"99419"* then *"99149"* | Job **99149**, see the bug section |
| *"the LDP"* | Read as **Local Development Plan**, alongside the design guidelines. Unconfirmed |
| *"long-awaited seven-year"* | Small talk about Shannan's leave. Garbled |

**Speaker mis-attribution:** at 34:48, Fathom gives Jerry the line *"Ali, this is the very first
thing that I promised Shane I'd be able to do in Power BI when I first started."* The content
(Power BI, *"when I first started"*) fits Shannan better, and her reply follows straight after.
Treat the speaker as uncertain.

### Fathom action items, resolved

| Fathom | Owner | Row |
|---|---|---|
| [Update Sales view: group clients by builder; add appointment outcomes; add My Week forecast/appointments](https://fathom.video/calls/848118663?timestamp=589.9999) | Jerry, Kane | 6 |
| [Schedule granular sales-view session w/ Ali, Shannan, Kane](https://fathom.video/calls/848118663?timestamp=876.9999) | Jerry | 7 |
| [Schedule discount-approval policy session w/ Sean + sales managers](https://fathom.video/calls/848118663?timestamp=1089.9999) | Alison or Jerry | 8 |
| [Define doc validity periods w/ Ali; add automated checks](https://fathom.video/calls/848118663?timestamp=1477.9999) | Jerry, Alison | 10 |
| [Add SharePoint auto-upload post-approval](https://fathom.video/calls/848118663?timestamp=1573.9999) | Jerry | 11 (idea only) |
| [Implement Teams notifications for pricing publish](https://fathom.video/calls/848118663?timestamp=1769.9999) | Jerry | 12 |
| [Create templates for builders w/ renamed designs](https://fathom.video/calls/848118663?timestamp=1835.9999) | Jerry | 13 |
| [Define pipeline-value logic w/ Ali; implement management reporting](https://fathom.video/calls/848118663?timestamp=2304.9999) | Jerry, Kane, Alison | 14 |
| [Implement payroll invoice notifications (received/approved)](https://fathom.video/calls/848118663?timestamp=2553.9999) | Kane | 15 |
| [Schedule marketing/lead-routing sync w/ Kelly](https://fathom.video/calls/848118663?timestamp=2594.9999) | Jerry | 16 |
| [Implement real-time lead-response-time tracking in manager view](https://fathom.video/calls/848118663?timestamp=2677.9999) | Jerry, Kane | 17 |
| [Schedule doc formatter/pricing test w/ Ali + Larnie, Oct 9 12:00](https://fathom.video/calls/848118663?timestamp=2785.9999) | Jerry | 3 |
| [Investigate Monday sub-item bug for contracts; report back to Ali](https://fathom.video/calls/848118663?timestamp=2852.9999) | Jerry | 2 |
| [Migrate live Monday + HubSpot data to Launchpad; hold go-live until Shannan returns](https://fathom.video/calls/848118663?timestamp=2990.9999) | Jerry, Kane | 1 |

Fathom listed the last item twice. Rows 4, 5, 9 and 18 came from the conversation, not from
Fathom.

### What this call means for this prototype (proposed, not applied)

This repo is the static prototype Jerry demoed from, so the call contradicts some of what it shows.
Nothing below has been changed. Each needs Kane's go-ahead, and several wait on a session above.

1. **Sales › Rapid Costing's discount rule is wrong for today.** `DISCOUNT_APPROVAL_THRESHOLD = 5000`
   ([sales/costing/data.ts:52](../src/components/modules/sales/costing/data.ts)) only asks for
   approval above $5,000. Alison says every discount needs a manager's sign-off today. Leave it until
   the Sean session (row 8). The screen is also parked as part of the HomeScope project.
2. **Sales' Pipeline value sums build amounts,** the figure Alison said is not pipeline value.
   `openPipelineK` sums each deal's value
   ([sales/data.ts:267](../src/components/modules/sales/data.ts)). Leadership already labels its
   pipeline KPI *"commission basis"* ([leadership/data.ts:92](../src/components/modules/leadership/data.ts)),
   so the two dashboards disagree. Wait for Alison's formula (row 14).
3. **Sales › My clients shows the builder on each card but does not group by builder**
   ([sales/clients/MyClients.tsx:56](../src/components/modules/sales/clients/MyClients.tsx)). Row 6.
4. **Appointment outcomes are not in Sales anywhere.** Row 6.
5. **Submissions has one generic "Dated within validity period" check**
   ([operations/submissions/data.ts:96](../src/components/modules/operations/submissions/data.ts)),
   with no period per document type. Row 10.
6. **Pricing has no Teams notification on publish.** Row 12.
7. **Employee › Invoices has statuses but no notifications** when an invoice is received or
   approved. Row 15.
8. **The builder is spelled two ways in the seed data:** *Levita* in `operations/submissions/data.ts`
   and *La Vida* in every other module. Pick one.
9. **Shannan's name differs in the seed data:** the org chart has *Shannan Murray* (matches Fathom).
   `EMPLOYEES` and the rail persona have *Shannan Hart*. The persona may be fictional on purpose.
   Ask before renaming.

If the Tickets dashboard in
[the 2026-10-06 spec](superpowers/specs/2026-10-06-tickets-dashboard-design.md) gets built, items 1
to 8 and rows 6 and 10 to 17 are candidate tickets. Its *"Field matrix session w/ Shannan"* seed
ticket is now blocked until she is back.

### Continuity

- **Before this call:** [Meeting1](Meeting1.md), Kane's first-week call (raw transcript, untitled
  speakers). Kane described a **parallel run**: *"we have her current system running and we will
  have parallel running... Until... We are no longer dependent on HubSpot."* On this call Alison
  said sales is not moving off HubSpot for inquiry to signing. The parallel run applies to Ops, not
  to sales.
- **Meeting1 also set up row 15.** Kane offered to automate contractor pay, and the call discussed
  paying contractors more often than monthly once the accountant has more time. Invoice status
  notifications follow from that.
- **Coming up:** the Doc formatter and pricing test on Friday October 9. Shannan's last day before
  leave is the same day. The go-live review and the Rapid Costing requirements both wait for her
  return.

### Small talk

The call opened on Shannan's coming leave (*"Oh, I am so ready. I need it."*). Near the end, Shannan
on Jerry: *"I've found that you have, like, a really natural intuition for the things that are
needed, even if you don't necessarily understand the details yet... it's a unique skill, for
sure."* Jerry is *"on my fourth month"* and still learning the process: *"the team and I would also
love to be able to really understand deeply the process."* Alison's sign-off: *"You're doing a
great job."*
