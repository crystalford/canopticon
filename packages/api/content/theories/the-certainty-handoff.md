---
slug: "the-certainty-handoff"
title: "The certainty handoff"
dek: "A conclusion handed to someone else carries the sender's confidence in it, and leaves the reasons behind. The sender does not check because it feels right; the receiver cannot, because the reasons stayed with the sender."
topic: "AI-directed development"
date: "2026-11-24"
version: 1
claim: "When one party hands a conclusion to another to act on, the conclusion and the sender's confidence travel, and the grounds for it mostly do not. The sender skips the check because the conclusion feels right and assumes it was understood; the receiver cannot run the check without the grounds, and a language model is also inclined to go along with it. So a hunch becomes an instruction that neither party has tested, and the error surfaces later, after work has been built on it. Handing on the grounds in a form the receiver can run moves the test back to the handoff."
coined: "Chris Telford, Canopticon, 9 October 2026, in the essay Unverified hunches in AI-assisted software work; stated as a theory 24 November 2026"
based_on:
  - id: correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-
    label: "Correct but Not Yet Known"
  - id: stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis
    label: "Stateless Partners, Shared Traces"
related:
  - route: /articles/unverified-hunches-in-ai-assisted-software-work
    label: "Essay: Unverified hunches in AI-assisted software work (where the name was first used)"
  - route: /concepts/the-overhearer
    label: "Term: The agent as overhearer (why a fresh session lacks the grounds)"
  - route: /theories/cognitive-ectothermy
    label: "Theory: Cognitive ectothermy (the same exchange seen from the receiver's side)"
  - route: /theories/ground-blindness
    label: "Theory: Ground blindness (what is in steady use stops being checked)"
  - route: /papers/false-quiet
    label: "Paper: False Quiet (the mechanism this theory shares with the other three)"
propositions:
  - statement: "The feeling that a conclusion is right is a signal separate from whether it is right, and it decides whether the conclusion gets checked."
    grade: "Strong"
    refs: "1,2,3,14"
    basis: "Across four reasoning tasks, a low feeling of rightness went with longer rethinking and more changed answers; 37% of wrong solutions to magic tricks got Aha ratings above the average for right ones; an Aha induced by an unrelated anagram made false statements seem truer (preregistered, n = 300); premature closure was the most common cognitive cause in 100 diagnostic errors."
  - statement: "That feeling follows how easily and consistently an answer comes to mind, not whether it is valid."
    grade: "Strong"
    refs: "1,5"
    basis: "The feeling of rightness was predicted by how fluently the first answer came; confidence follows how consistently an answer is supported across the considerations that come to mind, so it is high for wrong answers that are consistently favoured."
  - statement: "A person handing on a meaning overestimates how well it got across."
    grade: "Strong"
    refs: "6,7"
    basis: "Speakers trying to convey one meaning of an ambiguous sentence expected to be understood more often than they were; across five experiments, people believed they conveyed tone by email better than they did, because they could not set aside their own reading."
  - statement: "A language model, as trained today, seldom asks what an instruction meant and tends to go along with the view the user states."
    grade: "Strong"
    refs: "10,11"
    basis: "Compared with people, models generated far fewer clarifications and acknowledgements and wrote as if common ground already existed, and training on preference data reduced these acts further; five assistants consistently matched users' stated beliefs across four tasks."
  - statement: "Certainty also crosses the handoff in the other direction: fluent output from an AI raises a person's confidence beyond its accuracy."
    grade: "Strong"
    refs: "16,17,18,19"
    basis: "People overestimated the accuracy of model answers given with default explanations, and longer explanations raised confidence without raising accuracy; participants with an AI assistant wrote less secure code and more often believed it secure; people solving reasoning problems with AI scored three points higher and overestimated their score by four (N = 246, replicated with 452). Automation bias is the older name for the same pattern."
  - statement: "Explaining a mechanism step by step lowers confidence that was not earned."
    grade: "Strong"
    refs: "12,13"
    basis: "People rated their understanding of devices lower after writing out how they work; asking people to explain policies in detail lowered their rated understanding and moderated their positions."
  - statement: "Time pressure removes the checks before it removes the work."
    grade: "Moderate"
    refs: "15"
    basis: "A systematic review of 102 studies found that time pressure in software work tends to raise output and lower quality, mainly because reviews and testing are dropped. One review, of studies not designed to test a handoff."
  - statement: "In work directed through an AI, much of the rework traces to conclusions handed on without their grounds, and a check the receiver can run (a test, a type, a worked example) prevents more of it than a note describing the intent."
    grade: "Proposed"
    refs: ""
    basis: "No study yet measures rework caused by unchecked conclusions given to coding agents. Controlled comparisons of context files for agents found that prose notes did not raise task success while tests and types did, which fits the claim without testing it."
