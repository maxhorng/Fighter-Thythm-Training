import React from 'react';
import { ChevronRight, Globe, Minus, X } from 'lucide-react';
import { AppLang, LANG_OPTIONS } from '../data/i18n';
import pkg from '../../package.json';

interface GameHubViewProps {
  lang: AppLang;
  onChangeLang: (next: AppLang) => void;
  sf6ComboCount: number;
  onSelectGame: (gameId: 'sf6') => void;
}

const HUB_TEXT: Record<
  AppLang,
  {
    subtitle: string;
    selectTitle: string;
    selectDesc: string;
    sf6Desc: string;
    combosUnit: string;
    enterBtn: string;
    comingSoon: string;
    comingSoonDesc: string;
    resizeTip: string;
  }
> = {
  'zh-TW': {
    subtitle: '格鬥遊戲透明覆蓋節奏連段訓練器',
    selectTitle: '選擇要練習的遊戲',
    selectDesc: '選擇一款格鬥遊戲進入對應的角色與連段譜面庫',
    sf6Desc: '60fps 實機連段、指令錯誤診斷、1P/2P 鏡像、Classic / Modern 雙模式支援',
    combosUnit: '組連段',
    enterBtn: '進入練習',
    comingSoon: '更多格鬥遊戲開發中',
    comingSoonDesc: '未來將陸續擴充支援更多主流格鬥遊戲',
    resizeTip: '拖曳調整視窗大小',
  },
  'zh-CN': {
    subtitle: '格斗游戏透明覆盖节奏连段训练器',
    selectTitle: '选择要练习的游戏',
    selectDesc: '选择一款格斗游戏进入对应的角色与连段谱面库',
    sf6Desc: '60fps 实机连段、指令错误诊断、1P/2P 镜像、Classic / Modern 双模式支持',
    combosUnit: '组连段',
    enterBtn: '进入练习',
    comingSoon: '更多格斗游戏开发中',
    comingSoonDesc: '未来将陆续扩展支持更多主流格斗游戏',
    resizeTip: '拖动调整窗口大小',
  },
  en: {
    subtitle: 'Transparent Rhythm Combo Trainer for Fighting Games',
    selectTitle: 'Select a Game',
    selectDesc: 'Choose a fighting game to open its fighter roster and combo charts',
    sf6Desc: '60fps real-recorded combos, motion diagnostics, 1P/2P mirror, Classic & Modern support',
    combosUnit: 'Combos',
    enterBtn: 'Enter Trainer',
    comingSoon: 'More Fighting Games Coming Soon',
    comingSoonDesc: 'Additional fighting games will be supported in future updates',
    resizeTip: 'Drag to resize window',
  },
  ja: {
    subtitle: '格闘ゲーム向け 透過オーバーレイ リズムコンボ練習ツール',
    selectTitle: '練習するゲームを選択',
    selectDesc: 'ゲームを選択してキャラクターとコンボ譜面一覧へ進みます',
    sf6Desc: '60fps 実機コンボ、入力ミス診断、1P/2P 反転、クラシック / モダン両対応',
    combosUnit: 'コンボ',
    enterBtn: '練習を始める',
    comingSoon: '他の格闘ゲームも順次対応予定',
    comingSoonDesc: '今後のアップデートで対応タイトルを拡大予定です',
    resizeTip: 'ドラッグしてウィンドウサイズ変更',
  },
  ko: {
    subtitle: '격투 게임용 투명 오버레이 리듬 콤보 트레이너',
    selectTitle: '연습할 게임 선택',
    selectDesc: '게임을 선택해 캐릭터와 콤보 차트 목록으로 이동하세요',
    sf6Desc: '60fps 실기 콤보, 커맨드 오류 진단, 1P/2P 반전, 클래식 / 모던 모드 지원',
    combosUnit: '콤보',
    enterBtn: '연습 시작',
    comingSoon: '더 많은 격투 게임 지원 예정',
    comingSoonDesc: '향후 업데이트를 통해 다양한 격투 게임을 지원할 예정입니다',
    resizeTip: '드래그하여 창 크기 조절',
  },
};

export const GameHubView: React.FC<GameHubViewProps> = ({
  lang,
  onChangeLang,
  sf6ComboCount,
  onSelectGame,
}) => {
  const txt = HUB_TEXT[lang];

  return (
    <div className="menu-shell">
      {/* Top Draggable Titlebar */}
      <header className="titlebar">
        <div className="titlebar-brand">
          <img
            src="./icon.png"
            alt="Frame Beat Trainer (FBT)"
            style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }}
          />
          <span className="brand-title">Frame Beat Trainer (FBT)</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 999,
              background: 'rgba(56, 189, 248, 0.16)',
              color: '#7dd3fc',
              border: '1px solid rgba(56, 189, 248, 0.45)',
            }}
          >
            v{pkg.version}
          </span>
          <span className="brand-sub">{txt.subtitle}</span>
        </div>

        <div
          className="titlebar-right"
          style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} color="#38bdf8" />
            <select
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as AppLang)}
              style={{
                padding: '4px 10px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(15, 23, 42, 0.9)',
                color: '#e0f2fe',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-icon"
            onClick={() => window.electronAPI?.minimizeWindow()}
            title="Minimize"
          >
            <Minus size={15} />
          </button>
          <button
            className="btn-icon close"
            onClick={() => window.electronAPI?.closeWindow()}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* Center Game Selector */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
            {txt.selectTitle}
          </h1>
          <p style={{ fontSize: 13.5, color: '#94a3b8' }}>{txt.selectDesc}</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          {/* Street Fighter 6 Card */}
          <button
            type="button"
            onClick={() => onSelectGame('sf6')}
            style={{
              textAlign: 'left',
              padding: '22px 24px',
              borderRadius: 16,
              cursor: 'pointer',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              background:
                'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(15, 23, 42, 0.92) 60%, rgba(244, 63, 94, 0.14) 100%)',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'transform 0.14s ease, border-color 0.14s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'rgba(56, 189, 248, 0.22)',
                  color: '#7dd3fc',
                  border: '1px solid rgba(56, 189, 248, 0.55)',
                }}
              >
                SF6 · 60FPS
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#cbd5e1',
                }}
              >
                {sf6ComboCount} {txt.combosUnit}
              </span>
            </div>

            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
                Street Fighter 6
              </div>
              <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
                {txt.sf6Desc}
              </div>
            </div>

            <div
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 800,
                color: '#38bdf8',
              }}
            >
              <span>{txt.enterBtn}</span>
              <ChevronRight size={16} />
            </div>
          </button>

          {/* Coming Soon Placeholder Card */}
          <div
            style={{
              padding: '22px 24px',
              borderRadius: 16,
              border: '1px dashed rgba(148, 163, 184, 0.3)',
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 8,
              opacity: 0.72,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#cbd5e1' }}>
              {txt.comingSoon}
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
              {txt.comingSoonDesc}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom-right visible resize grip triangle */}
      <div
        title={txt.resizeTip}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.screenX;
          const startY = e.screenY;
          const startW = window.outerWidth;
          const startH = window.outerHeight;
          const onMove = (ev: MouseEvent) => {
            window.electronAPI?.resizeWindow?.(
              startW + (ev.screenX - startX),
              startH + (ev.screenY - startY)
            );
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
        style={{
          position: 'fixed',
          right: 4,
          bottom: 4,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          zIndex: 50,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: 2,
          userSelect: 'none',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M13 3L3 13" stroke="rgba(148, 163, 184, 0.7)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M13 7.5L7.5 13" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M13 11.5L11.5 13" stroke="rgba(56, 189, 248, 0.95)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
