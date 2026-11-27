import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Download,
  Heart,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { ComboData } from '../types/combo';
import { CHARACTERS } from '../data/combos';
import { AppLang, translateTag } from '../data/i18n';
import { ONLINE_I18N, OnlineI18n } from '../data/onlineI18n';
import { isOnlineConfigured } from '../config/online';
import { sanitizeForUpload, validateCombo } from '../schema/comboSchema';
import {
  cancelDiscordLogin,
  deleteMyCombo,
  downloadOnlineCombo,
  fetchMe,
  fetchMyCombos,
  fetchMyLikes,
  getStoredToken,
  listOnlineCombos,
  loginWithDiscord,
  logout,
  OnlineApiError,
  OnlineComboItem,
  OnlineSort,
  OnlineUser,
  toggleLike,
  uploadCombo,
} from '../utils/onlineApi';

type OnlineTab = 'browse' | 'mine' | 'upload';

interface OnlineCombosModalProps {
  lang: AppLang;
  customCombos: ComboData[];
  downloadedOnlineIds: Set<string>;
  initialUploadCombo?: ComboData | null;
  onDownloaded: (combo: ComboData) => void;
  onClose: () => void;
}

const CHAR_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

function formatRetryTime(sec: number | undefined, t: OnlineI18n): string {
  const s = Math.max(60, sec ?? 60);
  if (s >= 3600) {
    const h = Math.ceil(s / 3600);
    return `${h} ${t.hours}`;
  }
  const m = Math.ceil(s / 60);
  return `${m} ${t.minutes}`;
}

const LIMIT_ERROR_CODES = new Set([
  'rate_limit_upload',
  'rate_limit_download',
  'quota_exceeded',
  'service_busy',
  'upload_limit_hour',
  'upload_limit_day',
  'upload_limit_ip',
  'rate_limited',
]);

function isLimitError(err: unknown): err is OnlineApiError {
  return err instanceof OnlineApiError && LIMIT_ERROR_CODES.has(err.code);
}

function formatOnlineError(err: unknown, t: OnlineI18n): string {
  if (err instanceof OnlineApiError) {
    switch (err.code) {
      case 'rate_limit_upload':
      case 'upload_limit_hour':
      case 'upload_limit_day':
      case 'upload_limit_ip':
        return t.errRateLimited.replace('{time}', formatRetryTime(err.retryAfterSec, t));
      case 'rate_limit_download':
      case 'rate_limited':
        return err.retryAfterSec
          ? t.errRateLimitDownloadWait.replace('{time}', formatRetryTime(err.retryAfterSec, t))
          : t.errRateLimitDownload;
      case 'quota_exceeded':
        return t.errQuotaExceeded;
      case 'service_busy':
        return t.errServiceBusy;
      case 'duplicate':
        return t.errDuplicate;
      case 'invalid_format':
        return `${t.errInvalidFormat}${err.details.slice(0, 4).join('; ') || err.message}`;
      case 'unauthorized':
        return t.errUnauthorized;
      case 'banned':
        return t.errBanned;
      case 'account_too_new':
        return t.errAccountTooNew;
      case 'network':
        return t.errNetwork;
      case 'browser_only':
        return t.errBrowserOnly;
      case 'timeout':
        return t.errTimeout;
      case 'cancelled':
      case 'superseded':
        return '';
      default:
        return `${t.errGeneric}${err.message}`;
    }
  }
  return `${t.errGeneric}${err instanceof Error ? err.message : String(err)}`;
}

const selectStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 7,
  fontSize: 12,
  border: '1px solid rgba(148, 163, 184, 0.3)',
  background: 'rgba(15, 23, 42, 0.9)',
  color: '#f8fafc',
  outline: 'none',
};