cycle:
  - step: "A hunch arrives|already feeling right"
  - step: "Feels settled|fluency, not validity"
  - step: "Handed on|the reasons stay behind"
  - step: "Assumed understood|the meaning felt plain"
  - step: "Not questioned|no grounds to test"
  - step: "Built on|as if it had been checked"
  - step: "Found at review|after the cost has grown"
cycle_exit: "Hand on the reason with the conclusion, in a form the other side can run."
cycle_cut: 3
references:
  - text: "Thompson, V. A., Prowse Turner, J. A., & Pennycook, G. (2011). Intuition, reason, and metacognition. *Cognitive Psychology*, 63(3), 107–140. doi:10.1016/j.cogpsych.2011.06.001"
    url: "https://doi.org/10.1016/j.cogpsych.2011.06.001"
    read: "abstract"
  - text: "Danek, A. H., & Wiley, J. (2017). What about false insights? Deconstructing the Aha! experience along its multiple dimensions for correct and incorrect solutions separately. *Frontiers in Psychology*, 7, 2077. doi:10.3389/fpsyg.2016.02077 (the figures were checked in the open full text)"
    url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2016.02077/full"
    read: "abstract"
  - text: "Laukkonen, R. E., Kaveladze, B. T., Tangen, J. M., & Schooler, J. W. (2020). The dark side of Eureka: Artificially induced Aha moments make facts feel true. *Cognition*, 196, 104122. doi:10.1016/j.cognition.2019.104122"
    url: "https://doi.org/10.31234/osf.io/9w56m"
    read: "abstract"
  - text: "Salvi, C., Bricolo, E., Kounios, J., Bowden, E., & Beeman, M. (2016). Insight solutions are correct more often than analytic solutions. *Thinking & Reasoning*, 22(4), 443–460. doi:10.1080/13546783.2016.1141798"
    url: "https://doi.org/10.1080/13546783.2016.1141798"
    read: "secondary"
  - text: "Koriat, A. (2012). The self-consistency model of subjective confidence. *Psychological Review*, 119(1), 80–113. doi:10.1037/a0025648"
    url: "https://doi.org/10.1037/a0025648"
    read: "abstract"
  - text: "Keysar, B., & Henly, A. S. (2002). Speakers' overestimation of their effectiveness. *Psychological Science*, 13(3), 207–212. doi:10.1111/1467-9280.00439"
    url: "https://doi.org/10.1111/1467-9280.00439"
    read: "abstract"
  - text: "Kruger, J., Epley, N., Parker, J., & Ng, Z.-W. (2005). Egocentrism over e-mail: Can we communicate as well as we think? *Journal of Personality and Social Psychology*, 89(6), 925–936. doi:10.1037/0022-3514.89.6.925"
    url: "https://doi.org/10.1037/0022-3514.89.6.925"
    read: "abstract"
  - text: "Gilovich, T., Savitsky, K., & Medvec, V. H. (1998). The illusion of transparency: Biased assessments of others' ability to read one's emotional states. *Journal of Personality and Social Psychology*, 75(2), 332–346. doi:10.1037/0022-3514.75.2.332"
    url: "https://doi.org/10.1037/0022-3514.75.2.332"
    read: "secondary"
  - text: "Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In L. B. Resnick, J. M. Levine & S. D. Teasley (Eds.), *Perspectives on Socially Shared Cognition* (pp. 127–149). Washington, DC: American Psychological Association. doi:10.1037/10096-006"
    url: "https://doi.org/10.1037/10096-006"
    read: "secondary"
  - text: "Shaikh, O., Gligorić, K., Khetan, A., Gerstgrasser, M., Yang, D., & Jurafsky, D. (2024). Grounding gaps in language model generations. In *Proceedings of NAACL 2024* (pp. 6279–6296). doi:10.18653/v1/2024.naacl-long.348"
    url: "https://doi.org/10.18653/v1/2024.naacl-long.348"
    read: "abstract"
  - text: "Sharma, M., Tong, M., Korbak, T., et al. (2024). Towards understanding sycophancy in language models. *International Conference on Learning Representations (ICLR 2024)*. arXiv:2310.13548"
    url: "https://arxiv.org/abs/2310.13548"
    read: "abstract"
  - text: "Rozenblit, L., & Keil, F. (2002). The misunderstood limits of folk science: An illusion of explanatory depth. *Cognitive Science*, 26(5), 521–562. doi:10.1207/s15516709cog2605_1"
    url: "https://doi.org/10.1207/s15516709cog2605_1"
    read: "abstract"
  - text: "Fernbach, P. M., Rogers, T., Fox, C. R., & Sloman, S. A. (2013). Political extremism is supported by an illusion of understanding. *Psychological Science*, 24(6), 939–946. doi:10.1177/0956797612464058"
    url: "https://doi.org/10.1177/0956797612464058"
    read: "abstract"
  - text: "Graber, M. L., Franklin, N., & Gordon, R. (2005). Diagnostic error in internal medicine. *Archives of Internal Medicine*, 165(13), 1493–1499. doi:10.1001/archinte.165.13.1493"
    url: "https://doi.org/10.1001/archinte.165.13.1493"
    read: "abstract"
  - text: "Kuutila, M., Mäntylä, M., Farooq, U., & Claes, M. (2020). Time pressure in software engineering: A systematic review. *Information and Software Technology*, 121, 106257. doi:10.1016/j.infsof.2020.106257"
    url: "https://arxiv.org/abs/1901.05771"
    read: "abstract"
  - text: "Parasuraman, R., & Manzey, D. H. (2010). Complacency and bias in human use of automation: An attentional integration. *Human Factors*, 52(3), 381–410. doi:10.1177/0018720810376055"
    url: "https://doi.org/10.1177/0018720810376055"
    read: "abstract"
  - text: "Steyvers, M., Tejeda, H., Kumar, A., Belem, C., Karny, S., Hu, X., Mayer, L. W., & Smyth, P. (2025). What large language models know and what people think they know. *Nature Machine Intelligence*, 7(2), 221–231. doi:10.1038/s42256-024-00976-7"
    url: "https://www.nature.com/articles/s42256-024-00976-7"
    read: "abstract"
  - text: "Perry, N., Srivastava, M., Kumar, D., & Boneh, D. (2023). Do users write more insecure code with AI assistants? In *Proceedings of the 2023 ACM SIGSAC Conference on Computer and Communications Security* (pp. 2785–2799). doi:10.1145/3576915.3623157"
    url: "https://dl.acm.org/doi/pdf/10.1145/3576915.3623157"
    read: "abstract"
  - text: "Fernandes, D., Villa, S., Nicholls, S., Haavisto, O., Buschek, D., & Schmidt, A. (2026). AI makes you smarter but none the wiser: The disconnect between performance and metacognition. *Computers in Human Behavior*, 175, 108779. doi:10.1016/j.chb.2025.108779"
    url: "https://arxiv.org/abs/2409.16708"
    read: "abstract"
  - text: "Kahneman, D., & Klein, G. (2009). Conditions for intuitive expertise: A failure to disagree. *American Psychologist*, 64(6), 515–526. doi:10.1037/a0016755"
    url: "https://doi.org/10.1037/a0016755"
    read: "secondary"
