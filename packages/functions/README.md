# NewsPassID Functions

This package contains the Lambda functions for the NewsPassID audience project.

## Functions

### 1. API Handler (`src/api.ts`)

The main API endpoint for processing NewsPassID requests.

**Endpoint**: `POST /newspassid`

**Features**:

- Validates ID format (must be `<publisher>-<uuid>`)
- Extracts domain from URL
- Retrieves valid segments from S3
- Stores data in two formats:
  - **CSV format**: `newspassid/publisher/{domain}/{id}/{timestamp}.csv` - for backward compatibility
  - **JSON format**: `newspassid/properties/{domain}/{id}/{timestamp}.json` - for analytics (separate schema for Snowflake/Athena)
- Creates ID mappings when `previousId` is provided
- Sets secure cookies for client-side access

**Request Schema**:

```json
{
  "id": "string (required)",
  "timestamp": "number (required)",
  "url": "string (required)",
  "consentString": "string (required)",
  "previousId": "string (optional)",
  "publisherSegments": "string[] (optional)"
}
```

### 2. Braze MAU Tracker (`src/lib/braze-mau-tracker.ts`)

Monitors Monthly Active Users (MAU) from Braze API and projects usage against the 6M limit.

**Schedule**: Runs every 2 minutes via CloudWatch Events

**Features**:

- Fetches last 30 days of MAU data from Braze API
- Calculates daily growth rate for current month
- Projects end-of-month MAU based on current trends
- Determines if usage is on pace to stay under 6M limit
- Stores projection data as JSON in S3: `pacing/braze-mau-projection.json`

**Environment Variables**:

- `BRAZE_API_KEY`: Braze REST API key
- `BRAZE_ENDPOINT`: Braze REST API endpoint (e.g., `https://rest.iad-05.braze.com`)

**Output Format**:

```json
{
  "currentMau": 1053458,
  "currentDate": "2025-05-28",
  "monthlyLimit": 6000000,
  "daysInMonth": 31,
  "daysElapsed": 28,
  "daysRemaining": 3,
  "projectedEndOfMonthMau": 1065000,
  "projectedOverage": 0,
  "pacingPercentage": 17.75,
  "isOnPace": true,
  "dailyAverageGrowth": 3847,
  "lastUpdated": "2025-01-28T15:30:00.000Z",
  "rawData": [...]
}
```

### 3. Snowflake Processor (`src/lib/snowflake-processor.ts`)

Processes log files and enriches them with publisher data for analytics.

**Schedule**:

- Production: Runs every hour via CloudWatch Events
- Non-production: Available as HTTP endpoint for manual triggering

**Features**:

- Processes recent log files from S3
- Enriches data with GPP consent signals
- Fetches publisher-specific user data from Snowflake
- Writes enhanced records to Snowflake analytics tables

## Directory Structure

```
newspassid/
├── publisher/           # CSV files for backward compatibility
│   └── {domain}/
│       └── {id}/
│           └── {timestamp}.csv
├── properties/          # JSON files for analytics (separate schema)
│   └── {domain}/
│       └── {id}/
│           └── {timestamp}.json
├── segments.csv         # Valid segments with expiration timestamps
└── mappings/           # ID mapping files
    └── {previousId}.csv

pacing/
└── braze-mau-projection.json  # Current MAU pacing data
```

## Testing

Run tests with:

```bash
pnpm test
```

Tests cover:

- API endpoint validation and error handling
- Braze MAU tracker calculations and error scenarios
- S3 operations and data storage
- Utility functions

## Infrastructure

The functions are deployed using SST v3 with the following configuration:

- **API**: HTTP endpoint with CORS support
- **Braze MAU Tracker**: Cron job (every 2 minutes)
- **Snowflake Processor**: Cron job (hourly in production)

Required secrets:

- `BRAZE_API_KEY`
- `BRAZE_ENDPOINT`
- `SNOWFLAKE_*` (account, user, password, warehouse, database, schema)

## Development

1. Install dependencies: `pnpm install`
2. Set up environment variables in `.env`
3. Run tests: `pnpm test`
4. Deploy: `sst deploy --stage dev`
