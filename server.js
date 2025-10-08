// Simple Express server for Render.com with Puppeteer
// No browser reuse - simpler and more reliable
import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Caching
const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 2000;
const CHARACTER_CACHE_DURATION = 3600000;

// Cleanup
setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 2) {
      cache.delete(key);
    }
  }
  
  if (characterCache.size > 200) {
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 50).forEach(([key]) => characterCache.delete(key));
  }
}, 10000);

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API endpoint
app.get('/api/deaths', async (req, res) => {
  const worldId = req.query.world || "20";
  const url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;

  // Check cache
  const cacheKey = `deaths_${worldId}_v2`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache hit for world ${worldId}`);
    return res.json(cached.data);
  }

  let browser = null;

  try {
    console.log(`🌐 Fetching deaths for world ${worldId}...`);
    
    // Launch fresh browser each time - simple and reliable
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process'
      ],
      headless: true,
      timeout: 15000,
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Block resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log(`📡 Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });

    console.log(`⏳ Waiting for table...`);
    await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 15000 });

    const deaths = await page.evaluate(() => {
      const rows = document.querySelectorAll("div.TableContentContainer table.TableContent tr");
      const arr = [];
      let count = 0;
      const MAX_DEATHS = 10; // Only parse first 10 rows instead of all 300!

      for (let i = 0; i < rows.length && count < MAX_DEATHS; i++) {
        const row = rows[i];
        const tds = row.querySelectorAll("td");
        if (tds.length < 3) continue;

        const time = tds[1]?.innerText.trim();
        const playerLink = tds[2]?.querySelector("a")?.href || null;
        const player = tds[2]?.querySelector("a")?.innerText.trim() || null;

        const text = tds[2]?.innerText.replace(/\s+/g, " ") || "";
        const levelMatch = text.match(/level\s*(\d+)/i);
        if (!levelMatch || !player) continue;

        const level = parseInt(levelMatch[1]);
        let cause = text.replace(/^.*?died at level \d+ by\s+/i, "");
        cause = cause.replace(/\.$/, "");

        arr.push({ player, playerLink, level, cause, time });
        count++;
      }

      return arr;
    });

    console.log(`✅ Parsed ${deaths.length} deaths (max 10)`);

    // Fetch character data for latest 5 deaths
    const latestDeaths = deaths.slice(0, 5);
    const deathsWithCharacterData = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < latestDeaths.length; i++) {
      const death = latestDeaths[i];
      
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(charCacheKey);
      
      if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
        console.log(`✓ Cache hit: ${death.player}`);
        cacheHits++;
        deathsWithCharacterData.push({
          ...death,
          ...cachedChar.data
        });
        continue;
      }
      
      try {
        console.log(`✗ Fetching: ${death.player}`);
        cacheMisses++;

        await page.goto(death.playerLink, {
          waitUntil: "domcontentloaded",
          timeout: 10000
        });

        await page.waitForSelector("div.TableContentContainer", { timeout: 3000 });

        const characterData = await page.evaluate(() => {
          const table = document.querySelector("div.TableContentContainer table.TableContent");
          if (!table) return null;

          const rows = table.querySelectorAll("tr");
          const data = {};

          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
              const labelCell = cells[0];
              const valueCell = cells[1];

              if (labelCell && valueCell) {
                const label = labelCell.textContent?.trim().toLowerCase() || '';
                let value = valueCell.textContent?.trim() || '';

                if (label && value && value !== '') {
                  if (label.includes("vocation")) {
                    data.vocation = value;
                  } else if (label.includes("residence")) {
                    data.residence = value;
                  } else if (label.includes("account status") || label.includes("account")) {
                    data.accountStatus = value;
                  } else if (label.includes("guild")) {
                    data.guild = value.replace(/^Member of the\s*/i, '').replace(/^.*?\sof\s+the\s+/i, '');
                  }
                }
              }
            }
          });

          return data;
        });

        const charData = {
          vocation: characterData?.vocation || "Unknown",
          residence: characterData?.residence || "Unknown",
          accountStatus: characterData?.accountStatus || "Free Account",
          guild: characterData?.guild || "No Guild"
        };
        
        if (characterData && (characterData.vocation || characterData.residence || characterData.accountStatus)) {
          characterCache.set(charCacheKey, {
            data: charData,
            timestamp: Date.now()
          });
        }
        
        deathsWithCharacterData.push({
          ...death,
          ...charData
        });

        if (i < latestDeaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`❌ Error fetching ${death.player}:`, error.message);
        deathsWithCharacterData.push({
          ...death,
          vocation: "Unknown",
          residence: "Unknown",
          accountStatus: "Free Account",
          guild: "No Guild"
        });
      }
    }

    console.log(`✅ Processed ${deathsWithCharacterData.length} deaths (${cacheHits} cached, ${cacheMisses} fetched)`);

    // Close browser before responding
    await browser.close();

    // Cache result
    cache.set(cacheKey, {
      data: deathsWithCharacterData,
      timestamp: Date.now()
    });

    res.json(deathsWithCharacterData);

  } catch (err) {
    console.error("❌ Error:", err);
    console.error("❌ Stack:", err.stack);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }
    
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    cache: {
      deaths: cache.size,
      characters: characterCache.size
    }
  });
});

// SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  console.log(`Serving index.html from: ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading page - dist folder might not be built');
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/deaths`);
  console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
});
