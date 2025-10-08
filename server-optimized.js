// Optimized Express server for Railway with browser reuse
import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Caching - optimized sizes
const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 3000; // Increased to 3s for less requests
const CHARACTER_CACHE_DURATION = 7200000; // Increased to 2 hours

// Browser instance reuse for Railway
let sharedBrowser = null;
let browserLaunching = false;

// Cleanup - optimized
setInterval(() => {
  const now = Date.now();
  
  // Clean deaths cache
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 3) {
      cache.delete(key);
    }
  }
  
  // Clean character cache - smaller limit
  if (characterCache.size > 100) { // Reduced from 200
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 30).forEach(([key]) => characterCache.delete(key));
  }
}, 30000); // Check every 30s instead of 10s

// Get or create browser - optimized for Railway
async function getBrowser() {
  // If browser exists and is connected, reuse it
  if (sharedBrowser) {
    try {
      if (sharedBrowser.isConnected()) {
        console.log('♻️  Reusing browser');
        return sharedBrowser;
      }
    } catch (e) {
      console.log('🔄 Browser disconnected, creating new one');
      sharedBrowser = null;
    }
  }
  
  // Wait if another request is launching browser
  if (browserLaunching) {
    console.log('⏳ Waiting for browser launch...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getBrowser(); // Retry
  }
  
  browserLaunching = true;
  
  try {
    console.log('🚀 Launching browser...');
    sharedBrowser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
        '--disable-extensions',
        '--disable-default-apps'
      ],
      headless: true,
      timeout: 15000,
    });
    
    browserLaunching = false;
    return sharedBrowser;
  } catch (error) {
    browserLaunching = false;
    throw error;
  }
}

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

// API endpoint - optimized
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

  let page = null;
  let browser = null;

  try {
    console.log(`🌐 Fetching deaths for world ${worldId}...`);
    
    // Get or create browser (reuse!)
    browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Smaller viewport = less memory
    await page.setViewport({ width: 1024, height: 600 });
    
    // Block resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'websocket'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 20000 
    });

    await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 10000 });

    const deaths = await page.evaluate(() => {
      const rows = document.querySelectorAll("div.TableContentContainer table.TableContent tr");
      const arr = [];

      rows.forEach((row) => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 3) return;

        const time = tds[1]?.innerText.trim();
        const playerLink = tds[2]?.querySelector("a")?.href || null;
        const player = tds[2]?.querySelector("a")?.innerText.trim() || null;

        const text = tds[2]?.innerText.replace(/\s+/g, " ") || "";
        const levelMatch = text.match(/level\s*(\d+)/i);
        if (!levelMatch || !player) return;

        const level = parseInt(levelMatch[1]);
        let cause = text.replace(/^.*?died at level \d+ by\s+/i, "");
        cause = cause.replace(/\.$/, "");

        arr.push({ player, playerLink, level, cause, time });
      });

      return arr;
    });

    console.log(`✅ Found ${deaths.length} deaths`);

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
        console.log(`✓ ${death.player}`);
        cacheHits++;
        deathsWithCharacterData.push({
          ...death,
          ...cachedChar.data
        });
        continue;
      }
      
      try {
        console.log(`✗ ${death.player}`);
        cacheMisses++;

        await page.goto(death.playerLink, {
          waitUntil: "domcontentloaded",
          timeout: 15000
        });

        await page.waitForSelector("div.TableContentContainer", { timeout: 5000 });

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
        
        // Cache character data
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

        // Reduced delay
        if (i < latestDeaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms instead of 100ms
        }

      } catch (error) {
        console.error(`❌ ${death.player}: ${error.message}`);
        deathsWithCharacterData.push({
          ...death,
          vocation: "Unknown",
          residence: "Unknown",
          accountStatus: "Free Account",
          guild: "No Guild"
        });
      }
    }

    console.log(`✅ ${deathsWithCharacterData.length} deaths (${cacheHits} cached, ${cacheMisses} fetched)`);

    // Close page but keep browser alive
    await page.close();

    // Cache result
    cache.set(cacheKey, {
      data: deathsWithCharacterData,
      timestamp: Date.now()
    });

    res.json(deathsWithCharacterData);

  } catch (err) {
    console.error("❌ Error:", err.message);
    
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore
      }
    }
    
    // If browser failed completely, reset it
    if (browser && !browser.isConnected()) {
      sharedBrowser = null;
    }
    
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok',
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    cache: {
      deaths: cache.size,
      characters: characterCache.size
    },
    browser: sharedBrowser && sharedBrowser.isConnected() ? 'alive' : 'closed'
  });
});

// SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/deaths`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`⚡ Optimized with browser reuse`);
  console.log(`💾 Memory: ~200-300MB (with reuse)\n`);
});

