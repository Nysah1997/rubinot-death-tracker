import { useState, useEffect, useRef } from 'react';
import './index.css';

const SERVERS = [
  { id: "11", name: "Auroria" },
  { id: "19", name: "Baltrium" },
  { id: "15", name: "Belaria" },
  { id: "17", name: "Bellum" },
  { id: "1", name: "Elysian" },
  { id: "9", name: "Lunarian" },
  { id: "18", name: "Mystian" },
  { id: "12", name: "Solarian" },
  { id: "10", name: "Spectrum" },
  { id: "20", name: "Tormentum" },
  { id: "16", name: "Vesperia" },
];

// Function to format account status for display
const formatAccountStatus = (status) => {
  if (!status || status === "Unknown") return "Free Account";
  if (status.toLowerCase().includes("vip")) return "VIP Account";
  if (status.toLowerCase().includes("premium")) return "VIP Account";
  return status;
};

// Function to calculate time ago
const getTimeAgo = (deathTime) => {
  try {
    // Parse the death time (format: "07.10.2025, 22:50:28")
    const [datePart, timePart] = deathTime.split(', ');
    const [day, month, year] = datePart.split('.');
    const [hours, minutes, seconds] = timePart.split(':');
    
    const deathDate = new Date(year, month - 1, day, hours, minutes, seconds);
    const now = new Date();
    const diffMs = now - deathDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      return `${mins}m ago`;
    } else if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      const mins = Math.floor((diffSeconds % 3600) / 60);
      return `${hours}h ${mins}m ago`;
    } else {
      const days = Math.floor(diffSeconds / 86400);
      return `${days}d ago`;
    }
  } catch (e) {
    return '';
  }
};

// Function to get vocation-specific emoji
const getVocationEmoji = (vocation) => {
  if (!vocation) return "👤";
  
  const voc = vocation.toLowerCase();
  if (voc.includes("knight") || voc.includes("elite")) {
    return "⚔️"; // Crossed swords for knights
  } else if (voc.includes("druid") || voc.includes("elder")) {
    return "🍃"; // Leaf for druids
  } else if (voc.includes("paladin") || voc.includes("royal")) {
    return "🏹"; // Bow and arrow for paladins
  } else if (voc.includes("sorcerer") || voc.includes("master")) {
    return "🔥"; // Fire for sorcerers
  } else if (voc.includes("monk") || voc.includes("exalted")) {
    return "👊"; // Fist for monks
  }
  return "👤"; // Default person icon
};

