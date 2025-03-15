**Cleverum Application**

This is a combined chatbot and client admin application built with Express, Next.js, Socket.IO, and a custom AI bot powered by OpenAI's gpt-4o-mini. 
It connects to a MongoDB database to manage orders and includes QR code generation for restaurant use.

**Features**

Chatbot: Built using @builderbot/bot with a custom AI implementation, handling restaurant interactions.
Admin Client: A Next.js app for managing restaurant orders.
WebSocket: Real-time updates for new orders via Socket.IO.
QR Code Service: Serves a QR code image for restaurant customers.
MongoDB Integration: Manages orders using MongoDB.

**Prerequisites**

Node.js v14 or above
MongoDB
OpenAI API Key
A .env file containing the following:
PORT=3000
NODE_ENV=development
OPEN_API_KEY=your-openai-api-key
MONGO_URI=your-mongodb-connection-string

**Installation**

Clone the repository:
git clone https://github.com/your-repo/cleverum-restaurant.git
cd cleverum-restaurant

**Install dependencies:**

npm install

**Set up environment variables:**

Create a .env file in the root directory and add the required variables.

**Running the Application**

To start the application in development mode:

npm run dev
This will start both the Next.js admin client and the Express server with WebSocket and bot integration.

**Production**

For a production environment, make sure to set NODE_ENV=production in your .env file, then run:
npm run build
npm start

**Application Structure**

/src/chatbot: Contains the chatbot logic, including flows and service integration with OpenAI.
/src/client-admin: The Next.js admin client that manages orders and restaurant data.
/src/server.js: The main Express server that integrates with the chatbot, serves the client admin app, and handles WebSocket connections.
/client-admin/app/api/utils/mongoose.js: Contains MongoDB connection logic.

**API Endpoints**

/getqr: Serves the QR code image for restaurant usage.
WebSocket: Real-time order updates through Socket.IO.

**Technologies Used**

Express: Web framework for handling HTTP requests.
Next.js: React framework for the client admin interface.
Socket.IO: Real-time communication for order updates.
MongoDB: Database for storing order information.
OpenAI: AI integration for chatbot interactions.

**License**
This project is licensed under the MIT License.

