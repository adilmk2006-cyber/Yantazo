/**
 * Shared validation layer. Every candidate puzzle passes through
 * `validatePuzzle` before it can be shown; generator-specific verifiers
 * re-derive the answer independently from the hidden rule data.
 */
import type { GeneratorDef } from './generator';
import type { Puzzle } from './types';

function containsWord(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(haystack);
}

export function validatePuzzle(p: Puzzle, def?: GeneratorDef): string[] {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(msg);

  if (!p.title.trim()) fail('missing title');
  if (!p.prompt.trim()) fail('missing prompt');
  if (p.hints.length !== 3 || p.hints.some((h) => !h || !h.trim())) fail('needs exactly three non-empty hints');
  if (new Set(p.hints).size !== p.hints.length) fail('hints must be distinct');
  if (!p.explanation.answer.trim()) fail('explanation is missing the answer');
  if (!p.explanation.rule.trim()) fail('explanation is missing the governing rule');
  if (p.explanation.steps.length === 0) fail('explanation needs at least one step');
  if (p.explanation.skills.length === 0) fail('explanation needs at least one skill');
  if (!p.fingerprint.structure || !p.fingerprint.key) fail('missing fingerprint');
  if (p.metrics.rules < 1 || p.metrics.steps < 1) fail('implausible difficulty metrics');
  if (p.display.blocks.length === 0 && !p.display.memorize) fail('nothing to display');

  const hintText = p.hints.join(' \n ');
  const it = p.interaction;
  const ans = p.answer;

  const checkChoiceSet = (choices: { id: string; label: string }[]) => {
    if (choices.length < 2) fail('needs at least two options');
    if (choices.length > 12) fail('too many options');
    if (new Set(choices.map((c) => c.id)).size !== choices.length) fail('duplicate option ids');
    if (new Set(choices.map((c) => c.label)).size !== choices.length) fail('duplicate option labels');
  };

  switch (it.type) {
    case 'choice':
    case 'investigation': {
      checkChoiceSet(it.choices);
      if (ans.type !== 'choice') {
        fail('choice interaction needs a choice answer');
        break;
      }
      const correct = it.choices.filter((c) => c.id === ans.correct);
      if (correct.length !== 1) fail('exactly one option must be correct');
      const label = correct[0]?.label;
      if (label && !p.explanation.answer.includes(label) && !(correct[0].text && p.explanation.answer.toLowerCase().includes(correct[0].text.toLowerCase().slice(0, 12))))
        fail('explanation does not name the correct option');
      // Every distractor must come with a reason it fails.
      const explained = new Set(p.explanation.alternatives.map((a) => a.choiceId).filter(Boolean));
      for (const c of it.choices) if (c.id !== ans.correct && !explained.has(c.id)) fail(`option ${c.label} has no explanation of why it is wrong`);
      if (label && new RegExp(`\\b(option|answer)\\s+${label}\\b`, 'i').test(hintText)) fail('a hint names the correct option');
      // Text options must not collide.
      const texts = it.choices.filter((c) => c.text).map((c) => c.text!.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) fail('duplicate option texts');
      break;
    }
    case 'multi': {
      checkChoiceSet(it.choices);
      if (ans.type !== 'multi') {
        fail('multi interaction needs a multi answer');
        break;
      }
      const ids = new Set(it.choices.map((c) => c.id));
      if (ans.correct.some((id) => !ids.has(id))) fail('multi answer references unknown option');
      break;
    }
    case 'text': {
      if (ans.type !== 'text') {
        fail('text interaction needs a text answer');
        break;
      }
      if (ans.accepted.length === 0) fail('text answer needs accepted answers');
      for (const a of [ans.canonical, ...ans.accepted]) if (a.length > 2 && containsWord(hintText, a)) fail(`a hint reveals the answer "${a}"`);
      if (!p.explanation.answer.toLowerCase().includes(ans.canonical.toLowerCase())) fail('explanation does not state the answer');
      if (it.fallback) {
        checkChoiceSet(it.fallback);
        if (!it.fallback.some((c) => c.id === ans.fallbackCorrect)) fail('fallback choices miss the correct option');
        const fbTexts = it.fallback.map((c) => (c.text ?? '').toLowerCase());
        if (new Set(fbTexts).size !== fbTexts.length) fail('duplicate fallback options');
      }
      break;
    }
    case 'number': {
      if (ans.type !== 'number' || !Number.isFinite(ans.value)) {
        fail('number interaction needs a finite numeric answer');
        break;
      }
      if (new RegExp(`(^|[^0-9.])${String(ans.value).replace('.', '\\.')}($|[^0-9])`).test(hintText)) fail('a hint states the numeric answer');
      if (!p.explanation.answer.includes(String(ans.value))) fail('explanation does not state the number');
      if (it.fallback) {
        checkChoiceSet(it.fallback);
        const fb = it.fallback.find((c) => c.id === ans.fallbackCorrect);
        if (!fb) fail('fallback choices miss the correct option');
        else if (fb.text !== String(ans.value)) fail('fallback correct option does not match the value');
        const vals = it.fallback.map((c) => c.text);
        if (new Set(vals).size !== vals.length) fail('duplicate fallback options');
      }
      break;
    }
    case 'order': {
      if (ans.type !== 'order') {
        fail('order interaction needs an order answer');
        break;
      }
      if (ans.solution.length !== it.slots.length) fail('order solution length mismatch');
      const seen = new Set(ans.solution);
      if (seen.size !== ans.solution.length || ans.solution.some((i) => i < 0 || i >= it.items.length)) fail('order solution is not a valid assignment');
      break;
    }
    case 'assign': {
      if (ans.type !== 'assign') {
        fail('assign interaction needs an assign answer');
        break;
      }
      if (ans.solution.length !== it.rows.length) fail('assign solution row mismatch');
      ans.solution.forEach((row) => {
        if (row.length !== it.columns.length) fail('assign solution column mismatch');
        row.forEach((v, c) => {
          if (v < 0 || v >= it.columns[c].options.length) fail('assign solution option out of range');
        });
      });
      break;
    }
    case 'cell': {
      if (ans.type !== 'cell' || ans.index < 0 || ans.index >= it.rows * it.cols) fail('cell answer out of range');
      break;
    }
    case 'sequence': {
      if (ans.type !== 'sequence' || ans.items.length === 0) {
        fail('sequence answer missing');
        break;
      }
      const ids = new Set(it.palette.map((x) => x.id));
      if (ans.items.some((x) => !ids.has(x))) fail('sequence answer uses unknown symbols');
      if (ans.items.length !== it.length) fail('sequence length mismatch');
      break;
    }
    case 'glyphs': {
      if (ans.type !== 'glyphs') {
        fail('glyph interaction needs glyph answer');
        break;
      }
      if (ans.indices.length !== it.count) fail('glyph answer count mismatch');
      if (ans.indices.some((i) => i < 0 || i >= it.figure.glyphs.length)) fail('glyph answer out of range');
      break;
    }
    case 'open': {
      if (ans.type !== 'self' || !ans.model.trim() || ans.keyPoints.length === 0) fail('open puzzle needs a model answer and key points');
      break;
    }
  }

  try {
    JSON.stringify(p);
  } catch {
    fail('puzzle is not serialisable');
  }

  if (def?.verify) {
    try {
      problems.push(...def.verify(p));
    } catch (e) {
      problems.push(`verifier crashed: ${(e as Error).message}`);
    }
  }
  return problems;
}
