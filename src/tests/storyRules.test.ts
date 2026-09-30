import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import {
  characterHasScene,
  getStats,
  getTimelineWarning,
  orderedScenes,
  orphanRelations,
  relationsBetween,
  relationsInScene,
  relationsOfCharacter,
  removeCharacterReferences,
  sanitizeStory,
  validateName,
} from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('treats legacy documents without relations as having no relations', () => {
    const legacy = { ...createStarterStory() } as Partial<ReturnType<typeof createStarterStory>>;
    delete legacy.relations;
    const sanitized = sanitizeStory(legacy);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.relations).toEqual([]);
  });

  it('drops dangling and malformed relations while keeping valid ones', () => {
    const story = createStarterStory();
    const [mira, june] = story.characters;
    const migrated = sanitizeStory({
      ...story,
      relations: [
        { id: 'good', fromCharacterId: mira.id, toCharacterId: june.id, kind: '盟友', polarity: 'ally', note: '' },
        { id: 'dangling', fromCharacterId: mira.id, toCharacterId: 'character-gone', kind: '旧友', polarity: 'neutral', note: '' },
        { id: 'self', fromCharacterId: mira.id, toCharacterId: mira.id, kind: '内心', polarity: 'neutral', note: '' },
        null,
      ],
    });
    expect(migrated?.relations.map((relation) => relation.id)).toEqual(['good']);
    // 未知极性安全回退为中性
    const weird = sanitizeStory({
      ...story,
      relations: [{ id: 'weird', fromCharacterId: mira.id, toCharacterId: june.id, kind: '羁绊', polarity: 'mysterious', note: '' }],
    });
    expect(weird?.relations[0].polarity).toBe('neutral');
  });

  it('supports multiple directed relations between the same pair and scene lookup', () => {
    const story = createStarterStory();
    const [mira, june] = story.characters;
    // 示例故事里同对人物已有两个方向各一条
    expect(relationsBetween(story, mira.id, june.id)).toHaveLength(2);
    expect(relationsOfCharacter(story, mira.id)).toHaveLength(2);
    const stormScene = story.scenes.find((scene) => scene.title === '风暴前夜');
    expect(relationsInScene(story, stormScene!)).toHaveLength(2);
    // 只有米拉一人出场的场景不带入关系
    const harborScene = story.scenes.find((scene) => scene.title === '旧港口的来信');
    expect(relationsInScene(story, harborScene!)).toHaveLength(0);
  });

  it('removing a character clears scenes and every attached relation', () => {
    const story = createStarterStory();
    const june = story.characters[1];
    expect(characterHasScene(story, june.id)).toBe(true);
    const cleaned = removeCharacterReferences(story, june.id);
    expect(cleaned.characters).toHaveLength(1);
    expect(cleaned.relations).toHaveLength(0);
    expect(orphanRelations(cleaned)).toHaveLength(0);
    expect(cleaned.scenes.every((scene) => !scene.characterIds.includes(june.id))).toBe(true);
  });
});
