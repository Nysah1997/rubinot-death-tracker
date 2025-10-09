// ULTRA-FAST Express server for Railway
// Optimized with: browser reuse, parallel fetching, pre-warming, longer cache
import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { fileURLToPath } from 'url';

// Use stealth plugin to bypass Cloudflare bot detection
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// MAXIMUM SPEED caching - faster and still safe!
const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 3000; // 3 seconds (faster updates, still safe!)
const CHARACTER_CACHE_DURATION = 86400000; // 24 hours (character data rarely changes!)

// Browser instance for reuse
let sharedBrowser = null;
let browserLaunching = false;

// ULTRA-SMART Rate limiting - ONLY protects RubinOT, not cache hits!
const rubinOTRequestLog = new Map(); // Track ONLY actual RubinOT fetches per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_RUBINOT_FETCHES_PER_MINUTE = 30; // Max 30 actual RubinOT fetches per minute (supports 4+ concurrent users)
const MIN_RUBINOT_INTERVAL = 2000; // Minimum 2 seconds between RubinOT fetches (faster for multiple users)

// REQUEST QUEUE for multiple users - prevents overwhelming RubinOT
const requestQueue = [];
let isProcessingQueue = false;

// NO rate limiting for cache hits - instant responses!
function rateLimitMiddleware(req, res, next) {
  // Just pass through - we'll check rate limits ONLY if cache misses
  req._rateLimitIP = req.ip || req.connection.remoteAddress || 'unknown';
  req._rateLimitTime = Date.now();
  next();
}

// Helper to check AND enforce RubinOT rate limits (returns true if allowed)
function checkRubinOTRateLimit(ip) {
  const now = Date.now();
  
  if (!rubinOTRequestLog.has(ip)) {
    rubinOTRequestLog.set(ip, { requests: [], lastRequest: 0 });
  }
  
  const ipData = rubinOTRequestLog.get(ip);
  
  // Check minimum interval between RubinOT fetches
  const timeSinceLastFetch = now - ipData.lastRequest;
  if (ipData.lastRequest > 0 && timeSinceLastFetch < MIN_RUBINOT_INTERVAL) {
    console.warn(`🚫 RubinOT fetch too soon from IP ${ip}: ${timeSinceLastFetch}ms (need ${MIN_RUBINOT_INTERVAL}ms)`);
    return false; // BLOCKED!
  }
  
  // Remove old requests outside the time window
  const recentRequests = ipData.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  // Check if we'd exceed the limit
  if (recentRequests.length >= MAX_RUBINOT_FETCHES_PER_MINUTE) {
    console.warn(`🚫 RubinOT rate limit exceeded for IP ${ip}: ${recentRequests.length}/${MAX_RUBINOT_FETCHES_PER_MINUTE} fetches/minute`);
    return false; // BLOCKED!
  }
  
  // ALLOWED! Log this fetch
  recentRequests.push(now);
  ipData.requests = recentRequests;
  ipData.lastRequest = now;
  rubinOTRequestLog.set(ip, ipData);
  
  console.log(`✅ RubinOT fetch allowed for IP ${ip}: ${recentRequests.length}/${MAX_RUBINOT_FETCHES_PER_MINUTE} fetches in last minute`);
  return true;
}

// QUEUE PROCESSOR for multiple concurrent users
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  console.log(`🔄 Processing request queue: ${requestQueue.length} requests waiting`);
  
  while (requestQueue.length > 0) {
    const { resolve, reject, worldId, minLevel, vipFilter } = requestQueue.shift();
    
    try {
      // Check rate limit before processing
      if (!checkRubinOTRateLimit('server-queue')) {
        // Rate limited, wait and retry
        requestQueue.unshift({ resolve, reject, worldId, minLevel, vipFilter });
        await new Promise(resolve => setTimeout(resolve, MIN_RUBINOT_INTERVAL));
        continue;
      }
      
      // Process the request
      const result = await fetchDeathsFromRubinOT(worldId, minLevel, vipFilter);
      resolve(result);
      
      // Small delay between requests to be nice to RubinOT
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      reject(error);
    }
  }
  
  isProcessingQueue = false;
  console.log(`✅ Request queue processed`);
}

// Add request to queue
function queueRubinOTRequest(worldId, minLevel, vipFilter) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, worldId, minLevel, vipFilter });
    processRequestQueue(); // Start processing if not already running
  });
}

