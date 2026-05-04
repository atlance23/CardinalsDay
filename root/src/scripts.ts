// --- Configuration ---
// You need to sign up for a free API key at https://balldontlie.io
const API_KEY: string = '4ecc6593-08fa-47db-98b9-45a53d8b5e87';
const BASE_URL: string = 'https://api.balldontlie.io';
const OFFSET: number = -2;

// Cache configuration
const CACHE_DURATION_MS: number = 60000; // 1 minute in milliseconds

// --- Cache Interfaces ---
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface TeamsCache extends CacheEntry<number> {
    // Team ID cache
}

interface RunsCache extends CacheEntry<number> {
    date: string; // Track which date the runs are for
}

// --- Cache Storage ---
let teamIdCache: TeamsCache | null = null;
let runsCache: RunsCache | null = null;

// --- Cache Helper Functions ---
function isCacheValid<T extends CacheEntry<any>>(cache: T | null): boolean {
    if (!cache) return false;
    const now = Date.now();
    return (now - cache.timestamp) < CACHE_DURATION_MS;
}

function clearCache(): void {
    teamIdCache = null;
    runsCache = null;
    console.log('Cache cleared');
}

// Optional: Clear cache after 1 minute automatically
setInterval(() => {
    if (teamIdCache && !isCacheValid(teamIdCache)) {
        teamIdCache = null;
        console.log('Team ID cache expired');
    }
    if (runsCache && !isCacheValid(runsCache)) {
        runsCache = null;
        console.log('Runs cache expired');
    }
}, CACHE_DURATION_MS);

// Headers including your API key for authentication
const headers: HeadersInit = {
    'Authorization': API_KEY
};

// --- Type Definitions ---
interface MLBTeam {
    id: number;
    slug: string;
    abbreviation: string;
    display_name: string;
    short_display_name: string;
    name: string;
    location: string;
    league: 'American' | 'National';
    division: 'East' | 'Central' | 'West';
}

interface MLBTeamData {
    hits: number;
    runs: number;
    errors: number;
    inning_scores: number[];
}

interface MLBGame {
    id: number;
    home_team_name: string;
    away_team_name: string;
    home_team: MLBTeam;
    away_team: MLBTeam;
    season: number;
    postseason: boolean;
    season_type: 'spring_training' | 'regular' | 'postseason';
    date: string;
    home_team_data: MLBTeamData;
    away_team_data: MLBTeamData;
    venue: string;
    attendance: number;
    conference_play: boolean;
    period: number | null;
    clock: number | null;
    display_clock: string | null;
    status: string;
}

interface TeamsResponse {
    data: MLBTeam[];
}

interface GamesResponse {
    data: MLBGame[];
    meta: {
        next_cursor: number;
        prev_cursor: number | null;
        per_page: number;
    };
}

// --- Core Date Helper: Get date with offset in YYYY-MM-DD format in CST ---
// daysOffset: -1 for yesterday, -2 for day before yesterday, 0 for today, etc.
function getDateWithOffset(daysOffset: number = 0): string {
    const targetDate: Date = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return formatter.format(targetDate);
}

// --- Convenience Date Helpers ---
function getTodayDate(): string {
    return getDateWithOffset(0);
}

function getYesterdayDate(): string {
    return getDateWithOffset(-1);
}

function getDateDaysAgo(daysAgo: number): string {
    return getDateWithOffset(-daysAgo);
}

// --- Step 1: Get the St. Louis Cardinals team ID (with caching) ---
async function getCardinalsTeamId(): Promise<number> {
    // Check cache first
    if (isCacheValid(teamIdCache)) {
        console.log(`Using cached team ID: ${teamIdCache!.data}`);
        return teamIdCache!.data;
    }
    
    console.log('Cache expired or empty. Fetching team list from API...');
    const url: string = `${BASE_URL}/mlb/v1/teams`;
    
    const response: Response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Teams API error: ${response.status}`);
    
    const data: TeamsResponse = await response.json();
    
    // Find the team where the name or location includes 'Cardinals' or 'St. Louis'
    const cardinals: MLBTeam | undefined = data.data.find((team: MLBTeam) => 
        team.name === 'Cardinals' || 
        team.location === 'St. Louis' ||
        team.display_name.includes('Cardinals')
    );
    
    if (!cardinals) throw new Error('St. Louis Cardinals team not found');
    
    // Store in cache
    teamIdCache = {
        data: cardinals.id,
        timestamp: Date.now()
    };
    
    console.log(`Found and cached: ${cardinals.display_name} (ID: ${cardinals.id})`);
    return cardinals.id;
}

// --- Step 2: Fetch games and calculate total runs for the Cardinals (with caching) ---
async function getCardinalsRunsForDate(teamId: number, date: string): Promise<number> {
    // Check cache first - only valid if it's for the same date
    if (isCacheValid(runsCache) && runsCache?.date === date) {
        console.log(`Using cached runs for ${date}: ${runsCache!.data}`);
        return runsCache!.data;
    }
    
    console.log(`Cache expired or different date. Fetching games for ${date} from API...`);
    const url: string = `${BASE_URL}/mlb/v1/games?dates[]=${date}&team_ids[]=${teamId}`;
    
    const response: Response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Games API error: ${response.status}`);
    
    const data: GamesResponse = await response.json();
    
    if (data.data.length === 0) {
        console.log(`No games found for the Cardinals on ${date}.`);
        // Cache the zero result as well to prevent repeated queries
        runsCache = {
            data: 0,
            timestamp: Date.now(),
            date: date
        };
        return 0;
    }
    
    // Calculate total runs scored by the Cardinals across all games on this date
    let totalRuns: number = 0;
    
    for (const game of data.data) {
        // Determine if Cardinals are home or away
        const isHomeTeam: boolean = game.home_team.id === teamId;
        const cardinalsRuns: number = isHomeTeam 
            ? game.home_team_data.runs 
            : game.away_team_data.runs;
        
        totalRuns += cardinalsRuns;
        const opponent: string = isHomeTeam 
            ? game.away_team.name 
            : game.home_team.name;
        
        console.log(`Game vs ${opponent}: Cardinals scored ${cardinalsRuns} runs`);
    }
    
    // Store in cache
    runsCache = {
        data: totalRuns,
        timestamp: Date.now(),
        date: date
    };
    
    console.log(`\n🏆 TOTAL RUNS for St. Louis Cardinals on ${date}: ${totalRuns} (cached for 1 minute)`);
    return totalRuns;
}

// --- Additional exported functions for flexibility ---
export async function Main(daysOffset: number = OFFSET): Promise<number> {
    try {
        const teamId: number = await getCardinalsTeamId();
        const targetDate: string = getDateWithOffset(daysOffset);
        const totalRuns: number = await getCardinalsRunsForDate(teamId, targetDate);
        return totalRuns;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error:', errorMessage);
        throw new Error(errorMessage);
    }
}

// Export cache utilities for debugging/monitoring
export function getCacheStatus(): { teamIdCached: boolean; runsCached: boolean; cacheDurationMs: number } {
    return {
        teamIdCached: isCacheValid(teamIdCache),
        runsCached: isCacheValid(runsCache),
        cacheDurationMs: CACHE_DURATION_MS
    };
}

export function forceClearCache(): void {
    clearCache();
}

// Optional: Export individual functions for testing or reuse
export { 
    getCardinalsTeamId, 
    getCardinalsRunsForDate, 
    getTodayDate, 
    getYesterdayDate,
    getDateDaysAgo,
    getDateWithOffset
};