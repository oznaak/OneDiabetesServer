
# OneDiabetes 
This project was dropped due to discovery of NightScout i no longer need to keep developing OneDiabetes as the purpose of it's development is already fullfilled.
So far this is the backend, but it's missing an important step which is to first verify user's server cause it is currenltly hard coded to work with eu2.
This project was the back-end to a React Native App meant to connect with LibreLinkUP Api in order to display glucose readings from the FreeStyle Libre Sensor.


[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](/license.txt)


## Features

- Allow users to register/login with jwt
- Fetches token from Libre API
- Hashes LibreToken and fetches glucose readings from sensor with patient-id.
- Log insulin injections endpoints (Started right before dropping the project)


## Getting Started
### Prerequisites
- NodeJS

  
### Installation instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/oznaak/OneDiabetesServer.git

2. Install dependencies:
   ```bash
   npm install

3. Add environment tables:
   ```bash
   SECRET_KEY=JWT Secret Key (needs to be 512bit) check jwt documentantion if needed
   LOCAL_HOST=this is CORS configuration setup to allow requests from
   LIBRE_API=https://api-eu.libreview.io (this is where it is hardcoded to be .eu as i was using my sensor to test and i already knew it was eu
   MONGODB=mongodb connection url
4. Run server:
   ```bash
   npm start server.js


## Authors

- [@oznaak](https://www.github.com/oznaak)

