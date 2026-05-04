// --- Configuration ---
// You need to sign up for a free API key at https://balldontlie.io
const API_KEY: string = '4ecc6593-08fa-47db-98b9-45a53d8b5e87';
const BASE_URL: string = 'https://api.balldontlie.io';

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

// --- Helper: Get today's date in YYYY-MM-DD format in CST ---
function getTodayDate(): string {
    const today: Date = new Date();
    
    // Get UTC components
    const utcYear = today.getUTCFullYear();
    const utcMonth = today.getUTCMonth();
    const utcDay = today.getUTCDate();
    const utcHours = today.getUTCHours();
    const utcMinutes = today.getUTCMinutes();
    const utcSeconds = today.getUTCSeconds();
    
    // CST is UTC-6, CDT is UTC-5
    // Create a date object representing the UTC time
    const utcTimestamp = Date.UTC(utcYear, utcMonth, utcDay, utcHours, utcMinutes, utcSeconds);
    
    // CST/CDT offset (America/Chicago)
    // Check if it's daylight saving time (simplified - March to November)
    const isDST = () => {
        const marchDST = new Date(Date.UTC(utcYear, 2, 8, 2)); // Second Sunday in March
        const novemberDST = new Date(Date.UTC(utcYear, 10, 1, 2)); // First Sunday in November
        const currentUTC = new Date(utcTimestamp);
        return currentUTC >= marchDST && currentUTC < novemberDST;
    };
    
    const offsetHours = isDST() ? -5 : -6; // CDT: UTC-5, CST: UTC-6
    const cstTimestamp = utcTimestamp + (offsetHours * 60 * 60 * 1000);
    const cstDate = new Date(cstTimestamp);
    
    const year = cstDate.getUTCFullYear();
    const month = String(cstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cstDate.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// --- Helper: Get yesterday's date in YYYY-MM-DD format in CST ---
function getYesterdayDate(): string {
    const today: Date = new Date();
    
    // Create yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Convert to CST using Intl.DateTimeFormat (much simpler!)
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return formatter.format(yesterday);
}

// --- Step 1: Get the St. Louis Cardinals team ID ---
async function getCardinalsTeamId(): Promise<number> {
    const url: string = `${BASE_URL}/mlb/v1/teams`;
    console.log('Fetching team list...');
    
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
    console.log(`Found: ${cardinals.display_name} (ID: ${cardinals.id})`);
    return cardinals.id;
}

// --- Step 2: Fetch games and calculate total runs for the Cardinals ---
async function getCardinalsRunsToday(teamId: number, date: string): Promise<number> {
    const url: string = `${BASE_URL}/mlb/v1/games?dates[]=${date}&team_ids[]=${teamId}`;
    console.log(`\nFetching games for ${date}...`);
    
    const response: Response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Games API error: ${response.status}`);
    
    const data: GamesResponse = await response.json();
    
    if (data.data.length === 0) {
        console.log(`No games found for the Cardinals on ${date}.`);
        return 0;
    }
    
    // Calculate total runs scored by the Cardinals across all games today
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
    
    console.log(`\n🏆 TOTAL RUNS for St. Louis Cardinals on ${date}: ${totalRuns}`);
    return totalRuns;
}

// --- Main execution for yesterday ---
export async function Main(): Promise<number> {
    try {
        const teamId: number = await getCardinalsTeamId();
        const yesterday: string = getYesterdayDate();
        const totalRuns: number = await getCardinalsRunsToday(teamId, yesterday);
        return totalRuns;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error:', errorMessage);
        throw new Error(errorMessage);
    }
}

// Optional: Export individual functions for testing or reuse
export { getCardinalsTeamId, getCardinalsRunsToday, getTodayDate, getYesterdayDate };