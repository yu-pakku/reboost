import { describe, expect, it } from 'vitest';
import { clozePreview, countCharacters, textBoundaries, validateKnowledge, type KnowledgeDraft } from './knowledge';
const draft: KnowledgeDraft = { term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16 };
describe('登録内容と穴埋め', () => {
  it('仕様のHTTPを登録でき、原文位置からプレビューを作る', () => {
    expect(validateKnowledge(draft)).toEqual({});
    expect(draft.definition.slice(11, 16)).toBe('プロトコル');
    expect(clozePreview(draft)).toBe('Web通信で利用される＿＿＿＿');
  });
  it('空白のみと文字数上限を検証する', () => {
    expect(validateKnowledge({ ...draft, term: '　 ', definition: '\n\t' })).toHaveProperty('term');
    expect(validateKnowledge({ ...draft, definition: 'a'.repeat(1001) })).toHaveProperty('definition');
    expect(validateKnowledge({ ...draft, term: '🧠'.repeat(100) }).term).toBeUndefined();
    expect(validateKnowledge({ ...draft, term: '🧠'.repeat(101) }).term).toBeDefined();
    expect(countCharacters('🧠')).toBe(1);
  });
  it.each(['HTTPを使う通信', 'ｈｔｔｐを使う通信', 'HtTpを使う通信'])('答え漏洩を拒否する: %s', definition => {
    expect(validateKnowledge({ ...draft, definition })).toHaveProperty('definition');
  });
  it('繰り返しの2箇所目だけを空欄にする', () => {
    const value = { term: '例', definition: '猫と猫', cloze_start: 2, cloze_end: 3 };
    expect(validateKnowledge(value)).toEqual({}); expect(clozePreview(value)).toBe('猫と＿＿＿＿');
  });
  it.each([[-1, 1], [0, 100], [2, 1], [1, 1], [0.5, 2], [NaN, 2]])('不正なオフセットを拒否する (%s,%s)', (cloze_start, cloze_end) => {
    expect(validateKnowledge({ ...draft, cloze_start, cloze_end }).cloze).toBeDefined();
  });
  it('空白のみ・101文字の穴埋めを拒否する', () => {
    expect(validateKnowledge({ ...draft, definition: 'a b', cloze_start: 1, cloze_end: 2 }).cloze).toBeDefined();
    expect(validateKnowledge({ ...draft, definition: 'a'.repeat(101), cloze_start: 0, cloze_end: 101 }).cloze).toBeDefined();
  });
  it('絵文字・結合文字を分断せず原文を保つ', () => {
    const definition = '🧠と👨‍👩‍👧とe\u0301';
    expect(textBoundaries(definition)).toEqual([0, 2, 3, 11, 12, 14]);
    expect(validateKnowledge({ ...draft, definition, cloze_start: 0, cloze_end: 1 }).cloze).toBeDefined();
    expect(validateKnowledge({ ...draft, definition, cloze_start: 3, cloze_end: 5 }).cloze).toBeDefined();
    expect(validateKnowledge({ ...draft, definition, cloze_start: 12, cloze_end: 13 }).cloze).toBeDefined();
    expect(clozePreview({ ...draft, definition, cloze_start: 3, cloze_end: 11 })).toBe('🧠と＿＿＿＿とe\u0301');
  });
});
