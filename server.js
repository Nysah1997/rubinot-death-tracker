// ULTRA-FAST Express server for Railway
// Optimized with: browser reuse, parallel fetching, pre-warming, longer cache
import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Optimized caching - longer durations
const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds (more cache hits!)
const CHARACTER_CACHE_DURATION = 14400000; // 4 hours (longer persistence!)

// Browser instance for reuse
let sharedBrowser = null;
let browserLaunching = false;

// Cleanup - less frequent
setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 3) {
      cache.delete(key);
    }
  }
  
  if (characterCache.size > 100) {
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 30).forEach(([key]) => characterCache.delete(key));
  }
}, 60000); // Every minute

// Get or create browser - optimized
async function getBrowser() {
  if (sharedBrowser) {
    try {
      if (sharedBrowser.isConnected()) {
        return sharedBrowser;
      }
    } catch (e) {
      sharedBrowser = null;
    }
  }
  
  if (browserLaunching) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getBrowser();
  }
  
  browserLaunching = true;
  
  try {
    sharedBrowser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
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

// Pre-warm browser on startup!
(async () => {
  try {
    console.log('🔥 Pre-warming browser...');
    await getBrowser();
    console.log('✅ Browser pre-warmed and ready!');
  } catch (e) {
    console.error('⚠️  Browser pre-warm failed, will launch on first request');
  }
})();

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

// Helper function for parallel character fetching
async function fetchCharacterData(page, playerLink, playerName) {
  try {
    await page.goto(playerLink, {
      waitUntil: "domcontentloaded",
      timeout: 10000
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

    return {
      vocation: characterData?.vocation || "Unknown",
      residence: characterData?.residence || "Unknown",
      accountStatus: characterData?.accountStatus || "Free Account",
      guild: characterData?.guild || "No Guild"
    };
  } catch (error) {
    console.error(`❌ ${playerName}: ${error.message}`);
    return {
      vocation: "Unknown",
      residence: "Unknown",
      accountStatus: "Free Account",
      guild: "No Guild"
    };
  }
}

// API endpoint - ULTRA FAST!
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

  try {
    console.log(`🌐 Fetching deaths for world ${worldId}...`);
    
    // Get browser (reuse or create)
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1024, height: 600 }); // Smaller viewport
    
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
      timeout: 30000 // Longer timeout for slow servers
    });

    // Try to wait for table, if fails, check if page loaded anyway
    try {
      await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 15000 });
    } catch (timeoutError) {
      // Check if page has any content at all
      const hasContent = await page.evaluate(() => {
        return document.querySelector("div.TableContentContainer") !== null;
      });
      
      if (!hasContent) {
        throw new Error(`Server ${worldId} page didn't load properly - might be offline or slow`);
      }
      
      // Page loaded but table took too long, try to continue anyway
      console.log(`⚠️  Table took longer than expected, continuing...`);
    }

    // Parse only first 10 deaths (not 300!)
    const deaths = await page.evaluate(() => {
      const rows = document.querySelectorAll("div.TableContentContainer table.TableContent tr");
      const arr = [];
      let count = 0;
      const MAX_DEATHS = 10;

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

    console.log(`✅ Parsed ${deaths.length} deaths`);

    // If no deaths found, return empty array with cache
    if (deaths.length === 0) {
      console.log(`⚠️  No deaths found for world ${worldId}`);
      await page.close();
      
      const emptyResult = [];
      cache.set(cacheKey, {
        data: emptyResult,
        timestamp: Date.now()
      });
      
      return res.json(emptyResult);
    }

    // Fetch character data for latest 5 deaths
    const latestDeaths = deaths.slice(0, 5);
    
    // PARALLEL FETCHING - fetch all characters at once!
    const characterPromises = latestDeaths.map(async (death) => {
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(charCacheKey);
      
      // Check cache first
      if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
        console.log(`✓ ${death.player}`);
        return {
          ...death,
          ...cachedChar.data
        };
      }
      
      console.log(`✗ ${death.player}`);
      
      // Create new page for this character (parallel!)
      const charPage = await browser.newPage();
      
      try {
        await charPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await charPage.setViewport({ width: 1024, height: 600 });
        
        // Block resources
        await charPage.setRequestInterception(true);
        charPage.on('request', (req) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        const charData = await fetchCharacterData(charPage, death.playerLink, death.player);
        
        // Cache it
        if (charData.vocation !== "Unknown" || charData.residence !== "Unknown") {
          characterCache.set(charCacheKey, {
            data: charData,
            timestamp: Date.now()
          });
        }
        
        await charPage.close();
        
        return {
          ...death,
          ...charData
        };
      } catch (error) {
        console.error(`❌ ${death.player}: ${error.message}`);
        await charPage.close().catch(() => {});
        return {
          ...death,
          vocation: "Unknown",
          residence: "Unknown",
          accountStatus: "Free Account",
          guild: "No Guild"
        };
      }
    });

    // Wait for all character fetches to complete (parallel!)
    const deathsWithCharacterData = await Promise.all(characterPromises);

    console.log(`✅ Processed ${deathsWithCharacterData.length} deaths (parallel fetch)`);

    // Close main page
    await page.close();

    // Cache result
    cache.set(cacheKey, {
      data: deathsWithCharacterData,
      timestamp: Date.now()
    });

    res.json(deathsWithCharacterData);

  } catch (err) {
    console.error("❌ Error:", err.message);
    
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
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
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
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
  console.log('🛑 Shutting down...');
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 ULTRA-FAST Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/deaths`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`\n⚡ Optimizations:`);
  console.log(`   ✅ Browser reuse`);
  console.log(`   ✅ Parallel character fetching`);
  console.log(`   ✅ Pre-warmed browser`);
  console.log(`   ✅ Parse only 10 deaths (not 300)`);
  console.log(`   ✅ Extended caching (5s deaths, 4h characters)`);
  console.log(`\n💾 Expected memory: ~200-250MB`);
  console.log(`⚡ Expected speed: 0.8-2s (3x faster!)\n`);
});
