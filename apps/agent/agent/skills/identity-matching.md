---
name: identity-matching
description: How to decide that a LinkedIn profile is the person behind a CRM email address, and when to refuse.
---

# Identity matching

You are given an email address. You need the person. Getting this wrong writes
a stranger's career onto a customer's record, so the procedure is built to fail
closed.

## Why the obvious approach does not work

`pmarchetti@fernhill.com` is not a name. Searching for it directly returns nothing.
Asking a model what it stands for produces "Paula Marchetti" — which happens to be
right, and would have been just as confident had it been wrong. You cannot tell
the difference afterwards, which is why guessing is banned outright.

What works is decomposition: `pmarchetti` contains the surname `marchetti`, and
searching *that* returns `linkedin.com/in/paulamarchetti` as the first result.
The guess went into the **query**, and the answer came from the profile.

That is the shape of every match: guess where to look, never what you will find.

## The procedure

0. **`read_crm_history` first.** It is free and it is often decisive. If they
   have ever replied to us from that address, you already have the strongest
   evidence available anywhere — `crm.thread-reply` — and a signature block may
   hand you their title as well. Start every match here, not at a search engine.
1. **`resolve_linkedin_profile`** with the email. It decomposes the local part
   and returns candidate slugs. These are leads, not answers.
2. **`get_linkedin_profile`** on each candidate, passing the email — **and the
   `contactId`**. It returns the profile *and a verdict*. Passing the id is
   what lets it copy their photograph, which it does only if the verdict comes
   back positive, in code, without asking you. Leaving it out costs the contact
   their picture and saves nothing.
3. **Read the verdict, not the profile.** It checks one thing: `nameMatches` —
   the real name on the profile is consistent with the email local part
   (`y` + `okonkwo` → Tomi Okonkwo).
4. If it does not pass, **stop**. Leaving "Pmarchetti" in the CRM is the correct
   outcome when you do not know.

Somebody whose LinkedIn URL is **already on the record** has been through all of
this before. Do not re-run it to get a picture — `fetch_contact_photo` is one
call, and the URL sitting there is the verification.

## Reporting the match

Call `identify_contact` with what you actually saw:

| What you have | Evidence to record | What happens |
| --- | --- | --- |
| The verdict passes | `linkedin.name-match` | Written to the record. |
| They replied from that address | `crm.thread-reply` | Written to the record. |
| A weaker signal only — a handle that resembles their name, a search citing the profile | `handle.name-form`, or `search.cites-profile` | Offered to a rep as a suggestion. |
| Sources disagree | add a `contradiction` entry | Held. Nobody is shown a guess. |

The middle row is the case this exists for. A suggestion is not a failed match.
It is the match, handed to the one person who can finish it.

Do not add evidence you did not observe to push a claim over a line.

## Things that look like evidence and are not

- **A search result.** Search says where to look. A query for "Paula Marchetti"
  once returned three different people, all with total confidence.
- **A matching first name.** Half the Chrises anywhere are not your Chris. The
  surname has to carry it.
- **Perplexity's view of somebody's job title.** It aggregates stale sources; it
  said "Account Executive L3" for a profile that reads "Growth Specialist at
  Fernhill". For identity, the person's own profile wins.
- **A very plausible expansion.** `jsmith` is probably J. Smith. Probably is not
  a source.

## When the person genuinely is not findable

Some people have no profile, or a name that cannot be reconciled with their
address. Say so plainly and move on. A contact that keeps its placeholder name
is a contact a human can fix in five seconds; a contact with the wrong person's
job history is one nobody knows to fix.
