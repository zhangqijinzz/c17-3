import {
  characterColors,
  createId,
  createStarterStory,
  type RelationPolarity,
  type StoryCharacter,
  type StoryClue,
  type StoryDocument,
  type StoryRelation,
  type StoryScene,
} from '../models/story';
import {
  characterHasScene,
  characterName,
  getStats,
  getTimelineWarning,
  orderedScenes,
  orphanRelations,
  relationsInScene,
  relationsOfCharacter,
  removeCharacterReferences,
  validateName,
} from '../models/storyRules';
import type { StoryRepository } from '../repositories/storyRepository';

export type ViewModelStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface StoryViewState {
  status: ViewModelStatus;
  story: StoryDocument | null;
  stats: ReturnType<typeof getStats>;
  notice: string;
  error: string;
  search: string;
  activeSection: 'overview' | 'characters' | 'clues';
}

type Listener = () => void;

export class StoryViewModel {
  private state: StoryViewState = {
    status: 'loading',
    story: null,
    stats: { characters: 0, scenes: 0, clues: 0, unresolvedClues: 0, completion: 0 },
    notice: '',
    error: '',
    search: '',
    activeSection: 'overview',
  };
  private readonly listeners = new Set<Listener>();

  constructor(private readonly repository: StoryRepository) {}

  get snapshot(): StoryViewState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  initialize(): void {
    try {
      const story = this.repository.load();
      this.setState({ status: story.status === 'complete' ? 'completed' : 'ready', story, stats: getStats(story), error: '' });
    } catch {
      this.setState({ status: 'error', error: '故事读取失败，请重置为示例项目。' });
    }
  }

  setSearch(search: string): void {
    this.setState({ search });
  }

  setSection(activeSection: StoryViewState['activeSection']): void {
    this.setState({ activeSection });
  }

  selectScene(sceneId: string): void {
    this.updateStory((story) => ({ ...story, selectedSceneId: sceneId }));
  }

  addCharacter(name: string, role: string): void {
    const cleanName = validateName(name);
    if (cleanName === '至少输入 2 个字') {
      this.setState({ notice: cleanName });
      return;
    }
    const story = this.requireStory();
    const character: StoryCharacter = {
      id: createId('character'),
      name: cleanName,
      role: role.trim() || '待定义角色',
      color: characterColors[story.characters.length % characterColors.length],
    };
    this.updateStory((current) => ({ ...current, characters: [...current.characters, character] }));
    this.setState({ notice: `已加入人物「${character.name}」` });
  }

  /** 改名只动名字，关系按人物 id 关联，不会因此悬空 */
  renameCharacter(characterId: string, name: string): void {
    const cleanName = validateName(name);
    if (cleanName === '至少输入 2 个字') {
      this.setState({ notice: cleanName });
      return;
    }
    this.updateStory((story) => ({
      ...story,
      characters: story.characters.map((character) =>
        character.id === characterId ? { ...character, name: cleanName } : character,
      ),
    }));
    this.setState({ notice: '人物已改名，相关关系保持不变' });
  }

  /** 删除人物会连带清除其出场记录与全部关系，并回报清理结果 */
  deleteCharacter(characterId: string): void {
    const story = this.requireStory();
    const target = story.characters.find((character) => character.id === characterId);
    if (!target) return;
    const relationCount = relationsOfCharacter(story, characterId).length;
    const sceneCount = story.scenes.filter((scene) => scene.characterIds.includes(characterId)).length;
    this.updateStory((current) => removeCharacterReferences(current, characterId));
    const parts = [`已删除人物「${target.name}」`];
    if (relationCount > 0) parts.push(`清理 ${relationCount} 条关联关系`);
    if (sceneCount > 0) parts.push(`从 ${sceneCount} 个场景移除`);
    this.setState({ notice: parts.join('，') });
  }

