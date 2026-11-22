import React, { useState } from 'react';
import {
  Monitor,
  Gamepad2,
  Target,
  Radio,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { AppLang, OverlayHotkeys } from '../data/i18n';
import { formatKeyCode } from '../data/bindings';

interface TutorialModalProps {
  lang: AppLang;
  onChangeLang: (next: AppLang) => void;
  overlayHotkeys: OverlayHotkeys;
  resetKeyCode: string;
  onClose: (dontShowAgain: boolean) => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  lang,
  onChangeLang,
  overlayHotkeys,
  resetKeyCode,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const isEn = lang === 'en';

  const kReset = formatKeyCode(resetKeyCode || 'F8');
  const kReview = formatKeyCode(overlayHotkeys.toggleReview || 'F7');
  const kClick = formatKeyCode(overlayHotkeys.clickThrough || 'F9');
  const kExit = formatKeyCode(overlayHotkeys.exitOverlay || 'F10');

  const steps = [
    {
      icon: <Monitor size={28} color="#38bdf8" />,
      badge: isEn ? 'STEP 1 / 4 · DISPLAY' : '步驟 1 / 4 · 遊戲畫面設定',
      title: isEn
        ? 'Set SF6 to Borderless Windowed'
        : '先把 SF6 設為「無邊框視窗」',
      desc: isEn
        ? 'Transparent overlays cannot draw on top of Exclusive Fullscreen. In SF6: Options → Graphics → Display Mode → Borderless Windowed.'
        : '透明覆蓋視窗無法蓋過獨佔全螢幕。請先在《Street Fighter 6》中開啟「設定 → 畫面設定 → 顯示模式 → 無邊框視窗」。',
      visual: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '18px 16px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 112,
                height: 66,
                borderRadius: 8,
                border: '2px dashed rgba(244, 63, 94, 0.6)',
                background: 'rgba(244, 63, 94, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#fda4af',
                fontWeight: 700,
              }}
            >
              {isEn ? 'Fullscreen ✕' : '獨佔全螢幕 ✕'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              {isEn ? 'Blocks overlay' : '會蓋住節奏圈'}
            </div>
          </div>

          <div style={{ fontSize: 20, color: '#38bdf8', fontWeight: 900 }}>→</div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 132,
                height: 66,
                borderRadius: 8,
                border: '2px solid #22c55e',
                background: 'rgba(34, 197, 94, 0.14)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11.5,
                color: '#86efac',
                fontWeight: 800,
                boxShadow: '0 0 16px rgba(34, 197, 94, 0.25)',
              }}
            >
              <span>{isEn ? 'Borderless ✓' : '無邊框視窗 ✓'}</span>
              <span style={{ fontSize: 10, color: '#bbf7d0', marginTop: 2 }}>
                {isEn ? 'Overlay visible!' : '透明節奏完美顯示'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#86efac', marginTop: 6, fontWeight: 700 }}>
              {isEn ? 'Recommended' : '必開設定'}
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <Gamepad2 size={28} color="#a855f7" />,
      badge: isEn ? 'STEP 2 / 4 · CONTROLS' : '步驟 2 / 4 · 綁定你的按鍵',
      title: isEn
        ? 'Bind Keyboard or Controller & Hotkeys'
        : '設定鍵盤 / 手把按鍵與全域快捷鍵',
      desc: isEn
        ? 'Click "Settings / Keys & Lang" in the top-right to match your SF6 buttons (Classic 6-btn or Modern 4-btn). You can also customize Click-Through and Return-to-Menu hotkeys.'
        : '點右上角「設定 / 按鍵與語言」，把方向鍵、攻擊鍵與你的 SF6 訓練場設成一致（支援鍵盤、大搖、Hitbox、Xbox/PS 手把），也能自訂滑鼠穿透與返回選單快捷鍵。',
      visual: (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            padding: '14px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
          }}
        >
          {[
            { key: kReset, label: isEn ? 'Restart Combo' : '同步重來 / 清空', color: '#38bdf8' },
            { key: kReview, label: isEn ? 'Toggle Combo Review' : '開啟/收合檢討紀錄', color: '#a855f7' },
            { key: kClick, label: isEn ? 'Mouse Click-Through' : '切換滑鼠穿透', color: '#f59e0b' },
            { key: kExit, label: isEn ? 'Return to Menu' : '返回主選單', color: '#f43f5e' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '10px 8px',
                borderRadius: 10,
                background: 'rgba(30, 41, 59, 0.85)',
                border: `1px solid ${item.color}55`,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: `${item.color}22`,
                  border: `1px solid ${item.color}`,
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                {item.key}
              </div>
              <div style={{ fontSize: 11.5, color: '#cbd5e1', fontWeight: 600 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: <Target size={28} color="#facc15" />,
      badge: isEn ? 'STEP 3 / 4 · RHYTHM PLAY' : '步驟 3 / 4 · 看懂節奏圈圈',
      title: isEn
        ? 'Hit When the Outer Ring Shrinks In!'
        : '外圈縮到按鈕邊緣時按下！',
      desc: isEn
        ? 'Start Overlay → focus SF6 → press the 1st hit to auto-start! Watch the shrinking approach ring and bottom recorded input bar to master exact SF6 60fps timing.'
        : '按下「開始透明覆蓋訓練模式」後切回 SF6，打出連段第一擊就會自動開始跑拍！對準外圈縮合瞬間按下，畫面最底下還會同步回放錄製時的搖桿與按鍵。',
      visual: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '16px 14px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(250, 204, 21, 0.35)',
          }}
        >
          {/* Mini osu! circle illustration */}
          <div style={{ position: 'relative', width: 76, height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '3px solid rgba(250, 204, 21, 0.85)',
                boxShadow: '0 0 14px rgba(250, 204, 21, 0.45)',
              }}
            />
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: '2px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 15,
                color: '#fff',
              }}
            >
              2MK
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div>
              <span style={{ color: '#facc15', fontWeight: 900 }}>PERFECT</span>{' '}
              <span style={{ color: '#cbd5e1' }}>{isEn ? '±0.35f exact frame' : '±0.35f 精準對拍'}</span>
            </div>
            <div>
              <span style={{ color: '#38bdf8', fontWeight: 900 }}>GOOD</span>{' '}
              <span style={{ color: '#cbd5e1' }}>{isEn ? 'Real SF6 combo window' : 'SF6 真實可接範圍'}</span>
            </div>
            <div>
              <span style={{ color: '#f43f5e', fontWeight: 900 }}>EARLY / LATE</span>{' '}
              <span style={{ color: '#cbd5e1' }}>{isEn ? 'Danger zone (may drop)' : '偏早或偏晚（易斷連）'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <Radio size={28} color="#f43f5e" />,
      badge: isEn ? 'STEP 4 / 4 · RECORD & SHARE' : '步驟 4 / 4 · 錄製與分享連段',
      title: isEn
        ? 'Record Your Own Combos & Load Friends’ JSON'
        : '自己錄製連段 ＆ 載入別人分享的檔案',
      desc: isEn
        ? 'Click "● Record My Combo" to capture your own 60fps inputs in SF6 (press F10 to save & auto-copy JSON). Use "+ Import / Load Combo" to practice combos shared by friends!'
        : '點「● 錄製我的連段」即可在 SF6 實機錄製自己的 60fps 連段（按 F10 結束並自動複製 JSON）；也能點「+ 匯入 / 指令轉譜面」貼上別人分享的 JSON 直接開練！',
      visual: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '16px 12px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.5)' }}>
            {isEn ? '● Record 60fps' : '● 實機錄製'}
          </span>
          <span style={{ color: '#64748b' }}>→</span>
          <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.2)', color: '#bae6fd', border: '1px solid rgba(56, 189, 248, 0.5)' }}>
            {kExit} {isEn ? 'Save & Copy' : '存檔複製'}
          </span>
          <span style={{ color: '#64748b' }}>→</span>
          <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(34, 197, 94, 0.2)', color: '#bbf7d0', border: '1px solid rgba(34, 197, 94, 0.5)' }}>
            {isEn ? '+ Import JSON' : '+ 匯入分享'}
          </span>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="modal-backdrop" style={{ zIndex: 90 }}>
      <div className="modal-card" style={{ maxWidth: 560, padding: '22px 24px' }}>
        {/* Header with language switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#38bdf8" />
            <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.04em' }}>
              {isEn ? 'Quick Start Guide' : '快速上手教學'}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>by maxhorng / 92anini</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: 11,
                ...(lang === 'zh-TW' ? { borderColor: '#38bdf8', color: '#e0f2fe', background: 'rgba(56,189,248,0.2)' } : {}),
              }}
              onClick={() => onChangeLang('zh-TW')}
            >
              繁中
            </button>
            <button
              className="btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: 11,
                ...(lang === 'en' ? { borderColor: '#38bdf8', color: '#e0f2fe', background: 'rgba(56,189,248,0.2)' } : {}),
              }}
              onClick={() => onChangeLang('en')}
            >
              EN
            </button>
            <button className="btn-icon" onClick={() => onClose(dontShowAgain)}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {current.icon}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em' }}>
              {current.badge}
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18, color: '#f8fafc' }}>{current.title}</h2>
          </div>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#cbd5e1' }}>
          {current.desc}
        </p>

        {current.visual}

        {/* Step Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0 14px' }}>
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setStep(idx)}
              style={{
                width: idx === step ? 24 : 8,
                height: 8,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: idx === step ? '#38bdf8' : 'rgba(148, 163, 184, 0.35)',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            <span>{isEn ? "Don't show again on startup" : '下次啟動不再自動顯示'}</span>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft size={15} />
                {isEn ? 'Back' : '上一步'}
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                className="btn-secondary"
                style={{ background: 'rgba(56, 189, 248, 0.22)', borderColor: '#38bdf8', color: '#e0f2fe' }}
                onClick={() => setStep((s) => s + 1)}
              >
                {isEn ? 'Next' : '下一步'}
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                className="btn-secondary"
                style={{ background: 'rgba(34, 197, 94, 0.25)', borderColor: '#22c55e', color: '#dcfce7', fontWeight: 800 }}
                onClick={() => onClose(dontShowAgain)}
              >
                <CheckCircle2 size={15} />
                {isEn ? 'Start Training!' : '開始使用！'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
