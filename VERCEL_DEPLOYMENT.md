# Deploy SMS Deep Link API to Vercel

This guide will help you deploy your SMS Deep Link API to Vercel for free hosting.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to Git Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SMS Deep Link API"
   git remote add origin https://github.com/yourusername/sms-deeplink-api.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Vercel will auto-detect it as a Node.js project

3. **Configure Project**
   - Project Name: `sms-deeplink-api` (or your preferred name)
   - Framework Preset: `Other`
   - Root Directory: `./` (leave as default)
   - Build Command: Leave empty (Vercel will handle it)
   - Output Directory: Leave empty
   - Install Command: `npm install`

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete (usually 1-2 minutes)
   - Your API will be available at `https://your-project-name.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Choose your project settings
   - Deployment will start automatically

## API Endpoints (After Deployment)

Replace `your-project-name.vercel.app` with your actual Vercel domain:

### Generate SMS Link
```bash
curl -X POST https://your-project-name.vercel.app/api/sms/generate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Hello from Vercel!"
  }'
```

### Access Short Link
```
https://your-project-name.vercel.app/s/SHORT_ID
```

### Get Analytics
```bash
curl https://your-project-name.vercel.app/api/sms/analytics/SHORT_ID
```

### Health Check
```bash
curl https://your-project-name.vercel.app/health
```

## Important Notes

### Database Setup
- **Current Setup**: Uses MongoDB for persistent storage
- **Required**: MongoDB URI must be set in environment variables
- **Recommended**: MongoDB Atlas free tier for getting started

### Recommended Databases for Vercel

1. **Vercel KV (Redis)**
   ```bash
   npm install @vercel/kv
   ```
   - Built-in Redis-compatible storage
   - Perfect for this use case
   - Easy integration

2. **PlanetScale (MySQL)**
   ```bash
   npm install @planetscale/database
   ```
   - Serverless MySQL platform
   - Free tier available

3. **Supabase (PostgreSQL)**
   ```bash
   npm install @supabase/supabase-js
   ```
   - Open source Firebase alternative
   - PostgreSQL database

4. **MongoDB Atlas**
   ```bash
   npm install mongodb
   ```
   - Cloud MongoDB service
   - Free tier available

### Environment Variables

**REQUIRED**: Set up MongoDB connection in Vercel:

1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add your MongoDB connection string:
   - **Name**: `MONGODB_URI`
   - **Value**: `mongodb+srv://username:password@cluster.mongodb.net/sms_deeplink_api?retryWrites=true&w=majority`

**Get MongoDB URI from:**
- [MongoDB Atlas](https://www.mongodb.com/atlas) (Free tier available)
- Or any MongoDB hosting provider

## File Structure for Vercel

```
project-root/
├── api/
│   └── index.js          # Main API handler (Vercel serverless function)
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies
├── server.js             # Local development server
└── README.md             # Documentation
```

## Local Development vs Production

- **Local**: Use `npm start` (runs server.js on localhost)
- **Vercel**: Uses `api/index.js` as serverless function

## Troubleshooting

### Common Issues

1. **404 Errors**
   - Check `vercel.json` routing configuration
   - Ensure `api/index.js` exists

2. **Function Timeout**
   - Vercel free tier has 10-second timeout
   - Optimize database queries if using external DB

3. **Cold Starts**
   - First request after inactivity may be slower
   - This is normal for serverless functions

### Debugging

1. **Check Function Logs**
   - Go to Vercel dashboard → Project → Functions tab
   - View real-time logs

2. **Test Locally**
   ```bash
   vercel dev
   ```
   - Runs Vercel environment locally
   - Good for testing before deployment

## Custom Domain (Optional)

1. **Add Domain in Vercel**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update API Base URL**
   - The API automatically detects the domain
   - Short URLs will use your custom domain

## Security Considerations

For production use, consider adding:

1. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

2. **API Key Authentication**
   ```bash
   npm install express-rate-limit
   ```

3. **Input Sanitization**
   ```bash
   npm install express-validator
   ```

4. **CORS Configuration**
   ```bash
   npm install cors
   ```

## Monitoring

- **Vercel Analytics**: Built-in traffic analytics
- **Function Metrics**: Execution time, memory usage
- **Error Tracking**: Automatic error logging

Your SMS Deep Link API will be live and scalable on Vercel's global CDN!