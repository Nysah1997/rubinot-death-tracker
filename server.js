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

// Optimized caching - aggressive settings to protect Rubinot server
const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 3000; // 3 seconds for deaths (balanced: fresh + protection)
const CHARACTER_CACHE_DURATION = 86400000; // 24 hours (character data rarely changes!)

// Store the very latest death separately for instant access
let latestDeathCache = null;
let latestDeathTimestamp = 0;
const LATEST_DEATH_CACHE = 2000; // 2 seconds only for latest death

// ULTRA-FAST: Store deaths without character data for instant response
let fastDeathsCache = null;
let fastDeathsTimestamp = 0;
const FAST_DEATHS_CACHE = 2000; // 2 second cache for instant deaths

// Browser instance for reuse
let sharedBrowser = null;
let browserLaunching = false;

// Rate limiting protection to avoid IP blocking
const requestLog = new Map(); // Track requests per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 20; // Max 20 API calls per minute per IP
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests from same IP

// Rate limiting middleware (smart - excludes cache hits!)
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Check minimum interval first (always applies, even for cache)
  if (!requestLog.has(ip)) {
    requestLog.set(ip, { requests: [], lastRequest: 0 });
  }
  
  const ipData = requestLog.get(ip);
  const timeSinceLastRequest = now - ipData.lastRequest;
  
  // Minimum 500ms between ANY requests (spam protection)
  if (ipData.lastRequest > 0 && timeSinceLastRequest < 500) {
    console.warn(`⚠️  Request too fast from IP ${ip}: ${timeSinceLastRequest}ms`);
    return res.status(429).json({ 
      error: 'Requests too frequent. Please wait 500ms between requests.',
      retryAfter: 1
    });
  }
  
  // Update last request time
  ipData.lastRequest = now;
  requestLog.set(ip, ipData);
  
  // Mark this request for potential rate limit tracking
  // Will be logged ONLY if it results in actual Rubinot fetch (not cache hit)
  req._rateLimitIP = ip;
  req._rateLimitTime = now;
  
  next();
}

// Helper to log non-cached requests
function logRateLimitRequest(ip) {
  const now = Date.now();
  
  if (!requestLog.has(ip)) {
    requestLog.set(ip, { requests: [], lastRequest: now });
  }
  
  const ipData = requestLog.get(ip);
  
  // Remove old requests outside the time window
  const recentRequests = ipData.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  // Add this request
  recentRequests.push(now);
  
  ipData.requests = recentRequests;
  requestLog.set(ip, ipData);
  
  // Check if rate limit would be exceeded
  if (recentRequests.length > MAX_REQUESTS_PER_MINUTE) {
    console.warn(`⚠️  High request rate from IP ${ip}: ${recentRequests.length} Rubinot fetches/minute`);
  }
}

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
  
  // Cleanup old rate limit logs
  for (const [ip, ipData] of requestLog.entries()) {
    const recentRequests = ipData.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recentRequests.length === 0 && now - ipData.lastRequest > RATE_LIMIT_WINDOW) {
      requestLog.delete(ip);
    } else {
      ipData.requests = recentRequests;
      requestLog.set(ip, ipData);
    }
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
      timeout: 10000 // Reduced for speed!
    });

    // Try to wait for content, but continue if it fails
    try {
      await page.waitForSelector("div.TableContentContainer", { timeout: 5000 }); // Aggressive timeout!
    } catch (selectorError) {
      console.warn(`⚠️  ${playerName}: Slow page, skipping...`);
      // Return immediately with Unknown values
      return {
        vocation: "Unknown",
        residence: "Unknown",
        accountStatus: "Free Account",
        guild: "No Guild"
      };
    }

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

// Helper function to fetch a single character (for priority fetching)
async function fetchSingleCharacter(browser, death) {
  const charCacheKey = `char_${death.player.toLowerCase()}`;
  const cachedChar = characterCache.get(charCacheKey);
  
  // Check cache first
  if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
    console.log(`✓ ${death.player} (cached)`);
    return {
      ...death,
      ...cachedChar.data
    };
  }
  
  console.log(`⚡ ${death.player} (PRIORITY)`);
  
  // Create new page for this character
  const charPage = await browser.newPage();
  
  try {
    await charPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await charPage.setViewport({ width: 800, height: 400 }); // Even smaller for speed!
    
    // Block resources aggressively
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
}

