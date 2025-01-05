const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const API_ENDPOINT = 'https://api-eu.libreview.io'; // Change based on your region
const HEADERS = {
    'accept-encoding': 'gzip, deflate, br',
    'cache-control': 'no-cache',
    connection: 'Keep-Alive',
    'content-type': 'application/json',
    product: 'llu.ios',
    version: '4.12.0',
};
async function setToken(email, password) {
    try {
        const loginData = { email, password };
        console.log('Sending login request to LibreView:', loginData);

        // Send the login request
        const response = await axios.post(`${API_ENDPOINT}/llu/auth/login`, loginData, { headers: HEADERS });
        
        // Log the full response to check its structure
        console.log("LibreView login response:", response.data);

        // Log the raw response to inspect its structure
        console.log('Raw response data:', response.data);

        // Ensure the response structure is as expected
        if (!response.data || !response.data.data || !response.data.data.authTicket || !response.data.data.authTicket.token) {
            console.error('Failed to extract token:', response.data);
            throw new Error('Failed to authenticate user: Token missing from response');
        }

        // Direct extraction of the token and user ID
        const token = response.data.data.authTicket.token;  // Extract token directly
        const id = response.data.data.user.id;  // Extract user id directly
        console.log('rEsPonSe dAta URgeNTE',response.data.data.authTicket.token)
        // Check if token or id are missing
        if (!token || !id) {
            console.error('Missing token or user id:', { token, id });
            throw new Error('Received invalid data from LibreView: missing token or id');
        }

        // Hash the Libre ID
        const hashedLibreId = crypto.createHash('sha256').update(id).digest('hex');
        HEADERS.authorization = `Bearer ${token}`;
        HEADERS['Account-Id'] = hashedLibreId;

        console.log('Token 2:', token);
        console.log('Hashed LibreId 2:', hashedLibreId);

        return { libreToken: token, hashedLibreId };
    } catch (err) {
        console.error("Failed to authenticate user:", err.message);
        if (err.response) {
            console.error("LibreView API Error response:", err.response.data);
        }
        throw new Error('Failed to authenticate user: ' + err.message);
    }
}


async function getPatientId(libreToken) {
    try {
        const headers = {
            ...HEADERS,
            'authorization': `Bearer ${libreToken}`
        };
        const response = await axios.get(`${API_ENDPOINT}/llu/connections`, { headers });
        return response.data.data[0].patientId;
    } catch (err) {
        throw new Error('Failed to fetch patient ID: ' + err.message);
    }
}

async function getData(patientId, libreToken) {
    try {
        const headers = {
            ...HEADERS,
            'authorization': `Bearer ${libreToken}`
        };
        const response = await axios.get(`${API_ENDPOINT}/llu/connections/${patientId}/graph`, { headers });
        const { graphData, connection } = response.data.data;
        const entries = graphData || [];
        if (connection.glucoseMeasurement) entries.push(connection.glucoseMeasurement);
        return entries;
    } catch (err) {
        throw new Error('Failed to fetch glucose data: ' + err.message);
    }
}


module.exports = { setToken, getPatientId, getData };
