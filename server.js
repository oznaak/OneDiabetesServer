require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const libreService = require('./libreService');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3000;

const MONGODBURI = process.env.MONGODB;
const SECRET_KEY = process.env.SECRET_KEY;
const API_ENDPOINT = process.env.LIBRE_API;
const LOCAL_HOST = process.env.LOCAL_HOST;

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const libreToken = req.headers.libreToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  try {
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
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};

mongoose.connect(`${MONGODBURI}`, {
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

app.use(cors({
    origin: [{LOCAL_HOST}] 
  }));
  
app.use(bodyParser.json());

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

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, SECRET_KEY);

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/auth/connect-libre', async (req, res) => {
  const { token, email, password } = req.body;

  try {
    const { libreToken, hashedLibreId } = await libreService.setToken(email, password);
    const user = await User.findByIdAndUpdate(
      jwt.decode(token).userId,
      { 
        libreId: hashedLibreId, 
        libreToken: libreToken  
      },
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

    const headers = {
      'accept-encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: 'llu.ios',
      version: '4.12.0',
      authorization: `Bearer ${user.libreToken}`,  
      'Account-Id': user.libreId,
    };

    const patientResponse = await axios.get(`${API_ENDPOINT}/llu/connections`, { headers });
    const patientId = patientResponse.data.data[0].patientId;

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

app.post('/api/insulin-log', authenticateToken, async (req, res) => {
  const { units, type } = req.body;
  
  try {
    const newLog = new InsulinLog({
      userId: req.user._id,
      units,
      type,
      timestamp: new Date()
    });
    
    await newLog.save();
    res.status(201).json(newLog);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create insulin log' });
  }
});

app.get('/api/insulin-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await InsulinLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(10);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch insulin logs' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