// EXTRACTED: RubinOT fetching logic (used by queue processor)
async function fetchDeathsFromRubinOT(worldId, minLevel, vipFilter) {
  const url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}${minLevel ? `&min_level=${minLevel}` : ''}`;
  let page = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  try {
    console.log(`🌐 Fetching deaths for world ${worldId} (Rubinot request)...`);
    
    // Get browser (reuse or create)
    const browser = await getBrowser();
    
    // ULTRA-SMART RETRY LOGIC with progressive timeouts
    while (retryCount <= MAX_RETRIES) {
      try {
        page = await browser.newPage();
        
        // Stealth: Set realistic user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 }); // Realistic viewport
        
        // Stealth: Set additional headers
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // Stealth: Override navigator properties
        await page.evaluateOnNewDocument(() => {
          // Override the navigator.webdriver property
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });
          
          // Override the navigator.plugins to look like a real browser
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });
          
          // Override navigator.languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          });
        });
        
        // Block resources (but keep HTML/scripts for Cloudflare)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        // PROGRESSIVE TIMEOUTS: Start fast, get more patient
        let gotoTimeout, selectorTimeout;
        if (retryCount === 0) {
          gotoTimeout = 8000;    // 8s - fast bailout
          selectorTimeout = 4000; // 4s - quick check
        } else if (retryCount === 1) {
          gotoTimeout = 12000;   // 12s - medium patience
          selectorTimeout = 6000; // 6s - medium check
        } else {
          gotoTimeout = 20000;   // 20s - last chance, be patient
          selectorTimeout = 8000; // 8s - thorough check
        }
        
        const startTime = Date.now();
        
        await page.goto(url, { 
          waitUntil: "networkidle2", // Wait for network to be mostly idle
          timeout: gotoTimeout
        });

        const loadTime = Date.now() - startTime;
        console.log(`⏱️  Page loaded in ${loadTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

        // Give extra time for dynamic content
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try to wait for table with progressive timeout
        try {
          await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: selectorTimeout });
          console.log(`✅ Table found!`);
          break; // Success! Exit retry loop
        } catch (selectorError) {
          // Check if page has any content at all and debug structure
          const pageInfo = await page.evaluate(() => {
            const container = document.querySelector("div.TableContentContainer");
            const table = document.querySelector("table.TableContent");
            const anyTable = document.querySelector("table");
            const bodyHTML = document.body ? document.body.innerHTML.substring(0, 500) : "NO BODY";
            
            return { 
              container: !!container, 
              table: !!table,
              anyTable: !!anyTable,
              bodyPreview: bodyHTML,
              containerHTML: container ? container.innerHTML.substring(0, 300) : "NO CONTAINER"
            };
          });
          
          console.log(`🔍 Page content check: container=${pageInfo.container}, table=${pageInfo.table}, anyTable=${pageInfo.anyTable}`);
          console.log(`📄 Body preview:`, pageInfo.bodyPreview);
          console.log(`📦 Container HTML:`, pageInfo.containerHTML);
          
          if (pageInfo.container || pageInfo.anyTable) {
            // Some content exists, try to continue
            console.log(`⚠️  Some content exists, continuing to parse...`);
            break; // Exit retry loop, try to parse anyway
          }
          
          // No content at all, definitely need retry
          throw selectorError;
        }
        
      } catch (error) {
        console.log(`❌ Attempt ${retryCount + 1} failed: ${error.message}`);
        
        if (page) {
          try { await page.close(); } catch (e) {}
          page = null;
        }
        
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          throw new Error(`Failed to load RubinOT page after ${MAX_RETRIES + 1} attempts: ${error.message}`);
        }
        
        // Wait before retry
        const waitTime = Math.min(1000 * retryCount, 3000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Parse deaths from the page (flexible selector approach)
    const deaths = await page.evaluate(() => {
      // Try multiple selector strategies
      let rows = document.querySelectorAll("div.TableContentContainer table.TableContent tr");
      
      // Fallback 1: Try without div wrapper
      if (rows.length === 0) {
        rows = document.querySelectorAll("table.TableContent tr");
      }
      
      // Fallback 2: Try any table rows
      if (rows.length === 0) {
        const tables = document.querySelectorAll("table");
        for (const table of tables) {
          const testRows = table.querySelectorAll("tr");
          if (testRows.length > 0) {
            rows = testRows;
            break;
          }
        }
      }
      
      console.log(`Found ${rows.length} table rows`);
      
      const arr = [];
      let count = 0;
      const MAX_DEATHS = 3; // Only 3 for maximum speed!

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
          // Placeholder values - will be filled by character data fetch
          vocation: "Unknown",
          residence: "Loading...",
          accountStatus: "Loading...",
          guild: "" // Empty until fetched (won't show if no guild)
        });
        count++;
      }

      return arr;
    });

    await page.close();
    
    console.log(`📊 Parsed ${deaths.length} deaths from RubinOT`);
    return deaths;
    
  } catch (error) {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    throw error;
  }
}

