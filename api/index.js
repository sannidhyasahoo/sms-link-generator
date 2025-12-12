const express = require('express');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// MongoDB connection
let db;
let linksCollection;

// Initialize MongoDB connection
async function connectToMongoDB() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db('sms_deeplink_api');
        linksCollection = db.collection('links');

        // Create index for faster lookups
        await linksCollection.createIndex({ shortId: 1 }, { unique: true });

        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Initialize database connection
connectToMongoDB().catch(console.error);

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;

    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Must be at least 10 digits
    return cleanPhone.length >= 10;
}

/**
 * Cleans phone number by removing spaces, dashes, and special characters
 * @param {string} phone - Raw phone number
 * @returns {string} - Cleaned phone number with only digits and + prefix if international
 */
function cleanPhoneNumber(phone) {
    if (!phone) return '';

    // Keep + at the beginning if present, remove all other non-digits
    const hasPlus = phone.startsWith('+');
    const digitsOnly = phone.replace(/\D/g, '');

    return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Generates a cryptographically secure random short ID
 * @returns {string} - Random short ID
 */
function generateShortId() {
    return crypto.randomBytes(6).toString('base64url');
}

/**
 * Creates SMS deep link in the format: sms:PHONENUMBER?body=ENCODED_MESSAGE
 * @param {string} phone - Clean phone number
 * @param {string} message - SMS message text
 * @returns {string} - SMS deep link
 */
function createSmsDeepLink(phone, message) {
    const encodedMessage = encodeURIComponent(message);
    return `sms:${phone}?body=${encodedMessage}`;
}

// POST /api/sms/generate - Generate SMS deep link
app.post('/api/sms/generate', async (req, res) => {
    try {
        const { phone, message } = req.body;

        // Validate input
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message must be a non-empty string'
            });
        }

        // Validate phone number
        if (!validatePhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number. Must contain at least 10 digits'
            });
        }

        // Clean phone number
        const cleanPhone = cleanPhoneNumber(phone);

        // Generate unique short ID
        let shortId;
        let isUnique = false;
        do {
            shortId = generateShortId();
            const existing = await linksCollection.findOne({ shortId });
            isUnique = !existing;
        } while (!isUnique);

        // Create SMS deep link
        const deepLink = createSmsDeepLink(cleanPhone, message.trim());

        // Generate short URL - use Vercel domain
        const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';
        const shortUrl = `${baseUrl}/s/${shortId}`;

        // Store link data in MongoDB
        const linkData = {
            shortId,
            recipient: cleanPhone,
            message: message.trim(),
            deepLink,
            shortUrl,
            clickCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await linksCollection.insertOne(linkData);

        // Return response
        res.json({
            success: true,
            data: {
                shortUrl: linkData.shortUrl,
                deepLink: linkData.deepLink,
                shortId: linkData.shortId,
                recipient: linkData.recipient,
                message: linkData.message
            }
        });

    } catch (error) {
        console.error('Error generating SMS link:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /s/:shortId - Redirect to SMS deep link and track clicks
app.get('/s/:shortId', async (req, res) => {
    try {
        const { shortId } = req.params;

        // Find link data in MongoDB
        const linkData = await linksCollection.findOne({ shortId });

        if (!linkData) {
            return res.status(404).json({
                success: false,
                error: 'Short link not found'
            });
        }

        // Increment click counter
        await linksCollection.updateOne(
            { shortId },
            {
                $inc: { clickCount: 1 },
                $set: {
                    lastClickedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        // Redirect to SMS deep link
        res.redirect(linkData.deepLink);

    } catch (error) {
        console.error('Error redirecting SMS link:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/sms/analytics/:shortId - Get link analytics
app.get('/api/sms/analytics/:shortId', async (req, res) => {
    try {
        const { shortId } = req.params;

        // Find link data in MongoDB
        const linkData = await linksCollection.findOne({ shortId });

        if (!linkData) {
            return res.status(404).json({
                success: false,
                error: 'Short link not found'
            });
        }

        // Return analytics data
        res.json({
            success: true,
            data: {
                shortId: linkData.shortId,
                recipient: linkData.recipient,
                message: linkData.message,
                shortUrl: linkData.shortUrl,
                deepLink: linkData.deepLink,
                clickCount: linkData.clickCount,
                createdAt: linkData.createdAt,
                lastClickedAt: linkData.lastClickedAt || null,
                updatedAt: linkData.updatedAt
            }
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check MongoDB connection
        const dbStatus = db ? 'connected' : 'disconnected';
        let linkCount = 0;

        if (db) {
            linkCount = await linksCollection.countDocuments();
        }

        res.json({
            success: true,
            message: 'SMS Deep Link API is running on Vercel',
            timestamp: new Date().toISOString(),
            environment: 'vercel',
            database: {
                status: dbStatus,
                totalLinks: linkCount
            }
        });
    } catch (error) {
        res.json({
            success: true,
            message: 'SMS Deep Link API is running on Vercel',
            timestamp: new Date().toISOString(),
            environment: 'vercel',
            database: {
                status: 'error',
                error: error.message
            }
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'SMS Deep Link API',
        endpoints: {
            generate: 'POST /api/sms/generate',
            redirect: 'GET /s/:shortId',
            analytics: 'GET /api/sms/analytics/:shortId',
            health: 'GET /health'
        },
        documentation: 'https://github.com/your-repo/sms-deeplink-api'
    });
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Export for Vercel
module.exports = app;