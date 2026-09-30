export type StoryStatus = 'draft' | 'complete';

export const relationshipTypes = ['ally', 'rival', 'family', 'mentor', 'love', 'other'] as const;

export type RelationshipType = (typeof relationshipTypes)[number];

export const relationshipTypeLabels: Record<RelationshipType, string> = {
  ally: '绑定 / 同盟',
  rival: '对立 / 敌对',
  family: '亲属',
  mentor: '师徒',
  love: '爱慕',
  other: '其他',
};

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  color: string;
}

/**
 * 有方向的人物关系：fromId → toId。
 * 同一对人物可以存在多条（含方向相反）的关系，各记一句说明。
 */
export interface CharacterRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  note: string;
}

export interface StoryScene {
  id: string;
  title: string;
  order: number;
  summary: string;
  conflict: string;
  characterIds: string[];
  clueIds: string[];
}

export interface StoryClue {
  id: string;
  title: string;
  setupSceneId: string;
  payoffSceneId: string;
}

export interface StoryDocument {
  version: 1;
  id: string;
  title: string;
  status: StoryStatus;
  characters: StoryCharacter[];
  relationships: CharacterRelationship[];
  scenes: StoryScene[];
  clues: StoryClue[];
  selectedSceneId: string;
  updatedAt: string;
}

export interface StoryStats {
  characters: number;
  relationships: number;
  scenes: number;
  clues: number;
  unresolvedClues: number;
  completion: number;
}

export const characterColors = ['coral', 'blue', 'gold', 'sage', 'violet'] as const;

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createStarterStory(): StoryDocument {
  const miraId = 'character-mira';
  const juneId = 'character-june';
  const oldHarborId = 'scene-old-harbor';
  const firstLetterId = 'clue-first-letter';
  return {
    version: 1,
    id: 'story-last-lighthouse',
    title: '最后的灯塔',
    status: 'draft',
    characters: [
      { id: miraId, name: '米拉', role: '灯塔守望人', color: 'coral' },
      { id: juneId, name: '裘恩', role: '失踪船长的女儿', color: 'blue' },
    ],
    relationships: [
      {
        id: 'relationship-mira-june-ally',
        fromId: miraId,
        toId: juneId,
        type: 'ally',
        note: '为查明沉船真相暂时结盟，共同守护灯塔。',
      },
      {
        id: 'relationship-june-mira-rival',
        fromId: juneId,
        toId: miraId,
        type: 'rival',
        note: '怀疑米拉隐瞒了父亲失踪当夜的真相。',
      },
    ],
    scenes: [
      {
        id: oldHarborId,
        title: '旧港口的来信',
        order: 1,
        summary: '米拉收到一封来自已故船长的信，潮汐表背面写着一个日期。',
        conflict: '她必须决定是否相信一封不可能寄出的信。',
        characterIds: [miraId],
        clueIds: [firstLetterId],
      },
      {
        id: 'scene-storm',
        title: '风暴前夜',
        order: 2,
        summary: '裘恩抵达灯塔，带来一枚从沉船上找到的铜制罗盘。',
        conflict: '两人对罗盘的来历各执一词。',
        characterIds: [miraId, juneId],
        clueIds: [],
      },
    ],
    clues: [
      {
        id: firstLetterId,
        title: '潮汐表背后的日期',
        setupSceneId: oldHarborId,
        payoffSceneId: '',
      },
    ],
    selectedSceneId: oldHarborId,
    updatedAt: new Date().toISOString(),
  };
}
