import fetch from 'node-fetch';

// --- CONFIG ---
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const WORLD_ID = "20"; // Cambia el mundo si quieres
const POLLING_INTERVAL = 60000; // 60 segundos

// --- MEMORIA DE NOTIFICACIONES ---
const notifiedDeaths = new Set();

// --- FUNCIONES DE PARSEO ---
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

// --- FUNCION PARA ENVIAR ALERTA A DISCORD ---
async function sendDiscordAlert(death) {
  const content = `💀 **${death.player}** (Level ${death.level}) ha muerto.\nCausa: ${death.cause}\n[Perfil](${death.playerLink})`;
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error(`Error webhook Discord: ${res.status}`);
    console.log(`Alerta enviada: ${death.player}`);
  } catch (err) {
    console.error('Error enviando alerta Discord:', err.message);
  }
}

// --- FUNCION PRINCIPAL DE CHEQUEO ---
async function checkDeaths() {
  const url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${WORLD_ID}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html'
    }
  });
  const html = await response.text();
  const deaths = parseDeathsTable(html);
  const latestDeaths = deaths.slice(0, 5);

  for (const death of latestDeaths) {
    const deathId = `${death.player}_${death.time}`;
    if (!notifiedDeaths.has(deathId)) {
      // Enviar alerta a Discord
      await sendDiscordAlert(death);
      notifiedDeaths.add(deathId);
    }
  }
}

// --- INICIAR POLLING AUTOMATICO ---
console.log('Bot de alertas iniciado. Revisando muertes cada 60 segundos...');
setInterval(checkDeaths, POLLING_INTERVAL);

// --- OPCIONAL: Ejecutar inmediatamente al inicio ---
checkDeaths();
