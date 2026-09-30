import {
  characterColors,
  createId,
  createStarterStory,
  type CharacterRelationship,
  type RelationshipType,
  type StoryCharacter,
  type StoryClue,
  type StoryDocument,
  type StoryScene,
} from '../models/story';
import {
  getStats,
  getTimelineWarning,
  offstageCharacters,
  orderedScenes,
  relationshipsInScene,
  relationshipsOfCharacter,
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
    stats: { characters: 0, relationships: 0, scenes: 0, clues: 0, unresolvedClues: 0, completion: 0 },
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

  /** 人物改名 / 调整身份：关系按人物 id 关联，改名不会让关系悬空。 */
  updateCharacter(characterId: string, patch: Partial<Pick<StoryCharacter, 'name' | 'role'>>): void {
    const name = patch.name !== undefined ? validateName(patch.name) : undefined;
    if (name === '至少输入 2 个字') {
      this.setState({ notice: name });
      return;
    }
    this.updateStory((story) => ({
      ...story,
      characters: story.characters.map((character) =>
        character.id === characterId
          ? {
              ...character,
              ...(name !== undefined ? { name } : {}),
              ...(patch.role !== undefined ? { role: patch.role.trim() || character.role } : {}),
            }
          : character,
      ),
    }), false);
  }

  /** 建立一条有方向的关系：fromId → toId；同一对人物允许多条。 */
  addRelationship(fromId: string, toId: string, type: RelationshipType, note: string): void {
    const story = this.requireStory();
    if (!story.characters.some((character) => character.id === fromId)
      || !story.characters.some((character) => character.id === toId)) {
      this.setState({ notice: '请先选择关系两端的人物' });
      return;
    }
    if (fromId === toId) {
      this.setState({ notice: '关系需要连接两位不同的人物' });
      return;
    }
    const cleanNote = note.trim();
    if (cleanNote.length < 2) {
      this.setState({ notice: '请用一句话写下关系说明' });
      return;
    }
    const relationship: CharacterRelationship = {
      id: createId('relationship'),
      fromId,
      toId,
      type,
      note: cleanNote,
    };
    this.updateStory((current) => ({ ...current, relationships: [...current.relationships, relationship] }));
    this.setState({ notice: '人物关系已建立' });
  }

  removeRelationship(relationshipId: string): void {
    this.updateStory((story) => ({
      ...story,
      relationships: story.relationships.filter((relationship) => relationship.id !== relationshipId),
    }));
    this.setState({ notice: '已删除一条人物关系' });
  }

  /** 明确清理：移除与某位人物相关的全部关系（人物彻底离开故事时使用）。 */
  removeRelationshipsForCharacter(characterId: string): void {
    const character = this.requireStory().characters.find((item) => item.id === characterId);
    this.updateStory((story) => ({
      ...story,
      relationships: story.relationships.filter(
        (relationship) => relationship.fromId !== characterId && relationship.toId !== characterId,
      ),
    }));
    this.setState({ notice: character ? `已清理「${character.name}」关联的全部关系` : '已清理相关人物关系' });
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
    let removing = false;
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const hasCharacter = scene.characterIds.includes(characterId);
        removing = hasCharacter;
        return { ...scene, characterIds: hasCharacter ? scene.characterIds.filter((id) => id !== characterId) : [...scene.characterIds, characterId] };
      }),
    }));
    // 移出当前场景后若不再出现在任何场景，提示作者处理挂着的关系，避免无声悬空。
    if (removing) {
      const story = this.requireStory();
      const stillCast = story.scenes.some((scene) => scene.characterIds.includes(characterId));
      const relationshipCount = relationshipsOfCharacter(story, characterId).length;
      if (!stillCast && relationshipCount > 0) {
        const name = story.characters.find((character) => character.id === characterId)?.name ?? '该人物';
        this.setState({ notice: `「${name}」已不在任何场景中，仍有 ${relationshipCount} 条关系，请在人物卡中清理或保留。` });
      }
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

  get timelineWarning(): string | null {
    const story = this.state.story;
    return story ? getTimelineWarning(story) : null;
  }

  relationshipsForCharacter(characterId: string): CharacterRelationship[] {
    const story = this.state.story;
    return story ? relationshipsOfCharacter(story, characterId) : [];
  }

  relationshipsForScene(scene: StoryScene): CharacterRelationship[] {
    const story = this.state.story;
    return story ? relationshipsInScene(story, scene) : [];
  }

  get offstageCharacters() {
    const story = this.state.story;
    return story ? offstageCharacters(story) : [];
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
