# Signal — judging demo

## Hook

A constellation is scattered points until someone sees the pattern connecting them; Signal does that with a person’s scattered post-disaster facts, then puts likely next logistics steps in order.

## Demo script (about 1:45)

**0:00–0:15 — Intro.** Show the intro screen. “After a disaster, people can have the facts but still not know what to do first. Signal helps turn those facts into an ordered plan, once they’re safe.” Point out the persistent safety notice, then choose **Get Started**.

**0:15–0:35 — Facts.** Enter these as three separate facts, then choose **Find my pattern**:

- “I evacuated with my kids.”
- “Their school is closed.”
- “We’re out of diapers and formula.”

“Each short fact is a signal on its own. Signal looks for a combination.”

**0:35–0:50 — Constellation.** Let the unconnected stars settle, then watch the lines draw and the name appear. “The facts are now connected into the pattern they support.”

**0:50–1:10 — Plan and evidence.** Show **Evacuee with dependents**, the ordered needs, and their resource cards. “The first steps are a family-friendly shelter, children’s supplies, school information, then childcare. Each card adds places to start. Below that, Signal shows which trigger each fact matched.”

**1:10–1:30 — Safety override.** Replace the facts with “Someone is unconscious” and “I want to die,” then submit. “Safety runs first: the calm plan and constellation disappear, and Signal immediately shows its 911 emergency alert. For a self-harm phrase, it also shows the 988 call-or-text guidance.” Point out that the fact form remains visible; the app stops matching and does not show a calm plan.

**1:30–1:45 — Takeaway.** Return to the normal example, open **View printable summary**, and point to **Print / Save**. “The ordered plan can be printed or saved as a PDF to carry or share offline.”

## What the matching does

Signal’s current matcher is explainable keyword and trigger logic, not a black-box AI service call. It checks each fact for whole-word keywords, marks a trigger when a keyword appears, and scores a pattern as the fraction of its triggers that were lit. In the demo, the three dependent-related triggers all light, so the displayed score is 3 of 3 (100%). That is a match-coverage score, not a calibrated probability or a guarantee of accuracy. The app also shows the matching facts and trigger labels so a person can see why a pattern appeared.

The safety check runs before pattern matching. It searches for listed danger phrases and ignores a phrase when a negation word appears within the three words before it. For example, **“nobody is hurt”** does not trigger the **“is hurt”** phrase because **“nobody”** is in that preceding window. This is phrase-based logic, not a claim that the app understands every context.

## Safety decision

Signal is for people who are already safe. It is not an active-emergency tool and does not replace 911. This is a deliberate product decision: when listed active-danger language is detected, the app skips matching and the calm logistics plan and immediately presents the 911 alert and call link. When self-harm language is detected, it also presents 988 call-or-text guidance. The persistent notice repeats the boundary throughout the normal flow.

## Likely judge questions

**How is this different from a general resource directory?**

A directory makes someone search categories themselves. Signal uses their facts to surface a likely situation, prioritize needs in an order, and attach practical starting points to each need.

**How do you know the matching is accurate?**

The rules are inspectable and the app shows which facts lit which triggers. The score reports trigger coverage, not proven real-world accuracy; the patterns and resources need validation with users and reliable local sources.

**What if someone’s situation doesn’t match any pattern?**

Signal says no pattern was found yet and suggests adding context, such as who is with them or what they lost. It does not invent a match or show an unsupported plan.

**Why no login or accounts?**

Deliberately frictionless: someone dealing with a disaster should be able to start planning without creating an account or remembering a password.