  addScene(title: string, summary: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    const story = this.requireStory();
    const scene: StoryScene = {
      id: createId('scene'),
      title: cleanTitle,
      order: story.scenes.length + 1,
      summary: summary.trim() || '还没有写下这一幕发生了什么。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    };
    this.updateStory((current) => ({ ...current, scenes: [...current.scenes, scene], selectedSceneId: scene.id }));
    this.setState({ notice: `已创建场景「${scene.title}」` });
  }

  updateScene(sceneId: string, patch: Partial<Pick<StoryScene, 'title' | 'summary' | 'conflict'>>): void {
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)),
    }), false);
  }

  toggleCharacter(sceneId: string, characterId: string): void {
    const before = this.requireStory();
    const scene = before.scenes.find((item) => item.id === sceneId);
    const isRemoving = scene?.characterIds.includes(characterId) ?? false;
    // 移除后该人物是否不再出现在任何场景：在出场前先判断，提示其关系将如何处理
    const lastScene =
      isRemoving &&
      characterHasScene(before, characterId) &&
      before.scenes.filter((item) => item.characterIds.includes(characterId)).length === 1;
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((item) => {
        if (item.id !== sceneId) return item;
        const hasCharacter = item.characterIds.includes(characterId);
        return { ...item, characterIds: hasCharacter ? item.characterIds.filter((id) => id !== characterId) : [...item.characterIds, characterId] };
      }),
    }));
    if (lastScene) {
      const relationCount = relationsOfCharacter(before, characterId).length;
      const name = characterName(before, characterId);
      this.setState({
        notice:
          relationCount > 0
            ? `「${name}」已不在任何场景中，仍保留 ${relationCount} 条关系；若不再使用，请在人物卡删除以清理关系`
            : `「${name}」已不在任何场景中；若不再使用，可在人物卡删除该人物`,
      });
    }
  }

  addRelation(
    fromCharacterId: string,
    toCharacterId: string,
    kind: string,
    polarity: RelationPolarity,
    note: string,
  ): void {
    const story = this.requireStory();
    if (!fromCharacterId || !toCharacterId) {
      this.setState({ notice: '请选择关系两端的人物' });
      return;
    }
    if (fromCharacterId === toCharacterId) {
      this.setState({ notice: '一条关系需要两个不同的人物' });
      return;
    }
    const cleanKind = kind.trim();
    if (cleanKind.length === 0) {
      this.setState({ notice: '请填写关系类型，例如：盟友、对手' });
      return;
    }
    const from = story.characters.find((character) => character.id === fromCharacterId);
    const to = story.characters.find((character) => character.id === toCharacterId);
    if (!from || !to) {
      this.setState({ notice: '关系两端的人物已不存在，请重新选择' });
      return;
    }
    const relation: StoryRelation = {
      id: createId('relation'),
      fromCharacterId,
      toCharacterId,
      kind: cleanKind,
      polarity,
      note: note.trim(),
    };
    this.updateStory((current) => ({ ...current, relations: [...current.relations, relation] }));
    this.setState({
      notice: `已记录：${from.name} → ${to.name} 的「${cleanKind}」关系`,
    });
  }

  removeRelation(relationId: string): void {
    const story = this.requireStory();
    const relation = story.relations.find((item) => item.id === relationId);
    this.updateStory((current) => ({
      ...current,
      relations: current.relations.filter((item) => item.id !== relationId),
    }));
    if (relation) {
      this.setState({
        notice: `已删除 ${characterName(story, relation.fromCharacterId)} → ${characterName(story, relation.toCharacterId)} 的「${relation.kind}」关系`,
      });
    }
  }

  moveScene(sceneId: string, direction: 'up' | 'down'): void {
    const scenes = orderedScenes(this.requireStory());
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= scenes.length) return;
    [scenes[index], scenes[nextIndex]] = [scenes[nextIndex], scenes[index]];
    this.updateStory((story) => ({ ...story, scenes: scenes.map((scene, sceneIndex) => ({ ...scene, order: sceneIndex + 1 })) }));
    this.setState({ notice: '时间线顺序已更新' });
  }

  addClue(title: string, setupSceneId: string, payoffSceneId: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    if (!setupSceneId) {
      this.setState({ notice: '请先选择伏笔埋下的场景' });
      return;
    }
    const clue: StoryClue = { id: createId('clue'), title: cleanTitle, setupSceneId, payoffSceneId };
    this.updateStory((story) => ({
      ...story,
      clues: [...story.clues, clue],
      scenes: story.scenes.map((scene) => scene.id === setupSceneId ? { ...scene, clueIds: [...scene.clueIds, clue.id] } : scene),
    }));
    this.setState({ notice: payoffSceneId ? '伏笔关系已建立' : '伏笔已记录，等待回收' });
  }

  completeProject(): void {
    this.updateStory((story) => ({ ...story, status: 'complete' }));
    this.setState({ status: 'completed', notice: '项目已标记为完成，仍可继续编辑' });
  }

  resetProject(): void {
    const story = createStarterStory();
    this.persist(story);
    this.setState({ status: 'ready', story, stats: getStats(story), notice: '已恢复示例项目', error: '' });
  }

  get visibleCharacters(): StoryCharacter[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return story.characters.filter((character) => `${character.name}${character.role}`.toLowerCase().includes(keyword));
  }

  get visibleScenes(): StoryScene[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return orderedScenes(story).filter((scene) => `${scene.title}${scene.summary}${scene.conflict}`.toLowerCase().includes(keyword));
  }

  get selectedScene(): StoryScene | null {
    const story = this.state.story;
    return story?.scenes.find((scene) => scene.id === story.selectedSceneId) ?? null;
  }

  relationsOf(characterId: string): StoryRelation[] {
    const story = this.state.story;
    return story ? relationsOfCharacter(story, characterId) : [];
  }

  relationsForSelectedScene(): StoryRelation[] {
    const story = this.state.story;
    const scene = this.selectedScene;
    return story && scene ? relationsInScene(story, scene) : [];
  }

  /** 悬空关系数量：任何清理失败或外部脏数据都会在这里显形 */
  get orphanRelationCount(): number {
    const story = this.state.story;
    return story ? orphanRelations(story).length : 0;
  }

  get timelineWarning(): string | null {
    const story = this.state.story;
    return story ? getTimelineWarning(story) : null;
  }

  private requireStory(): StoryDocument {
    if (!this.state.story) throw new Error('故事尚未初始化');
    return this.state.story;
  }

  private updateStory(updater: (story: StoryDocument) => StoryDocument, showEditing = true): void {
    const story = updater(this.requireStory());
    this.persist(story);
    this.setState({ story, stats: getStats(story), status: showEditing ? 'editing' : this.state.status, error: '' });
  }

  private persist(story: StoryDocument): void {
    try {
      this.repository.save({ ...story, updatedAt: new Date().toISOString() });
    } catch {
      this.setState({ status: 'error', error: '保存失败，但当前编辑仍保留在页面中。' });
    }
  }

  private setState(patch: Partial<StoryViewState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
