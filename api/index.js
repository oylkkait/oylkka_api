const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB কানেকশন ক্যাশে (Vercel-এ রিকোয়েস্ট প্রতি reconnect এড়াতে)
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('MHNGraphics'); // আপনার ডাটাবেস নাম ঠিক করুন
  cachedDb = db;
  return db;
}

// টেস্ট রুট – API চালু আছে কিনা চেক করতে
app.get('/', (req, res) => {
  res.json({ message: 'Oylkka Auth API is running', status: 'ok' });
});

// =========================== সাইনআপ API ===========================
app.post('/api/signup', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const users = db.collection('User');

    const { name, email, phoneNumber, password } = req.body;

    // 1. প্রয়োজনীয় ফিল্ড চেক
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'নাম, ইমেইল, ফোন নম্বর এবং পাসওয়ার্ড সবগুলো প্রয়োজন',
      });
    }

    // 2. ইমেইল ফরম্যাট চেক
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক ইমেইল ঠিকানা দিন (যেমন example@domain.com)',
      });
    }

    // 3. বাংলাদেশি ফোন নম্বর চেক (01XXXXXXXXX)
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক মোবাইল নম্বর দিন (যেমন 01912345678)',
      });
    }

    // 4. ডুপ্লিকেট চেক (ইমেইল বা ফোন আগে থেকে থাকলে)
    const existingUser = await users.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingUser) {
      const conflictField = existingUser.email === email.toLowerCase() ? 'ইমেইল' : 'ফোন নম্বর';
      return res.status(409).json({
        success: false,
        message: `এই ${conflictField}টি ইতিমধ্যে রেজিস্টার করা আছে`,
      });
    }

    // 5. পাসওয়ার্ড হ্যাশ করুন
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. নতুন ইউজার ডকুমেন্ট তৈরি
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    // 7. সাফল্যের রেসপন্স (পাসওয়ার্ড বাদে)
    res.status(201).json({
      success: true,
      message: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! এখন লগইন করুন।',
      user: {
        id: result.insertedId,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'সার্ভার সমস্যা। আবার চেষ্টা করুন।',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// =========================== লগইন API ===========================
app.post('/api/login', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const users = db.collection('User');

    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'আইডি (ইমেইল/ফোন) এবং পাসওয়ার্ড দিন',
      });
    }

    // ইমেইল বা ফোন নম্বর দিয়ে ইউজার খোঁজা
    const user = await users.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি',
      });
    }

    // পাসওয়ার্ড মিলানো
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'পাসওয়ার্ড সঠিক নয়',
      });
    }

    // লগইন সফল – পাসওয়ার্ড বাদ দিয়ে ইউজার তথ্য পাঠান
    res.status(200).json({
      success: true,
      message: 'লগইন সফল হয়েছে',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'সার্ভার সমস্যা। আবার চেষ্টা করুন।',
    });
  }
});

// Vercel-এর জন্য প্রয়োজনীয় এক্সপোর্ট (app.listen লাগবে না)
module.exports = app;