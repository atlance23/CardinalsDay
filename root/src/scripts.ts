// --- Configuration ---
// You need to sign up for a free API key at https://balldontlie.io
const API_KEY: string = '4ecc6593-08fa-47db-98b9-45a53d8b5e87';
const BASE_URL: string = 'https://api.balldontlie.io';
const OFFSET: number = -2;

// Cache configuration
const CACHE_DURATION_MS: number = 60000; // 1 minute in milliseconds

// --- Cache Storage Keys for sessionStorage ---
const CACHE_KEYS = {
    TEAM_ID: 'cardinals_team_id',
    TEAM_ID_TIMESTAMP: 'cardinals_team_id_timestamp',
    RUNS: 'cardinals_runs',
    RUNS_TIMESTAMP: 'cardinals_runs_timestamp',
    RUNS_DATE: 'cardinals_runs_date'
};

// --- Request Deduplication (Prevents multiple simultaneous requests) ---
let pendingTeamIdRequest: Promise<number> | null = null;
let pendingRunsRequest: Promise<number> | null = null;
let pendingRunsDate: string | null = null;

// --- Cache Helper Functions with sessionStorage ---
function isCacheValid(timestamp: string | null): boolean {
    if (!timestamp) return false;
    const now = Date.now();
    return (now - parseInt(timestamp)) < CACHE_DURATION_MS;
}

function getCachedTeamId(): number | null {
    const cached = sessionStorage.getItem(CACHE_KEYS.TEAM_ID);
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TEAM_ID_TIMESTAMP);
    
    if (!cached || !timestamp) return null;
    
    if (isCacheValid(timestamp)) {
        console.log(`[CACHE HIT] Using cached team ID: ${cached}`);
        return parseInt(cached);
    }
    
    console.log('[CACHE EXPIRED] Team ID cache expired');
    return null;
}

function setCachedTeamId(teamId: number): void {
    sessionStorage.setItem(CACHE_KEYS.TEAM_ID, teamId.toString());
    sessionStorage.setItem(CACHE_KEYS.TEAM_ID_TIMESTAMP, Date.now().toString());
    console.log(`[CACHED] Team ID: ${teamId}`);
}

function getCachedRuns(date: string): number | null {
    const cached = sessionStorage.getItem(CACHE_KEYS.RUNS);
    const timestamp = sessionStorage.getItem(CACHE_KEYS.RUNS_TIMESTAMP);
    const cachedDate = sessionStorage.getItem(CACHE_KEYS.RUNS_DATE);
    
    if (!cached || !timestamp || !cachedDate) return null;
    
    if (cachedDate !== date) {
        console.log(`[CACHE MISS] Different date (cached: ${cachedDate}, requested: ${date})`);
        return null;
    }
    
    if (isCacheValid(timestamp)) {
        console.log(`[CACHE HIT] Using cached runs for ${date}: ${cached}`);
        return parseInt(cached);
    }
    
    console.log(`[CACHE EXPIRED] Runs cache expired for ${date}`);
    return null;
}

function setCachedRuns(date: string, runs: number): void {
    sessionStorage.setItem(CACHE_KEYS.RUNS, runs.toString());
    sessionStorage.setItem(CACHE_KEYS.RUNS_TIMESTAMP, Date.now().toString());
    sessionStorage.setItem(CACHE_KEYS.RUNS_DATE, date);
    console.log(`[CACHED] Runs for ${date}: ${runs}`);
}

function clearCache(): void {
    sessionStorage.removeItem(CACHE_KEYS.TEAM_ID);
    sessionStorage.removeItem(CACHE_KEYS.TEAM_ID_TIMESTAMP);
    sessionStorage.removeItem(CACHE_KEYS.RUNS);
    sessionStorage.removeItem(CACHE_KEYS.RUNS_TIMESTAMP);
    sessionStorage.removeItem(CACHE_KEYS.RUNS_DATE);
    console.log('[CACHE] All cache cleared');
}

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

