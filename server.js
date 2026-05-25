require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./database/models/users');
const Post = require('./database/models/Post');
const Message = require('./database/models/Message');
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON data from the frontend

const LEGACY_USER_INDEXES = ['email_1', 'anonymousName_1', 'licenseNumber_1'];

async function prepareDatabase() {
    const usersCollection = mongoose.connection.db.collection('users');

    for (const indexName of LEGACY_USER_INDEXES) {
        try {
            await usersCollection.dropIndex(indexName);
            console.log(`Dropped legacy index: ${indexName}`);
        } catch (err) {
            if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
                throw err;
            }
        }
    }

    try {
        await User.syncIndexes();
    } catch (err) {
        console.warn('Could not sync user indexes. Run npm run fix-db if signup fails:', err.message);
    }

    const therapistsMissingProfile = await User.find({
        role: 'therapist',
        $or: [{ displayName: { $exists: false } }, { displayName: '' }, { displayName: null }]
    });

    for (const therapist of therapistsMissingProfile) {
        therapist.displayName = formatDisplayName(therapist.identifier);
        therapist.bio = therapist.bio || 'Licensed professional ready to support clients on HearMe.';
        if (!therapist.specialties?.length) {
            therapist.specialties = ['Anxiety', 'Depression', 'General Support'];
        }
        await therapist.save();
    }

    // Only backfill new-schema messages (skip old expert_name/message documents)
    const messagesNeedingClientId = await Message.find({
        therapistId: { $exists: true },
        senderId: { $exists: true },
        clientId: { $exists: false }
    }).select('_id senderId senderRole');

    for (const msg of messagesNeedingClientId) {
        if (msg.senderRole === 'therapist') continue;

        await Message.updateOne(
            { _id: msg._id },
            { $set: { clientId: msg.senderId, senderRole: 'user' } }
        );
    }
}

function formatDisplayName(identifier) {
    const base = identifier.includes('@')
        ? identifier.split('@')[0]
        : identifier;

    return base
        .replace(/[._-]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function toTherapistCard(therapist) {
    const name = therapist.displayName || formatDisplayName(therapist.identifier);
    const specialties = therapist.specialties?.length
        ? therapist.specialties
        : ['General Support'];

    return {
        id: therapist._id,
        name,
        identifier: therapist.identifier,
        bio: therapist.bio || 'Licensed professional available on HearMe.',
        specialties,
        initials: name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
    };
}

function sendDbError(res, error, context) {
    console.error(`${context}:`, error);

    if (error.code === 11000) {
        return res.status(400).json({ message: 'This identifier is already taken.' });
    }

    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database is not connected. Try again shortly.' });
    }

    return res.status(500).json({ message: `Server error during ${context}.` });
}


//  SIGNUP ROUTE
// ==========================================
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { role, isAnonymous, identifier, password } = req.body;

        if (!role || !identifier || !password) {
            return res.status(400).json({ message: 'Role, identifier, and password are required.' });
        }

        const existingUser = await User.findOne({ identifier });
        if (existingUser) {
            return res.status(400).json({ message: 'This identifier is already taken.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const trimmedIdentifier = String(identifier).trim();
        const userData = {
            role,
            isAnonymous: Boolean(isAnonymous),
            identifier: trimmedIdentifier,
            password: hashedPassword
        };

        if (role === 'therapist') {
            userData.displayName = formatDisplayName(trimmedIdentifier);
            userData.bio = 'Licensed professional ready to support clients on HearMe.';
            userData.specialties = ['Anxiety', 'Depression', 'General Support'];
        }

        const newUser = new User(userData);

        await newUser.save();

        res.status(201).json({ message: 'Account created successfully!' });

    } catch (error) {
        return sendDbError(res, error, 'signup');
    }
});


// 2. LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { role, identifier, password } = req.body;

        const user = await User.findOne({
            $or: [{ identifier }, { email: identifier }]
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Verify they are logging into the correct role 
        if (user.role !== role) {
            return res.status(400).json({ message: 'Role mismatch.' });
        }

        // Compare the submitted password with the hashed database password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Generate a JWT Token
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.status(200).json({ 
            message: 'Logged in successfully',
            token,
            user: {
                id: user._id,
                identifier: user.identifier,
                role: user.role,
                displayName: user.displayName || formatDisplayName(user.identifier)
            }
        });

    } catch (error) {
        return sendDbError(res, error, 'login');
    }
});


// Middleware to verify if a user is logged in
const verifyToken = (req, res, next) => {
   
    const token = req.header('Authorization');
    
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify the token using your secret key
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded; // Attach the user's ID and role to the request
        next(); // Let them through to the route
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};


//  LIST REGISTERED THERAPISTS (Experts page)
// ==========================================
app.get('/api/therapists', async (req, res) => {
    try {
        const therapists = await User.find({ role: 'therapist' })
            .select('displayName identifier bio specialties createdAt')
            .sort({ createdAt: -1 });

        res.status(200).json(therapists.map(toTherapistCard));
    } catch (error) {
        return sendDbError(res, error, 'fetch therapists');
    }
});


