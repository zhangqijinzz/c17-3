import { describe, expect, it } from 'vitest';
import {
  createStarterStory,
  type CharacterRelationship,
  type StoryDocument,
} from '../models/story';
import {
  normalizeStory,
  offstageCharacters,
  relationshipsInScene,
  relationshipsOfCharacter,
  sanitizeStory,
} from '../models/storyRules';

function storyWithoutRelationships(): Partial<StoryDocument> {
  const legacy: Partial<StoryDocument> = { ...createStarterStory() };
  delete legacy.relationships;
  return legacy;
}

describe('character relationship rules', () => {
  it('treats legacy projects without relationship data as having no relationships', () => {
    expect(sanitizeStory(storyWithoutRelationships())?.relationships).toEqual([]);
    expect(normalizeStory(storyWithoutRelationships()).relationships).toEqual([]);
  });

  it('prunes relationships that point at missing characters instead of leaving dangling data', () => {
    const story = createStarterStory();
    const dangling: CharacterRelationship = {
      id: 'relationship-dangling',
      fromId: story.characters[0].id,
      toId: 'character-ghost',
      type: 'rival',
      note: '指向一个已删除的人物',
    };
    const normalized = normalizeStory({ ...story, relationships: [...story.relationships, dangling] });
    expect(normalized.relationships.some((item) => item.id === 'relationship-dangling')).toBe(false);
    expect(normalized.relationships.length).toBe(story.relationships.length);
  });

  it('falls back unknown relationship types to other without rejecting the document', () => {
    const story = createStarterStory();
    const weird = { ...story.relationships[0], type: 'mystery' } as unknown as CharacterRelationship;
    const normalized = normalizeStory({ ...story, relationships: [weird] });
    expect(normalized.relationships[0].type).toBe('other');
  });

  it('lists relationships in a scene only when both endpoints share that scene', () => {
    const story = createStarterStory();
    const [harbor, storm] = [...story.scenes].sort((a, b) => a.order - b.order);
    expect(relationshipsInScene(story, harbor)).toEqual([]);
    const stormBonds = relationshipsInScene(story, storm);
    expect(stormBonds.length).toBe(2);
    expect(stormBonds.every((rel) => storm.characterIds.includes(rel.fromId) && storm.characterIds.includes(rel.toId))).toBe(true);
  });

  it('exposes directed relationships per character from both ends', () => {
    const story = createStarterStory();
    const [mira, june] = story.characters;
    expect(relationshipsOfCharacter(story, mira.id).length).toBe(2);
    const outgoing = relationshipsOfCharacter(story, june.id).filter((rel) => rel.fromId === june.id);
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].toId).toBe(mira.id);
    expect(outgoing[0].type).toBe('rival');
  });

  it('flags characters absent from every scene that still carry relationships', () => {
    const story = createStarterStory();
    expect(offstageCharacters(story)).toEqual([]);
    // 把裘恩移出唯一同场的第二幕（第一幕本就没有她）
    story.scenes = story.scenes.map((scene) =>
      scene.id === 'scene-storm' ? { ...scene, characterIds: scene.characterIds.filter((id) => id !== story.characters[1].id) } : scene,
    );
    const flagged = offstageCharacters(story);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].character.name).toBe('裘恩');
    expect(flagged[0].relationshipCount).toBe(2);
  });
});