// --- Step 1: Get the St. Louis Cardinals team ID (with sessionStorage caching + deduplication) ---
async function getCardinalsTeamId(): Promise<number> {
    // Check sessionStorage cache first
    const cachedId = getCachedTeamId();
    if (cachedId !== null) {
        return cachedId;
    }
    
    // If there's already a pending request, return that promise
    if (pendingTeamIdRequest) {
        console.log('[DEDUPE] Waiting for pending team ID request...');
        return pendingTeamIdRequest;
    }
    
    console.log('[CACHE MISS] Fetching team list from API...');
    
    // Create new request and store the promise
    pendingTeamIdRequest = (async () => {
        const url: string = `${BASE_URL}/mlb/v1/teams`;
        const response: Response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Teams API error: ${response.status}`);
        
        const data: TeamsResponse = await response.json();
        
        const cardinals: MLBTeam | undefined = data.data.find((team: MLBTeam) => 
            team.name === 'Cardinals' || 
            team.location === 'St. Louis' ||
            team.display_name.includes('Cardinals')
        );
        
        if (!cardinals) throw new Error('St. Louis Cardinals team not found');
        
        // Store in sessionStorage
        setCachedTeamId(cardinals.id);
        console.log(`Found: ${cardinals.display_name} (ID: ${cardinals.id})`);
        return cardinals.id;
    })();
    
    try {
        return await pendingTeamIdRequest;
    } finally {
        pendingTeamIdRequest = null; // Clear after request completes
    }
}

// --- Step 2: Fetch games and calculate total runs (with sessionStorage caching + deduplication) ---
async function getCardinalsRunsForDate(teamId: number, date: string): Promise<number> {
    // Check sessionStorage cache first
    const cachedRuns = getCachedRuns(date);
    if (cachedRuns !== null) {
        return cachedRuns;
    }
    
    // If there's already a pending request for the same date, return that promise
    if (pendingRunsRequest && pendingRunsDate === date) {
        console.log(`[DEDUPE] Waiting for pending runs request for ${date}...`);
        return pendingRunsRequest;
    }
    
    console.log(`[CACHE MISS] Fetching games for ${date} from API...`);
    
    // Create new request and store the promise
    pendingRunsDate = date;
    pendingRunsRequest = (async () => {
        const url: string = `${BASE_URL}/mlb/v1/games?dates[]=${date}&team_ids[]=${teamId}`;
        const response: Response = await fetch(url, { headers });
        
        // Handle rate limiting specifically
        if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before refreshing.');
        }
        if (!response.ok) throw new Error(`Games API error: ${response.status}`);
        
        const data: GamesResponse = await response.json();
        
        if (data.data.length === 0) {
            console.log(`No games found for the Cardinals on ${date}.`);
            setCachedRuns(date, 0);
            return 0;
        }
        
        let totalRuns: number = 0;
        
        for (const game of data.data) {
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
        
        // Store in sessionStorage
        setCachedRuns(date, totalRuns);
        console.log(`\n🏆 TOTAL RUNS for St. Louis Cardinals on ${date}: ${totalRuns}`);
        return totalRuns;
    })();
    
    try {
        return await pendingRunsRequest;
    } finally {
        pendingRunsRequest = null;
        pendingRunsDate = null;
    }
}

// --- Main exported function ---
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
export function getCacheStatus(): { teamIdCached: boolean; runsCached: boolean; cacheDurationMs: number; runsDate?: string } {
    const teamIdTimestamp = sessionStorage.getItem(CACHE_KEYS.TEAM_ID_TIMESTAMP);
    const runsTimestamp = sessionStorage.getItem(CACHE_KEYS.RUNS_TIMESTAMP);
    const runsDate = sessionStorage.getItem(CACHE_KEYS.RUNS_DATE) || undefined;
    
    return {
        teamIdCached: isCacheValid(teamIdTimestamp),
        runsCached: isCacheValid(runsTimestamp),
        cacheDurationMs: CACHE_DURATION_MS,
        runsDate
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