cite: "Telford, C. (2026). The certainty handoff: a theory of why conclusions are passed on unchecked. Canopticon. canopticon.com/theories/the-certainty-handoff"
---

You ask an AI coding agent to rename something because the name is wrong. You know why it is wrong, so you do not say. The agent renames it, guesses at the reason, and builds on the guess. An hour later you are undoing work that rested on a hunch neither of you checked. A doctor handing over a patient at the end of a shift, a manager passing a decision to a team and a reviewer approving a change all do something similar: they pass on a conclusion, and the conclusion arrives with the sender's confidence but without the reasons for it.

This theory names that exchange and what follows from it. It was first stated in an essay on AI-assisted software work, and it rests on research the record holds on intuition and on working with partners that forget.

## Definition

**The certainty handoff** is the moment a conclusion passes from the person who reached it to someone who will act on it, carrying the sender's confidence and few of its grounds. The **grounds** are whatever would let someone else test the conclusion: the reason, the evidence, the case that prompted it, or a check that would fail if it were wrong.

The handoff has two halves. On the sender's side, the conclusion feels right, so it is not tested, and the sender believes it was conveyed as clearly as it is held. On the receiver's side, the conclusion arrives as an instruction, without what would be needed to test it. The theory's central claim is that each half removes the check the other might have made.

## Prior work

The parts are studied in separate fields.

| Existing idea | Field | What it captures | What it leaves out |
| --- | --- | --- | --- |
| Feeling of rightness [1] | Reasoning research | A feeling attached to a first answer decides whether it is rethought | What happens when the answer is passed on |
| False insight; the Eureka heuristic [2] [3] | Insight research | The Aha feeling can attach to wrong answers and lend them truth | Communication |
| Speaker overestimation; illusion of transparency [6] [7] [8] | Social psychology | Senders think they were understood more than they were | Whether the content was right to begin with |
| Grounding in communication [9] | Psycholinguistics | Conversation builds shared understanding through checks and repairs | Partners that do not repair, or forget between sessions |
| Premature closure [14] | Clinical error research | The first diagnosis stops the search for alternatives | The handover to the next clinician |
| Automation bias [16] | Human factors | People accept a machine's output without checking it | The person's own unchecked input to the machine |
| Sycophancy; grounding gaps [10] [11] | Language model research | Models go along with users and rarely ask | The user's side of the exchange |

