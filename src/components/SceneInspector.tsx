import type { StoryCharacter, StoryScene } from '../models/story';
import { characterName, polarityLabel } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface SceneInspectorProps { viewModel: StoryViewModel; scene: StoryScene | null; characters: StoryCharacter[]; }

export function SceneInspector({ viewModel, scene, characters }: SceneInspectorProps) {
  if (!scene) return <section className="panel inspector empty-inspector"><span className="eyebrow">INSPECTOR</span><h2>选择一个场景</h2><p>从时间线中选择一幕，开始补充人物、冲突和节奏。</p></section>;
  const story = viewModel.snapshot.story;
  const index = story ? [...story.scenes].sort((a, b) => a.order - b.order).findIndex((item) => item.id === scene.id) : 0;
  const relations = viewModel.relationsForSelectedScene();
  return (
    <section className="panel inspector">
      <div className="inspector-top"><div><span className="eyebrow">SCENE {String(index + 1).padStart(2, '0')} / 场景详情</span><h2>{scene.title}</h2></div><span className="edit-state">编辑中</span></div>
      <label>场景标题<input value={scene.title} onChange={(event) => viewModel.updateScene(scene.id, { title: event.target.value })} /></label>
      <label>这一幕发生了什么<textarea value={scene.summary} onChange={(event) => viewModel.updateScene(scene.id, { summary: event.target.value })} rows={3} /></label>
      <label>核心冲突<textarea value={scene.conflict} onChange={(event) => viewModel.updateScene(scene.id, { conflict: event.target.value })} rows={2} placeholder="是什么让人物无法轻易得到想要的东西？" /></label>
      <div className="field-block"><span className="field-label">出场人物</span><div className="person-toggles">{characters.map((character) => <button key={character.id} className={scene.characterIds.includes(character.id) ? `person-toggle selected ${character.color}` : 'person-toggle'} onClick={() => viewModel.toggleCharacter(scene.id, character.id)}><span>{character.name.slice(0, 1)}</span>{character.name}</button>)}</div></div>
      <div className="field-block scene-relations">
        <span className="field-label">同场关系（随出场人物自动带入）</span>
        {scene.characterIds.length < 2 && <span className="hint-inline">至少两位人物同场时，才会带入彼此的关系。</span>}
        {scene.characterIds.length >= 2 && relations.length === 0 && <span className="hint-inline">这几位人物之间还没有记录关系，可在人物卡中补充。</span>}
        {relations.map((relation) => (
          <div key={relation.id} className={`scene-relation ${relation.polarity}`}>
            <i>{polarityLabel(relation.polarity)}</i>
            <div>
              <strong>{story ? characterName(story, relation.fromCharacterId) : ''} → {story ? characterName(story, relation.toCharacterId) : ''} · {relation.kind}</strong>
              {relation.note && <span>{relation.note}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="order-controls"><span>时间顺序</span><button disabled={index <= 0} onClick={() => viewModel.moveScene(scene.id, 'up')}>↑ 上移</button><button disabled={index >= (story?.scenes.length ?? 1) - 1} onClick={() => viewModel.moveScene(scene.id, 'down')}>↓ 下移</button></div>
    </section>
  );
}
