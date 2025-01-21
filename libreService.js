require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const API_ENDPOINT = process.env.LIBRE_API;
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

        const response = await axios.post(`${API_ENDPOINT}/llu/auth/login`, loginData, { headers: HEADERS });

        if (!response.data || !response.data.data || !response.data.data.authTicket || !response.data.data.authTicket.token) {
            console.error('Failed to extract token:', response.data);
            throw new Error('Failed to authenticate user: Token missing from response');
        }

        const token = response.data.data.authTicket.token;
        const id = response.data.data.user.id;
        if (!token || !id) {
            console.error('Missing token or user id:', { token, id });
            throw new Error('Received invalid data from LibreView: missing token or id');
        }

        const hashedLibreId = crypto.createHash('sha256').update(id).digest('hex');
        HEADERS.authorization = `Bearer ${token}`;
        HEADERS['Account-Id'] = hashedLibreId

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
