import { useState } from 'react';
import type { StoryCharacter, StoryRelation } from '../models/story';
import { polarityLabel, relationPresets } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface CharacterPanelProps { viewModel: StoryViewModel; characters: StoryCharacter[]; }

export function CharacterPanel({ viewModel, characters }: CharacterPanelProps) {
  const story = viewModel.snapshot.story;
  const allCharacters = story?.characters ?? [];
  return (
    <section className="panel character-panel">
      <div className="panel-heading"><div><span className="eyebrow">CAST / 角色阵容</span><h2>人物卡</h2></div><span className="count-badge">{characters.length}</span></div>
      <div className="character-list">
        {characters.map((character) => (
          <CharacterCard key={character.id} viewModel={viewModel} character={character} allCharacters={allCharacters} />
        ))}
        {characters.length === 0 && <div className="empty-inline">还没有人物，从下方添加第一位角色。</div>}
      </div>
      {allCharacters.length >= 2 && <RelationForm viewModel={viewModel} characters={allCharacters} />}
    </section>
  );
}

interface CharacterCardProps { viewModel: StoryViewModel; character: StoryCharacter; allCharacters: StoryCharacter[]; }

function CharacterCard({ viewModel, character, allCharacters }: CharacterCardProps) {
  const story = viewModel.snapshot.story;
  const [nameDraft, setNameDraft] = useState(character.name);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const relations = viewModel.relationsOf(character.id);
  const inAnyScene = story ? story.scenes.some((scene) => scene.characterIds.includes(character.id)) : true;
  const nameOf = (id: string) => allCharacters.find((item) => item.id === id)?.name ?? '已移除人物';

  const saveRename = () => {
    viewModel.renameCharacter(character.id, nameDraft);
    setEditing(false);
  };

  const requestDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    viewModel.deleteCharacter(character.id);
  };

  return (
    <div className="character-card">
      <span className={`avatar ${character.color}`}>{character.name.slice(0, 1)}</span>
      <div>
        {editing ? (
          <span className="rename-row">
            <input aria-label="修改人物姓名" value={nameDraft} autoFocus onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveRename(); if (event.key === 'Escape') { setNameDraft(character.name); setEditing(false); } }} />
            <button className="mini-action" onClick={saveRename}>保存</button>
          </span>
        ) : (
          <strong>{character.name}</strong>
        )}
        <span>{character.role}</span>
        <div className="relation-chips">
          {relations.map((relation) => (
            <RelationChip
              key={relation.id}
              relation={relation}
              selfId={character.id}
              otherName={nameOf(relation.fromCharacterId === character.id ? relation.toCharacterId : relation.fromCharacterId)}
              onRemove={() => viewModel.removeRelation(relation.id)}
            />
          ))}
          {relations.length === 0 && <em className="no-relations">暂无关系记录</em>}
        </div>
        {!inAnyScene && <em className="offstage-flag">未出现在任何场景</em>}
      </div>
      <div className="card-actions">
        {!editing && <button className="icon-button" title="改名" aria-label={`给${character.name}改名`} onClick={() => { setNameDraft(character.name); setEditing(true); }}>✎</button>}
        <button
          className={confirmingDelete ? 'icon-button danger armed' : 'icon-button danger'}
          title={confirmingDelete ? '再次点击确认删除，将一并清理其关系' : '删除人物及其关系'}
          aria-label={`删除${character.name}`}
          onClick={requestDelete}
          onBlur={() => setConfirmingDelete(false)}
        >{confirmingDelete ? '确认' : '✕'}</button>
      </div>
    </div>
  );
}

interface RelationChipProps { relation: StoryRelation; selfId: string; otherName: string; onRemove: () => void; }

function RelationChip({ relation, selfId, otherName, onRemove }: RelationChipProps) {
  const outgoing = relation.fromCharacterId === selfId;
  const text = outgoing ? `→ ${otherName} · ${relation.kind}` : `${otherName} → · ${relation.kind}`;
  return (
    <span className={`relation-chip ${relation.polarity}`} title={`${polarityLabel(relation.polarity)}：${relation.note || '没有填写说明'}`}>
      <i>{polarityLabel(relation.polarity)}</i>{text}
      {relation.note && <em>{relation.note}</em>}
      <button className="chip-remove" aria-label="删除这条关系" onClick={onRemove}>×</button>
    </span>
  );
}

function RelationForm({ viewModel, characters }: { viewModel: StoryViewModel; characters: StoryCharacter[] }) {
  const [fromId, setFromId] = useState(characters[0]?.id ?? '');
  const [toId, setToId] = useState(characters[1]?.id ?? characters[0]?.id ?? '');
  const [kind, setKind] = useState('');
  const [polarity, setPolarity] = useState<StoryRelation['polarity']>('ally');
  const [note, setNote] = useState('');
  const submit = () => {
    viewModel.addRelation(fromId, toId, kind, polarity, note);
    setKind('');
    setNote('');
  };
  return (
    <div className="relation-form">
      <span className="form-title">建立关系（有方向，可重复建立）</span>
      <div className="relation-form-row">
        <select aria-label="关系发起方" value={fromId} onChange={(event) => setFromId(event.target.value)}>
          {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
        <span className="relation-arrow">→</span>
        <select aria-label="关系承受方" value={toId} onChange={(event) => setToId(event.target.value)}>
          {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
        <input aria-label="关系类型" list="relation-kinds" value={kind} onChange={(event) => setKind(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="类型，如 盟友/对手" />
        <select aria-label="关系倾向" value={polarity} onChange={(event) => setPolarity(event.target.value as StoryRelation['polarity'])}>
          <option value="ally">绑定</option>
          <option value="rival">对立</option>
          <option value="neutral">中性</option>
        </select>
      </div>
      <datalist id="relation-kinds">
        {relationPresets.map((preset) => <option key={preset.kind} value={preset.kind} />)}
      </datalist>
      <div className="relation-form-row">
        <input aria-label="关系说明" value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="一句话说明这层关系，如：因沉船之夜反目" />
        <button className="icon-add" onClick={submit} aria-label="建立关系">＋</button>
      </div>
    </div>
  );
}
