import { useState } from 'react';
import {
  relationshipTypeLabels,
  relationshipTypes,
  type CharacterRelationship,
  type RelationshipType,
  type StoryCharacter,
} from '../models/story';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface CharacterPanelProps { viewModel: StoryViewModel; characters: StoryCharacter[]; }

const shortTypeLabels: Record<RelationshipType, string> = {
  ally: '绑定',
  rival: '对立',
  family: '亲属',
  mentor: '师徒',
  love: '爱慕',
  other: '其他',
};

function CharacterCard({ viewModel, character, cast, nameOf }: {
  viewModel: StoryViewModel;
  character: StoryCharacter;
  cast: boolean;
  nameOf: (id: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role);
  const relationships = viewModel.relationshipsForCharacter(character.id);

  const save = () => {
    viewModel.updateCharacter(character.id, { name, role });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="character-card editing">
        <span className={`avatar ${character.color}`}>{character.name.slice(0, 1)}</span>
        <div className="character-edit-fields">
          <input
            aria-label="修改人物姓名"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            placeholder="人物姓名"
          />
          <input
            aria-label="修改人物身份"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            placeholder="身份 / 角色弧"
          />
        </div>
        <button className="mini-save" onClick={save} aria-label={`保存${character.name}的修改`}>保存</button>
      </div>
    );
  }

  return (
    <div className="character-card">
      <span className={`avatar ${character.color}`}>{character.name.slice(0, 1)}</span>
      <div className="character-body">
        <div className="character-title-row">
          <strong>{character.name}</strong>
          {!cast && <em className="offstage-tag">未出场</em>}
        </div>
        <span>{character.role}</span>
        {relationships.length > 0 && (
          <div className="relationship-chips">
            {relationships.map((relationship) => {
              const outgoing = relationship.fromId === character.id;
              const otherName = nameOf(outgoing ? relationship.toId : relationship.fromId);
              return (
                <span
                  key={relationship.id}
                  className={`relationship-chip ${relationship.type}`}
                  title={`${relationshipTypeLabels[relationship.type]}：${relationship.note}`}
                >
                  {outgoing ? '我 →' : '→ 我'} {otherName} · {shortTypeLabels[relationship.type]}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <button className="mini-edit" onClick={() => { setName(character.name); setRole(character.role); setEditing(true); }} aria-label={`改名人物${character.name}`}>✎</button>
    </div>
  );
}

function RelationshipRow({ viewModel, relationship, nameOf }: {
  viewModel: StoryViewModel;
  relationship: CharacterRelationship;
  nameOf: (id: string) => string;
}) {
  return (
    <div className={`relationship-row ${relationship.type}`}>
      <span className={`relationship-type ${relationship.type}`}>{shortTypeLabels[relationship.type]}</span>
      <div className="relationship-copy">
        <strong>{nameOf(relationship.fromId)} <b>→</b> {nameOf(relationship.toId)}</strong>
        <span>{relationship.note}</span>
      </div>
      <button
        className="mini-remove"
        onClick={() => viewModel.removeRelationship(relationship.id)}
        aria-label={`删除${nameOf(relationship.fromId)}与${nameOf(relationship.toId)}的关系`}
      >
        ×
      </button>
    </div>
  );
}

export function CharacterPanel({ viewModel, characters }: CharacterPanelProps) {
  const story = viewModel.snapshot.story;
  const allCharacters = story?.characters ?? [];
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [type, setType] = useState<RelationshipType>('ally');
  const [note, setNote] = useState('');

  const nameOf = (id: string): string => allCharacters.find((character) => character.id === id)?.name ?? '已删除人物';
  const castIds = new Set((story?.scenes ?? []).flatMap((scene) => scene.characterIds));
  const effectiveFrom = fromId || allCharacters[0]?.id || '';
  const effectiveTo = toId || allCharacters[1]?.id || allCharacters[0]?.id || '';
  const offstage = viewModel.offstageCharacters;

  const submit = () => {
    viewModel.addRelationship(effectiveFrom, effectiveTo, type, note);
    setNote('');
  };

  return (
    <section className="panel character-panel">
      <div className="panel-heading"><div><span className="eyebrow">CAST / 角色阵容</span><h2>人物卡</h2></div><span className="count-badge">{characters.length}</span></div>
      {offstage.length > 0 && (
        <div className="offstage-warning">
          <strong>⚠ 以下人物已不在任何场景中，关系仍挂在名下：</strong>
          {offstage.map(({ character, relationshipCount }) => (
            <div className="offstage-row" key={character.id}>
              <span>{character.name} · {relationshipCount} 条关系</span>
              <button onClick={() => viewModel.removeRelationshipsForCharacter(character.id)}>清理关系</button>
            </div>
          ))}
        </div>
      )}
      <div className="character-list">
        {characters.map((character) => (
          <CharacterCard key={character.id} viewModel={viewModel} character={character} cast={castIds.has(character.id)} nameOf={nameOf} />
        ))}
        {characters.length === 0 && <div className="empty-inline">还没有人物，从下方添加第一位角色。</div>}
      </div>
      <AddCharacterForm viewModel={viewModel} />
      <div className="relationship-editor">
        <div className="relationship-editor-heading"><span className="eyebrow">BONDS / 人物关系</span><span>{story?.relationships.length ?? 0} 条</span></div>
        <div className="relationship-list">
          {story?.relationships.map((relationship) => (
            <RelationshipRow key={relationship.id} viewModel={viewModel} relationship={relationship} nameOf={nameOf} />
          ))}
          {(story?.relationships.length ?? 0) === 0 && <div className="empty-inline">还没有关系，选择两位人物建立第一条。</div>}
        </div>
        {allCharacters.length < 2 ? (
          <div className="empty-inline">至少需要两位人物才能建立关系。</div>
        ) : (
          <div className="relationship-form">
            <select aria-label="关系起点人物" value={effectiveFrom} onChange={(event) => setFromId(event.target.value)}>
              {allCharacters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
            <select aria-label="关系类型" value={type} onChange={(event) => setType(event.target.value as RelationshipType)}>
              {relationshipTypes.map((value) => <option key={value} value={value}>{relationshipTypeLabels[value]}</option>)}
            </select>
            <select aria-label="关系指向人物" value={effectiveTo} onChange={(event) => setToId(event.target.value)}>
              {allCharacters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
            <input
              aria-label="关系一句说明"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              placeholder="一句说明，例如：怀疑对方隐瞒真相"
            />
            <button className="icon-add" onClick={submit} aria-label="建立人物关系">＋</button>
          </div>
        )}
      </div>
    </section>
  );
}

function AddCharacterForm({ viewModel }: { viewModel: StoryViewModel }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const submit = () => { viewModel.addCharacter(name, role); setName(''); setRole(''); };
  return (
    <div className="inline-form"><input aria-label="人物姓名" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="人物姓名" /><input aria-label="人物身份" value={role} onChange={(event) => setRole(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="身份 / 角色弧" /><button className="icon-add" onClick={submit} aria-label="添加人物">＋</button></div>
  );
}