//  SEND MESSAGE TO THERAPIST (User -> Therapist)
// ==========================================
app.post('/api/messages', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'user') {
            return res.status(403).json({ message: 'Only users can send messages to therapists.' });
        }

        const { therapistId, content } = req.body;
        if (!therapistId || !content?.trim()) {
            return res.status(400).json({ message: 'Therapist and message content are required.' });
        }

        const therapist = await User.findOne({ _id: therapistId, role: 'therapist' });
        if (!therapist) {
            return res.status(404).json({ message: 'Therapist not found.' });
        }

        const sender = await User.findById(req.user.userId);
        const message = new Message({
            therapistId: therapist._id,
            clientId: sender._id,
            senderId: sender._id,
            senderRole: 'user',
            senderIdentifier: sender.identifier,
            content: content.trim()
        });

        await message.save();

        res.status(201).json({
            message: 'Message sent successfully.',
            data: message
        });
    } catch (error) {
        return sendDbError(res, error, 'send message');
    }
});


function getThreadClientId(msg, therapistId) {
    if (msg.clientId) {
        return msg.clientId.toString();
    }
    if (msg.senderRole === 'therapist') {
        return null;
    }
    if (msg.senderId.toString() === therapistId.toString()) {
        return null;
    }
    return msg.senderId.toString();
}

function isUserMessage(msg) {
    return !msg.senderRole || msg.senderRole === 'user';
}


//  THERAPIST REPLY TO CLIENT
// ==========================================
app.post('/api/messages/reply', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'therapist') {
            return res.status(403).json({ message: 'Only therapists can send replies.' });
        }

        const { clientId, content } = req.body;
        if (!clientId || !content?.trim()) {
            return res.status(400).json({ message: 'Client and message content are required.' });
        }

        const therapist = await User.findById(req.user.userId);
        const client = await User.findOne({ _id: clientId, role: 'user' });
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        const message = new Message({
            therapistId: therapist._id,
            clientId: client._id,
            senderId: therapist._id,
            senderRole: 'therapist',
            senderIdentifier: therapist.identifier,
            content: content.trim(),
            read: true
        });

        await message.save();

        res.status(201).json({
            message: 'Reply sent successfully.',
            data: message
        });
    } catch (error) {
        return sendDbError(res, error, 'send reply');
    }
});


//  THERAPIST INBOX
// ==========================================
app.get('/api/messages/inbox', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'therapist') {
            return res.status(403).json({ message: 'Only therapists can view this inbox.' });
        }

        const therapistId = req.user.userId;
        const messages = await Message.find({ therapistId })
            .sort({ createdAt: -1 });

        const conversationsMap = new Map();

        messages.forEach((msg) => {
            const key = getThreadClientId(msg, therapistId);
            if (!key) return;

            if (!conversationsMap.has(key)) {
                const clientIdentifier = isUserMessage(msg)
                    ? msg.senderIdentifier
                    : messages.find(
                          (entry) =>
                              getThreadClientId(entry, therapistId) === key && isUserMessage(entry)
                      )?.senderIdentifier || 'Client';

                conversationsMap.set(key, {
                    clientId: key,
                    senderId: key,
                    senderIdentifier: clientIdentifier,
                    unreadCount: 0,
                    messages: []
                });
            }

            const conversation = conversationsMap.get(key);
            conversation.messages.push(msg);
            if (isUserMessage(msg) && !msg.read) {
                conversation.unreadCount += 1;
            }
        });

        const conversations = Array.from(conversationsMap.values()).map((conversation) => {
            const userMsg = conversation.messages.find((msg) => isUserMessage(msg));
            if (userMsg) {
                conversation.senderIdentifier = userMsg.senderIdentifier;
            }

            conversation.messages.sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
            conversation.lastMessage = conversation.messages[conversation.messages.length - 1];
            conversation.clientId = conversation.clientId || conversation.senderId;

            return conversation;
        });

        conversations.sort(
            (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
        );

        res.status(200).json({
            unreadTotal: messages.filter((msg) => isUserMessage(msg) && !msg.read).length,
            conversations
        });
    } catch (error) {
        return sendDbError(res, error, 'fetch inbox');
    }
});


//  MARK MESSAGES AS READ (Therapist)
// ==========================================
app.patch('/api/messages/read', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'therapist') {
            return res.status(403).json({ message: 'Only therapists can mark messages as read.' });
        }

        const { senderId } = req.body;
        if (!senderId) {
            return res.status(400).json({ message: 'senderId is required.' });
        }

        await Message.updateMany(
            {
                therapistId: req.user.userId,
                clientId: senderId,
                read: false,
                $or: [{ senderRole: 'user' }, { senderRole: { $exists: false } }]
            },
            { $set: { read: true } }
        );

        res.status(200).json({ message: 'Messages marked as read.' });
    } catch (error) {
        return sendDbError(res, error, 'mark messages read');
    }
});


//  GET ALL POSTS (For the Feed)
// ==========================================
app.get('/api/posts', verifyToken, async (req, res) => {
    try {
        // Fetch all posts, sorted by newest first
        const posts = await Post.find().sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while fetching posts.' });
    }
});


//  CREATE A NEW POST
// ==========================================
app.post('/api/posts', verifyToken, async (req, res) => {
    try {
        const { postType, content } = req.body;

        // Fetch the user's identifier from the database using the ID inside their token
        const user = await User.findById(req.user.userId);

        const newPost = new Post({
            authorId: user._id,
            authorIdentifier: user.identifier,
            postType,
            content
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while creating post.' });
    }
});


const PORT = process.env.PORT || 5000;

async function startServer() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is missing from .env');
        process.exit(1);
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is missing from .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB successfully!');
        await prepareDatabase();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log('API ready: /api/therapists, /api/messages, /api/posts');
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();