export const OnlineCombosModal: React.FC<OnlineCombosModalProps> = ({
  lang,
  customCombos,
  downloadedOnlineIds,
  initialUploadCombo = null,
  onDownloaded,
  onClose,
}) => {
  const t = ONLINE_I18N[lang];
  const configured = isOnlineConfigured();

  const uploadableCombos = useMemo(
    () => customCombos.filter((c) => c.source !== 'online'),
    [customCombos]
  );

  const [tab, setTab] = useState<OnlineTab>(initialUploadCombo ? 'upload' : 'browse');

  // Auth state
  const [user, setUser] = useState<OnlineUser | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [limitBanner, setLimitBanner] = useState<{ severity: 'amber' | 'red'; message: string } | null>(null);

  const reportLimitIfAny = useCallback(
    (err: unknown): boolean => {
      if (!isLimitError(err)) return false;
      const msg = formatOnlineError(err, t);
      if (msg) {
        setLimitBanner({
          severity: err.code === 'quota_exceeded' ? 'red' : 'amber',
          message: msg,
        });
      }
      return true;
    },
    [t]
  );

  // Browse filters
  const [charFilter, setCharFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [sort, setSort] = useState<OnlineSort>('likes');
  const [showUnverified, setShowUnverified] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<{ id: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleCopyCode = (id: string) => {
    try {
      navigator.clipboard?.writeText(id).catch(() => undefined);
    } catch {
      // ignore clipboard error
    }
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1500);
  };

  const handleCopyShareLink = (id: string) => {
    const url = `https://maxhorng.github.io/Frame-Beat-Trainer/combo.html?id=${encodeURIComponent(id)}`;
    try {
      navigator.clipboard?.writeText(url).catch(() => undefined);
    } catch {
      // ignore clipboard error
    }
    setCopiedLinkId(id);
    window.setTimeout(() => {
      setCopiedLinkId((cur) => (cur === id ? null : cur));
    }, 1800);
  };

  // Browse data
  const [items, setItems] = useState<OnlineComboItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Likes & downloads
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [justDownloadedIds, setJustDownloadedIds] = useState<Set<string>>(new Set());

  // My uploads
  const [myItems, setMyItems] = useState<OnlineComboItem[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload tab
  const [selectedUploadId, setSelectedUploadId] = useState<string>(
    initialUploadCombo?.id ?? uploadableCombos[0]?.id ?? ''
  );
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedUploadCombo = useMemo(() => {
    if (initialUploadCombo && initialUploadCombo.id === selectedUploadId) return initialUploadCombo;
    return uploadableCombos.find((c) => c.id === selectedUploadId) ?? initialUploadCombo ?? null;
  }, [initialUploadCombo, uploadableCombos, selectedUploadId]);

  const localValidation = useMemo(() => {
    if (!selectedUploadCombo) return null;
    return validateCombo(sanitizeForUpload(selectedUploadCombo));
  }, [selectedUploadCombo]);

  // Restore existing session on mount
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      const token = await getStoredToken();
      if (cancelled || !token) return;
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        const ids = await fetchMyLikes();
        if (!cancelled) setLikedIds(new Set(ids));
      } catch {
        // Expired or unreachable — stay logged out
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // Cancel any in-flight loopback OAuth server if the modal closes
  useEffect(() => {
    return () => {
      cancelDiscordLogin().catch(() => undefined);
    };
  }, []);

  const loadBrowse = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!configured) return;
      setLoadingList(true);
      setListError(null);
      try {
        const res = await listOnlineCombos({
          character: charFilter || undefined,
          difficulty: diffFilter || undefined,
          mode: modeFilter || undefined,
          position: posFilter || undefined,
          author: authorFilter?.id || undefined,
          sort,
          q: appliedSearch || undefined,
          page: targetPage,
          includePending: showUnverified,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setPage(res.page);
        setHasMore(res.hasMore);
        setLimitBanner(null);
      } catch (err) {
        if (!reportLimitIfAny(err)) {
          const msg = formatOnlineError(err, t);
          if (msg) setListError(msg);
        }
      } finally {
        setLoadingList(false);
      }
    },
    [configured, charFilter, diffFilter, modeFilter, posFilter, authorFilter, sort, appliedSearch, showUnverified, t, reportLimitIfAny]
  );

  useEffect(() => {
    if (tab === 'browse') {
      loadBrowse(0, false);
    }
  }, [tab, loadBrowse]);

  const loadMine = useCallback(async () => {
    if (!configured || !user) return;
    setLoadingMine(true);
    setMineError(null);
    try {
      const list = await fetchMyCombos();
      setMyItems(list);
      setLimitBanner(null);
    } catch (err) {
      if (err instanceof OnlineApiError && err.status === 401) {
        setUser(null);
        setLikedIds(new Set());
      }
      if (!reportLimitIfAny(err)) {
        const msg = formatOnlineError(err, t);
        if (msg) setMineError(msg);
      }
    } finally {
      setLoadingMine(false);
    }
  }, [configured, user, t, reportLimitIfAny]);

  useEffect(() => {
    if (tab === 'mine' && user) {
      loadMine();
    }
  }, [tab, user, loadMine]);

  const handleLogin = async () => {
    if (!configured) {
      setAuthError(t.errNotConfigured);
      return;
    }
    setAuthError(null);
    setLoggingIn(true);
    try {
      const me = await loginWithDiscord();
      setUser(me);
      fetchMyLikes()
        .then((ids) => setLikedIds(new Set(ids)))
        .catch(() => undefined);
    } catch (err) {
      const msg = formatOnlineError(err, t);
      if (msg) setAuthError(msg);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCancelLogin = async () => {
    await cancelDiscordLogin();
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setUser(null);
    setLikedIds(new Set());
    setMyItems([]);
  };

  const handleToggleLike = async (item: OnlineComboItem) => {
    if (!user) {
      setAuthError(t.loginRequired);
      return;
    }
    if (likingId) return;
    setLikingId(item.id);
    setListError(null);
    try {
      const res = await toggleLike(item.id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (res.liked) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, likes: res.likes } : c))
      );
      setLimitBanner(null);
    } catch (err) {
      if (err instanceof OnlineApiError && err.status === 401) {
        setUser(null);
        setLikedIds(new Set());
      }
      if (!reportLimitIfAny(err)) {
        const msg = formatOnlineError(err, t);
        if (msg) setListError(msg);
      }
    } finally {
      setLikingId(null);
    }
  };

  const handleDownload = async (item: OnlineComboItem) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    setListError(null);
    try {
      const combo = await downloadOnlineCombo(item);
      onDownloaded(combo);
      setJustDownloadedIds((prev) => new Set(prev).add(item.id));
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, downloads: c.downloads + 1 } : c))
      );
      setLimitBanner(null);
    } catch (err) {
      if (!reportLimitIfAny(err)) {
        const msg = formatOnlineError(err, t);
        if (msg) setListError(msg);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedUploadCombo) return;
    if (!configured) {
      setUploadResult({ ok: false, text: t.errNotConfigured });
      return;
    }
    if (!user) {
      setUploadResult({ ok: false, text: t.loginRequired });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await uploadCombo(selectedUploadCombo);
      setLimitBanner(null);
      setUploadResult({
        ok: true,
        text: res.status === 'approved' ? t.uploadApproved : t.uploadPending,
      });
    } catch (err) {
      if (err instanceof OnlineApiError && err.status === 401) {
        setUser(null);
        setLikedIds(new Set());
      }
      reportLimitIfAny(err);
      const msg = formatOnlineError(err, t);
      if (msg) setUploadResult({ ok: false, text: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMine = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setMineError(null);
    try {
      await deleteMyCombo(id);
      setMyItems((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
      setLimitBanner(null);
    } catch (err) {
      if (!reportLimitIfAny(err)) {
        const msg = formatOnlineError(err, t);
        if (msg) setMineError(msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const renderDifficultyBadge = (difficulty: ComboData['difficulty']) => (
    <span
      className={`diff-badge ${difficulty === 'Ultra Hard' ? 'ultra' : difficulty.toLowerCase()}`}
      style={
        difficulty === 'Ultra Hard'
          ? {
              background: 'rgba(168, 85, 247, 0.24)',
              color: '#e9d5ff',
              border: '1px solid rgba(192, 132, 252, 0.75)',
            }
          : undefined
      }
    >
      {difficulty}
    </span>
  );

  const renderStatusBadge = (status: OnlineComboItem['status']) => {
    const map = {
      pending: {
        label: t.statusPending,
        bg: 'rgba(250, 204, 21, 0.16)',
        color: '#fde047',
        border: 'rgba(250, 204, 21, 0.5)',
      },
      approved: {
        label: t.statusApproved,
        bg: 'rgba(74, 222, 128, 0.16)',
        color: '#86efac',
        border: 'rgba(74, 222, 128, 0.5)',
      },
      rejected: {
        label: t.statusRejected,
        bg: 'rgba(244, 63, 94, 0.18)',
        color: '#fda4af',
        border: 'rgba(244, 63, 94, 0.5)',
      },
    }[status];
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: 999,
          background: map.bg,
          color: map.color,
          border: `1px solid ${map.border}`,
        }}
      >
        {map.label}
      </span>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 70 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 94vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cloud size={19} color="#38bdf8" />
              {t.title}
            </h2>
            <p className="muted" style={{ marginTop: 2 }}>
              {t.subtitle}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(88, 101, 242, 0.16)',
                  border: '1px solid rgba(129, 140, 248, 0.45)',
                  fontSize: 12,
                  color: '#e0e7ff',
                }}
              >
                {user.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                    alt={user.displayName}
                    style={{ width: 20, height: 20, borderRadius: '50%' }}
                  />
                )}
                <span>
                  {t.loggedInAs}
                  <strong>{user.displayName}</strong>
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 22, height: 22 }}
                  onClick={handleLogout}
                  title={t.logout}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : loggingIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bae6fd' }}>
                <span>{t.loggingIn}</span>
                <button type="button" className="btn-secondary" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={handleCancelLogin}>
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{
                  background: 'rgba(88, 101, 242, 0.25)',
                  borderColor: 'rgba(129, 140, 248, 0.7)',
                  color: '#e0e7ff',
                  fontWeight: 700,
                }}
                onClick={handleLogin}
              >
                <LogIn size={14} />
                {t.loginDiscord}
              </button>
            )}
            <button type="button" className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {!configured && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(250, 204, 21, 0.14)',
              border: '1px solid rgba(250, 204, 21, 0.45)',
              color: '#fde047',
              fontSize: 12.5,
            }}
          >
            {t.errNotConfigured}
          </div>
        )}

        {limitBanner && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 9,
              background:
                limitBanner.severity === 'red'
                  ? 'rgba(244, 63, 94, 0.2)'
                  : 'rgba(245, 158, 11, 0.18)',
              border:
                limitBanner.severity === 'red'
                  ? '1px solid rgba(251, 113, 133, 0.7)'
                  : '1px solid rgba(251, 191, 36, 0.7)',
              color: limitBanner.severity === 'red' ? '#fecdd3' : '#fef08a',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <AlertTriangle
                size={16}
                color={limitBanner.severity === 'red' ? '#fb7185' : '#fbbf24'}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 800, marginBottom: 2 }}>{t.limitBannerTitle}</div>
                <div style={{ lineHeight: 1.45 }}>{limitBanner.message}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon"
              style={{ width: 22, height: 22, flexShrink: 0 }}
              onClick={() => setLimitBanner(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {authError && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.16)',
              border: '1px solid rgba(244, 63, 94, 0.45)',
              color: '#fda4af',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{authError}</span>
            <button type="button" className="btn-icon" style={{ width: 20, height: 20 }} onClick={() => setAuthError(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(
            [
              { id: 'browse', label: t.tabBrowse, icon: <Cloud size={14} /> },
              { id: 'mine', label: t.tabMine, icon: <Heart size={14} /> },
              { id: 'upload', label: t.tabUpload, icon: <Upload size={14} /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn-secondary"
              style={
                tab === item.id
                  ? {
                      borderColor: '#38bdf8',
                      color: '#e0f2fe',
                      background: 'rgba(56, 189, 248, 0.2)',
                      fontWeight: 800,
                    }
                  : undefined
              }
              onClick={() => {
                setTab(item.id);
                setUploadResult(null);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* BROWSE TAB */}
        {tab === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <select
                value={charFilter}
                onChange={(e) => setCharFilter(e.target.value)}
                style={selectStyle}
                aria-label={t.character}
              >
                <option value="">{t.allCharacters}</option>
                {CHARACTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                style={selectStyle}
                aria-label={t.difficulty}
              >
                <option value="">
                  {t.difficulty}: {t.all}
                </option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Ultra Hard">Ultra Hard</option>
              </select>

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                style={selectStyle}
                aria-label={t.mode}
              >
                <option value="">
                  {t.mode}: {t.all}
                </option>
                <option value="classic">{t.classic}</option>
                <option value="modern">{t.modern}</option>
              </select>

              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                style={selectStyle}
                aria-label={t.position}
              >
                <option value="">
                  {t.position}: {t.all}
                </option>
                <option value="midscreen">{t.midscreen}</option>
                <option value="corner">{t.corner}</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as OnlineSort)}
                style={selectStyle}
                aria-label={t.sort}
              >
                <option value="likes">{t.sortLikes}</option>
                <option value="downloads">{t.sortDownloads}</option>
                <option value="new">{t.sortNew}</option>
              </select>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  border: showUnverified
                    ? '1px solid rgba(251, 191, 36, 0.65)'
                    : '1px solid rgba(148, 163, 184, 0.3)',
                  background: showUnverified
                    ? 'rgba(245, 158, 11, 0.18)'
                    : 'rgba(15, 23, 42, 0.9)',
                  color: showUnverified ? '#fde047' : '#cbd5e1',
                }}
              >
                <input
                  type="checkbox"
                  checked={showUnverified}
                  onChange={(e) => setShowUnverified(e.target.checked)}
                  style={{ accentColor: '#fbbf24', width: 13, height: 13, margin: 0 }}
                />
                <span>{t.showUnverified}</span>
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedSearch(searchInput.trim());
                }}
                style={{ display: 'flex', gap: 4, flex: 1, minWidth: 180 }}
              >
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  style={{ ...selectStyle, flex: 1, minWidth: 120 }}
                />
                <button type="submit" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                  <Search size={13} />
                  {t.search}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 8px' }}
                  onClick={() => loadBrowse(0, false)}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </form>
            </div>

            {authorFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.55)',
                    color: '#bae6fd',
                  }}
                >
                  <span>
                    {t.author}: <strong>{authorFilter.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthorFilter(null)}
                    aria-label={t.cancel}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: '#e0f2fe',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                  </button>
                </span>
              </div>
            )}

            {listError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(244, 63, 94, 0.16)',
                  border: '1px solid rgba(244, 63, 94, 0.45)',
                  color: '#fda4af',
                  fontSize: 12.5,
                }}
              >
                {listError}
              </div>
            )}

            {/* List */}
            <div
              style={{
                flex: 1,
                minHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingRight: 4,
              }}
            >
              {loadingList && items.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  {t.loading}
                </div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: 13,
                    border: '1px dashed rgba(148, 163, 184, 0.25)',
                    borderRadius: 10,
                  }}
                >
                  {t.empty}
                </div>
              ) : (
                items.map((item) => {
                  const charMeta = CHAR_BY_ID.get(item.characterId);
                  const accent = charMeta?.accent ?? '#38bdf8';
                  const liked = likedIds.has(item.id);
                  const isDownloaded = downloadedOnlineIds.has(item.id) || justDownloadedIds.has(item.id);
                  const displayTitle = lang === 'en' && item.titleEn ? item.titleEn : item.title;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(148, 163, 184, 0.22)',
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '1px 7px',
                              borderRadius: 6,
                              background: `${accent}2b`,
                              color: '#f8fafc',
                              border: `1px solid ${accent}88`,
                            }}
                          >
                            {item.characterName}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background:
                                item.mode === 'modern'
                                  ? 'rgba(168, 85, 247, 0.22)'
                                  : 'rgba(56, 189, 248, 0.18)',
                              color: item.mode === 'modern' ? '#e9d5ff' : '#bae6fd',
                            }}
                          >
                            {item.mode === 'modern' ? t.modern : t.classic}
                          </span>
                          {item.position && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 999,
                                background:
                                  item.position === 'corner'
                                    ? 'rgba(251, 146, 60, 0.2)'
                                    : 'rgba(45, 212, 191, 0.16)',
                                color: item.position === 'corner' ? '#fdba74' : '#5eead4',
                              }}
                            >
                              {item.position === 'corner' ? t.corner : t.midscreen}
                            </span>
                          )}
                          {renderDifficultyBadge(item.difficulty)}
                          {item.status === 'pending' && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                padding: '1px 7px',
                                borderRadius: 999,
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#fde047',
                                border: '1px solid rgba(251, 191, 36, 0.6)',
                              }}
                            >
                              {t.unverifiedBadge}
                            </span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#f8fafc' }}>
                            {displayTitle}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 5,
                            fontSize: 11.5,
                            color: '#94a3b8',
                          }}
                        >
                          <span>
                            {t.author}:{' '}
                            <button
                              type="button"
                              title={t.filterByAuthor}
                              onClick={() => {
                                if (item.authorId) {
                                  setAuthorFilter({ id: item.authorId, name: item.author });
                                } else {
                                  setSearchInput(item.author);
                                  setAppliedSearch(item.author);
                                }
                              }}
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: '#7dd3fc',
                                fontWeight: 700,
                                fontSize: 'inherit',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: 2,
                              }}
                            >
                              {item.author}
                            </button>
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: 'rgba(30, 41, 59, 0.9)',
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                              fontSize: 10.5,
                              color: '#cbd5e1',
                            }}
                          >
                            <span>{item.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.id)}
                              title={t.copyCode}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '0 3px',
                                border: 'none',
                                background: 'transparent',
                                color: copiedId === item.id ? '#86efac' : '#7dd3fc',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedId === item.id ? t.copiedCode : t.copyCode}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyShareLink(item.id)}
                              title="複製分享連結"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '0 4px',
                                border: 'none',
                                borderLeft: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'transparent',
                                color: copiedLinkId === item.id ? '#86efac' : '#f472b6',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {copiedLinkId === item.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>
                                {copiedLinkId === item.id
                                  ? lang === 'en'
                                    ? 'Link Copied'
                                    : '已複製連結'
                                  : lang === 'en'
                                  ? 'Share Link'
                                  : '分享連結'}
                              </span>
                            </button>
                          </span>
                          <span>
                            {item.noteCount} {t.hits} · {item.totalFrames}f
                          </span>
                          <span>
                            {item.downloads} {t.downloadsLabel}
                          </span>
                          {item.tags.slice(0, 4).map((tg) => (
                            <span
                              key={tg}
                              style={{
                                fontSize: 10.5,
                                padding: '0px 6px',
                                borderRadius: 999,
                                background: 'rgba(148, 163, 184, 0.14)',
                                color: '#cbd5e1',
                              }}
                            >
                              #{translateTag(tg, lang)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={likingId === item.id}
                          onClick={() => handleToggleLike(item)}
                          title={t.likeTitle}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            borderColor: liked ? 'rgba(244, 63, 94, 0.7)' : undefined,
                            background: liked ? 'rgba(244, 63, 94, 0.2)' : undefined,
                            color: liked ? '#fda4af' : '#e2e8f0',
                          }}
                        >
                          <Heart size={13} fill={liked ? '#f43f5e' : 'none'} color={liked ? '#f43f5e' : 'currentColor'} />
                          <span>{item.likes}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={downloadingId === item.id}
                          onClick={() => handleDownload(item)}
                          style={{
                            padding: '5px 11px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderColor: isDownloaded ? 'rgba(74, 222, 128, 0.65)' : '#38bdf8',
                            background: isDownloaded
                              ? 'rgba(74, 222, 128, 0.16)'
                              : 'rgba(56, 189, 248, 0.22)',
                            color: isDownloaded ? '#86efac' : '#e0f2fe',
                          }}
                        >
                          {isDownloaded ? <Check size={13} /> : <Download size={13} />}
                          <span>{isDownloaded ? t.downloaded : t.download}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {hasMore && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loadingList}
                  onClick={() => loadBrowse(page + 1, true)}
                  style={{ alignSelf: 'center', marginTop: 4 }}
                >
                  {loadingList ? t.loading : t.loadMore}
                </button>
              )}
            </div>
          </div>
        )}

        {/* MY UPLOADS TAB */}
        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 240, flex: 1, overflowY: 'auto' }}>
            {!user ? (
              <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ color: '#cbd5e1', fontSize: 13.5 }}>{t.loginRequired}</div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    background: 'rgba(88, 101, 242, 0.25)',
                    borderColor: 'rgba(129, 140, 248, 0.7)',
                    color: '#e0e7ff',
                    fontWeight: 700,
                  }}
                  onClick={handleLogin}
                  disabled={loggingIn}
                >
                  <LogIn size={14} />
                  {t.loginDiscord}
                </button>
              </div>
            ) : (
              <>
                {mineError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(244, 63, 94, 0.16)',
                      border: '1px solid rgba(244, 63, 94, 0.45)',
                      color: '#fda4af',
                      fontSize: 12.5,
                    }}
                  >
                    {mineError}
                  </div>
                )}
                {loadingMine ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {t.loading}
                  </div>
                ) : myItems.length === 0 ? (
                  <div
                    style={{
                      padding: 32,
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: 13,
                      border: '1px dashed rgba(148, 163, 184, 0.25)',
                      borderRadius: 10,
                    }}
                  >
                    {t.mineEmpty}
                  </div>
                ) : (
                  myItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(148, 163, 184, 0.22)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          {renderStatusBadge(item.status)}
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7dd3fc' }}>
                            {item.characterName}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#f8fafc' }}>
                            {item.title}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            fontSize: 11.5,
                            color: '#94a3b8',
                            marginTop: 4,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: 'rgba(30, 41, 59, 0.9)',
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                              fontSize: 10.5,
                              color: '#cbd5e1',
                            }}
                          >
                            <span>{item.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.id)}
                              title={t.copyCode}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '0 3px',
                                border: 'none',
                                background: 'transparent',
                                color: copiedId === item.id ? '#86efac' : '#7dd3fc',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedId === item.id ? t.copiedCode : t.copyCode}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyShareLink(item.id)}
                              title="複製分享連結"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '0 4px',
                                border: 'none',
                                borderLeft: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'transparent',
                                color: copiedLinkId === item.id ? '#86efac' : '#f472b6',
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {copiedLinkId === item.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>
                                {copiedLinkId === item.id
                                  ? lang === 'en'
                                    ? 'Link Copied'
                                    : '已複製連結'
                                  : lang === 'en'
                                  ? 'Share Link'
                                  : '分享連結'}
                              </span>
                            </button>
                          </span>
                          <span>
                            {item.noteCount} {t.hits} · {item.totalFrames}f · {item.likes} ♥ · {item.downloads} {t.downloadsLabel}
                          </span>
                        </div>
                        {item.status === 'rejected' && item.rejectReason && (
                          <div style={{ fontSize: 12, color: '#fda4af', marginTop: 4 }}>
                            {t.rejectReason}
                            {item.rejectReason}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {confirmDeleteId === item.id ? (
                          <>
                            <span style={{ fontSize: 11.5, color: '#fda4af' }}>{t.deleteConfirm}</span>
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={deletingId === item.id}
                              style={{
                                padding: '4px 9px',
                                fontSize: 11.5,
                                borderColor: 'rgba(244, 63, 94, 0.7)',
                                background: 'rgba(244, 63, 94, 0.25)',
                                color: '#fecdd3',
                              }}
                              onClick={() => handleDeleteMine(item.id)}
                            >
                              {t.delete}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 9px', fontSize: 11.5 }}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              {t.cancel}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              padding: '4px 9px',
                              fontSize: 12,
                              borderColor: 'rgba(244, 63, 94, 0.45)',
                              color: '#fda4af',
                            }}
                            onClick={() => setConfirmDeleteId(item.id)}
                          >
                            <Trash2 size={13} />
                            {t.delete}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* UPLOAD TAB */}
        {tab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 240 }}>
            <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>{t.uploadRules}</div>

            {uploadableCombos.length === 0 && !initialUploadCombo ? (
              <div
                style={{
                  padding: 28,
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 13,
                  border: '1px dashed rgba(148, 163, 184, 0.25)',
                  borderRadius: 10,
                }}
              >
                {t.empty}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#cbd5e1' }}>{t.uploadIntro}</div>
                  {uploadableCombos.length > 1 && (
                    <select
                      value={selectedUploadCombo?.id ?? ''}
                      onChange={(e) => {
                        setSelectedUploadId(e.target.value);
                        setUploadResult(null);
                      }}
                      style={{ ...selectStyle, padding: '8px 10px', fontSize: 13 }}
                    >
                      {uploadableCombos.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.characterName} · {c.mode}] {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedUploadCombo && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <strong style={{ color: '#7dd3fc' }}>{selectedUploadCombo.characterName}</strong>
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                        {selectedUploadCombo.mode === 'modern' ? t.modern : t.classic}
                      </span>
                      {renderDifficultyBadge(selectedUploadCombo.difficulty)}
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{selectedUploadCombo.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {selectedUploadCombo.notes.length} {t.hits} ·{' '}
                      {selectedUploadCombo.notes[selectedUploadCombo.notes.length - 1]?.frame ?? 0}f
                    </div>
                    <div className="combo-steps" style={{ marginTop: 4 }}>
                      {selectedUploadCombo.notes.slice(0, 14).map((n, idx) => (
                        <React.Fragment key={n.id}>
                          <span className="step-chip">
                            <strong>{n.notation}</strong>
                            <small>{n.frame}f</small>
                          </span>
                          {idx < Math.min(selectedUploadCombo.notes.length, 14) - 1 && (
                            <span className="step-arrow">→</span>
                          )}
                        </React.Fragment>
                      ))}
                      {selectedUploadCombo.notes.length > 14 && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          +{selectedUploadCombo.notes.length - 14}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {localValidation && !localValidation.ok && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(244, 63, 94, 0.16)',
                      border: '1px solid rgba(244, 63, 94, 0.45)',
                      color: '#fda4af',
                      fontSize: 12,
                    }}
                  >
                    <div>{t.errInvalidFormat}</div>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {localValidation.errors.slice(0, 6).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {uploadResult && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: uploadResult.ok
                        ? 'rgba(74, 222, 128, 0.16)'
                        : 'rgba(244, 63, 94, 0.16)',
                      border: uploadResult.ok
                        ? '1px solid rgba(74, 222, 128, 0.5)'
                        : '1px solid rgba(244, 63, 94, 0.5)',
                      color: uploadResult.ok ? '#86efac' : '#fda4af',
                      fontSize: 12.5,
                    }}
                  >
                    {uploadResult.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto' }}>
                  {!user ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        background: 'rgba(88, 101, 242, 0.25)',
                        borderColor: 'rgba(129, 140, 248, 0.7)',
                        color: '#e0e7ff',
                        fontWeight: 700,
                      }}
                      onClick={handleLogin}
                      disabled={loggingIn}
                    >
                      <LogIn size={14} />
                      {t.loginDiscord}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={uploading || !selectedUploadCombo || Boolean(localValidation && !localValidation.ok)}
                      onClick={handleUpload}
                      style={{
                        background: 'rgba(56, 189, 248, 0.26)',
                        borderColor: '#38bdf8',
                        color: '#e0f2fe',
                        fontWeight: 800,
                        padding: '7px 16px',
                      }}
                    >
                      <Upload size={14} />
                      {uploading ? t.uploading : t.uploadSubmit}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
