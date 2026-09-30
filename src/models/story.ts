export type StoryStatus = 'draft' | 'complete';

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  color: string;
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

/** 关系的情感倾向：ally 绑定 / rival 对立 / neutral 中性，决定人物视图里的配色 */
export type RelationPolarity = 'ally' | 'rival' | 'neutral';

/** 两个人物之间一条带方向的关系，同一对人物允许存在多条 */
export interface StoryRelation {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  kind: string;
  polarity: RelationPolarity;
  note: string;
}

export interface StoryDocument {
  version: 1;
  id: string;
  title: string;
  status: StoryStatus;
  characters: StoryCharacter[];
  scenes: StoryScene[];
  clues: StoryClue[];
  relations: StoryRelation[];
  selectedSceneId: string;
  updatedAt: string;
}

export interface StoryStats {
  characters: number;
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
    relations: [
      {
        id: 'relation-june-distrusts-mira',
        fromCharacterId: juneId,
        toCharacterId: miraId,
        kind: '猜忌',
        polarity: 'rival',
        note: '裘恩怀疑米拉隐瞒了父亲失踪那晚的真相。',
      },
      {
        id: 'relation-mira-guards-june',
        fromCharacterId: miraId,
        toCharacterId: juneId,
        kind: '守护',
        polarity: 'ally',
        note: '米拉答应过老船长，要照看他唯一的女儿。',
      },
    ],
    selectedSceneId: oldHarborId,
    updatedAt: new Date().toISOString(),
  };
}
