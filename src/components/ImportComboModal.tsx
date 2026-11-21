import React, { useMemo, useState } from 'react';
import { Plus, Sparkles, X, FileJson } from 'lucide-react';
import { ComboData, ControlMode } from '../types/combo';
import { parseNotationToCombo } from '../utils/notationParser';
import { SF6_CHARACTER_FRAME_DATA } from '../data/frameData';

interface ImportComboModalProps {
  mode: ControlMode;
  characterId: string;
  onImport: (combo: ComboData) => void;
  onClose: () => void;
}

const SAMPLE_NOTATIONS: Record<ControlMode, { title: string; notation: string }[]> = {
  classic: [
    { title: 'Ryu 跳入綠衝全套', notation: 'j.HP > 5MP > 2MP xx DR > 5HP > 4HP xx 623HP' },
    { title: '基礎 2MK 取消波動拳', notation: '2MK xx 236HP' },
    { title: '肯 跳入目標連迅雷', notation: 'j.HP > 5MP xx 5HP xx 236MK > 6LK' },
  ],
  modern: [
    { title: '現代跳入輔助綠衝', notation: 'j.H > AUTO+M xx DR > 5H xx 6+SP' },
    { title: '現代基礎 2M 必殺', notation: '2M xx SP' },
  ],
};

export const ImportComboModal: React.FC<ImportComboModalProps> = ({
  mode,
  characterId,
  onImport,
  onClose,
}) => {
  const [tab, setTab] = useState<'notation' | 'json'>('notation');
  const [title, setTitle] = useState('');
  const [notation, setNotation] = useState(SAMPLE_NOTATIONS[mode][0].notation);
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const charData = SF6_CHARACTER_FRAME_DATA[characterId] ?? SF6_CHARACTER_FRAME_DATA.ryu;

  const previewCombo = useMemo(() => {
    if (!notation.trim()) return null;
    return parseNotationToCombo({
      characterId,
      mode,
      title: title || `${charData.name} 匯入連段`,
      notation,
    });
  }, [characterId, mode, title, notation, charData.name]);

  const handleConfirm = () => {
    setError(null);
    if (tab === 'notation') {
      if (!previewCombo || previewCombo.notes.length === 0) {
        setError('請輸入有效的連段指令');
        return;
      }
      onImport(previewCombo);
      onClose();
    } else {
      try {
        const parsed = JSON.parse(jsonText) as ComboData;
        if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0) {
          throw new Error('JSON 缺少 notes 陣列');
        }
        onImport({
          ...parsed,
          id: `json-${Date.now()}`,
          mode: parsed.mode || mode,
          characterId: parsed.characterId || characterId,
          characterName: parsed.characterName || charData.name,
        });
        onClose();
      } catch (err) {
        setError(`JSON 格式錯誤：${err instanceof Error ? err.message : '無法解析'}`);
      }
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>匯入 / 自動生成 60fps 連段 ({charData.name} · {charData.jump.totalJumpFrames}f 跳躍)</h2>
            <p className="muted">
              貼上網路攻略指令（<code>&gt;</code> 目押、<code>xx</code> 取消、<code>DR</code> 綠衝、<code>j.HP</code> 跳入）或 YouTube 抓取腳本匯出的 JSON
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn-secondary ${tab === 'notation' ? 'active-tab' : ''}`}
            style={tab === 'notation' ? { borderColor: '#38bdf8', color: '#38bdf8' } : undefined}
            onClick={() => setTab('notation')}
          >
            <Sparkles size={14} /> 指令自動轉 60fps 譜面
          </button>
          <button
            className={`btn-secondary ${tab === 'json' ? 'active-tab' : ''}`}
            style={tab === 'json' ? { borderColor: '#38bdf8', color: '#38bdf8' } : undefined}
            onClick={() => setTab('json')}
          >
            <FileJson size={14} /> 匯入 JSON（YouTube 腳本 / 玩家分享）
          </button>
        </div>

        {tab === 'notation' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="連段名稱（選填，例如：Ryu 跳入綠衝全套）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)',
                background: '#1a2235',
                color: '#fff',
                fontSize: 13,
              }}
            />

            <textarea
              rows={2}
              placeholder="例如：j.HP > 5MP > 2MP xx DR > 5HP > 4HP xx 623HP"
              value={notation}
              onChange={(e) => setNotation(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)',
                background: '#1a2235',
                color: '#fff',
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SAMPLE_NOTATIONS[mode].map((s) => (
                <button
                  key={s.title}
                  className="btn-secondary"
                  onClick={() => {
                    setTitle(s.title);
                    setNotation(s.notation);
                  }}
                >
                  套用範例：{s.title}
                </button>
              ))}
            </div>

            {previewCombo && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.3)' }}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  自動計算 60fps 時間軸預覽（{charData.zhName} 跳躍 {charData.jump.totalJumpFrames}f）
                </div>
                <div className="combo-steps">
                  {previewCombo.notes.map((n, idx) => (
                    <React.Fragment key={n.id}>
                      <span className="step-chip">
                        <strong>{n.notation}</strong>
                        <small>{n.frame}f</small>
                      </span>
                      {idx < previewCombo.notes.length - 1 && <span className="step-arrow">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <textarea
            rows={7}
            placeholder='貼上 ComboData JSON（例如 tools/yt_combo_extractor.py 輸出的 JSON）...'
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.14)',
              background: '#1a2235',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          />
        )}

        {error && <div style={{ color: '#f43f5e', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-start-overlay"
            style={{ width: 'auto', padding: '8px 18px', fontSize: 13 }}
            onClick={handleConfirm}
          >
            <Plus size={16} /> 加入連段清單
          </button>
        </div>
      </div>
    </div>
  );
};
