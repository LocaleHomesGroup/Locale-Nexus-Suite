# Meeting 3 - AI Team Weekly Huddle (IT, AI & Growth Systems)

**Date:** October 7, 2026 (Wednesday)
**Duration:** ~69 minutes
**Attendees:** Jerry Delos Santos (Head of AI & Growth Systems), Jan Kane Reroma (AI Engineer), Andre Serra (AI Engineer), Pablo Lopez (IT Systems Engineer, joined about 35 minutes in)
**Recording:** 69 mins (no highlights), [Fathom call 848118664](https://fathom.video/calls/848118664)
**Language:** Mostly Tagalog until Pablo joined, then English. Quotes marked *(tr.)* are English
translations. The rest are verbatim.

---

## Summary

**Kane now owns most of Launchpad.** Jerry split the work. Kane owns the Launchpad UI as a whole
and its general features. He also owns Sales and Marketing, most of Operations, and Rapid Costing
with HomeScope. Andre owns Wealth and Finance, plus the Doc formatter inside Operations. Andre also
hands his builder portal poller to Kane, to fit into the UI. Pablo stays on IT. Jerry had swapped
Kane's and Andre's areas: *"for sales and marketing, I swapped you two, right? So sales and
marketing is Kane, mostly. And then wealth, finance, that's you, Andre."* *(tr.)*

**Exclusive Land is the urgent item.** It is the last reason sales reps need Monday. Launchpad
will show them their build status, and Pablo's automation already emails them the HomeScope PDF.
Once Exclusive Land is in Launchpad, Jerry can remove every rep's Monday access: *"So we will be
able to save the company a bunch of money."* He asked Kane for it by Tuesday October 13, under
Sales and visible to everyone. This prototype already has an Exclusive land tab. Two things are
missing: who maintains the lots (Jerry thinks Alison) and the link to the live Monday board.

**The production mirror is read-only.** Kane committed to mirroring live Monday and HubSpot data,
including uploaded documents, into Launchpad production by the next huddle. Jerry: *"And yeah,
we're not writing anything yet."* Kane: *"Just mirroring everything."* That answers
[Meeting2](Meeting2.md)'s open question on whether sending stays off during the hold, at least for
now. Near the end Jerry read out *"version one of go live of CRM dash sync under operation should
be live"*, which needs squaring with Meeting2's hold. See
[the mirror section](#production-mirror-read-only-by-tuesday-october-13).

**Monday API usage is far over the daily limit.** Monday allows 10,000 API calls a day, and Jerry
saw about 44,000 the day before. Locale isn't being charged yet, but from 2027 it will have to buy a
higher limit, billed yearly. Jerry suspects Launchpad is making calls it doesn't need. Andre will
audit them. In the local copy of Jerry's build, the mirror re-reads every board's full item list
every five minutes. That is a likely place to start. See [Verification](#verification).

Also from the call:

- **HomeScope is the quotation tool, and Rapid Costing is something else.** Jerry walked through
  HomeScope and wants it replaced (*"this ugly thing"*) *(tr.)*. Kane said his rebuild is already
  in Launchpad. Jerry corrected himself: Rapid Costing is the pricing spreadsheet that goes away
  once HomeScope's pricing is right.
- **Sales gets two views:** a Sales Representative view (my leads pipeline, my won clients) and a
  Sales Manager view (all reps, all clients). Kane's unmerged `feat/sales-portal` branch already
  makes that split.
- **IT ticketing system, initial version next week,** assigned to Pablo: email-to-ticket,
  priorities, and ideas. Pablo asked whether Kane already has one. This prototype has two.
- **HomeScope on AWS must refuse submissions with no sales rep.** Alison asked for this, and Pablo
  owns it. Pablo has already routed unassigned PDFs to Alison, Shannan and Larnie.
- **Lai is working on test data.** It will point at Launchpad's data once the mirror is live, and
  Andre adds Lai's capabilities to Jarvis.
- **Only IT will create Teams and groups.** Yasmin asked for it. Pablo drafts the plan.
- **The Doc formatter meeting moved to Friday October 9, 12:30 to 1:30.** Andre and Kane were
  added to it.

---

## Who owns what now

Jerry set this out at the start (4:11) and again at 31:14.

| Area | Owner | From the call |
|---|---|---|
| The Launchpad UI as a whole, and its general features | Kane | *"Kane will probably own the whole Launchpad UI, so Kane does the other stuff in Launchpad, like the general ones."* *(tr.)* |
| Sales and Marketing | Kane | Swapped with Andre. Marketing is *"a different whole beast"*, to be discussed later |
| Operations, most of it (CRM Dash Sync, Inbound capture, Review queue, Deal submissions) | Kane | *"So operations, Kane, mostly operations is yours."* *(tr.)* |
| Rapid Costing and HomeScope | Kane | Andre: *"Rapid costing, take that too, Kane, since you're the one doing HomeScope."* *(tr.)* |
| Exclusive Land | Kane | *"Kane, this one's yours, Exclusive Land."* *(tr.)* |
| Doc formatter (in Operations) | Andre | Jerry: *"Dre, you were the one who started it."* Andre: *"I've already done that. Me, correct."* *(tr.)* |
| Builder portal poller | Andre built it, Kane fits it into the UI | Andre: *"so it can fit in the current UI, because it's standalone right now."* *(tr.)* |
| Wealth and Finance, including the Wealth Generator | Andre | Pablo hands the Wealth Generator to Andre |
| Lai, Sai, and Lai's capabilities in Jarvis | Andre | See [Lai, Sai and Jarvis](#lai-sai-and-jarvis) |
| IT: SharePoint migration, Teams governance, ticketing, HomeScope on AWS | Pablo | |
| IT: distribution lists and their naming convention | Jerry | Waiting on Yasmin and Adam to approve the convention |

## Monday.com API calls are over the daily limit

> **Jerry:** *"Monday only allows 10,000 API calls a day. Currently we had like 44,000 yesterday...
> I think maybe our setup is wrong, especially in Launchpad. Maybe it's calling something it
> doesn't need."* *(tr.)*
>
> *"Although right now we haven't been charged. But by 2027 that stops, and we'll need to extend
> the limit. And their limit is expensive... and it's billed yearly."* *(tr.)*

Jerry asked Andre to audit the calls and look for unneeded and duplicate ones. Andre agreed. The
other figures Jerry read out (*"100 plus... 120... 200 per day"*) are garbled. They may be the
higher tiers' limits.

**This matters for Kane's production mirror.** It adds its own Monday reads. Andre's audit should
cover the mirror's read pattern before it runs against production. The lead below comes from the
local copy of Jerry's build.

## HomeScope is the quotation tool, not Rapid Costing

Jerry walked through HomeScope as a sales rep would, to show Kane and Andre what to replicate:
*"Watch this, because I'm going to have you replicate this in Launchpad."* *(tr.)*

**History.** *"Before I joined, they hired a third party to build this. It's built on AWS... It
wasn't secured at first, so Pablo and I put SSO on it."* *(tr.)* It used to be open to anyone with
the link. Jerry found that first and has since fixed it.

**The flow** matches the rebuild's eleven steps: client details, block (address, lot size, corner
block), builder, model, spec range, front elevation, site costs (BAL rating, coastal distance,
noise, title delay), colour scheme, then the estimate summary and Submit. Submit writes to Monday,
where Operations keep the catalogue up to date: *"if Move or Forma have new pricing on an
elevation, they update it here."* *(tr.)* The emailed output is formatted per builder (Forma's
differs from La Vida's) *"because those are the conditions sent to the client."* *(tr.)*

**The name.**
> **Kane:** *"It should have 'quotation' in the name... it's a quotation tool, like I said
> earlier."* *(tr.)*
>
> **Jerry:** *"Okay, but its name is rapid costing. No, no, no, rapid costing is different. So this
> is quotation. Rapid costing is based on our pricing... Shannan said yesterday that eventually
> rapid costing goes once we fix the pricing here."* *(tr.)*

**Replacing it.** Jerry: *"One of my dreams really is to replace this... No branding, and built by
a third party. The problem is it's already integrated."* *(tr.)* Kane said the rebuild already
exists: *"I'm putting it in Sales under Rapid costing, on this page. You'll see it in a few
minutes."* *(tr.)* Jerry: *"You've replicated this, Kane? Nice."* *(tr.)* Later, to Pablo:
*"Kane will be rebuilding HomeScope through Launchpad."*

**Shannan was not on this call.** In Meeting2 she parked the HomeScope rebuild and the Rapid
Costing replacement until she is back, with requirements, sign-off and multi-SME testing. Jerry
has now endorsed the build. Releasing anything that changes prices still waits for her.

## Exclusive Land: the last thing reps need Monday for

Jerry listed why a rep opens Monday today. Each has a replacement:

1. **Their clients' build status** (*"Say I'm Kane, I have three closed deals. What's the status of
   my job?"* *(tr.)*). Launchpad will show it.
2. **The HomeScope PDF.** Pablo's automation now emails it.
3. **Exclusive Land.** Not replaced yet.

**What Exclusive Land is.** Locale brokers land as well as builds. Some land developers give
Locale lots that only Locale may sell. Today a rep sees one in the Exclusive Land board in Monday
(and in Teams messages), and places a hold for their client:
> *"There's an automation: it's held for [the client] for 24 hours... After 24 hours, if it isn't
> sold or they couldn't get a deposit from their client, it goes back to available. I want this in
> Launchpad, under Sales."* *(tr.)*

The board shows each lot as available, on hold for a named rep, or sold.

**Who maintains it.** *"Whoever updates this, that's another problem for you guys to solve...
I think it's Alison who updates the new exclusive land, up for grabs."* *(tr.)* Kane: *"I'll
solve that."* *(tr.)*

**Why it is urgent.**
> **Jerry:** *"Once we move this to Launchpad, I can take out all the monday.com access for all the
> reps, because this is their only remaining dependency on Monday. So we can prioritise this,
> because the savings are big."* *(tr.)*

**Where it goes.** Jerry asked whether it should go in the live Launchpad or a separate web app.
Kane offered a portal on its own domain from the same repo. Once Kane confirmed it is for Sales,
Jerry put it under Sales. Later: *"Everyone can see Exclusive Land. That's fine."* Kane said
access would be set in the Admin dashboard.

**Deadline.** Jerry: *"are you able to replicate exclusive land by Tuesday next week? I know you
have a lot on your plate."* Kane doesn't have access to the board in Monday yet. Jerry will grant
it (the board is in the Local Jobs workspace).

**Kane's question on land.** Can one lot be built on by different builders? Jerry: yes. *"We are
not just brokers of builders, we are also brokers of land developers... Move, La Vida, Forma, they
are construction companies, they don't own lands. So our sales reps actually sell both land and
house."* That is why HomeScope asks about the land. It is also why Launchpad tracks title status:
a build can be delayed when the title isn't there yet.

## Sales Manager and Sales Representative views

Kane shared his screen and showed the Sales dashboard being split. Jerry set the shape:
> **Jerry:** *"under sales, there should be a rep view and a sales manager view. Because the sales
> manager view, I can see all."*
>
> **Kane:** *"Okay, we'll make this one sales manager and this one sales rep... This one is all
> clients."*
>
> **Jerry:** *"as a sales rep, I don't need to see all clients. I just need to see my clients."*
>
> **Kane:** *"So that's why this one should be called all clients... the manager should also see
> all representatives."* **Jerry:** *"All reps, all clients."*

The rep's own view has two parts. Jerry: *"the sales pipeline, which is not yet [a client]. It's
just a lead... I'm still working on meeting and calling... And then another view, which is my
clients, those clients that I won."* Kane offered *"marketing manager"* for another view. Jerry
said Marketing is *"a different whole beast"* and moved it to a later talk.

Jerry also asked Kane to start the Sales Representative view as a starting point for next
Tuesday. Jerry will send inputs, *"particularly the ones that Sean wanted to see."* The Fathom item
puts this with Jerry.

## Production mirror: read-only, by Tuesday October 13

> **Kane:** *"We will have the live data being read from Monday."* **Jerry:** *"From Monday. And
> HubSpot."* **Kane:** *"And HubSpot, yes. It will be mirrored."*
>
> **Jerry:** *"And yeah, we're not writing anything yet."* **Kane:** *"Just mirroring everything.
> All the upload documents."*

Earlier, Kane said the plan is to take the environment variables live and read from HubSpot *"until
such time [they] no longer need to use HubSpot"*, merging the Operations work Jerry has done in
the test environment *(tr.)*. Kane: *"Actually it's easier to take Monday away from users than
HubSpot."* *(tr.)* Jerry: *"That's still a long way off. But the plan is parallel. They can still
use HubSpot, but they can also use Launchpad."* *(tr.)* Monday is for project management once
construction starts, and HubSpot is for leads, so reps can drop Monday first.

**To square with Meeting2.** Jerry read from his management list: *"version one of go live of crm
dash sync under operation should be live."* Meeting2's first decision held the Dash Sync go-live
until Shannan is back. The likely reading is that "version one" means the read-only mirror in
production, with sending still off. **Confirm with Jerry** before anything writes to Monday or
HubSpot.

**Kane's commitment for October 13** (*"I don't want to overextend, but you can expect most of the
operations will be done by Tuesday"*):

- Live Monday and HubSpot data mirrored to production, read-only, with uploaded documents.
- CRM Dash Sync and the poller screens redesigned.
- The approve queue done. Jerry: *"You can say it's ugly, man. I created that."* Pablo agreed.
- The Doc formatter: Kane will *"copy whatever Andre has or... create a new one"*, once Andre's is
  done.

Jerry: *"Undercommit, overdeliver. That should be your goal."*

## Operations: the poller, Inbound capture and the Doc formatter

**The poller goes to Kane.** Kane: *"I'll just have Claude analyse the data coming out of the
poller and work out where it goes in Launchpad."* *(tr.)* Andre agreed.

**Why Jerry wants the poller, attachments especially:**
> *"It's not just for operations. It's for sales too. Right now the whole sales team has shared
> credentials to every builder portal. So if a salesperson leaves, they take Locale's builder
> portal credentials with them, and the passwords have to be reset every time someone leaves...
> They won't need the builder portal credentials anymore, because we capture it in Launchpad."*
> *(tr.)*

**Inbound capture's Excel upload is parked.** It came from Alison. Builders such as Forma used to
send a weekly Excel of every active job, and the job number and completion date are what
matter. *"But the Excel doesn't happen anymore. So it's just a feature. We can park that for
now."* *(tr.)*

**Doc formatter.** Andre owns it. The meeting with Alison and Larnie moved from 12:00 to **12:30
to 1:30 on Friday October 9**, and Andre and Kane were added. Jerry: *"Kane, I'll still include you,
okay?"* *(tr.)* Jerry expects an update from Andre at the next huddle. The time zone wasn't
given. Meeting2 assumed Perth time.

## Lai, Sai and Jarvis

> **Andre:** *"We still have Lai only for now. So, Lai holds both functionalities for operations
> and sales right now. But once we have established this, then we will separate them into two
> entities."*

Lai uses vector embeddings over chunked documents on Locale's Azure OpenAI subscription, and it
can now read SharePoint. What's left is choosing which company knowledge goes into SharePoint for
Lai. Lai already queries both SharePoint and Launchpad data, *"but right now, we're only using test
data. So, no actual answers will be given."*

Jerry asked whether sales could point Lai at Launchpad instead of HubSpot, since HubSpot and Monday
are being mirrored there. Andre: yes. **Once Kane's mirror is live, Andre points Lai at Launchpad**,
and the two agree where the data lives.

**Jarvis.** Jerry asked whether Kane would build Launchpad's AI himself. It should match the AI in
Teams, which is live. The offer to *"handle that so Kane doesn't have to redo it from scratch"*
was Andre's. Fathom gives the line to Jerry. Andre had seen Jarvis in the updated UI: *"We just
need to add the capabilities that I currently have."* Kane: *"all the data will be inside this
database if it points there, and you have like a PG vector in there and you'll help Jarvis pinpoint
all the data."* Jerry: *"I'll let you guys coordinate together... Don't wait for me."*

## IT: groups, distribution lists, SharePoint and a ticketing system

**Teams and groups.** Yasmin wants staff to stop creating their own Teams (Quentin had made one).
Pablo: *"Yes, kind of... So I need to know who is going to be allowed to create groups."* Jerry:
*"Just us... Because Andre and Kane is also IT. So anyone wants to have a group must go through
us."* Pablo drafts a plan by October 13.

**Distribution lists.** Adam and Jerry talked this week about IT issues. Jerry reviewed the
distribution lists: *"There are about 108. Anyone just makes them."* *(tr.)* He will tidy them once
Yasmin and Adam approve his naming convention. Jerry and Pablo will talk about email groups
separately.

**SharePoint migration.** Pablo is one folder short (qualifications). He emailed about deleting
the old SharePoint folders, and he will delete them if nobody answers. The space is needed before
Sunday October 11, when the old site becomes read-only. Jerry will book a decision meeting on Friday
October 9 with Pablo, Yasmin, Adam and Kelly. The Wi-Fi settings work is on Thursday October 8.

**Ticketing system.**
> **Jerry:** *"we need that ticketing system, man. Do you have time to do that? Because I think Kane
> has a ticketing system that he created before."* **Pablo:** *"Kane, do you have a ticketing
> system, right?"* **Kane:** *"No, I can go ahead and look for one."*

Jerry wants an initial version from Pablo next week: *"whatever request they have, it should be
logged."* Rachel has another IT issue now. He separated it from a project board:
> **Jerry:** *"to do in progress and blah blah, that's a project thing, that's a kanban. The
> ticketing system is like if they request something they just submit a ticket, or if they email
> to an inbox, then it will create a ticket for us."*
>
> **Pablo:** *"They are divided by priorities, like this is an emergency, this can be handled
> later."*

Jerry also wants **ideas** in it. Brad sends him more ideas than he can keep up with. Jerry built an
ideas tracker in Projects but never deployed it. The prototype already has an IT Help desk and the
Tickets board. See proposed item 7.

## HomeScope on AWS: no submission without a sales rep

> **Jerry:** *"what Allison is asking is, sales reps cannot submit if they don't put their names
> there."* **Pablo:** *"that needs to be directly in the platform, yeah... in AWS."*

Pablo has already routed PDFs with no sales rep to Alison, Shannan and Larnie. The validation is
his to add in HomeScope itself, with an update at the next huddle. **Kane's rebuild has the same
gap** (proposed item 4).

## Wealth Generator handed to Andre

Pablo started the Wealth Generator, the one for Conor, and paused it. He hands it to Andre:
*"It should be Andre because Andre is for finance and wealth."* Jerry: *"it's still a form. It's
like a quotation. It's like HomeScope... our business in wealth is that we will offer our clients
ready-made properties that they can buy and invest so that they can have it rented."* It captures
things like the address and market value. Pablo books the handover with Andre and includes Jerry.
Fathom has Friday October 9. Pablo prefers the evening: *"I'm more relaxed on that time."*

## Also raised

- **Website rebuild.** Jerry will talk to Kane separately.
- **HubSpot standard saved views.** Jerry: *"I'm going to create this one."*
- **A meeting with Aled on Monday October 12** about the accounts group. Jerry asked Kane and
  Andre to join.
- **Kane's meet and greet** with *"Anna Wieners"*: done. The name isn't in the org seed.
- **Claude plan.** Kane said the project may outgrow his account and an enterprise account may be
  needed later. Jerry will upgrade him to the 5x plan now.

---

## Decisions Made

1. **The ownership split above.** Kane: Launchpad UI, Sales and Marketing, most of Operations,
   Rapid Costing, HomeScope and Exclusive Land. Andre: Wealth and Finance, the Doc formatter, and
   Lai. Pablo: IT.
2. **The production mirror reads only.** Nothing writes to Monday or HubSpot yet.
3. **Exclusive Land goes into Launchpad under Sales, visible to everyone.** Kane owns it. It is
   due Tuesday October 13 and is urgent.
4. **Reps lose Monday access once Exclusive Land is live in Launchpad.**
5. **Sales has a Sales Representative view and a Sales Manager view.** The manager's client list
   is called All clients.
6. **Kane rebuilds HomeScope in Launchpad, and Rapid Costing moves to him.** Shannan's release
   conditions from Meeting2 still apply.
7. **Andre owns the Doc formatter.** The Friday meeting is 12:30 to 1:30, with Alison, Larnie,
   Andre and Kane.
8. **Only IT creates Teams and groups.** That means Pablo, Jerry, Andre and Kane. Pablo plans how.
9. **The Wealth Generator moves from Pablo to Andre.**
10. **Jarvis stays as Launchpad's AI, and Andre adds Lai's capabilities to it.** Kane doesn't
    rebuild them.
11. **Inbound capture's Excel or CSV upload is parked.**

**Not decided:**

- Who adds and retires Exclusive Land lots. Jerry thinks Alison.
- How *"version one of go live of CRM Dash Sync"* fits with Meeting2's hold.
- Whether Pablo builds a new ticketing system or extends one that exists.
- The Marketing manager view.
- The Monday API plan for 2027.

## Action Items / Next Steps

The next huddle is Tuesday October 13. Most rows are due by then.

| # | Owner | Action | Status |
|---|---|---|---|
| 1 | Jerry | Send the Doc formatter meeting invite: Alison, Larnie, Andre, Kane (Fathom) | **Scheduled: Friday October 9, 12:30 to 1:30** |
| 2 | Andre | Own the Doc formatter. Finalise it at Friday's meeting. Update at the October 13 huddle | Open |
| 3 | Andre | Audit Monday.com API calls against the 10,000-a-day limit. Find unneeded and duplicate calls, then propose fixes (Fathom). Start with the mirror's board walks (Verification) | Open |
| 4 | Kane | Exclusive Land in Launchpad under Sales, visible to everyone: 24-hour holds that lapse back to available, and a way for the maintainer to add lots (Fathom) | **Open, urgent. Due October 13** |
| 5 | Jerry | Give Kane access to the Exclusive Land board in Monday (Local Jobs workspace) | Open |
| 6 | Jerry | Remove sales reps' Monday access once row 4 is live | Blocked on row 4 |
| 7 | Kane | Mirror live Monday and HubSpot data into Launchpad production, read-only, with uploaded documents. Present it on October 13 (Fathom) | Open. Confirm the Dash Sync "version one" reading first |
| 8 | Andre, Kane | Point Lai and Sai at Launchpad's data once mirrored. Agree where it lives (Fathom) | Blocked on row 7 |
| 9 | Andre | Add Lai's current capabilities to Jarvis | Open |
| 10 | Andre, Kane | Hand the poller over to Kane. Kane fits it into the UI (Inbound capture) | Open |
| 11 | Kane | Redesign CRM Dash Sync and the poller screens. Finish the approve queue. Most of Operations by October 13 | Open |
| 12 | Jerry | Send Kane inputs for the Sales Representative view, including what Sean wants (Fathom) | Open |
| 13 | Kane | Sales Representative view (leads pipeline, my won clients) and Sales Manager view (all reps, All clients) | Built on `feat/sales-portal`, not merged into `main` |
| 14 | Pablo | IT ticketing system, initial version next week: email-to-ticket, priorities, ideas (Fathom) | Open. See proposed item 7 |
| 15 | Pablo | HomeScope (AWS): block Submit without the sales rep's name and email (Fathom). Unassigned PDFs to Alison, Shannan and Larnie | Routing done per Pablo (unverified). Validation open, update October 13 |
| 16 | Jerry | SharePoint migration decision meeting with Pablo, Yasmin, Adam and Kelly (Fathom) | Friday October 9, time not set |
| 17 | Pablo | Finish the SharePoint migration (the qualifications folder). Free space before the old site goes read-only | Due Sunday October 11 |
| 18 | Pablo | Plan for Teams and group governance: only IT creates groups (Fathom) | Open, plan by October 13 |
| 19 | Jerry | Tidy the 108 distribution lists. Talk to Pablo about email groups | Waiting on Yasmin and Adam to approve the naming convention |
| 20 | Pablo | Wealth Generator handover to Andre, with Jerry (Fathom) | Friday October 9, evening |
| 21 | Jerry | Upgrade Kane's Claude plan to 5x (Fathom) | Open |
| 22 | Jerry, Kane | Website rebuild, a separate talk | Open, undated |
| 23 | Jerry | HubSpot standard saved views | Open |
| 24 | Jerry, Kane, Andre | Meeting with Aled about the accounts group | Monday October 12 |

---

## Verification

**Checked the same day, against this repo and the local copy of Jerry's repo
(`Desktop/Locale_Launchpad-main`, which can lag the live build):**

- **Exclusive Land is "already in the mock-up": true.** Sales › Exclusive land
  ([ExclusiveLand.tsx](../src/components/modules/sales/land/ExclusiveLand.tsx)) has an estate
  filter, 24-hour holds with an expiry time, a queue of up to three holds per lot, and
  available/hold/sold states. Sales' seed data says it was taken from the mock-up's Sales view
  ([sales/data.ts:3](../src/components/modules/sales/data.ts)). Holds are simulated, there is no
  screen to add or retire lots, and the holders are placeholders. **Jerry's local build has no
  Exclusive Land.**
- **Monday API calls, a lead for row 3.** In the local copy, the mirror runs every five minutes
  (`vercel.json`: `/api/mirror/sync`, `*/5 * * * *`). On every pass, including incremental ones,
  `runMonday` walks **every board's full item list and every subitem board** in pages of 500
  (`walkBoard`, `walkSubitemBoard` in `src/lib/mirror/run.ts`, lines 193 to 196). The watermark
  only filters which items it then reads in full, 25 per call. So listing calls grow with board size
  × 288 passes a day, even when nothing changed. For example, a board with 2,000 items and 10,000
  subitems costs 4 + 20 = 24 calls a pass, about 6,900 a day before any detail reads. A full pass
  is also scheduled every five minutes through one hour a night (`*/5 18 * * *`, UTC). Whether the
  later ones stop once the first finishes is up to the database, which wasn't read. The outbox
  dispatcher also runs every five minutes. **The 44,000 can't be split by source from here.**
  HomeScope's submissions, automations and any other integrations count too.
- **The HomeScope rebuild doesn't require a sales rep either.** "Prepared by" is optional. The
  Client details step checks contacts, address, lot size and frontage, but not staff
  ([HomeScope.tsx:92](../src/components/modules/sales/costing/homescope/HomeScope.tsx)), and a saved
  quote falls back to `"Unassigned"`
  ([store.ts:457](../src/components/modules/sales/costing/homescope/store.ts)).
- **The Sales split matches `feat/sales-portal`,** which is eight commits ahead of `main` and not
  merged. In its `dashboards.ts`, Sales Manager has Pipeline, **Clients**, Exclusive land and Team.
  Sales Representative has My pipeline, My clients and My progress. The call's name for the
  manager's list is **All clients**. Exclusive land is only on Sales Manager.
- **Ticketing: the prototype has two.** IT › Help desk
  ([ItScreen.tsx](../src/components/modules/it/ItScreen.tsx)) raises `#214`-style tickets with a
  category and Low, Medium or High priority. The Tickets board ([tickets/](../src/components/modules/tickets/))
  has `LP-` tickets, low to urgent, and the Projects kanban Jerry contrasted it with. Neither takes
  email, since the prototype has no backend, and neither has an Idea type.
- **Title status:** a job's detail offers only Titled or Untitled
  ([DetailCards.tsx:97](../src/components/modules/operations/jobs/detail/DetailCards.tsx)). Jerry
  described titled, non-titled and delayed-titled. HomeScope's site costs carry the
  delayed-title allowance.
- **Andre's seat** in the org seed is *"AI Engineer – Sales & Marketing"*
  ([hr/data.ts:230](../src/components/modules/hr/data.ts)). After the swap, his areas are Wealth
  and Finance.

**Not verifiable from here:**

- The 44,000 calls, the 10,000 limit's tier, and the 2027 pricing.
- That Pablo's routing of unassigned HomeScope PDFs works.
- Lai's SharePoint access and the Azure OpenAI setup. Andre's code is not in either repo.
- Whether the live Launchpad's mirror is already running against production Monday.

---

## Reference Notes

### Transcription artifacts

| As transcribed | Actually |
|---|---|
| *"Gray"*, *"Dre"* | **Andre** (*Dre* is his nickname). The seed has him as Andre Mikhail Serra |
| *"impoller"*, *"puller"*, *"polar"* | The **poller**, Andre's builder portal scraper |
| *"lunchpad"*, *"launch"* | **Launchpad** |
| *"UAP"* | Read as **UAT**, the test environment. Unconfirmed |
| *"EMDASH"*, *"CRM dash"* | **CRM Dash Sync** |
| *"dock for matter"*, *"dog formatter"* | **Doc formatter** |
| *"homeschool"*, *"home scope"*, *"coating tool"* | **HomeScope**, the **quoting** tool |
| *"MU"* | **Move** (Move Homes), next to Forma |
| *"Cyber night"*, *"Balance rating"* | **BAL rating** (bushfire attack level) |
| *"Postal distance"* | **Coastal distance**. Jerry: *"whether it's near the sea"* *(tr.)* |
| *"Light delay"* | **Title delay** (HomeScope's title delayed period). Probable |
| *"Sales Reptile"* | **sales rep** |
| *"Yung perfect talaga is yung nasa club"* | *"The perfect one really is the one in the [cloud?]"* *(tr.)*. Garbled |
| *"PG vector"* | **pgvector** (Postgres vector search) |
| *"Ailed"*, *"a led"* | **Aled** (Aled Smith, Company Accountant) |
| *"Allison"*, *"Alisson"*, *"Ali"* | **Alison Carter** (Sales Operations) |
| *"Yas"*, *"Yasmin"* | **Yasmin Georgiadis** (Non-Exec Director in the seed). Probable |
| *"Adam"* | **Adam Schaal** (Managing Director). Probable. Adam Orlando is a sales manager |
| *"Kelly"* | Unresolved. The seed's Kellie Boyer (Head of Marketing) is the nearest |
| *"Quentin"* | **Quentin Smith** (Advocate Manager WA) |
| *"Rachel"* | **Rachel Riggio** (Sales Associate). Probable |
| *"Brad"* | **Brad Linford** (Head of Finance). Probable |
| *"Conor"* | **Conor Lloyd-Fox** (Wealth Manager) |
| *"Anna Wieners"* | Not in the seed. Unresolved |
| *"200 yen per day"* | Garbled. Probably a Monday tier's limit (*"200[k]"*?) |
| *"you're Claude"*, *"5X"* | Kane's **Claude** plan, the 5x usage tier |

**Speaker mis-attributions:**

- 42:40, *"Yeah, I can integrate that here. But do you already have one built before?"* is given to
  Jerry. It reads as Pablo and Jerry talking over each other.
- About 51:00, Fathom gives Jerry *"I can handle that so Kane doesn't have to redo it from
  scratch"*. That was Andre.
- 1:07:00, *"Kane uh and andre probably you can join we have a meeting with a led monday"* is given
  to Kane. That was Jerry.

**Left out on purpose.** This repo is public. Client names and lot holders read off the live Monday
boards are not in this note. Neither are the HomeScope prices shown on screen or HomeScope's URL.

### Fathom action items, resolved

| Fathom | Owner | Row |
|---|---|---|
| [Schedule Doc Formatter mtg w/ Ali, Larnie, Andre, Kane (Oct 9 12:30–1:30)](https://fathom.video/calls/848118664?timestamp=169.9999) | Jerry | 1 |
| [Audit Monday.com API calls; propose optimizations](https://fathom.video/calls/848118664?timestamp=518.9999) | Andre | 3 |
| [Implement Exclusive Land in Launchpad; add Sales Manager view; grant Jerry access](https://fathom.video/calls/848118664?timestamp=1796.9999) | Kane, Jerry | 4, 5, 13. "Grant Jerry access" is read as Jerry granting Kane access to the Monday board |
| [Implement IT ticketing system in Launchpad (email-to-ticket, priorities, ideas)](https://fathom.video/calls/848118664?timestamp=2565.9999) | Pablo | 14 |
| [Schedule SharePoint migration decision mtg w/ Yasmin, Adam, Kelly (Oct 9)](https://fathom.video/calls/848118664?timestamp=2725.9999) | Jerry | 16 |
| [Enforce sales rep name/email on HomeScope submissions; route unassigned PDFs to Allison, Shannan, Larnie](https://fathom.video/calls/848118664?timestamp=2798.9999) | Pablo | 15 |
| [Coordinate w/ Kane on Lai/Sai data sources; point to Launchpad after mirroring](https://fathom.video/calls/848118664?timestamp=3038.9999) | Andre, Kane | 8 |
| [Mirror Monday.com + HubSpot to Launchpad prod; enable read-only; coord w/ Andre on Lai/Sai](https://fathom.video/calls/848118664?timestamp=3154.9999) | Kane | 7 |
| [Provide inputs to Kane for Sales Rep view](https://fathom.video/calls/848118664?timestamp=3303.9999) | Jerry | 12 |
| [Schedule Wealth Generator handover w/ Andre (Oct 9); include Jerry](https://fathom.video/calls/848118664?timestamp=3361.9999) | Pablo | 20 |
| [Draft plan for Teams/DL governance; restrict group creation to IT](https://fathom.video/calls/848118664?timestamp=3479.9999) | Pablo | 18 |
| [Upgrade Kane's Claude account to Premium (5x)](https://fathom.video/calls/848118664?timestamp=4069.9999) | Jerry | 21 |

Rows 2, 6, 9 to 11, 17, 19 and 22 to 24 came from the conversation, not from Fathom.

### What this call means for this prototype (proposed, not applied)

Nothing below has been changed. Each needs Kane's go-ahead.

1. **Exclusive land is only on Sales Manager** in `feat/sales-portal`. Jerry wants everyone to
   see it, and reps are the ones placing holds. Add it to the Sales Representative portal, or open
   it to every role in Admin. Row 4.
2. **Exclusive land has no way to add or retire lots.** Whoever maintains them (Alison?) needs a
   screen for it. Row 4.
3. **Rename Sales Manager's "Clients" to "All clients"** in `feat/sales-portal` (`dashboards.ts`,
   the `tab("sales", "clients", ...)` line). Kane and Jerry agreed the name on the call.
4. **Require "Prepared by" in the HomeScope rebuild** before Client details can continue, and drop
   the `"Unassigned"` fallback. That matches what Alison asked of the AWS version.
5. **HomeScope sits under Sales › Rapid costing › HomeScope.** Jerry and Kane both said HomeScope
   is the quotation tool and Rapid Costing is the separate pricing sheet being retired. Consider
   giving HomeScope (or "Quotes") its own Sales tab.
6. **Andre's seed title** (*"AI Engineer – Sales & Marketing"*) no longer matches his areas. Ask
   before renaming.
7. **Show Pablo IT › Help desk and the Tickets board before he builds a third system.** Help desk
   already has categories and priorities. The gaps are an email inbox (needs the backend) and an
   Idea type. The board's "Suggest an improvement" is close to ideas.
8. **Job title status** could add *Delayed* beside Titled and Untitled, per Jerry's description.

### Continuity

- **Follows [Meeting2](Meeting2.md)** (October 6, Operations team), which this call updates in
  four places:
  - The Doc formatter test moved from 12:00 to **12:30 to 1:30** on Friday October 9, and Andre and
    Kane joined it. Meeting2 row 3.
  - Meeting2 parked the HomeScope rebuild and the Rapid Costing replacement (decision 3). Here
    Jerry endorsed Kane's rebuild. Shannan wasn't on this call, and her conditions for release
    stand. Meeting2 row 9.
  - Meeting2's open question, whether sending stays off during the hold, has an answer for now:
    the production mirror only reads. Meeting2 row 1 becomes row 7 here, due October 13.
  - Meeting2 said Andre built the builder portal scrape. That holds, and it now goes to Kane.
- **Coming up:**
  - Thursday October 8: Wi-Fi settings.
  - Friday October 9: the Doc formatter meeting, the SharePoint decision meeting, the Wealth
    Generator handover, and Shannan's last day before leave.
  - Sunday October 11: the old SharePoint goes read-only.
  - Monday October 12: the meeting with Aled.
  - Tuesday October 13: the next huddle.

### Small talk

The call opened on the office printer. Pablo was fixing it, and Andre asked why the office has no
in-house IT person. Jerry: *"If they did, they wouldn't need us. Everything's remote now anyway."*
*(tr.)* During the Exclusive Land demo, Jerry joked that the team should buy neighbouring lots, and
that the Monday savings *"will go to the head of AI and IT."*
