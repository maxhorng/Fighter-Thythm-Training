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

  const infoCat = await ensureCategory('官方資訊');
  const communityCat = await ensureCategory('社群交流');

  const welcomeCh = await ensureTextChannel(
    '歡迎與下載',
    infoCat.id,
    'Frame Beat Trainer (FBT) 官方下載、使用說明與伺服器版規',
    true
  );
  const announceCh = await ensureTextChannel(
    '公告與更新',
    infoCat.id,
    '每次發布新版本時會自動在此推播更新通知',
    true
  );
  await ensureTextChannel(
    '連段分享',
    communityCat.id,
    '分享你的線上連段編號 (oc-xxxx) 或分享連結！',
    false
  );
  await ensureTextChannel(
    '問題回報',
    communityCat.id,
    '遇到 Bug、按鍵偵測問題或設定疑問請在這裡貼截圖回報',
    false
  );
  await ensureTextChannel(
    '建議與許願',
    communityCat.id,
    '有任何新功能點子或手感調整建議都歡迎提出！',
    false
  );
  await ensureTextChannel(
    '閒聊交流',
    communityCat.id,
    '快打旋風 6 練段心得、角色討論與日常交流',
    false
  );

  console.log('2. Posting & pinning welcome message in #歡迎與下載...');
  const welcomeMsg = await discordApi('POST', `/channels/${welcomeCh.id}/messages`, {
    content: [
      '**歡迎來到 Frame Beat Trainer (FBT) 官方社群！**',
      '',
      'FBT 是一款免費開源的《快打旋風 6》透明疊層節奏練段工具，無巨集、無自動出招、不讀寫遊戲記憶體。',
      '',
      '**官方連結**',
      '- 官方一鍵下載網站：https://maxhorng.github.io/Frame-Beat-Trainer/',
      '- GitHub 專案與 SHA-256 校驗碼：https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest',
      '- Ko-fi 贊助支持開發：https://ko-fi.com/92liang',
      '',
      '**頻道說明**',
      '- `#公告與更新`：每次推出新版本會自動通知',
      '- `#連段分享`：歡迎貼出你的線上連段分享連結或 `oc-xxxx` 編號',
      '- `#問題回報`：遇到任何 Bug 或設定問題歡迎附上截圖發問',
      '- `#建議與許願`：歡迎許願想新增的功能',
      '',
      '**簡單版規**',
      '1. 互相尊重，友善交流練段心得。',
      '2. 禁止張貼外掛、巨集、廣告或惡意連結。',
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
