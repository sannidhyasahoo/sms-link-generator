# SMS Deep Link API

A Node.js Express API for generating SMS deep links with click analytics. This API allows you to create short URLs that redirect to SMS deep links, opening the device's SMS app with pre-filled recipient and message.

## Features

- Generate short URLs for SMS deep links
- Track click analytics for each generated link
- Validate and clean phone numbers
- Cryptographically secure short ID generation
- Proper error handling and validation
- In-memory storage for demo (easily replaceable with database)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on port 3000 by default (configurable via PORT environment variable).

## API Endpoints

### 1. Generate SMS Deep Link
**POST** `/api/sms/generate`

Creates a short URL that redirects to an SMS deep link.

**Request Body:**
```json
{
  "phone": "+1234567890",
  "message": "Your text message here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shortUrl": "http://localhost:3000/s/AbC123",
    "deepLink": "sms:+1234567890?body=Your%20text%20message%20here",
    "shortId": "AbC123",
    "recipient": "+1234567890",
    "message": "Your text message here"
  }
}
```

### 2. Redirect to SMS Deep Link
**GET** `/s/:shortId`

Redirects to the SMS deep link and increments click counter.

**Example:** `GET /s/AbC123`

This will redirect to: `sms:+1234567890?body=Your%20text%20message%20here`

### 3. Get Analytics
**GET** `/api/sms/analytics/:shortId`

Returns link data and click analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "shortId": "AbC123",
    "recipient": "+1234567890",
    "message": "Your text message here",
    "shortUrl": "http://localhost:3000/s/AbC123",
    "deepLink": "sms:+1234567890?body=Your%20text%20message%20here",
    "clickCount": 5,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastClickedAt": "2024-01-15T11:45:00.000Z"
  }
}
```

### 4. Health Check
**GET** `/health`

Returns server status.

## Example Usage with cURL

### Generate SMS Link
```bash
curl -X POST http://localhost:3000/api/sms/generate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Hello! This is a test SMS message."
  }'
```

### Get Analytics
```bash
curl http://localhost:3000/api/sms/analytics/AbC123
```

### Test Redirect (in browser)
```
http://localhost:3000/s/AbC123
```

## Validation Rules

- **Phone Number**: Must contain at least 10 digits
- **Message**: Must be a non-empty string
- Phone numbers are automatically cleaned (spaces, dashes, special characters removed)
- International format with + prefix is supported

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid phone number. Must contain at least 10 digits"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Short link not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## SMS Deep Link Format

The API generates SMS deep links in the standard format:
```
sms:PHONENUMBER?body=ENCODED_MESSAGE
```

This format is supported by most mobile devices and will open the default SMS app with:
- Recipient field pre-filled with the phone number
- Message field pre-filled with the text

## Production Considerations

**Storage**: This demo uses in-memory Map storage. For production, replace with a persistent database:
- MongoDB with collections for links and analytics
- PostgreSQL with proper indexing
- Redis for high-performance caching

**Security**: Consider adding:
- Rate limiting to prevent abuse
- API key authentication
- Input sanitization for XSS protection
- HTTPS enforcement

**Scalability**: For high traffic:
- Database connection pooling
- Caching layer (Redis)
- Load balancing
- Monitoring and logging

## License

MIT