# TrainingPlans

## Data sources

- **Garmin is the primary data source.** Use the `garmin` MCP server (configured in `.mcp.json`)
  first for activities, heart rate (including resting HR), sleep, HRV, Body Battery, stress,
  hydration and other wellness data.
- **Strava is a fallback.** Use it only when Garmin doesn't have the data, or for Strava-specific
  data (kudos, segments, Strava relative effort, best efforts). Say which source each number came from.
- The Garmin server reads `GARMIN_PERSONAL_API_KEY` from the environment. Set it in the Claude Code
  environment settings; never commit the key.