function App() {
  const [deaths, setDeaths] = useState([]);
  const [world, setWorld] = useState("20"); // Tormentum default
  const [minLevel, setMinLevel] = useState(0);
  const [vipOnly, setVipOnly] = useState(false);
  const [newDeaths, setNewDeaths] = useState(new Set());
  const [copiedPlayer, setCopiedPlayer] = useState(null);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const latestIds = useRef(new Set());
  const fetchingRef = useRef(false);
  const currentWorld = useRef(world);

  // Update current world ref whenever world changes
  useEffect(() => {
    currentWorld.current = world;
  }, [world]);

  // Update current time every second for countdown timers (only when deaths visible)
  useEffect(() => {
    if (deaths.length === 0) return; // Don't run timer if no deaths
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [deaths.length]);

  // Fetch function - defined outside useEffect so it can be called anywhere
  const fetchDeaths = async () => {
    // Prevent multiple concurrent requests
    if (fetchingRef.current) {
      return;
    }

    try {
      fetchingRef.current = true;

      // Build URL with filters
      let url = `/api/deaths?world=${currentWorld.current}`;
      if (minLevel > 0) {
        url += `&minLevel=${minLevel}`;
      }
      if (vipOnly) {
        url += `&vip=true`;
      }
      
      const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();

        // Handle response - should be a simple array of deaths
        if (!Array.isArray(data)) {
          console.error("Invalid response format:", data);
          return;
        }

        console.log(`Fetched ${data.length} deaths for world ${currentWorld.current}`);

        // Simple logic: check for new deaths and update state
        const newDeathIds = new Set();

        setDeaths(prevDeaths => {
          const updatedDeaths = [];
          
          data.forEach(d => {
            const id = d.player + d.time;
            
          // Check if this is a new death
          if (!latestIds.current.has(id)) {
            latestIds.current.add(id);
            
            // Only mark as new if we already have deaths (not first load)
            if (prevDeaths.length > 0) {
              newDeathIds.add(id);
            }
            
            // Memory optimization: limit latestIds to 50 most recent
            if (latestIds.current.size > 50) {
              const idsArray = Array.from(latestIds.current);
              latestIds.current = new Set(idsArray.slice(-50));
            }
          }
          
          updatedDeaths.push(d);
          });

          // Keep only the latest 5 deaths for speed
          return updatedDeaths.slice(0, 5);
        });

        setNewDeaths(newDeathIds);
        
        // Clear loading state after data is set
        setIsLoadingServer(false);

        // Remove new death animation after 3 seconds
        if (newDeathIds.size > 0) {
          setTimeout(() => {
            setNewDeaths(new Set());
          }, 3000);
        }

      } catch (err) {
        console.error("Error fetching deaths:", err);
        setIsLoadingServer(false);
      } finally {
        fetchingRef.current = false;
      }
  };

  // Handle server/filter changes - only clear and restart for world changes
  useEffect(() => {
    console.log('World changed to:', world);
    
    // IMMEDIATELY clear everything before any async operations
    setIsLoadingServer(true);
    setDeaths([]);
    setNewDeaths(new Set());
    latestIds.current.clear();
    
    // Initial fetch
    fetchDeaths();
    
    // Set up auto-refresh every 2 seconds (fast but safe)
    const interval = setInterval(() => {
      fetchDeaths();
    }, 2000);

    return () => {
      console.log('Cleaning up interval for world:', world);
      clearInterval(interval);
    };
  }, [world]); // Only re-run when world changes!
  
  // When filters change, just fetch new data (don't restart everything)
  useEffect(() => {
    if (deaths.length > 0) { // Only if we already have data
      fetchDeaths();
    }
  }, [minLevel, vipOnly]); // Fetch when filters change

  const selectedServer = SERVERS.find(s => s.id === world);

  return (
    <div className="App">
      <div className="header">
        <div className="header-content">
          <img src="/img/header.png" alt="RubinOT Header" className="header-banner" />
          <div className="header-text">
            <h1>RubinOT Death Tracker</h1>
            <p>Real-time death monitoring for {selectedServer?.name} server</p>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="control-group">
          <label className="control-label">Server</label>
          <select value={world} onChange={e => setWorld(e.target.value)}>
            {SERVERS.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Minimum Level</label>
          <input
            type="number"
            placeholder="0"
            value={minLevel === 0 ? '' : minLevel}
            onChange={e => {
              const value = e.target.value;
              setMinLevel(value === '' ? 0 : Number(value));
            }}
            min="0"
          />
        </div>

        <div className="control-group">
          <label className="control-label">VIP Only</label>
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={e => setVipOnly(e.target.checked)}
            className="checkbox-input"
          />
        </div>
      </div>

      {isLoadingServer || deaths.length === 0 ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading deaths from {selectedServer?.name}...</p>
        </div>
      ) : (() => {
          const filteredDeaths = deaths.filter(d => {
            const levelMatch = d.level >= minLevel;
            const vipMatch = !vipOnly || (d.accountStatus && d.accountStatus.toLowerCase().includes("vip"));
            return levelMatch && vipMatch;
          });
          
          return filteredDeaths.length === 0 ? (
            <div className="empty-state">
              <h3>No deaths found</h3>
              <p>Try adjusting your minimum level filter or check back later.</p>
            </div>
          ) : (
            <div className="deaths-grid">
              {filteredDeaths.map((d, i) => {
            const deathId = d.player + d.time;
            const isNew = newDeaths.has(deathId);
            const accountStatus = formatAccountStatus(d.accountStatus);
            const isPremium = accountStatus.toLowerCase().includes("vip");

            return (
              <div
                key={i}
                className={`death-card ${isNew ? 'new-death' : ''}`}
                data-listing-sort={Date.now()}
              >
                <div className="death-content">
                  <div className="death-info">
                    <div className="death-header">
                      <div className="death-player-info">
                        <span className="death-skull">💀</span>
                        <a
                          href={d.playerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="death-player"
                        >
                          {d.player}
                        </a>
                        <button 
                          className={`copy-btn ${copiedPlayer === d.player ? 'copied' : ''}`}
                          onClick={() => {
                            navigator.clipboard.writeText(`exiva "${d.player}"`);
                            setCopiedPlayer(d.player);
                            setTimeout(() => setCopiedPlayer(null), 2000);
                          }}
                          title={copiedPlayer === d.player ? 'Copied to Exiva!' : `Copy: exiva "${d.player}"`}
                        >
                          <i className={`fa ${copiedPlayer === d.player ? 'fa-check' : 'fa-copy'}`}></i>
                          {copiedPlayer === d.player && <span className="copy-feedback">Copied to Exiva</span>}
                        </button>
                      </div>
                    </div>

                    <div className="death-badges">
                      <div className="death-badge">
                        {getVocationEmoji(d.vocation)} {d.vocation || "Unknown"}
                      </div>
                      <div className="death-badge">
                        <i className="fa fa-globe"></i> {selectedServer?.name || 'Unknown'}
                      </div>
                      <div className={`death-badge ${isPremium ? 'success' : 'danger'}`}>
                        <i className={`fa ${isPremium ? 'fa-diamond' : 'fa-user'}`}></i> {accountStatus}
                      </div>
                      <div className="death-badge">
                        <i className="fa fa-home"></i> {d.residence || "Unknown"}
                      </div>
                      {d.guild && d.guild !== "No Guild" && (
                        <div className="death-badge">
                          <i className="fa fa-users"></i> {d.guild}
                        </div>
                      )}
                    </div>

                    <div className="death-message">
                      Died at Level <strong>{d.level}</strong> by {d.cause}.
                    </div>

                    <div className="death-time">
                      <i className="fa fa-clock-o"></i> {d.time}
                      <span className="time-ago">• {getTimeAgo(d.time)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          );
        })()
      }

    </div>
  );
}

export default App;