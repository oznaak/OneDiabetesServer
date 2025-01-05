require('dotenv').config();


const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS
const libreService = require('./libreService');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3000;

const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const SECRET_KEY = process.env.SECRET_KEY;
const API_ENDPOINT = 'https://api-eu.libreview.io'; 


const authenticateToken = async (req, res, next) => {
  console.log('xxxx');
  const token = req.headers.authorization?.split(' ')[1];
  const libreToken = req.headers.libreToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    console.log(token,SECRET_KEY);
    const decoded = jwt.verify(token, SECRET_KEY, { complete: true });
    const userId = decoded.payload.userId;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (libreToken){
      req.user = {...user,libreToken}
    }else{
      req.user = user;
    }   

    // Call next to proceed to the next middleware or route handler
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
  console.log('finish');
};


mongoose.connect(`mongodb+srv://${dbUsername}:${dbPassword}@oznak.axpkr.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=oznak`, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));


app.use(cors({
    origin: ['http://localhost:8081', 'http://192.168.x.x:8081',] // Replace with your local network IP
  }));
  
app.use(bodyParser.json());


// Endpoint to login and set the token
// Registration endpoint
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const newUser = new User({ email, password });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/auth/connect-libre', async (req, res) => {
  const { token, email, password } = req.body;

  try {
    // Get LibreView token and hashedLibreId from LibreView API
    const { libreToken, hashedLibreId } = await libreService.setToken(email, password);
    //console.log('PLS HAVE THE LIBGRE TOKEN',libreToken)
    // Store these credentials in the user document
    const user = await User.findByIdAndUpdate(
      jwt.decode(token).userId,
      { 
        libreId: hashedLibreId, 
        libreToken: libreToken  // We're storing the LibreView token here
      },
      //console.log('important',libreToken,hashedLibreId),
      { new: true }
    );

    res.status(200).json({ message: 'LibreView account connected', user });
  } catch (error) {
    console.error('Error connecting to LibreView:', error.message);
    res.status(500).json({ error: 'Failed to connect to LibreView' });
  }
});

app.get('/api/patient-id', authenticateToken, async (req, res) => {
  try {
    // Get the user's LibreView token from the database
    const user = req.user;
    if (!user.libreToken) {
      return res.status(400).json({ error: 'LibreView not connected' });
    }

    const patientId = await libreService.getPatientId();
    res.json({ success: true, patientId });
  } catch (error) {
    console.error('Error fetching patient ID:', error);
    res.status(500).json({ error: 'Failed to fetch patient ID' });
  }
});

app.get('/api/glucose-data', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user.libreToken) {
      return res.status(400).json({ error: 'LibreView not connected' });
    }

    // Initialize headers with the stored LibreView token
    const headers = {
      'accept-encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: 'llu.ios',
      version: '4.12.0',
      authorization: `Bearer ${user.libreToken}`,  // Use the stored LibreView token here
      'Account-Id': user.libreId,
    };

    // Get patient ID using the LibreView token
    const patientResponse = await axios.get(`${API_ENDPOINT}/llu/connections`, { headers });
    const patientId = patientResponse.data.data[0].patientId;

    // Get glucose data using the same headers with LibreView token
    const glucoseResponse = await axios.get(
      `${API_ENDPOINT}/llu/connections/${patientId}/graph`, 
      { headers }
    );

    const { graphData, connection } = glucoseResponse.data.data;
    const entries = graphData || [];
    if (connection?.glucoseMeasurement) {
      entries.push(connection.glucoseMeasurement);
    }

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching glucose data:', error);
    res.status(500).json({ error: 'Failed to fetch glucose data' });
  }
});

app.get('/api/libre-token', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (!user.libreToken) {
      return res.status(400).json({ error: 'LibreView not connected' });
    }

    res.status(200).json({ libreToken: user.libreToken });
  } catch (error) {
    console.error('Error fetching Libre token:', error);
    res.status(500).json({ error: 'Failed to fetch Libre token' });
  }
});



app.listen(PORT, () => {
//const randomSecret = crypto.randomBytes(64).toString('hex'); // 512-bit key in hex format
//console.log(randomSecret); // Use this in your .env file

  console.log(`Server is running on http://localhost:${PORT}`);
});


