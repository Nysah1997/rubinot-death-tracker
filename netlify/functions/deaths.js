import puppeteer from "puppeteer";

// Two-tier caching system
const cache = new Map(); // Short cache for deaths list
const characterCache = new Map(); // Permanent cache for character data
const CACHE_DURATION = 2000; // 2 second cache for deaths list
const CHARACTER_CACHE_DURATION = 3600000; // 1 hour cache for character data (permanent-ish)

// Clean up old cache entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean deaths cache
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 2) {
      cache.delete(key);
    }
  }
  
  // Clean character cache (keep max 500 characters, remove oldest)
  if (characterCache.size > 500) {
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, 100); // Remove oldest 100
    toDelete.forEach(([key]) => characterCache.delete(key));
  }
}, 10000); // Clean every 10 seconds

export async function handler(event) {
  // Handle CORS preflight
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

  // Check cache first (with version to force refresh)
  const cacheKey = `deaths_${worldId}_v2`; // v2 forces cache refresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Returning cached data for world ${worldId} (${cached.data.length} deaths)`);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify(cached.data)
    };
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-networking',
        '--disable-background-sync',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--disable-ipc-flooding-protection'
      ],
      headless: true,
      timeout: 15000,
    });

    const page = await browser.newPage();
    
    // Optimize page settings for speed
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Disable images and CSS for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 10000 
    });

    console.log("Waiting for table to load...");
    await page.waitForSelector("div.TableContentContainer table.TableContent", { timeout: 5000 });

    console.log("Extracting deaths data...");
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

    console.log(`Found ${deaths.length} deaths`);

    // Fetch character data for the latest 5 deaths for faster processing
    const latestDeaths = deaths.slice(0, 5);
    const deathsWithCharacterData = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < latestDeaths.length; i++) {
      const death = latestDeaths[i];
      
      // Check if we have cached character data first
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      const cachedChar = characterCache.get(charCacheKey);
      
      if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
        console.log(`✓ Cache hit for: ${death.player}`);
        cacheHits++;
        deathsWithCharacterData.push({
          ...death,
          ...cachedChar.data
        });
        continue; // Skip fetching, use cached data
      }
      
      try {
        console.log(`✗ Cache miss, fetching: ${death.player}`);
        cacheMisses++;

        await page.goto(death.playerLink, {
          waitUntil: "domcontentloaded",
          timeout: 10000 // Reliable timeout to ensure data loads
        });

        // Wait for table with sufficient time
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
                // Get label text
                const label = labelCell.textContent?.trim().toLowerCase() || '';
                
                // Try multiple methods to get value - comprehensive extraction
                let value = '';
                
                // Method 1: textContent
                value = valueCell.textContent?.trim() || '';
                
                // Method 2: innerText
                if (!value) {
                  value = valueCell.innerText?.trim() || '';
                }
                
                // Method 3: bold element first (common in account status)
                if (!value) {
                  const boldElement = valueCell.querySelector('b');
                  if (boldElement) {
                    value = boldElement.textContent?.trim() || boldElement.innerText?.trim() || '';
                  }
                }
                
                // Method 4: innerHTML stripped
                if (!value) {
                  value = valueCell.innerHTML?.replace(/<[^>]*>/g, '').trim() || '';
                }
                
                // Method 5: Check all child text nodes
                if (!value) {
                  const allText = Array.from(valueCell.childNodes)
                    .map(node => node.textContent?.trim())
                    .filter(text => text && text !== '')
                    .join(' ');
                  value = allText;
                }

                // Only process if we have both label and value
                if (label && value && value !== '') {
                  if (label.includes("vocation")) {
                    data.vocation = value;
                  } else if (label.includes("residence")) {
                    data.residence = value;
                  } else if (label.includes("account status") || label.includes("account")) {
                    data.accountStatus = value;
                  } else if (label.includes("guild")) {
                    // Clean guild name - remove rank and "Member of the"
                    data.guild = value.replace(/^Member of the\s*/i, '').replace(/^.*?\sof\s+the\s+/i, '');
                  }
                }
              }
            }
          });

          return data;
        });

        // Log what we found
        console.log(`Character data for ${death.player}:`, characterData);

        // Build character data object
        const charData = {
          vocation: characterData?.vocation || "Unknown",
          residence: characterData?.residence || "Unknown",
          accountStatus: characterData?.accountStatus || "Free Account",
          guild: characterData?.guild || "No Guild"
        };
        
        // Cache character data permanently (1 hour)
        if (characterData && (characterData.vocation || characterData.residence || characterData.accountStatus)) {
          console.log(`Caching character data for ${death.player} (permanent)`);
          characterCache.set(charCacheKey, {
            data: charData,
            timestamp: Date.now()
          });
        }
        
        // Add to results
        deathsWithCharacterData.push({
          ...death,
          ...charData
        });

        // Small delay to prevent rate limiting and ensure reliability
        if (i < latestDeaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`Error fetching data for ${death.player}:`, error.message);
        // Don't cache failed fetches - will retry next time
        deathsWithCharacterData.push({
          ...death,
          vocation: "Unknown",
          residence: "Unknown",
          accountStatus: "Free Account",
          guild: "No Guild"
        });
      }
    }

    console.log(`Successfully processed ${deathsWithCharacterData.length} deaths with character data`);
    console.log(`Character cache performance: ${cacheHits} hits, ${cacheMisses} misses (${cacheHits > 0 ? Math.round(cacheHits/(cacheHits+cacheMisses)*100) : 0}% hit rate)`);

    // Cache the result
    cache.set(cacheKey, {
      data: deathsWithCharacterData,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify(deathsWithCharacterData)
    };
  } catch (err) {
    console.error("Erro Puppeteer:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed successfully");
      } catch (closeErr) {
        console.error("Error closing browser:", closeErr);
      }
    }
  }
}