**What this theory adds.** It joins the sender's error and the receiver's into one event, and shows that they compound: the sender's confidence removes the first check, and the missing grounds remove the second. It names where the check should go (at the handoff, before anything is built on the conclusion) and what form it must take (one the receiver can run). And it shows that when the receiver is an AI the handoff runs both ways: the person's hunch goes in unchecked, and the model's fluent answer comes back with confidence it has not earned.

## Mechanism

The handoff begins before anything is said. The research behind this theory starts from one finding: <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Introduction">the feeling that an intuition is right is a separate signal from the intuition itself</q>. That feeling decides whether a first answer is rethought [1], and it is produced by how easily and how consistently the answer comes to mind [1] [5]. A conclusion that came quickly and fits what one already believes feels finished, and a finished conclusion is not tested.

Handing it on adds a second error. People who try to convey a specific meaning expect to be understood more often than they are [6], and they cannot easily hear their own words as someone without their intention would hear them [7]. With an AI agent, the research puts it plainly: <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Section 3">Your intention is transparent *to you* because you hold it. The agent gets only the words.</q>

The receiver then has the conclusion without the grounds. A person in conversation would often ask what was meant, which is how misunderstandings are usually repaired [9]. A language model is less likely to ask and more likely to agree [10] [11]. In a project that runs over many sessions, the model also starts each one without the history behind the request: <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Part 1">the human presumes accumulated ground, and the model is trained to presume ground too, so neither party triggers repair.</q>

So the conclusion is acted on as if checked, and the error shows only when the output is reviewed, after other work rests on it. Pressure makes each step more likely, because reviews and testing are the first things dropped when time is short [15].

The handoff can also run in reverse. An AI's answer arrives fluent, complete and confident, and fluency is what produces the feeling of rightness in the person reading it. People given model answers with explanations overestimate their accuracy, and longer explanations raise their confidence without raising accuracy [17]. The person then hands that confidence on in turn.

## Evidence

The feeling of rightness is separate from rightness and governs checking (P1). Across four reasoning tasks, a low feeling of rightness went with longer rethinking and more changed answers [1]. Of 1,124 wrong solutions to magic tricks, <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Summary">37% of incorrect solutions got Aha ratings higher than the average for correct ones</q> [2]. An Aha produced by an unrelated anagram made false statements feel truer in a preregistered experiment of 300 people [3]. In 100 diagnostic errors, <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Key findings">Premature closure, "the failure to continue considering reasonable alternatives after an initial diagnosis was reached," was the single most common cause.</q> [14]

It follows fluency (P2). The reasoning studies put it directly: <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Key findings">FOR is driven largely by answer fluency, meaning how quickly and easily the answer came to mind, not by its validity.</q> [1] Confidence in general tracks how consistently an answer is supported, so it is high for wrong answers that are consistently favoured [5].

Senders overestimate how well they were understood (P3). In the classic experiment, speakers <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Section 3">believed they were understood 72% of the time, while listeners actually misunderstood them 39% of the time</q> [6]. Five experiments on email found the same overconfidence about tone, and traced it to egocentrism [7].

Models seldom ask and tend to agree (P4). Measured against human conversation, models were <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Summary">"three times less likely to initiate clarification and sixteen times less likely to provide follow-up requests than humans,"</q> and <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Part 1">"training on contemporary preference data leads to a reduction in generated grounding acts."</q> [10] Five assistants consistently matched users' stated beliefs across four kinds of task [11].

Certainty comes back the other way (P5). People overestimated the accuracy of model answers given with default explanations, and longer explanations raised confidence without improving accuracy [17]. Participants with an AI assistant wrote less secure code than those without one and were more likely to believe their code was secure [18]. People solving reasoning problems with AI scored three points higher than a norm group and overestimated their score by four, in a study of 246 people replicated with 452 [19]. Reviews of automation bias describe the same acceptance of machine output without checking [16].

Explaining lowers confidence that was not earned (P6). People rated their understanding of how devices work lower after writing out each step [12]; explaining policies in detail lowered rated understanding and moderated positions [13].

