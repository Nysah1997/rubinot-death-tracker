// Netlify function with better headers to bypass bot detection
import fetch from "node-fetch";

const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 2000;
const CHARACTER_CACHE_DURATION = 3600000;

// Set para no enviar alertas duplicadas
const notifiedDeaths = new Set();

// Webhook de Discord
const DISCORD_WEBHOOK_URL = "TU_WEBHOOK_DE_DISCORD_AQUI";

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 2) {
      cache.delete(key);
    }
  }
  if (characterCache.size > 500) {
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 100).forEach(([key]) => characterCache.delete(key));
  }
}, 10000);

async function sendDiscordAlert(death) {
  const message = {
    content: `💀 **${death.player}** (nivel ${death.level}) murió en **${death.time}** en ${death.vocation}, ${death.residence}. Causa: ${death.cause}. Cuenta: ${death.accountStatus}. Guild: ${death.guild}`,
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Error enviando alerta a Discord:", err.message);
  }
}

function parseDeathsTable(html) {
  const deaths = [];
  const tableMatch = html.match(/<table[^>]*class="TableContent"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return deaths;

  const tableContent = tableMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    const rowHtml = rowMatch[1];
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }

    if (cells.length >= 3) {
      const time = cells[1].replace(/<[^>]*>/g, '').trim();
      const playerLinkMatch = cells[2].match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/i);
      if (!playerLinkMatch) continue;

      const playerLink = 'https://rubinot.com.br/' + playerLinkMatch[1].replace(/^\.\/\?/, '?');
      const player = playerLinkMatch[2].trim();

      const fullText = cells[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const levelMatch = fullText.match(/level\s+(\d+)/i);
      if (!levelMatch) continue;

      const level = parseInt(levelMatch[1]);
      const causeMatch = fullText.match(/level\s+\d+\s+by\s+(.+?)\.?\s*$/i);
      const cause = causeMatch ? causeMatch[1].trim() : 'unknown';

      deaths.push({ player, playerLink, level, cause, time });
    }
  }

  return deaths;
}

function parseCharacterData(html) {
  const data = {
    vocation: 'Unknown',
    residence: 'Unknown',
    accountStatus: 'Free Account',
    guild: 'No Guild'
  };

  const vocationMatch = html.match(/<b>Vocation:<\/b><\/td>\s*<td>([^<]+)/i);
  if (vocationMatch) data.vocation = vocationMatch[1].trim();

  const residenceMatch = html.match(/<b>Residence:<\/b><\/td>\s*<td>([^<]+)/i);
  if (residenceMatch) data.residence = residenceMatch[1].trim();

  const accountMatch = html.match(/<b>Account\s+status:<\/b><\/td>\s*<td>[\s\S]*?<b>([^<]+)<\/b>/i);
  if (accountMatch) data.accountStatus = accountMatch[1].trim();

  const guildMatch = html.match(/<b>Guild:<\/b><\/td>\s*<td>Member of the <a[^>]*>([^<]+)<\/a>/i);
  if (guildMatch) data.guild = guildMatch[1].trim();

  return data;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  const worldId = event.queryStringParameters?.world || "20";
  const url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;

  const cacheKey = `deaths_${worldId}_v3`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(cached.data)
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch deaths: ${response.status}`);

    const html = await response.text();
    const deaths = parseDeathsTable(html);

    const latestDeaths = deaths.slice(0, 5);
    const deathsWithCharacterData = [];

    for (const death of latestDeaths) {
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(charCacheKey);

      if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
        deathsWithCharacterData.push({ ...death, ...cachedChar.data });
        continue;
      }

      try {
        const charResponse = await fetch(death.playerLink, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://rubinot.com.br/',
            'Connection': 'keep-alive'
          }
        });

        if (!charResponse.ok) throw new Error(`Failed to fetch character: ${charResponse.status}`);

        const charHtml = await charResponse.text();
        const charData = parseCharacterData(charHtml);

        characterCache.set(charCacheKey, { data: charData, timestamp: Date.now() });
        deathsWithCharacterData.push({ ...death, ...charData });

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching ${death.player}:`, error.message);
        deathsWithCharacterData.push({
          ...death,
          vocation: 'Unknown',
          residence: 'Unknown',
          accountStatus: 'Free Account',
          guild: 'No Guild'
        });
      }
    }

    // Enviar alertas a Discord
    for (const death of deathsWithCharacterData) {
      const deathId = `${death.player}_${death.time}`;
      if (!notifiedDeaths.has(deathId) && (death.level >= 100 || death.accountStatus.includes("Premium"))) {
        await sendDiscordAlert(death);
        notifiedDeaths.add(deathId);
      }
    }

    cache.set(cacheKey, { data: deathsWithCharacterData, timestamp: Date.now() });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deathsWithCharacterData)
    };

  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: err.message })
    };
  }
}