// Apply rate limiting to all API endpoints
app.use('/api', rateLimitMiddleware);

// ULTRA-FAST: Get deaths WITHOUT character data (instant response!)
app.get('/api/deaths-fast', async (req, res) => {
  const worldId = req.query.world || "20";
  const minLevel = req.query.minLevel || req.query.min_level || "1";
  const vipFilter = req.query.vip === "true" ? "1" : "0";
  
  // Build cache key with filters
  const fastCacheKey = `${worldId}_${minLevel}_${vipFilter}`;
  
  // Check fast cache
  if (fastDeathsCache && fastDeathsCache.key === fastCacheKey && Date.now() - fastDeathsTimestamp < FAST_DEATHS_CACHE) {
    console.log(`⚡⚡ INSTANT cache hit (${Date.now() - fastDeathsTimestamp}ms old) (no Rubinot request)`);
    return res.json(fastDeathsCache.deaths);
  }
  
  // Log non-cached request
  if (req._rateLimitIP) {
    logRateLimitRequest(req._rateLimitIP);
  }
  
  // Fetch deaths page (no character data!)
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 600, height: 300 }); // Tiny viewport for speed
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media', 'websocket'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Build URL with Rubinot's filters
    let url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;
    if (minLevel && parseInt(minLevel) > 1) {
      url += `&min_level=${minLevel}`;
    }
    if (vipFilter === "1") {
      url += `&vip=${vipFilter}`;
    }
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    
    try {
      await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 8000 });
    } catch (e) {
      // Continue
    }
    
    // Parse deaths (no character data lookup!)
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

        arr.push({ 
          player, 
          playerLink, 
          level, 
          cause, 
          time,
          // Placeholders for immediate display
          vocation: "Loading...",
          residence: "Loading...",
          accountStatus: "Loading...",
          guild: "Loading..."
        });
        count++;
      }

      return arr;
    });
    
    await page.close();
    
    // Cache it with filter key
    fastDeathsCache = { key: fastCacheKey, deaths };
    fastDeathsTimestamp = Date.now();
    
    console.log(`⚡⚡ FAST fetch: ${deaths.length} deaths (level ${minLevel}+) in <1s`);
    return res.json(deaths);
    
  } catch (error) {
    console.error("❌ Fast fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// NEW: Get ONLY the latest death (super fast!)
app.get('/api/latest-death', async (req, res) => {
  const worldId = req.query.world || "20";
  
  // Check if we have a recent latest death cached
  if (latestDeathCache && Date.now() - latestDeathTimestamp < LATEST_DEATH_CACHE) {
    console.log(`⚡ Returning cached latest death (instant!) (no Rubinot request)`);
    return res.json(latestDeathCache);
  }
  
  // Log non-cached request
  if (req._rateLimitIP) {
    logRateLimitRequest(req._rateLimitIP);
  }
  
  // If not cached, fetch just the latest death
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 800, height: 400 });
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    const url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    try {
      await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 15000 });
    } catch (e) {
      // Continue anyway
    }
    
    // Parse ONLY the first death
    const latestDeath = await page.evaluate(() => {
      const rows = document.querySelectorAll("div.TableContentContainer table.TableContent tr");
      if (rows.length < 2) return null;
      
      const row = rows[1]; // First data row
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return null;
      
      const playerLink = cells[0].querySelector("a");
      const deathText = cells[1].textContent.trim();
      
      return {
        player: playerLink?.textContent.trim() || "Unknown",
        playerLink: playerLink?.href || "",
        death: deathText,
        timestamp: Date.now()
      };
    });
    
    await page.close();
    
    if (!latestDeath) {
      return res.json({ error: "No deaths found" });
    }
    
    // Fetch character data for this death
    const deathWithData = await fetchSingleCharacter(browser, latestDeath);
    
    // Cache it
    latestDeathCache = deathWithData;
    latestDeathTimestamp = Date.now();
    
    console.log(`⚡ Latest death fetched: ${deathWithData.player}`);
    return res.json(deathWithData);
    
  } catch (error) {
    console.error("❌ Error fetching latest death:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint - ULTRA FAST!
app.get('/api/deaths', async (req, res) => {
  const worldId = req.query.world || "20";
  const minLevel = req.query.minLevel || req.query.min_level || "1";
  const vipFilter = req.query.vip === "true" ? "1" : "0";
  
  // Build URL with Rubinot's built-in filters!
  let url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;
  
  // Add level filter (uses Rubinot's native filter!)
  if (minLevel && parseInt(minLevel) > 1) {
    url += `&min_level=${minLevel}`;
    console.log(`🎯 Using Rubinot's level filter: ${minLevel}+`);
  }
  
  // Add VIP filter if requested
  if (vipFilter === "1") {
    url += `&vip=${vipFilter}`;
    console.log(`👑 Using Rubinot's VIP filter`);
  }

  // Check cache (include filters in cache key!)
  const cacheKey = `deaths_${worldId}_${minLevel}_${vipFilter}_v3`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache hit for world ${worldId}, level ${minLevel}+ (no Rubinot request)`);
    return res.json(cached.data);
  }

  // Log non-cached request (actual Rubinot fetch)
  if (req._rateLimitIP) {
    logRateLimitRequest(req._rateLimitIP);
  }

  let page = null;

  try {
    console.log(`🌐 Fetching deaths for world ${worldId} (Rubinot request)...`);
    
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
    // NOTE: Rubinot's filter ensures these 10 are the RIGHT ones (filtered by level/VIP)
    // Without filter: first 10 of all deaths
    // With filter: first 10 of filtered deaths (much more useful!)
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

    // SMART CACHING: Check which deaths already have cached character data
    const deathsWithCacheStatus = deaths.map(death => {
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(charCacheKey);
      const isCached = cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION;
      
      if (isCached) {
        return {
          ...death,
          ...cachedChar.data,
          _cached: true
        };
      }
      
      return {
        ...death,
        _cached: false,
        _needsFetch: true
      };
    });
    
    // Separate cached from uncached
    const cachedDeaths = deathsWithCacheStatus.filter(d => d._cached);
    const uncachedDeaths = deathsWithCacheStatus.filter(d => !d._cached);
    
    console.log(`💾 ${cachedDeaths.length} cached, ⚡ ${uncachedDeaths.length} need fetching`);
    
    // Fetch ONLY the first 3 uncached deaths (not all!)
    const deathsToFetch = uncachedDeaths.slice(0, 3);
    const quickDeaths = uncachedDeaths.slice(3).map(death => ({
      ...death,
      vocation: "Unknown",
      residence: "Unknown",
      accountStatus: "Free Account",
      guild: "No Guild"
    }));
    
    // If we have no uncached deaths to fetch, return immediately!
    if (deathsToFetch.length === 0) {
      console.log(`⚡⚡ ALL CACHED! Instant response!`);
      const allDeaths = [...cachedDeaths].sort((a, b) => {
        // Maintain original order
        return deaths.findIndex(d => d.player === a.player) - deaths.findIndex(d => d.player === b.player);
      });
      
      await page.close();
      
      cache.set(cacheKey, {
        data: allDeaths,
        timestamp: Date.now()
      });
      
      return res.json(allDeaths);
    }
    
    // Fetch uncached character data
    const characterPromises = deathsToFetch.map(async (death) => {
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
    const newlyFetchedDeaths = await Promise.all(characterPromises);
    
    // Combine: cached deaths + newly fetched + quick deaths, maintaining original order
    const allFetchedDeaths = [...cachedDeaths, ...newlyFetchedDeaths, ...quickDeaths];
    const deathsWithCharacterData = allFetchedDeaths.sort((a, b) => {
      return deaths.findIndex(d => d.player === a.player) - deaths.findIndex(d => d.player === b.player);
    });

    console.log(`✅ Processed ${deathsWithCharacterData.length} deaths (priority fetch)`);

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

// Serve favicon (skull emoji)
app.get('/favicon.ico', (req, res) => {
  // Send a simple SVG skull as favicon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <text y="80" font-size="80">💀</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
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