// Cleanup - less frequent
setInterval(() => {
  const now = Date.now();
  
  // Clean old rate limit data
  for (const [ip, data] of rubinOTRequestLog.entries()) {
    data.requests = data.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (data.requests.length === 0 && now - data.lastRequest > RATE_LIMIT_WINDOW) {
      rubinOTRequestLog.delete(ip);
    }
  }
}, 30000); // Every 30 seconds

// Browser management
async function getBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  
  if (browserLaunching) {
    // Wait for browser to finish launching
    while (browserLaunching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return sharedBrowser;
  }
  
  browserLaunching = true;
  
  try {
    console.log('🚀 Launching browser with stealth mode...');
    sharedBrowser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    return sharedBrowser;
  } catch (error) {
    console.error('❌ Failed to launch browser:', error);
    throw error;
  } finally {
    browserLaunching = false;
  }
}

// Character data fetching
async function fetchCharacterData(playerName) {
  const cacheKey = `char_${playerName.toLowerCase()}`;
  const cached = characterCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CHARACTER_CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
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
    
    const url = `https://rubinot.com.br/?subtopic=characters&name=${encodeURIComponent(playerName)}`;
    
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    
    await page.waitForSelector("div.TableContentContainer", { timeout: 3000 });
    
    const characterData = await page.evaluate((pName) => {
      const container = document.querySelector("div.TableContentContainer");
      if (!container) return null;
      
      const rows = container.querySelectorAll("tr");
      let vocation = "Unknown";
      let residence = "Unknown";
      let accountStatus = "Unknown";
      let guild = ""; // Empty string means no guild (won't display label)
      
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          const label = cells[0]?.textContent?.trim().toLowerCase();
          const value = cells[1]?.textContent?.trim();
          
          if (label?.includes("vocation")) {
            vocation = value || "Unknown";
          } else if (label?.includes("residence")) {
            residence = value || "Unknown";
          } else if (label?.includes("account")) {
            accountStatus = value || "Unknown";
          } else if (label?.includes("guild")) {
            // Extract guild name only (remove "Member of the " or "Rank of ")
            if (value && !value.toLowerCase().includes("no guild")) {
              const guildMatch = value.match(/(?:Member of the|of the)\s+(.+)/i);
              guild = guildMatch ? guildMatch[1].trim() : value;
            } else {
              guild = ""; // Empty string means no guild (won't display label)
            }
          }
        }
      }
      
      return { player: pName, vocation, residence, accountStatus, guild };
    }, playerName);
    
    await page.close();
    
    if (characterData) {
      characterCache.set(cacheKey, {
        data: characterData,
        timestamp: Date.now()
      });
    }
    
    return characterData;
    
  } catch (error) {
    console.error(`❌ Failed to fetch character data for ${playerName}:`, error.message);
    return null;
  }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Rate limiting middleware
app.use('/api', rateLimitMiddleware);

