# MongoDB Setup Guide

This guide will help you set up MongoDB for your SMS Deep Link API.

## Option 1: MongoDB Atlas (Recommended - Free Tier Available)

### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" and create an account
3. Verify your email address

### Step 2: Create a Cluster
1. Choose "Build a Database"
2. Select "M0 Sandbox" (Free tier)
3. Choose your preferred cloud provider and region
4. Name your cluster (e.g., "sms-api-cluster")
5. Click "Create Cluster"

### Step 3: Create Database User
1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Set username and password (save these!)
5. Set role to "Read and write to any database"
6. Click "Add User"

### Step 4: Configure Network Access
1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - For production, restrict to specific IPs
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Replace `<dbname>` with `sms_deeplink_api`

**Example Connection String:**
```
mongodb+srv://myuser:mypassword@sms-api-cluster.abc123.mongodb.net/sms_deeplink_api?retryWrites=true&w=majority
```

## Option 2: Local MongoDB (Development)

### Install MongoDB Locally
1. **Windows**: Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. **macOS**: `brew install mongodb-community`
3. **Linux**: Follow [official installation guide](https://docs.mongodb.com/manual/administration/install-on-linux/)

### Start MongoDB Service
```bash
# Windows (as service)
net start MongoDB

# macOS/Linux
brew services start mongodb-community
# or
sudo systemctl start mongod
```

### Connection String for Local MongoDB
```
mongodb://localhost:27017/sms_deeplink_api
```

## Environment Variable Setup

### For Local Development
1. Create `.env` file in your project root:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sms_deeplink_api?retryWrites=true&w=majority
PORT=3000
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

### For Vercel Deployment
1. Go to your Vercel project dashboard
2. Navigate to "Settings" → "Environment Variables"
3. Add new variable:
   - **Name**: `MONGODB_URI`
   - **Value**: Your MongoDB connection string
4. Deploy your project

## Database Schema

The API automatically creates the following structure:

### Collection: `links`
```javascript
{
  _id: ObjectId("..."),
  shortId: "AbC123",           // Unique short identifier
  recipient: "+1234567890",    // Clean phone number
  message: "Hello world!",     // SMS message text
  deepLink: "sms:+1234567890?body=Hello%20world!",
  shortUrl: "https://yourapp.vercel.app/s/AbC123",
  clickCount: 5,               // Number of times clicked
  createdAt: ISODate("..."),   // When link was created
  updatedAt: ISODate("..."),   // Last updated
  lastClickedAt: ISODate("...") // Last click timestamp (optional)
}
```

### Indexes
- `shortId`: Unique index for fast lookups
- Automatically created by the application

## Testing the Connection

### Health Check
```bash
curl https://yourapp.vercel.app/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SMS Deep Link API is running on Vercel",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "vercel",
  "database": {
    "status": "connected",
    "totalLinks": 0
  }
}
```

### Create Test Link
```bash
curl -X POST https://yourapp.vercel.app/api/sms/generate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Test message from MongoDB!"
  }'
```

## Troubleshooting

### Common Issues

1. **"MONGODB_URI environment variable is not set"**
   - Ensure you've added the environment variable in Vercel
   - Check that the variable name is exactly `MONGODB_URI`

2. **"Authentication failed"**
   - Verify username and password in connection string
   - Ensure database user has correct permissions

3. **"Connection timeout"**
   - Check network access settings in MongoDB Atlas
   - Ensure IP address is whitelisted (0.0.0.0/0 for all)

4. **"Database not found"**
   - MongoDB will create the database automatically
   - Ensure database name in connection string matches

### Debug Connection
Add this to your local development to test connection:
```javascript
// Test MongoDB connection
connectToMongoDB()
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection failed:', err));
```

## Security Best Practices

### For Production:
1. **Restrict IP Access**: Don't use 0.0.0.0/0 in production
2. **Use Strong Passwords**: Generate secure database passwords
3. **Enable Authentication**: Always use username/password
4. **Regular Backups**: Set up automated backups in Atlas
5. **Monitor Usage**: Use MongoDB Atlas monitoring tools

### Connection String Security:
- Never commit `.env` files to Git
- Use Vercel environment variables for production
- Rotate database passwords regularly

## Scaling Considerations

### MongoDB Atlas Scaling:
- **M0 (Free)**: 512 MB storage, shared CPU
- **M2/M5**: Dedicated clusters for production
- **Auto-scaling**: Available on paid tiers

### Performance Optimization:
- Indexes are automatically created for `shortId`
- Consider adding indexes for `createdAt` if querying by date
- Monitor query performance in Atlas

Your SMS Deep Link API is now ready with persistent MongoDB storage!