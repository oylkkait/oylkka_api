const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt'); // এনক্রিপ্টেড পাসওয়ার্ড চেক করার জন্য
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

// লগইন এপিআই (ইমেইল অথবা ফোন নম্বর দিয়ে)
app.post('/api/login', async (req, res) => {
    try {
        await client.connect();
        const database = client.db("MHNGraphics");
        const users = database.collection("User");

        // Flutter অ্যাপ থেকে 'identifier' এবং 'password' পাঠানো হবে
        const { identifier, password } = req.body; 

        if (!identifier || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email/Phone এবং Password প্রদান করুন" 
            });
        }

        // ডাটাবেসে ইউজার খুঁজে দেখা (email অথবা phoneNumber ফিল্ডে)
        const user = await users.findOne({
            $or: [
                { email: identifier },
                { phoneNumber: identifier }
            ]
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি!" 
            });
        }

        // এনক্রিপ্টেড পাসওয়ার্ড (Hash) চেক করা
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
            res.status(200).json({
                success: true,
                message: "লগইন সফল হয়েছে!",
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phoneNumber
                }
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "পাসওয়ার্ড সঠিক নয়!" 
            });
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "সার্ভার সমস্যা: " + error.message 
        });
    }
});

module.exports = app;