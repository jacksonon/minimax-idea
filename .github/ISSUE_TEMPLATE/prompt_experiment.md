---
name: M3 prompt experiment
about: Propose a change to the M3 screenplay prompt
title: "[prompt] "
labels: prompt-iteration
---

## Current behavior

<!-- What does the current `docs/prompts/screenplay.md` produce that you want to change? -->

## Proposed change

<!-- Quote the exact diff (system prompt or user prompt template). -->

## Test corpus

<!-- Which of the 20 cases in `docs/prompts/test-corpus.json` did you run? -->

- [ ] Case 1 (flying)
- [ ] Case 2 (school)
- [ ] Case 3 (chased)
- [ ] Case 4 (grandmother)
- [ ] Case 5 (falling)
- [ ] Case 6 (cats)
- [ ] Case 7 (underwater)
- [ ] Case 8 (wedding)
- [ ] Case 9 (teeth)
- [ ] Case 10 (city)
- [ ] Case 11 (party)
- [ ] Case 12 (forest)
- [ ] Case 13 (bedroom)
- [ ] Case 14 (soldier)
- [ ] Case 15 (paralyzed)
- [ ] Case 16 (vivid-color)
- [ ] Case 17 (train)
- [ ] Case 18 (interview)
- [ ] Case 19 (house)
- [ ] Case 20 (date)

## Metric

<!-- Per AGENTS.md §8.1, a "good" prompt change is one that improves a measurable property. Which one? -->

- [ ] `json_parse_success_rate` ↑
- [ ] `enum_compliance` ↑
- [ ] `scene_visual_distinctness` ↑
- [ ] `voiceover_no_meta_words` ↑
- [ ] `visual_prompt_length_compliance` ↑

## Measured before

<!-- Run `docs/prompts/test-corpus.json` against the current prompt. Paste the metric. -->

## Measured after

<!-- Same, with the proposed prompt. Paste the metric. -->

## Verdict

<!-- Net improvement, net regression, or noise? -->
