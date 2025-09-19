**Cleverum Application**

This is a combined chatbot and client admin application built with Next.js, WebSockets, and a custom AI chatbot powered by OpenAI's GPT-4o-mini. It connects to a MongoDB database to manage interactions and includes AI-driven responses for customer engagement.

---

**Features**

- **Chatbot**: Built using `@builderbot/bot` with a custom AI implementation to handle customer interactions.
- **Admin Client**: A Next.js app for managing customer interactions and chatbot analytics.
- **WebSocket**: Real-time updates via `socket.io`.
- **Secure Authentication**: Uses JSON Web Tokens (JWT) for authentication.
- **MongoDB Integration**: Manages customer interactions and chatbot learning data.
- **Role-Based File Processing**: Uploads and processes role-based files with AI matching.
- **QR Code Service**: Generates QR codes for dynamic AI service access.
- **Cloud Storage**: Stores images and assets on Digital Ocean Spaces.

---

**Prerequisites**

- Node.js v18 or above
- MongoDB
- OpenAI API Key
- Two `.env` files, one for the chatbot and one for the web client, containing:
  
  **Chatbot `.env` file:**
  - `NODE_ENV`
  - `BOT_PORT`
  - `OPEN_API_KEY`
  - `CHATBOT_SECRET_KEY`
  - `WEB_PUBLIC_URL`
  - `BOT_PUBLIC_URL`
  
  **Web Client `.env` file:**
  - `NODE_ENV`
  - `WEB_PORT`
  - `MONGODB_URI`
  - `DB_NAME`
  - `JWT_SECRET_KEY`
  - `CHATBOT_SECRET_KEY`
  - `BOT_PUBLIC_URL`
  - `WEB_PUBLIC_URL`
  - `DO_ENDPOINT`
  - `DO_ACCESS_KEY_ID`
  - `DO_SECRET_ACCESS_KEY`
  - `DO_BUCKET_NAME`

---

**Installation**

Clone the repository:
```sh
git clone https://github.com/your-repo/cleverum.git
cd cleverum
```

Install dependencies:
```sh
npm install
```

Install the `sharp` library for the chatbot:
```sh
npm install --cpu=wasm32 sharp
```

Set up environment variables:
Create the `.env` files in the appropriate directories and add the required variables.

---

**Running the Application**

To start the application in development mode:
```sh
npm run dev
```
This will start both the Next.js admin client and the chatbot service with WebSocket integration.

### Multi-Client Setup

The application now supports multiple clients with complete data isolation and automatic session-based redirection:

#### Session-Based Redirection
- **Automatic Login Detection**: When you have a valid JWT session, you're automatically redirected to `/clientes` on app load/refresh
- **Middleware Protection**: Server-side middleware checks for valid tokens and redirects authenticated users
- **Fallback Client-Side Check**: JavaScript validation ensures redirection even if middleware fails
- **Seamless Experience**: No more landing on the home page after login/refresh

#### Multi-Client Management
1. **Login** with your username and password (no clientId required)
2. **Auto-redirect** to `/clientes` if authenticated
3. **Create clients** via the "Clientes" menu
4. **Select a client** to manage their data
5. **Switch between clients** using the dropdown in the navbar
6. Each client has:
   - Isolated orders, products, and profiles
   - Independent chatbot sessions
   - Separate WebSocket notifications
   - Unique data storage

#### Authentication Flow
```
User visits / → Middleware checks JWT → Redirect to /clientes if valid
                     ↓
User logs in → Store JWT in cookies + localStorage → Redirect to /clientes
                     ↓
User refreshes → Client-side check → Stay on /clientes or redirect
```

---

**Production**

For a production environment, set `NODE_ENV=production` in your `.env` files, then run:
```sh
npm run build
npm start
```

---

**Deploying with Docker**

To deploy the application using Docker:

1. Build the Docker images:
   ```sh
   docker-compose build
   ```

2. Start the containers:
   ```sh
   docker-compose up -d
   ```

3. To check logs:
   ```sh
   docker-compose logs -f
   ```

4. To stop the containers:
   ```sh
   docker-compose down
   ```

Make sure to update the `.env` files with your production credentials before deploying.

---

**Application Structure**

```
/web                 # Next.js client admin interface
/chatbot             # AI chatbot service
  ├── chatbotServer.ts   # Main chatbot server
  ├── intents/          # Chatbot intent handling
  ├── services/        # API service integrations
  ├── models/         # AI response models
/server              # Express-like API handling (if needed)
.env                 # Environment variables
package.json         # Project dependencies
```

---

**API Endpoints**

- `/api/getqr` → Serves dynamically generated QR codes.
- WebSocket: Real-time customer interactions via `socket.io`.

---

**Technologies Used**

- **Next.js**: Client admin interface.
- **Socket.IO**: Real-time communication.
- **MongoDB**: Database for storing AI interactions.
- **OpenAI GPT-4o-mini**: AI chatbot engine.
- **BuilderBot**: Custom chatbot framework.
- **JWT Authentication**: Secure access control.
- **Digital Ocean Spaces**: Cloud storage for images and assets.
- **Docker**: Containerized deployment.

---

**License**

This project is licensed under the MIT License.

