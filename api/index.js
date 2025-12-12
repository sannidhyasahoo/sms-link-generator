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
let client;

// Initialize MongoDB connection
async function connectToMongoDB() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        if (!client) {
            // Add connection options for better reliability
            const options = {
                serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
                socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            };

            client = new MongoClient(process.env.MONGODB_URI, options);
            await client.connect();

            // Test the connection
            await client.db('admin').command({ ping: 1 });

            db = client.db('sms_deeplink_api');
            linksCollection = db.collection('links');

            // Create index for faster lookups (ignore if already exists)
            try {
                await linksCollection.createIndex({ shortId: 1 }, { unique: true });
            } catch (indexError) {
                // Index might already exist, that's okay
                console.log('Index creation skipped (may already exist)');
            }

            console.log('Connected to MongoDB successfully');
        }

        return { db, linksCollection };
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        // Reset client on connection failure
        client = null;
        db = null;
        linksCollection = null;
        throw error;
    }
}

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
        // Ensure MongoDB connection
        await connectToMongoDB();

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
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /s/:shortId - Redirect to SMS deep link and track clicks
app.get('/s/:shortId', async (req, res) => {
    try {
        // Ensure MongoDB connection
        await connectToMongoDB();

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
        // Ensure MongoDB connection
        await connectToMongoDB();

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
        // Ensure MongoDB connection
        await connectToMongoDB();

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

// API Documentation endpoint
app.get('/docs', (req, res) => {
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';

    res.json({
        success: true,
        title: 'SMS Deep Link API Documentation',
        version: '1.0.0',
        description: 'Generate SMS deep links with analytics tracking',
        baseUrl: baseUrl,
        endpoints: {
            documentation: {
                method: 'GET',
                path: '/docs',
                description: 'API documentation (this endpoint)',
                response: {
                    success: true,
                    title: 'SMS Deep Link API Documentation',
                    // ... (this response)
                }
            },
            root: {
                method: 'GET',
                path: '/',
                description: 'API overview and quick reference',
                response: {
                    success: true,
                    message: 'SMS Deep Link API',
                    endpoints: '{ ... }'
                }
            },
            health: {
                method: 'GET',
                path: '/health',
                description: 'Health check and system status',
                response: {
                    success: true,
                    message: 'SMS Deep Link API is running',
                    timestamp: '2024-01-01T00:00:00.000Z',
                    environment: 'vercel',
                    database: {
                        status: 'connected',
                        totalLinks: 0
                    }
                }
            },
            generateSmsLink: {
                method: 'POST',
                path: '/api/sms/generate',
                description: 'Generate a new SMS deep link with short URL',
                requestBody: {
                    required: true,
                    contentType: 'application/json',
                    schema: {
                        phone: {
                            type: 'string',
                            required: true,
                            description: 'Phone number (minimum 10 digits)',
                            examples: ['+1234567890', '123-456-7890', '(123) 456-7890']
                        },
                        message: {
                            type: 'string',
                            required: true,
                            description: 'SMS message text',
                            examples: ['Hello! Check out this link.', 'Your verification code is 123456']
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'SMS link generated successfully',
                        example: {
                            success: true,
                            data: {
                                shortUrl: `${baseUrl}/s/abc123`,
                                deepLink: 'sms:+1234567890?body=Hello%21%20Check%20out%20this%20link.',
                                shortId: 'abc123',
                                recipient: '+1234567890',
                                message: 'Hello! Check out this link.'
                            }
                        }
                    },
                    400: {
                        description: 'Invalid input',
                        examples: {
                            missingFields: {
                                success: false,
                                error: 'Phone number and message are required'
                            },
                            invalidPhone: {
                                success: false,
                                error: 'Invalid phone number. Must contain at least 10 digits'
                            },
                            invalidMessage: {
                                success: false,
                                error: 'Message must be a non-empty string'
                            }
                        }
                    },
                    500: {
                        description: 'Internal server error',
                        example: {
                            success: false,
                            error: 'Internal server error'
                        }
                    }
                }
            },
            redirectShortLink: {
                method: 'GET',
                path: '/s/:shortId',
                description: 'Redirect to SMS deep link and track click analytics',
                parameters: {
                    shortId: {
                        type: 'string',
                        required: true,
                        description: 'Short link identifier',
                        example: 'abc123'
                    }
                },
                responses: {
                    302: {
                        description: 'Redirect to SMS deep link',
                        headers: {
                            Location: 'sms:+1234567890?body=Hello%21%20Check%20out%20this%20link.'
                        }
                    },
                    404: {
                        description: 'Short link not found',
                        example: {
                            success: false,
                            error: 'Short link not found'
                        }
                    },
                    500: {
                        description: 'Internal server error',
                        example: {
                            success: false,
                            error: 'Internal server error'
                        }
                    }
                }
            },
            getAnalytics: {
                method: 'GET',
                path: '/api/sms/analytics/:shortId',
                description: 'Get analytics data for a specific short link',
                parameters: {
                    shortId: {
                        type: 'string',
                        required: true,
                        description: 'Short link identifier',
                        example: 'abc123'
                    }
                },
                responses: {
                    200: {
                        description: 'Analytics data retrieved successfully',
                        example: {
                            success: true,
                            data: {
                                shortId: 'abc123',
                                recipient: '+1234567890',
                                message: 'Hello! Check out this link.',
                                shortUrl: `${baseUrl}/s/abc123`,
                                deepLink: 'sms:+1234567890?body=Hello%21%20Check%20out%20this%20link.',
                                clickCount: 5,
                                createdAt: '2024-01-01T00:00:00.000Z',
                                lastClickedAt: '2024-01-01T12:00:00.000Z',
                                updatedAt: '2024-01-01T12:00:00.000Z'
                            }
                        }
                    },
                    404: {
                        description: 'Short link not found',
                        example: {
                            success: false,
                            error: 'Short link not found'
                        }
                    },
                    500: {
                        description: 'Internal server error',
                        example: {
                            success: false,
                            error: 'Internal server error'
                        }
                    }
                }
            }
        },
        usage: {
            curl: {
                generateLink: `curl -X POST ${baseUrl}/api/sms/generate \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+1234567890", "message": "Hello! Check out this link."}'`,
                getAnalytics: `curl ${baseUrl}/api/sms/analytics/abc123`,
                healthCheck: `curl ${baseUrl}/health`
            },
            javascript: {
                generateLink: `fetch('${baseUrl}/api/sms/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+1234567890',
    message: 'Hello! Check out this link.'
  })
}).then(res => res.json()).then(data => console.log(data));`,
                getAnalytics: `fetch('${baseUrl}/api/sms/analytics/abc123')
  .then(res => res.json())
  .then(data => console.log(data));`
            }
        },
        notes: {
            phoneNumberFormat: 'Phone numbers are automatically cleaned and validated. Supports international formats with + prefix.',
            smsDeepLinks: 'Generated deep links use the sms: protocol which opens the default SMS app on most devices.',
            analytics: 'Click tracking is automatic when users visit short links. Analytics include click count and timestamps.',
            security: 'Short IDs are cryptographically secure random strings to prevent enumeration attacks.',
            database: 'All data is stored in MongoDB with proper indexing for fast lookups.'
        },
        support: {
            repository: 'https://github.com/your-repo/sms-deeplink-api',
            issues: 'https://github.com/your-repo/sms-deeplink-api/issues',
            contact: 'api-support@yourcompany.com'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';

    res.json({
        success: true,
        message: 'SMS Deep Link API',
        version: '1.0.0',
        description: 'Generate SMS deep links with analytics tracking',
        endpoints: {
            docs: 'GET /docs - Complete API documentation',
            generate: 'POST /api/sms/generate - Generate SMS deep link',
            redirect: 'GET /s/:shortId - Redirect to SMS app',
            analytics: 'GET /api/sms/analytics/:shortId - Get link analytics',
            health: 'GET /health - System health check'
        },
        quickStart: {
            documentation: `${baseUrl}/docs`,
            example: `curl -X POST ${baseUrl}/api/sms/generate -H "Content-Type: application/json" -d '{"phone": "+1234567890", "message": "Hello World!"}'`
        },
        repository: 'https://github.com/your-repo/sms-deeplink-api'
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

// Export handler for Vercel serverless function
module.exports = (req, res) => {
    return app(req, res);
};