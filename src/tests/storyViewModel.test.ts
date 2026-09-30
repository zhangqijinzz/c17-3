import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('opens legacy projects without relations data instead of failing', () => {
    const storage = new MemoryStorageService();
    const legacy = createStarterStory() as Partial<ReturnType<typeof createStarterStory>>;
    delete legacy.relations;
    storage.write(JSON.stringify(legacy));
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    expect(viewModel.snapshot.story?.relations).toEqual([]);
  });

  it('creates directed relations, including more than one between the same pair', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const [mira, june] = viewModel.snapshot.story!.characters;
    viewModel.addRelation(mira.id, june.id, '盟友', 'ally', '共同守塔');
    viewModel.addRelation(mira.id, june.id, '猜忌', 'rival', '互相试探');
    expect(viewModel.snapshot.notice).toContain('猜忌');
    expect(viewModel.relationsOf(june.id)).toHaveLength(4);
    // 校验：不能与自己建立关系
    viewModel.addRelation(mira.id, mira.id, '自省', 'neutral', '');
    expect(viewModel.snapshot.notice).toContain('两个不同的人物');
  });

  it('keeps relations intact across renames and cleans them up on delete', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const june = viewModel.snapshot.story!.characters[1];
    const relationCount = viewModel.relationsOf(june.id).length;
    viewModel.renameCharacter(june.id, '小裘');
    expect(viewModel.snapshot.story?.characters.find((item) => item.id === june.id)?.name).toBe('小裘');
    expect(viewModel.relationsOf(june.id)).toHaveLength(relationCount);
    expect(viewModel.snapshot.notice).toContain('关系保持不变');

    viewModel.deleteCharacter(june.id);
    expect(viewModel.snapshot.story?.relations).toHaveLength(0);
    expect(viewModel.orphanRelationCount).toBe(0);
    expect(viewModel.snapshot.notice).toContain('清理');
  });

  it('warns when a character leaves their last scene while relations remain', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const mira = viewModel.snapshot.story!.characters[0];
    // 米拉出现在两个场景，先从第一幕移除，不应触发最后一场提示
    const firstScene = viewModel.snapshot.story!.scenes[0];
    viewModel.toggleCharacter(firstScene.id, mira.id);
    expect(viewModel.snapshot.notice).toBe('');
    // 再从最后一场（风暴前夜）移除：关系仍在，需要提示
    const secondScene = viewModel.snapshot.story!.scenes[1];
    viewModel.toggleCharacter(secondScene.id, mira.id);
    expect(viewModel.snapshot.notice).toContain('不在任何场景');
    expect(viewModel.snapshot.notice).toContain('关系');
  });

  it('brings relations into a scene only when both characters are present', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const stormScene = viewModel.snapshot.story!.scenes[1];
    viewModel.selectScene(stormScene.id);
    expect(viewModel.relationsForSelectedScene()).toHaveLength(2);
    const june = viewModel.snapshot.story!.characters[1];
    viewModel.toggleCharacter(stormScene.id, june.id);
    expect(viewModel.relationsForSelectedScene()).toHaveLength(0);
  });
});
