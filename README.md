# WebAnalytics

WebAnalytics is a custom web analytics tool to track your website traffic. This self-hosted (https://codehooks.io) solution gives you full control over your data and analytics.

## Features

- Track page views and user interactions
- User authentication system
- Custom event tracking
- Real-time analytics dashboard
- Easy integration with your existing websites

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- [Coho](https://coho.io/) account for backend services

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/webanalytics.git
   cd webanalytics
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Configuration

1. Set up JWT secrets for authentication:
   ```
   coho set-env JWT_ACCESS_TOKEN_SECRET 'your_access_token_secret' --encrypted
   coho set-env JWT_REFRESH_TOKEN_SECRET 'your_refresh_token_secret' --encrypted
   ```
   Tip: Use `uuidgen` to generate random secrets.

2. Create a new API key:
   ```
   coho add-token
   ```
   Note the token output for future use.

3. Create a user collection:
   ```
   coho createcollection users
   ```

## Usage

### Running the Application

Start the development server:
```
npm run dev
```

### Creating a New User

Use the following curl command to create a new user:

```
curl --location 'https://your-coho-app-url.codehooks.io/auth/createuser' \
--header 'x-apikey: YOUR_API_KEY' \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "user@example.com", 
    "password": "SecurePassword123!"
}'
```
Tip: create a secure password using `openssl`
```
openssl rand -base64 32
```

Replace `YOUR_API_KEY` with the token you created earlier.

### Integrating Analytics Script

Add the following script tag to your website's HTML:

```html
<script src="https://your-coho-app-url.codehooks.io|your-domain.com/analytics-script.js"></script>
```

## API Documentation

### Aggregated Statistics

Endpoint: `GET /api/aggstats/:from/:to`

This endpoint provides aggregated statistics for a specified date range.

#### Parameters:

- `from`: Start date (inclusive) in ISO 8601 format (e.g., "2023-04-01")
- `to`: End date (inclusive) in ISO 8601 format (e.g., "2023-04-30")
- `domain`: (Query parameter) The domain to filter statistics for (e.g., "codehooks.io")

#### Request:

```
GET https://your-coho-app-url.codehooks.io/api/aggstats/2024-10-05T00/2024-10-05T23?domain=codehooks.io
```

#### Headers:

- `Authorization`: Bearer token (JWT)
- Or
- `x-apikey`: Your API key

#### Response:

```json
{
  "uniqueUsers": 45,
  "totalPageViews": 199,
  "uniqueEvents": 3,
  "totalPageEvents": 23,
  "averageSessionDuration": {
    "hours": "03",
    "minutes": "37",
    "seconds": "17"
  },
  "bounceRate": "60.00",
  "topPages": [
    { "url": "https://codehooks.io/", "views": 107 },
    { "url": "https://codehooks.io/docs", "views": 11 },
    { "url": "https://codehooks.io/docs/quickstart-cli", "views": 10 }
  ],
  "topReferers": [
    { "url": "Direct", "views": 158 },
    { "url": "Reddit", "views": 8 },
    { "url": "Google", "views": 5 }
  ],
  "topCountries": [
    { "country": "Norway", "views": 13 },
    { "country": "Brazil", "views": 8 },
    { "country": "Canada", "views": 6 }
  ],
  "topEvents": [
    { "event": "PricingCTA", "views": 10 },
    { "event": "ImageCarouselSwiped", "views": 9 },
    { "event": "Login", "views": 4 }
  ],
  "pageViewsPerHour": [63, 21, 9, 15, 38, 1, 2, 5, 4, 18, 9, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "pageViewsPerDayOfWeek": [0, 0, 0, 0, 0, 0, 199],
  "pageViewsPerDayOfMonth": [0, 0, 0, 0, 199, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "pageViewsPerMonth": [0, 0, 0, 0, 0, 0, 0, 0, 0, 199, 0, 0],
  "deviceTypes": {
    "desktop": 37,
    "mobile": 8
  },
  "geoLocCounts": [
    {
      "geoloc": {
        "lat": -10.9111,
        "lon": -37.0717
      },
      "count": 96
    }
    // ... more geolocation entries ...
  ]
}
```

#### Response Fields:

- `uniqueUsers`: Number of unique visitors
- `totalPageViews`: Total number of page views in the date range
- `uniqueEvents`: Number of unique event types
- `totalPageEvents`: Total number of events triggered
- `averageSessionDuration`: Average time on site in hours, minutes, and seconds
- `bounceRate`: Bounce rate as a percentage
- `topPages`: Array of top pages with their view counts
- `topReferers`: Array of top referrers with their view counts
- `topCountries`: Array of top countries with their view counts
- `topEvents`: Array of top events with their trigger counts
- `pageViewsPerHour`: Array of page views for each hour (0-23)
- `pageViewsPerDayOfWeek`: Array of page views for each day of the week (0-6, where 0 is Sunday)
- `pageViewsPerDayOfMonth`: Array of page views for each day of the month (1-31)
- `pageViewsPerMonth`: Array of page views for each month (0-11, where 0 is January)
- `deviceTypes`: Breakdown of visits by device type
- `geoLocCounts`: Array of geolocation data with view counts
  - `geoloc`: Object containing latitude and longitude
  - `count`: Number of views from this location

#### Error Responses:

- 400 Bad Request: Invalid date format
- 401 Unauthorized: Missing or invalid authentication
- 403 Forbidden: Insufficient permissions
- 500 Internal Server Error: Server-side error

## Dashboard

Access your analytics dashboard at `https://your-app-url.com/dashboard`

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please file an issue on our [GitHub issue tracker](https://github.com/yourusername/webanalytics/issues).
