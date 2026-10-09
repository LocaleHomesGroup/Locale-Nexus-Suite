# Meeting 4 - Doc Formatter and Monthly Builder Pricing (Sales Operations)

**Date:** October 9, 2026 (Friday)
**Duration:** ~48 minutes
**Attendees:** Jerry Delos Santos (Head of AI & Growth Systems), Jan Kane Reroma (AI Engineer), Andre Serra (AI Engineer), Larnie Clark (Sales Operations Manager) and Alison Carter (Sales Operations), who shared one device in the office
**Recording:** 48 mins (no highlights). The paste had no Fathom link and no action items.

---

## Summary

**Ops showed the monthly pricing update, and it is three manual copies of the same numbers.**
Builders send a new PDF price list around the end of each month, each with its own branding and
layout. Larnie and Alison then copy the prices by hand into three places: a Locale-branded price
list, the Rapid Costing tool, and the Monday boards behind HomeScope. They also email Sean the
month-on-month differences. The office: *"The amount of manual work that goes into this is
unbelievable."* Last month a new design was not copied across properly, and a rep's quick costing
came out *"$17,000 out."*

**Ops endorsed the Doc formatter.** Jerry showed the flow: upload the builder's PDF, check what was
extracted, fix anything it missed, download Locale's list, send Sean the change report in one
click, then publish to the Monday Models board, Rapid costing and the branded PDF, with a Teams
notice. A person still reviews every list. Asked if the idea sounded good, the office said
*"Absolutely."*

**Commission gets a tick box.** Most builders' prices already include Locale's commission. Three
builders' do not, and Ops add it by formula today. Agreed on the call: a *"Commission included"*
box, ticked by default. Unticking it opens a field for the amount to add, because a builder
sometimes includes only part of the commission.

**HomeScope's catalogue moves off Monday into Launchpad.** Ops agreed that Kane builds HomeScope in
Launchpad. Jerry then asked for the catalogue behind it (builders, models, spec ranges, elevations,
colour schemes, pictures, prices) to live in Launchpad too, *"so that we won't be using Monday
anymore."* The office suggested *"a separate section under the operations part of Launchpad...
HomeScope pricing or something like that."* The Doc formatter would then update that catalogue
directly: *"there won't be any transfers anymore."* Jerry will give Kane access to the HomeScope
boards in Monday.

Also from the call:

- **Rapid Costing is for the builder, HomeScope is for the client.** The office explained why the
  Rapid Costing tool exists. The client's quote can be adjusted without itemising, and the Rapid
  Costing tool breaks every adjustment down so the builder can see what was applied. They asked
  whether Launchpad could report each cost as up or down against the builder's price list.
- **Reps want to compare builders quickly.** Ops have merged every Rapid Costing tool into one
  *Builder Comparison Tool* with a summary tab. They asked whether Launchpad could do the same.
  Jerry: *"Absolutely."* Whether that is a budget filter in HomeScope or its own view was left for
  Jerry, Kane and Andre to talk through after the call.
- **Kane's idea to record rep and client meetings was not taken up.** First and second appointments
  are mostly face to face in the office, and asking to record could hurt rapport.
- **The office Wi-Fi is being replaced.** Alison did the physical install (gateway, switch, three
  access points) because the contractor didn't come. Pablo is configuring it. Mid-call the office
  moved onto the new *Locale Staff* network to test it.

---

## The monthly pricing update today

The office shared a screen and walked through it from the Pricing folder in Teams.

1. **Locale's branded price list.** Yasmin's spreadsheet in Pricing › Builder Docs has a tab per
   builder. Ops export the builder's PDF to Excel and paste the prices into that builder's tab.
   The tab compares this month against last month and shows any price changes at the side. Ops
   check it line by line: *"make sure that there's no new designs or designs that have been
   deleted, make sure we've got the designs in the right order."* That feeds a branded tab, which
   is saved as a PDF to the Sales team channel. *"It takes away their branding and we just have
   like a generic looking price list for each builder."*
2. **The Rapid Costing tool.** Ops copy last month's Rapid Costing template in the Teams channel,
   unhide its costing tab, paste the builder's prices in, and save it as Excel in the same folder.
   *"This is just for the sales team only to be able to do the pricing."*
