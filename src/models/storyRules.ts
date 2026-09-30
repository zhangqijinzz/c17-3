import type {
  RelationPolarity,
  StoryCharacter,
  StoryDocument,
  StoryRelation,
  StoryScene,
  StoryStats,
} from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

/** 常见关系类型与倾向，供编辑器快捷选择；作者仍可自行填写类型 */
export const relationPresets: Array<{ kind: string; polarity: RelationPolarity }> = [
  { kind: '亲人', polarity: 'ally' },
  { kind: '盟友', polarity: 'ally' },
  { kind: '师徒', polarity: 'ally' },
  { kind: '恋人', polarity: 'ally' },
  { kind: '守护', polarity: 'ally' },
  { kind: '对手', polarity: 'rival' },
  { kind: '仇敌', polarity: 'rival' },
  { kind: '猜忌', polarity: 'rival' },
  { kind: '利用', polarity: 'rival' },
  { kind: '旧识', polarity: 'neutral' },
];

export function polarityLabel(polarity: RelationPolarity): string {
  return polarity === 'ally' ? '绑定' : polarity === 'rival' ? '对立' : '中性';
}

/** 与某个人物有关的全部关系（发出的与指向他的），用于人物卡展示 */
export function relationsOfCharacter(story: StoryDocument, characterId: string): StoryRelation[] {
  return story.relations.filter(
    (relation) => relation.fromCharacterId === characterId || relation.toCharacterId === characterId,
  );
}

/** 一对人物之间的全部关系（两个方向都算），同一对人允许不止一条 */
export function relationsBetween(story: StoryDocument, aId: string, bId: string): StoryRelation[] {
  return story.relations.filter(
    (relation) =>
      (relation.fromCharacterId === aId && relation.toCharacterId === bId) ||
      (relation.fromCharacterId === bId && relation.toCharacterId === aId),
  );
}

/** 两位人物同场时应带入场景的关系：只要双方都在这一幕出场，两个方向的关系都呈现 */
export function relationsInScene(story: StoryDocument, scene: StoryScene): StoryRelation[] {
  const cast = new Set(scene.characterIds);
  return story.relations.filter(
    (relation) => cast.has(relation.fromCharacterId) && cast.has(relation.toCharacterId),
  );
}

/** 任一端人物已不存在的关系，属于必须提示或清理的悬空数据 */
export function orphanRelations(story: StoryDocument): StoryRelation[] {
  const characterIds = new Set(story.characters.map((character) => character.id));
  return story.relations.filter(
    (relation) => !characterIds.has(relation.fromCharacterId) || !characterIds.has(relation.toCharacterId),
  );
}

/** 人物是否还出现在至少一个场景中 */
export function characterHasScene(story: StoryDocument, characterId: string): boolean {
  return story.scenes.some((scene) => scene.characterIds.includes(characterId));
}

export function characterName(story: StoryDocument, characterId: string): string {
  return story.characters.find((character) => character.id === characterId)?.name ?? '已移除人物';
}

/** 删除人物后，连带清掉其全部出场与以其为端点的关系，避免悬空数据 */
export function removeCharacterReferences(story: StoryDocument, characterId: string): StoryDocument {
  return {
    ...story,
    characters: story.characters.filter((character) => character.id !== characterId),
    scenes: story.scenes.map((scene) =>
      scene.characterIds.includes(characterId)
        ? { ...scene, characterIds: scene.characterIds.filter((id) => id !== characterId) }
        : scene,
    ),
    relations: story.relations.filter(
      (relation) => relation.fromCharacterId !== characterId && relation.toCharacterId !== characterId,
    ),
  };
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
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
  // 旧项目没有 relations 字段：视为没有关系，而不是出错
  const relations = Array.isArray(candidate.relations) ? candidate.relations : [];
  const characterIds = new Set(
    candidate.characters
      .filter((character): character is StoryCharacter => Boolean(character) && typeof character.id === 'string')
      .map((character) => character.id),
  );
  const normalizedRelations: StoryRelation[] = relations
    .filter(
      (relation): relation is StoryRelation =>
        Boolean(relation) &&
        typeof relation.id === 'string' &&
        typeof relation.fromCharacterId === 'string' &&
        typeof relation.toCharacterId === 'string' &&
        typeof relation.kind === 'string' &&
        typeof relation.note === 'string',
    )
    // 自指或指向已删除人物的关系属于悬空数据，直接剔除
    .filter(
      (relation) =>
        relation.fromCharacterId !== relation.toCharacterId &&
        characterIds.has(relation.fromCharacterId) &&
        characterIds.has(relation.toCharacterId),
    )
    .map((relation) => ({
      ...relation,
      polarity: relation.polarity === 'ally' || relation.polarity === 'rival' ? relation.polarity : 'neutral',
    }));
  return { ...(candidate as StoryDocument), relations: normalizedRelations };
}
