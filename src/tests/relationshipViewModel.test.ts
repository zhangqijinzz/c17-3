import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

function setup(): { viewModel: StoryViewModel; repository: LocalStoryRepository } {
  const repository = new LocalStoryRepository(new MemoryStorageService());
  const viewModel = new StoryViewModel(repository);
  viewModel.initialize();
  return { viewModel, repository };
}

describe('relationship view model flows', () => {
  it('adds directed relationships, keeps multiple between the same pair, and persists them', () => {
    const { viewModel, repository } = setup();
    const [mira, june] = viewModel.snapshot.story!.characters;
    const before = viewModel.snapshot.stats.relationships;

    viewModel.addRelationship(june.id, mira.id, 'family', '她终于承认米拉出现在父亲的信里。');
    expect(viewModel.snapshot.stats.relationships).toBe(before + 1);
    const juneBonds = viewModel.relationshipsForCharacter(june.id);
    expect(juneBonds.some((rel) => rel.fromId === june.id && rel.toId === mira.id && rel.type === 'family')).toBe(true);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.relationships.some((rel) => rel.type === 'family')).toBe(true);
  });

  it('rejects self relations, missing endpoints, and short notes', () => {
    const { viewModel } = setup();
    const [mira] = viewModel.snapshot.story!.characters;
    const before = viewModel.snapshot.stats.relationships;

    viewModel.addRelationship(mira.id, mira.id, 'ally', '自己与自己');
    expect(viewModel.snapshot.stats.relationships).toBe(before);
    viewModel.addRelationship(mira.id, 'character-missing', 'ally', '对方不存在的一条关系说明');
    expect(viewModel.snapshot.stats.relationships).toBe(before);
    viewModel.addRelationship(mira.id, viewModel.snapshot.story!.characters[1].id, 'rival', '短');
    expect(viewModel.snapshot.stats.relationships).toBe(before);
    expect(viewModel.snapshot.notice).toContain('一句');
  });

  it('keeps relationships intact when a character is renamed', () => {
    const { viewModel } = setup();
    const june = viewModel.snapshot.story!.characters[1];
    viewModel.updateCharacter(june.id, { name: '裘恩·海德', role: '沉船唯一继承人' });
    const renamed = viewModel.snapshot.story?.characters.find((item) => item.id === june.id);
    expect(renamed?.name).toBe('裘恩·海德');
    expect(viewModel.relationshipsForCharacter(june.id).length).toBe(2);
  });

  it('prompts when removing a character from their last scene and offers explicit cleanup', () => {
    const { viewModel } = setup();
    const june = viewModel.snapshot.story!.characters[1];
    expect(viewModel.offstageCharacters).toEqual([]);

    viewModel.toggleCharacter('scene-storm', june.id);
    expect(viewModel.snapshot.notice).toContain('不在任何场景');
    expect(viewModel.offstageCharacters[0].relationshipCount).toBe(2);

    viewModel.removeRelationshipsForCharacter(june.id);
    expect(viewModel.relationshipsForCharacter(june.id)).toEqual([]);
    expect(viewModel.offstageCharacters).toEqual([]);
  });

  it('opens a legacy saved project without relationships instead of erroring', () => {
    const storage = new MemoryStorageService();
    const legacyDoc: Partial<ReturnType<typeof createStarterStory>> = { ...createStarterStory() };
    delete legacyDoc.relationships;
    storage.write(JSON.stringify(legacyDoc));
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    expect(viewModel.snapshot.status).not.toBe('error');
    expect(viewModel.snapshot.story?.relationships).toEqual([]);
    expect(viewModel.snapshot.stats.relationships).toBe(0);
  });
});