// API endpoint - ULTRA FAST!
app.get('/api/deaths', async (req, res) => {
  const worldId = req.query.world || "20";
  const minLevel = req.query.minLevel || req.query.min_level || "";
  const vipFilter = req.query.vip === "true"; // Client-side filter only
  
  // DEBUG: Log what we received
  console.log(`📥 Request params: world=${worldId}, minLevel="${minLevel}", vip=${vipFilter}`);
  
  // Build URL with Rubinot's built-in filters!
  let url = `https://rubinot.com.br/?subtopic=latestdeaths&world=${worldId}`;
  
  // Add level filter (uses Rubinot's native filter!)
  const levelInt = parseInt(minLevel);
  if (minLevel && !isNaN(levelInt) && levelInt > 1) {
    url += `&min_level=${levelInt}`;
    console.log(`🎯 Using Rubinot's level filter: ${levelInt}+`);
  }
  
  // NOTE: VIP filter is client-side only (Rubinot doesn't have this filter)

  // Check cache (only level affects Rubinot response, not VIP)
  const cacheKey = `deaths_${worldId}_${minLevel || 'all'}_v4`;
  console.log(`🔑 Cache key: ${cacheKey}`);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    const levelText = (minLevel && minLevel !== '') ? `level ${minLevel}+` : 'all levels';
    console.log(`✅ Cache hit for world ${worldId}, ${levelText} (no Rubinot request)`);
    
    // Add browser cache headers (1 second)
    res.set('Cache-Control', 'public, max-age=1');
    res.set('ETag', `"${cacheKey}-${cached.timestamp}"`);
    
    // Apply client-side VIP filter if requested
    if (vipFilter) {
      const vipDeaths = cached.data.filter(death => 
        death.accountStatus && death.accountStatus.toLowerCase().includes('vip')
      );
      console.log(`👑 Client-side VIP filter: ${vipDeaths.length}/${cached.data.length} deaths`);
      return res.json(vipDeaths);
    }
    
    return res.json(cached.data);
  }

  // Use QUEUE SYSTEM for multiple concurrent users
  try {
    console.log(`🔄 Adding request to queue for world ${worldId}...`);
    const deaths = await queueRubinOTRequest(worldId, minLevel, vipFilter);
    
    // Process character data for uncached deaths
    const uncachedDeaths = deaths.filter(d => {
      const cacheKey = `char_${d.player.toLowerCase()}`;
      return !characterCache.has(cacheKey);
    });
    console.log(`🔍 Fetching character data for ${uncachedDeaths.length} uncached deaths...`);
    
    if (uncachedDeaths.length > 0) {
      const characterPromises = uncachedDeaths.map(death => fetchCharacterData(death.player));
      const characterData = await Promise.all(characterPromises);
      
      // Merge character data with deaths
      deaths.forEach(death => {
        const charData = characterData.find(c => c && c.player === death.player);
        if (charData) {
          death.vocation = charData.vocation || "Unknown";
          death.residence = charData.residence || "Unknown";
          death.accountStatus = charData.accountStatus || "Unknown";
          death.guild = charData.guild || ""; // Empty if no guild
        }
      });
    }
    
    // Fill cached character data
    deaths.forEach(death => {
      const cacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(cacheKey);
      if (cachedChar) {
        death.vocation = cachedChar.data.vocation || "Unknown";
        death.residence = cachedChar.data.residence || "Unknown";
        death.accountStatus = cachedChar.data.accountStatus || "Unknown";
        death.guild = cachedChar.data.guild || ""; // Empty if no guild
      }
    });
    
    // Apply VIP filter if requested (client-side)
    let finalDeaths = deaths;
    if (vipFilter) {
      finalDeaths = deaths.filter(death => 
        death.accountStatus && death.accountStatus.toLowerCase().includes('vip')
      );
      console.log(`👑 VIP filter applied: ${finalDeaths.length}/${deaths.length} deaths`);
    }
    
    // Cache the results
    cache.set(cacheKey, {
      data: finalDeaths,
      timestamp: Date.now()
    });
    
    // Add browser cache headers
    res.set('Cache-Control', 'public, max-age=1');
    res.set('ETag', `"${cacheKey}-${Date.now()}"`);
    
    console.log(`✅ Returning ${finalDeaths.length} deaths for world ${worldId}`);
    return res.json(finalDeaths);
    
  } catch (error) {
    console.error(`❌ Error fetching deaths: ${error.message}`);
    
    // Return stale cache if available
    if (cached) {
      const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
      console.log(`⚠️  Returning stale cache (${cacheAge}s old) due to error`);
      res.set('X-Stale-Cache', 'true');
      
      // Apply client-side VIP filter if requested
      if (vipFilter) {
        const vipDeaths = cached.data.filter(death => 
          death.accountStatus && death.accountStatus.toLowerCase().includes('vip')
        );
        return res.json(vipDeaths);
      }
      
      return res.json(cached.data);
    }
    
    // No cache available, return error
    return res.status(500).json({ 
      error: 'Failed to fetch deaths. Please try again.',
      details: error.message
    });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Optimizations: Browser reuse, parallel fetching, smart caching, request queuing`);
  console.log(`🛡️  Rate limiting: ${MAX_RUBINOT_FETCHES_PER_MINUTE} RubinOT fetches/minute, ${MIN_RUBINOT_INTERVAL}ms intervals`);
  console.log(`📊 Cache: ${CACHE_DURATION}ms deaths, ${CHARACTER_CACHE_DURATION/1000/60/60}h characters`);
  console.log(`🔄 Queue system: Supports ${Math.floor(MAX_RUBINOT_FETCHES_PER_MINUTE / (MIN_RUBINOT_INTERVAL/1000))} concurrent users`);
});
