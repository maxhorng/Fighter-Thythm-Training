#!/usr/bin/env node
/**
 * One-click Discord Server Setup Script for Frame Beat Trainer (FBT)
 * Zero dependencies (uses Node 18+ built-in fetch).
 *
 * Usage (PowerShell):
 *   $env:DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
 *   $env:DISCORD_GUILD_ID="YOUR_SERVER_ID"
 *   node scripts/setup-discord.mjs
 */

const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim();
const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim();

if (!TOKEN || !GUILD_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID environment variable.');
  console.error('PowerShell example:');
  console.error('  $env:DISCORD_BOT_TOKEN="your_bot_token"');
  console.error('  $env:DISCORD_GUILD_ID="your_server_id"');
  console.error('  node scripts/setup-discord.mjs');
  process.exit(1);
}

const API = 'https://discord.com/api/v10';
const SEND_MESSAGES = 1n << 11n; // 2048
const VIEW_CHANNEL = 1n << 10n; // 1024

async function discordApi(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discord API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('1. Fetching existing channels...');
  const existing = await discordApi('GET', `/guilds/${GUILD_ID}/channels`);
  const byName = new Map(existing.map((c) => [c.name, c]));

  const ensureCategory = async (name) => {
    if (byName.has(name)) {
      console.log(`   [skip] Category "${name}" already exists.`);
      return byName.get(name);
    }
    const created = await discordApi('POST', `/guilds/${GUILD_ID}/channels`, {
      name,
      type: 4, // GUILD_CATEGORY
    });
    console.log(`   [created] Category "${name}"`);
    return created;
  };

  const ensureTextChannel = async (name, parentId, topic, readOnly = false) => {
    if (byName.has(name)) {
      console.log(`   [skip] Channel "#${name}" already exists.`);
      return byName.get(name);
    }
    const payload = {
      name,
      type: 0, // GUILD_TEXT
      parent_id: parentId,
      topic,
    };
    if (readOnly) {
      // @everyone role id === guild id
      payload.permission_overwrites = [
        {
          id: GUILD_ID,
          type: 0,
          allow: VIEW_CHANNEL.toString(),
          deny: SEND_MESSAGES.toString(),
        },
      ];
    }
    const created = await discordApi('POST', `/guilds/${GUILD_ID}/channels`, payload);
    console.log(`   [created] Channel "#${name}"${readOnly ? ' (read-only)' : ''}`);
    return created;
  };

  const infoCat = await ensureCategory('OFFICIAL / 官方資訊');
  const globalCat = await ensureCategory('GLOBAL / ENGLISH');
  const langCat = await ensureCategory('LANGUAGES / 各語言交流區');

  const welcomeCh = await ensureTextChannel(
    'welcome-and-download',
    infoCat.id,
    'Official download, quick start guide, and server rules (EN / 繁中 / 日本語)',
    true
  );
  const announceCh = await ensureTextChannel(
    'announcements',
    infoCat.id,
    'Automatic release notifications whenever a new version of FBT is published',
    true
  );

  // Global / English channels
  await ensureTextChannel(
    'general-en',
    globalCat.id,
    'English general discussion for Street Fighter 6 & Frame Beat Trainer',
    false
  );
  await ensureTextChannel(
    'combo-sharing',
    globalCat.id,
    'Share your Online Combo Library links (combo.html?id=oc-xxxx) or oc-xxxx codes!',
    false
  );
  await ensureTextChannel(
    'bug-reports',
    globalCat.id,
    'Report bugs, input issues, or setup questions (screenshots welcome!)',
    false
  );
  await ensureTextChannel(
    'suggestions',
    globalCat.id,
    'Feature requests and feedback for future FBT updates',
    false
  );

  // International language channels
  await ensureTextChannel(
    '繁體中文-討論',
    langCat.id,
    '繁體中文交流、練段心得與使用發問區',
    false
  );
  await ensureTextChannel(
    '日本語-チャット',
    langCat.id,
    '日本語での雑談・コンボ練習・質問チャンネル',
    false
  );
  await ensureTextChannel(
    '한국어-채팅',
    langCat.id,
    '한국어 자유 대화 및 질문 채널',
    false
  );

  console.log('2. Posting & pinning multilingual welcome message in #welcome-and-download...');
  const welcomeMsg = await discordApi('POST', `/channels/${welcomeCh.id}/messages`, {
    content: [
      '**Welcome to the Official Frame Beat Trainer (FBT) Community! / 歡迎來到 FBT 官方社群！ / 公式コミュニティへようこそ！**',
      '',
      'Frame Beat Trainer (FBT) is a free, open-source rhythm combo overlay for Street Fighter 6 — visual & timing guidance only (no macros, no auto-inputs, no memory reading).',
      'FBT 是一款免費開源的《快打旋風 6》透明疊層節奏練段工具，無巨集、無自動出招、不讀寫遊戲記憶體。',
      '',
      '**Official Links / 官方連結**',
      '- Official Website (1-Click Download): https://maxhorng.github.io/Frame-Beat-Trainer/',
      '- GitHub Releases & SHA-256: https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest',
      '- Support on Ko-fi: https://ko-fi.com/92liang',
      '',
      '**Channels / 頻道導覽**',
      '- `#announcements`: Auto-posted release updates / 新版本自動更新通知',
      '- `#combo-sharing`: Share your `oc-xxxx` links / 分享你的線上連段連結',
      '- `#bug-reports` & `#suggestions`: Feedback & troubleshooting / 問題回報與許願',
      '- `#general-en` / `#繁體中文-討論` / `#日本語-チャット` / `#한국어-채팅`: Language chat rooms',
      '',
      '**Rules / 版規**',
      '1. Be respectful and welcoming to all players. / 互相尊重，友善交流。',
      '2. No cheats, macros, spam, or malicious links. / 禁止外掛、巨集、廣告或惡意連結。',
    ].join('\n'),
  });
  if (welcomeMsg?.id) {
    await discordApi('PUT', `/channels/${welcomeCh.id}/pins/${welcomeMsg.id}`);
    console.log('   [pinned] Welcome message pinned.');
  }

  console.log('3. Creating GitHub Release notification webhook in #公告與更新...');
  const webhook = await discordApi('POST', `/channels/${announceCh.id}/webhooks`, {
    name: 'FBT Release Bot',
  });

  console.log('\n=== SETUP COMPLETE ===');
  console.log('Webhook URL (save this as GitHub Repo Secret: DISCORD_RELEASE_WEBHOOK):');
  console.log(webhook.url);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