Time pressure removes the checks (P7). Across 102 studies of software teams, <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Summary">time pressure usually raises productivity but lowers quality, mainly because developers drop reviews and testing</q> [15].

What prevents the rework (P8) is the least studied part. The research is candid about the gap: <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Key findings">No study I found directly measures rework caused by unverified human intuitions given to coding agents.</q> The nearest evidence concerns what to give an agent: the best controlled comparisons show <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Summary">that naive artifacts (prose context files) do not raise task success</q>, and that what helps are <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Summary">the ones that constrain the work itself (tests, types, executable specs), not notes about it.</q>

## Measures

Four quantities make the theory checkable in any setting where one party directs another.

1. **Grounds rate.** Of the instructions handed on, the share that carry a reason or a check the receiver could use.
2. **Clarification rate.** How often the receiver asks what was meant, per instruction.
3. **Confidence gap.** The sender's rating of how clearly an instruction was conveyed, against what the receiver understood it to mean.
4. **Late-found share.** Of the errors found, the share found only at review, after other work depended on them, and the rework they cost.

The theory expects the late-found share to fall as the grounds rate rises, and the confidence gap to be widest under time pressure.

## Protocol

1. **Before handing on a conclusion, write its reason in one sentence.** If the sentence will not come, the conclusion has not been checked.
2. **Turn the reason into something the receiver can run.** A test that fails if the conclusion is wrong, an example of the case that prompted it, or the one thing that would change your mind.
3. **Ask for the conclusion back in the receiver's words.** For an AI, ask it to state the reason it will act on before it acts.
4. **Mark what is a hunch.** Say "I think" where you have not checked, so the receiver knows which parts to test.
5. **Treat a fluent answer as unchecked until it has been run.** Apply the same rules to what comes back.

## A four-question check

Before handing a conclusion to someone, or something, that will act on it:

1. Can you say why it is true in one sentence?
2. Have you checked it, or does it only feel right?
3. Does the receiver have what they would need to find out it is wrong?
4. Would anything fail before the work built on it is done, if it were wrong?

A no to any of them means the handoff carries certainty without grounds. This check is a working tool built from the measures above; it has not been validated.

**Worked example: renaming with an agent.** The developer can say why the name is wrong (1: yes) but has not checked that the new name fits every use (2: no), has not told the agent why (3: no), and nothing would fail if the agent guessed wrong (4: no). Three noes. One sentence of reason and a test that uses the new name in the case that prompted it would close the handoff.

**Worked example: an answer from an AI.** A model explains why a library call is safe. The reader finds the explanation convincing (1: yes, in the model's words), has not run it (2: no), and would learn it was wrong only in production (4: no). Two noes: run the case the explanation describes before relying on it [17] [18].

**Worked example outside software: a shift handover.** A clinician hands over a patient as "probably viral, nothing to do." The reason is not stated (1: no), the next clinician has no finding to recheck (3: no), and nothing in the plan would flag a wrong call before morning (4: no). Clinical research on premature closure points to the same remedy: recheck the findings against the first diagnosis and its alternatives [14].

## Scope

The theory applies wherever one party acts on another's conclusion without having reached it: delegation, handovers, code review, and above all work directed through AI agents, where the receiver forgets between sessions and is inclined to agree.

It does not say that intuitions should be distrusted. Insight solutions are correct more often than analytic ones [4], and expert intuition is reliable in settings regular enough, with feedback quick enough, to learn from [20]. The theory concerns what is lost when such a conclusion is passed on: even a correct hunch leaves its receiver unable to tell it from a wrong one.

## Counter-evidence

Stating the grounds has costs. Putting a forming idea into words can disrupt it, and the research's own advice is to check the idea once it has formed: <q doc="correct-but-not-yet-known-the-science-of-treating-a-fast-intuition-as-" section="Key findings">let the intuition form, then articulate and test it before it becomes a directive to someone else, not while it's still forming.</q> Spelling out every reason would also slow work that mostly goes right; the theory's protocol is meant for conclusions that others will build on, not for every remark.

Experienced people may already adjust. In one study of professionals delegating long tasks, they gave AI <q doc="stateless-partners-shared-traces-common-ground-stigmergy-and-naturalis" section="Details">"rigid, exhaustive instructions to minimize ambiguity and deviation,"</q> which suggests that the handoff is worst for people new to directing an AI, or for those who have worked with one long enough to stop being careful.

Several parts rest on evidence gathered for other purposes. The overestimation studies used ambiguous sentences and email tone, not technical instructions; the time-pressure review draws heavily on surveys and correlations; and the claim about rework in AI-directed work has not been measured at all. Models also change: the grounding gap and sycophancy were measured in models of 2023 and 2024, and later training may narrow them.
