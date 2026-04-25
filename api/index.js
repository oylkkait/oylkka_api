const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ডাটাবেস ক্লায়েন্ট (ফাংশনের বাইরে রাখা ভালো যাতে কানেকশন রিইউজ হয়)
const client = new MongoClient(process.env.MONGODB_URI);

// ১. টেস্ট রুট (যাতে আপনি ব্রাউজারে চেক করতে পারেন সার্ভার চালু আছে কি না)
app.get('/', (req, res) => {
    res.send("Oylkka IT API is running successfully!");
});

// ২. লগইন টেস্ট রুট (ব্রাউজারে /api/login এ ঢুকলে এটি দেখাবে)
app.get('/api/login', (req, res) => {
    res.json({ message: "Please use POST method from Flutter app to login." });
});

// ৩. আসল লগইন এপিআই (POST Method)
app.post('/api/login', async (req, res) => {
    try {
        // কানেকশন চেক
        await client.connect();
        const database = client.db("MHNGraphics");
        const users = database.collection("User");

        const { identifier, password } = req.body; 

        if (!identifier || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email/Phone এবং Password প্রদান করুন" 
            });
        }

        // ইউজার খোঁজা
        const user = await users.findOne({
            $or: [
                { email: identifier },
                { phoneNumber: identifier }
            ]
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "এই তথ্য দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি!" 
            });
        }

        // পাসওয়ার্ড চেক
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
            res.status(200).json({
                success: true,
                message: "লগইন সফল হয়েছে!",
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
                message: "পাসওয়ার্ড সঠিক নয়!" 
            });
        }

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "সার্ভার সমস্যা: " + error.message 
        });
    }
});

// সার্ভার লিসেন (লোকাল টেস্টের জন্য)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;