3. **HomeScope's back end in Monday.** Ops export the Models board to Excel, paste the builder's
   prices into that format, then re-import it into Monday (*"import models"*). HomeScope reads its
   prices from there.
4. **The price difference to Sean.** Jerry prompted this one. A section of the spreadsheet lists how
   much each design changed month on month, and Ops email it to Sean from Outlook. One builder had
   designs go up by $18,000 in a month: *"this is really crucial to Sean. So he's aware of how much
   our builders are increasing our pricing by."*

**Move Homes skips step 1.** *"their price list is pretty much perfect, and we don't need to make any
changes. So, we just save their prices straight to the Teams channel."* Steps 2 to 4 still apply.

**One or two builders also need commission added** before the list goes out. See
[Commission](#commission-a-tick-box-and-an-amount).

**The cost of doing it by hand:**
> *"I even made a mistake last month when I did the September pricing. We had a new design and I
> thought I'd added it in, copied the pricing across, and I hadn't copied it across properly. And
> in the [Rapid] Costing tool, one of the reps did a quick costing up and that was $17,000 out...
> So I'd like to avoid ever doing that again."*

Jerry: *"by capturing it from the builder themselves, I think we can capture it correctly. But of
course, there's still a human intervention, like a human review."*

## The Doc formatter, as Jerry showed it

Jerry shared his screen. The flow matches Operations › Doc formatter in this prototype (see
[Verification](#verification)).

> **Jerry:** *"all you need to do is just upload the builder pricing here, the PDF, right, and then
> start. It'll format. You don't need to convert it into Excel, then copy and paste. It'll format
> itself like an OCR, and then you will get the extracted fields here."*

- **Templates.** The Builder Price List template is Yasmin's spreadsheet.
- **Review.** Fields that look wrong are flagged. Jerry typed a negative value to show it. *"if it
  did not capture any line item from our price list, we'll have to manually input it."* The office
  added: *"it'll either be if it sees something that it doesn't recognize or if wording doesn't
  match up a hundred percent."*
- **Site costs stay apart from base prices.** The office spotted site costs in the preview:
  *"usually we wouldn't combine our site cost pricing with the base prices."* Jerry said it was
  just an example.
- **Confirm and download**, then the price changes against last month.
- **Send report** emails Sean directly, in the same format as the spreadsheet: *"So you don't need to
  go to Outlook."*
- **Publish** goes to the Monday Models board, the branded PDF and Rapid costing: *"It'll update the
  Monday board, it'll update rapid costing, and it will also inform them on Teams that a new
  pricing is updated."*

Jerry on the review step: *"So you still got like a review stage, right? But just reviewing it, and
then click and click."*

**Who builds it.** Jerry: *"the granular details, it'll be worked on by Andre for Kane."* Read with
[Meeting3](Meeting3.md): Andre owns the Doc formatter, and Kane fits it into the Launchpad UI.

## Commission: a tick box and an amount

Larnie raised it:
> *"is there a way of basically recognizing, depending on what builder we're importing, whether
> the, like, our margin or the marketing fee is inclusive or not inclusive. I'm just mindful if...
> someone new comes in and they don't realize that the costing they're receiving isn't inclusive of
> a marketing fee and then it goes straight across."*

> **Office:** *"for our main builders, the prices they send us are already inclusive of our
> commission and we don't have to... change any of their pricing at all. But then there's some
> builders, which are the three that I mentioned, they send us their standard prices and we have
> to add our commission to that before we release the pricing to the sales team."*

They showed the Select Living tab in the spreadsheet, which has an *"add commission"* section with a
formula, and the price list pulls from the added figure.

**The three builders are Select Living, Redink SW and SW1.** The transcript garbles them (*"Select
Reddick Southwest and Southwest One"*). The names were checked the same day against the Builders
board in Monday's HomeScope workspace, which lists exactly these three beside the six others. See
[Transcription artifacts](#transcription-artifacts).

> **Kane:** *"Is a tick box where it's add or not add? Or is it inclusive or not yet inclusive?...
> would you know that beforehand or does the builder inform you?"*
>
> **Office:** *"we know as soon as we get their pricing whether or not the builders got commission
> included or not."* **Kane:** *"That's doable."*
>
> **Jerry:** *"So we'll just add a tick box commission included or not... Well the default should
> be commission is included right?"*

**Partial commission.** The office raised a longer-term case. A builder has in the past included
part of Locale's commission in its prices, so Ops only add the difference:
> *"whether there's a way we can specify exactly how much commission we're adding as well. So maybe
> if we tick that box it comes up with a field and then we enter the commission field... whether
> it's our full commission, half commission, whatever else."* **Jerry:** *"Awesome. Perfect."*

## Rapid Costing is for the builder

Jerry asked what Rapid Costing is for, since Kane's plan folds it into HomeScope. The office
explained:

> *"the reason why we created the Rapid Costing tool was because we could adjust Builder's pricing
> when we quote the client up, but we obviously don't itemize it."*

Two examples:

- **A contingency on the base price,** *"just in case we've missed something like some sort of
  compliance check... so then when it goes to the builder, if they need to add on further pricing,
  we don't have to ask the client for more money."* The example given was $3,000.
- **A change a rep groups into one cost.** A client adds a fifth bedroom, and the rep puts it on the
  quote as one figure rather than the extra area, the robe and the door. The Rapid Costing tool
  itemises it *"so when we send it to the builder, the builder has full oversight of exactly what
  costs have been applied."*

How it works: dropdowns pull the builder's own prices, then the rep itemises each adjustment and its
reason, up or down, and everything adds up to the client's quote. *"sometimes they have to make it
look a bit cleaner for the client quote, but then break it down in more detail for the builder."*

**Why it exists:**
> *"back in the early days before we had the [Rapid] Costing tool, we would get given a quote that a
> client had signed and I was like, oh my God, the base price is like five grand different from the
> builder's price list. And the variation pricing doesn't look right either... if we said that to
> the builder, the builder would have gone, what the hell have you done?"*

**What the office would like from Launchpad:**
> *"if there's a way that Launchpad could read what the base price or the builder's pricing is
> supposed to be, and then how it's been adjusted, up or down, and then spit out some sort of report
> saying this cost is up, this cost is down."*

Jerry summed it up: *"So the home scope is for the client. And rapid costing is for the builder."*
Clients never see it.

**When reps use it.** Kane asked whether reps fill it in with the client there. Mostly not. A rep
sometimes uses it mid-meeting to check which builder might suit, with the screen turned away.
*"most of the time when the rapid costing tool is done, they've already created the home scope quote
for the client. That's been sent to the client and now they're just breaking down the cost in order
to submit the deal paperwork to us."*

## Comparing builders against a budget

> **Office:** *"We've also got a document that, we've called it a Builder Comparison Tool, and it's
> basically, we've just combined all the rapid costing tools into one document. So the reps can
> actually very quickly compare the cost between two or three builders... I've got like a summary
> page on the beginning... so they can see straight away which one's the cheapest quote, which
> one's the most expensive."*

It is usually driven by budget. A rep checks whether, say, Forma's 12.5 m design comes out cheaper
than Move's once site costs and BAL costs are added. *"It saves them putting together a formal
quote through HomeScope."* Jerry: *"Absolutely. As long as we have all the pricing and details in
Launchpad."*

**Budget in HomeScope.** The office had already suggested a budget field on HomeScope's first screen,
so it only offers what fits. But HomeScope is *"a bit more long-winded"* than the Rapid Costing
dropdowns. Jerry: *"I even thought that that was Homescope-ish, like getting the requirements and
the budget... and then it'll choose which one is fit."* He will talk it through with Kane and Andre
after the call.

**Kane's idea: record the meeting and let AI match builders.** Kane suggested Fathom-style notes of
rep and client meetings, analysed against the builders' data to suggest the top three builders.
Jerry: *"the Fathom thing, I don't think we need that, Kane, for now."* The office: *"a lot of our
first and second appointments are in the office, they're not on Teams"*, and on a first meeting
*"They're still trying to build rapport, so I don't really know if that would come across too
well."* Not pursued.

## HomeScope's catalogue moves into Launchpad

> **Jerry:** *"Are you guys OK if Kane would start building the home scope in Launchpad?"*
> **Office:** *"Absolutely. Yeah, absolutely."*

Jerry then asked for the data behind HomeScope:
> **Jerry:** *"we need to create like a view or an admin for HomeScope... so that operations can
> update it and update the data so that we won't be using Monday anymore."*
>
> **Kane:** *"Where do you want me to put the admin? Is it on Monday or on Launchpad?"* **Jerry:**
> *"No, on Launchpad... Not admin, more of a database."*
>
> **Office:** *"I guess it would just be like a separate section under the operations part of
> Launchpad... HomeScope pricing or something like that."*
>
> **Kane:** *"You're looking for like a catalog of all the options. Where they can set it."*

Jerry showed the Monday boards HomeScope reads: builders, models, specification ranges, elevation
styles, colour options, pictures and pricing. Kane couldn't see them. He only has Leads, Agreements,
Dev agreements and Estimation. Jerry: *"I'll give you access to HomeScope."*

**Who maintains it:** Alison, Larnie and *"probably Shannan."*

**How often each part changes**, per the office:

| Part | How often |
|---|---|
| Models (base prices) | Every month. *"Models is the main one."* |
| Variation price books, site works costs | Sometimes |
| Title allowances | Sometimes |
| BAL rating, coastal distance, noise package | Rarely |

**One place for everything.** Jerry: *"especially since our pricing doc formatter will be in
Launchpad. So once you create the new pricing there, it'll just automatically update this one
inside Launchpad... So there won't be any transfers anymore."*

## Office Wi-Fi

The contractor didn't come, so Alison spent about an hour and a half plugging in the new gateway,
switch and three access points with Jerry on the call. Jerry: *"I used to do that when I was a
network automation engineer."* Pablo is configuring it. The new network needs a different name from
the current one. The office suggested *"Locale Property"* in place of *"Locale Group"* (both
probable readings). Jerry plans three networks: guests, office staff, and the sales team when they
come in. When the office's connection kept dropping mid-call, they joined the new *Locale Staff*
network to test it, and the call held after that.

---

## Decisions Made

1. **The Doc formatter replaces the three manual copies and the email to Sean.** One upload, a human
   review, then one click each to send Sean the report and to publish. The office agreed.
2. **A "Commission included" tick box on each upload, ticked by default.** Unticking it opens a field
   for the amount to add (full, partial, or other).
3. **Site costs stay separate from base prices** on Locale's price list.
4. **Kane builds HomeScope in Launchpad.** Larnie and Alison agreed.
5. **HomeScope's catalogue moves into Launchpad, under Operations,** and Ops stop maintaining it in
   Monday. The Doc formatter publishes into it.

**Not decided:**

- The commission amount for each of the three builders (Select Living, Redink SW, SW1).
- Whether builder comparison is a budget filter in HomeScope or its own view.
- Whether Launchpad replaces the Rapid Costing tool with an adjustments breakdown and an up or down
  report.
- The new Wi-Fi network names.

## Action Items / Next Steps

| # | Owner | Action | Status |
|---|---|---|---|
| 1 | Andre, Kane | Doc formatter: real extraction of the builder's PDF, flags on suspect values, manual entry for anything it misses, month-on-month changes. Andre builds it and Kane fits it into the UI | Open. The prototype has the flow on sample data |
| 2 | Andre, Kane | Commission: a "Commission included" box, ticked by default, and an amount field when it is unticked | Open |
| 3 | Andre, Kane | Send report: email Sean the price changes in the spreadsheet's format, no Outlook step | Prototype has it (simulated) |
| 4 | Andre, Kane | Publish: Monday Models board, Rapid costing, the branded PDF to the Sales team channel, and a Teams notice to reps | Open. No Teams notice in the prototype |
| 5 | Kane | HomeScope in Launchpad | Built in this prototype (Sales › Rapid costing › HomeScope) on a 6 October snapshot. Release still waits for Shannan |
| 6 | Kane | HomeScope pricing under Operations: an editable catalogue of builders, models, spec ranges, elevations, colour schemes, pictures, variation price books, site works, title allowances, BAL, coastal and noise. The Doc formatter publishes into it | Open |
| 7 | Jerry | Give Kane access to HomeScope's boards in Monday | Done for the API: Launchpad's Monday token read the HomeScope workspace on October 9 |
| 8 | Jerry, Kane, Andre | Talk through builder comparison and a budget-first HomeScope | After the call. Not logged |
| 9 | Kane | Builder comparison for reps: compare two or three builders' totals against a budget, cheapest and most expensive first | Open. Waits on row 8 |
| 10 | Kane | Rapid costing: the builder's price, each adjustment with its reason, and a report of what went up or down | Idea, not agreed. Touches money, so Shannan's conditions from Meeting2 apply |
| 11 | Pablo | Configure the new office Wi-Fi: guest, staff and sales networks | In progress. *Locale Staff* worked on the call |
| 12 | Jerry | Show Ops the initial setup, test it with them, then go live: *"Same as usual."* | Open |

---

## Verification

**Checked the same day, against this repo and the local copy of Jerry's repo
(`Desktop/Locale_Launchpad-main`, which can lag the live build):**

- **The flow Jerry showed is the prototype's Operations › Doc formatter.** Upload, processing, then
  a review that scores each field and blocks Confirm and download while any field is missing
  ([ExtractionReview.tsx:255](../src/components/modules/operations/formatter/ExtractionReview.tsx)).
  Price changes sends the report to Sean and publishes to the same three targets Jerry named
  (`PUBLISH_TARGETS` in [formatter/data.ts:122](../src/components/modules/operations/formatter/data.ts)).
  The local copy of Jerry's build has no Doc formatter screen.
- **Negative values are not flagged.** The review only scores extraction confidence. Nothing checks
  that a value is a sensible price, so the negative Jerry typed would pass.
- **There is no way to add a line item.** The review edits a fixed list of fields
  (`SEED_FIELDS`). A design the extraction never saw can't be added.
- **New and removed designs are not flagged.** Price changes compares rates only. The sample data
  shows the gap: *The Halcyon* is in the month's change list (`PRICE_CHANGES`) but not among the
  extracted fields or the price list preview, and nothing points it out. That is the kind of miss
  behind the $17,000 mistake.
- **The price list preview mixes site costs with base prices.** `SHEET_ROWS` puts coastal, BAL,
  noise and the Finishing Touch promotion on the same sheet as the designs. The office said they are
  kept apart.
- **No commission setting anywhere in the Doc formatter.**
- **No Teams notice on publish.** Meeting2's proposed item 6 is still open. The branded PDF is said
  to be *"filed to SharePoint"*, not to the Sales team channel.
- **The report's copy line misspells Shannan's address** as `shannen@`
  ([formatter/data.ts:118](../src/components/modules/operations/formatter/data.ts)). The org seed
  has `shannan@`.
- **Builders.** Operations › Pricing and Rapid costing list five: Move Homes, Forma, La Vida, New
  Choice and New Era. The HomeScope snapshot has four (no New Era). None of the three commission
  builders, Select Living included, appear anywhere in the repo.
- **The HomeScope catalogue is read-only.** `catalogue.json` is a snapshot from 6 October, with no
  screen to edit it ([catalogue.ts](../src/components/modules/sales/costing/homescope/catalogue.ts)).
  It already covers the parts the office listed (models, spec ranges, elevations, site costs, title
  allowances, BAL, coastal, noise, colour schemes, variations), but **not pictures**.
- **The Supabase plan reads the catalogue from Monday.** `launchpad.homescope_catalogues` is
  commented *"today a snapshot, later read from Monday's price boards"*, and its `source` allows only
  `snapshot` or `monday`
  ([20261008000600_launchpad_sales.sql:138](../supabase/migrations/20261008000600_launchpad_sales.sql)).
  After this call, Launchpad is where the catalogue is edited.
- **Rapid costing is a rep's quick estimate, not the builder's breakdown.** Sales › Rapid costing ›
  Calculator takes a builder, design, storey, BAL, slope, coastal, noise, promotion, buyer type and
  a discount, and works out commission and whether a manager must approve
  ([costing/data.ts](../src/components/modules/sales/costing/data.ts)). It has no itemised
  adjustments with reasons and no comparison across builders. HomeScope has no budget field.

**Not verifiable from here:**

- The $17,000 and $18,000 figures, and which builder rose by $18,000 (the speaker wasn't sure).
- Whether the AWS HomeScope reads its catalogue through Monday's API on every use. If it does,
  moving the catalogue into Launchpad also cuts Monday calls ([Meeting3](Meeting3.md)'s 44,000 a
  day).
- Yasmin's spreadsheet, the Rapid Costing template and the Builder Comparison Tool. None are in
  either repo.

---

## Reference Notes

### Transcription artifacts

| As transcribed | Actually |
|---|---|
| *"Ellie"*, *"Eli"*, *"Ali"*, *"Allie"* | **Alison** (Alison Carter, Sales Operations) |
| *"Publix"* | **Pablo** (Pablo Lopez, IT) |
| *"Yaz"* | **Yasmin**, who made the price list spreadsheet. Probably Yasmin Georgiadis |
| *"Sean"* | **Sean** (Sean O'Neill, Head of Sales) |
| *"wrapper costing tool"*, *"RapidCosting"* | **Rapid Costing tool** |
| *"Builder Priceless Template"* | **Builder Price List template** |
| *"Move"* | **Move Homes** |
| *"bow costs"*, *"bow rating"* | **BAL** costs, **BAL** rating (bushfire attack level) |
| *"tidal allowances"* | **Title allowances** (the delayed-title allowance). Probable |
| *"SiteWorks"* | **Site works** costs |
| *"Select Reddick Southwest and Southwest One"* | **Select Living, Redink SW and SW1**, the three builders whose prices exclude commission. Checked against Monday's Builders board |
| *"New Choice, for example, had, was it New Choice? New Era?"* | The speaker wasn't sure which builder rose by $18,000 |
| *"slush"* | A **contingency** on the base price |
| *"12.5m design"* | A design for a **12.5 m frontage** block |
| *"import models"* | Monday's import into the **Models** board |
| *"locale estimation"* | HomeScope's catalogue boards: the **Estimation Source Data** folder in Monday's **HomeScope** workspace (twelve boards). Kane's Leads, Agreements and Dev boards are in the same workspace's other folder |
| *"help group"*, *"help property"* | Read as **Locale Group** and **Locale Property** (Wi-Fi names). Probable |
| *"Branding."*, repeated from 28:33 to 29:14 | Noise from the office device. Ignored |
| *"Screen your record"* | Garbled. Jerry confirming the session was being recorded |
| *"uh no no just uh formatter... they need Pablo"* (3:01) | Garbled. Jerry telling Andre this call is the formatter, not Rapid Costing, then moving on to the Wi-Fi |

**Speaker labels.** Larnie and Alison were on one device, so Fathom labels everything from the
office *"Larnie Clark"*. Quotes in this note say *"the office"* unless the transcript shows who spoke.
At 26:17, *"I think what Larnie is saying"* shows that Alison was answering Larnie's commission
question.

**Mis-attributions:**

- 6:06, *"Hey, Ellie, thank you so much again for being our on-site IT"* is given to Larnie. That
  was Jerry.
- 23:06, *"a lot of our first and second appointments are in the office, they're not on Teams"* is
  given to Jerry. That was the office.
- 14:17, *"No. Everything was explained perfectly."* is given to Jerry. It answers his question to
  Kane, so it was probably Kane.
- 45:41 to 45:43, *"Okay. Kane?"* is given to Andre and *"Not at the moment... answered already"*
  to Jerry. Read as Jerry asking and Kane answering.

**Left out on purpose.** This repo is public. The commission amounts said on the call and the
prices on screen are not in this note.

### What this call means for this prototype (proposed, not applied)

Nothing below has been changed. Each needs Kane's go-ahead.

1. **Add a "Commission included" box to the Doc formatter's upload step,** ticked by default.
   Unticking it shows an amount field, and the amount is added before the preview. Remember the
   setting per builder, since the same three builders need it every month. Decision 2.
2. **Flag new and removed designs** in Price changes, not just changed rates. Fix the sample data
   too, so The Halcyon is either extracted or flagged as missing.
3. **Let a reviewer add a line item** the extraction missed, and **flag values that can't be
   prices** (negative, zero, or far off last month).
4. **Keep site costs off the builder price list preview,** or give them their own section. Check
   the layout against Yasmin's spreadsheet. Decision 3.
5. **Let Move Homes skip the branded list.** A per-builder option to file the builder's own PDF
   as is.
6. **Publish targets:** add the Teams notice (Meeting2 item 6), file the branded PDF to the Sales
   team channel, and add the HomeScope catalogue as a target. The Monday Models board drops off once
   the catalogue lives in Launchpad.
7. **Fix Shannan's misspelt address** in `REPORT_ROUTING`.
8. **Add Operations › HomeScope pricing,** an editor over the sections `catalogue.ts` already models,
   plus pictures. Show what each publish changed, with versions. Row 6.
9. **The Supabase catalogue table assumes Monday is the source.** Launchpad edits need a source such
   as `launchpad`, and versions. Another session is running that plan, so raise it there rather than
   changing it from here.
10. **Rebuild Rapid costing as the builder's breakdown:** a HomeScope quote's lines priced from the
    builder's list, each adjustment itemised with its reason, a total equal to the client's quote,
    and an up or down report. It could also produce the Rapid Costing document that Deal
    submissions require (Meeting2). Row 10. Wait for Shannan before releasing anything that changes
    prices.
11. **Builder comparison:** a budget on HomeScope's first step, or a comparison view with the
    cheapest and most expensive first. Wait for row 8.
12. **Ask the office for** copies of Yasmin's spreadsheet, the Rapid Costing template and the
    Builder Comparison Tool. Those copies hold real prices, so keep them out of this public repo. The
    builder list is now known: Monday's Builders board has nine (Forma, LaVida, Move, My Homes WA,
    New Choice, New Era, Redink SW, Select Living, SW1). This repo's sample data has five, and the
    HomeScope snapshot has four.
13. **Import HomeScope's catalogue from Monday.** Planned in
    [2026-10-09-homescope-catalogue-import.md](superpowers/plans/2026-10-09-homescope-catalogue-import.md):
    the format, the field map from the twelve boards, and Operations › HomeScope pricing. Row 6.

### Continuity

- **This is the Doc formatter meeting** booked in [Meeting2](Meeting2.md) (row 3, Friday 12:00)
  and moved in [Meeting3](Meeting3.md) to 12:30 to 1:30, with Andre and Kane added (row 1). Jerry
  moved it again because of an earlier meeting with Ali.
- **Rapid Costing is not simply retired.** In Meeting3, Jerry relayed Shannan's view that Rapid
  Costing *"goes once we fix the pricing here."* This call says what it does that HomeScope doesn't:
  the builder's itemised breakdown, which Deal submissions also require (Meeting2). Retiring the
  spreadsheet means Launchpad has to produce that breakdown.
- **Shannan's conditions still apply.** Meeting2 parked Rapid Costing, ups and downs and the
  HomeScope rebuild as touching *"everybody's money"*. Meeting3 had Jerry endorse Kane's rebuild,
  and now Larnie and Alison have too. Today is Shannan's last day before leave, and she wasn't on
  this call. Releasing anything that changes prices still waits for her.
- **"Three builders" twice.** Meeting2 had three builders whose design names Locale renames (row
  13). This call has three builders whose prices exclude commission. Nobody said they are the same
  three.
- **Monday access.** Meeting3 had Jerry granting Kane the Exclusive Land board. This adds
  HomeScope's boards.
- **Wi-Fi.** Meeting3 had the Wi-Fi settings work on Thursday October 8. This call has the hardware
  in and Pablo configuring it.
- **Coming up:**
  - Monday October 12: the meeting with Aled.
  - Tuesday October 13: the next huddle. Andre's Doc formatter update is due there (Meeting3 row 2).

### Small talk

Kane opened with a cold (*"Sneezy"*). Andre's office is in BGC, and he used to commute an hour each
way: *"Never again."* It was raining where Jerry was. On the Wi-Fi install, Alison: *"it would work
in this plug, and it didn't work in this plug, and then I went back to that plug, and it didn't
work."* When Kane and Andre had no questions about the process, the office: *"You guys are too smart."*
