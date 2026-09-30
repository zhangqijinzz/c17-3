import {
  relationshipTypes,
  type CharacterRelationship,
  type RelationshipType,
  type StoryCharacter,
  type StoryDocument,
  type StoryScene,
  type StoryStats,
} from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    relationships: story.relationships.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

/** 某个人物发出或指向该人物的全部关系（有方向，保留原方向）。 */
export function relationshipsOfCharacter(story: StoryDocument, characterId: string): CharacterRelationship[] {
  return story.relationships.filter(
    (relationship) => relationship.fromId === characterId || relationship.toId === characterId,
  );
}

/** 同场人物之间正在生效的关系（任一端指向另一端，且双方都在该场出场）。 */
export function relationshipsInScene(story: StoryDocument, scene: StoryScene): CharacterRelationship[] {
  const cast = new Set(scene.characterIds);
  return story.relationships.filter(
    (relationship) => cast.has(relationship.fromId) && cast.has(relationship.toId),
  );
}

export interface OffstageCharacter {
  character: StoryCharacter;
  relationshipCount: number;
}

/** 不再出现在任何场景、但仍挂着关系的人物，需要作者决定清理或保留。 */
export function offstageCharacters(story: StoryDocument): OffstageCharacter[] {
  const castIds = new Set(story.scenes.flatMap((scene) => scene.characterIds));
  return story.characters
    .filter((character) => !castIds.has(character.id))
    .map((character) => ({
      character,
      relationshipCount: relationshipsOfCharacter(story, character.id).length,
    }))
    .filter((entry) => entry.relationshipCount > 0);
}

function normalizeRelationship(raw: unknown, characterIds: Set<string>): CharacterRelationship | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<CharacterRelationship>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.fromId !== 'string' ||
    typeof candidate.toId !== 'string' ||
    typeof candidate.note !== 'string'
  ) {
    return null;
  }
  // 任一端指向已不存在的人物即为悬空数据，直接清掉。
  if (!characterIds.has(candidate.fromId) || !characterIds.has(candidate.toId)) return null;
  const type: RelationshipType = (relationshipTypes as readonly string[]).includes(candidate.type ?? '')
    ? (candidate.type as RelationshipType)
    : 'other';
  return { id: candidate.id, fromId: candidate.fromId, toId: candidate.toId, type, note: candidate.note };
}

/**
 * 兼容旧项目：老存档没有 relationships 字段时视为「没有关系」；
 * 同时剔除引用了已删除/失效人物的悬空关系。
 */
export function normalizeStory(input: Partial<StoryDocument>): StoryDocument {
  const characterIds = new Set((input.characters ?? []).map((character) => character.id));
  const relationships = Array.isArray(input.relationships)
    ? input.relationships
        .map((relationship) => normalizeRelationship(relationship, characterIds))
        .filter((relationship): relationship is CharacterRelationship => relationship !== null)
    : [];
  return { ...(input as StoryDocument), relationships };
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  // 旧项目没有 relationships 数组：补齐为空，而不是判为损坏。
  if (candidate.relationships !== undefined && !Array.isArray(candidate.relationships)) return null;
  return normalizeStory(candidate);
}
