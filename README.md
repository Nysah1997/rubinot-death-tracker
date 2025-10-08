# RubinOT Death Tracker

Real-time death monitoring for RubinOT servers with modern UI and instant updates.

## Features

- 💀 **Real-time Death Tracking** - Auto-refreshes every 1.5 seconds
- 🎮 **Multi-Server Support** - Aurora, Spectrum, Tormentum, Vesperia
- 🔍 **Dynamic Filters** - Filter by minimum level and VIP status
- 📋 **Copy to Clipboard** - Quick exiva command copying
- 🎨 **Modern UI** - Clean, dark theme with smooth animations
- ⚡ **Fast Loading** - Optimized character data fetching
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Netlify Functions + Puppeteer
- **Icons**: FontAwesome 4.7.0
- **Hosting**: Netlify

## Deployment

### Prerequisites

- Node.js 18+ installed
- Netlify account

### Deploy to Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Build the project**:
   ```bash
   npm install
   npm run build
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

### Environment Variables

No environment variables are required for this project.

### Netlify Configuration

The project is already configured with `netlify.toml`:
- Build directory: `dist`
- Functions directory: `netlify/functions`
- Automatic API routing

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Access the app**:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8888/.netlify/functions/deaths`

## Project Structure

```
death-tracker/
├── netlify/
│   └── functions/
│       └── deaths.js          # Serverless function for scraping
├── public/
│   └── alert.mp3              # Death notification sound
├── img/
│   ├── background.png         # Background image
│   ├── deadhuman.gif          # Death icon
│   └── header.png             # Header banner
├── src/
│   ├── App.jsx                # Main React component
│   ├── index.css              # Styles
│   └── main.jsx               # React entry point
├── index.html                 # HTML template
├── netlify.toml               # Netlify configuration
├── package.json               # Dependencies
└── vite.config.js             # Vite configuration
```

## API Endpoint

`/.netlify/functions/deaths?world={worldId}`

**Parameters**:
- `world`: World ID (1=Aurora, 10=Spectrum, 20=Tormentum, 16=Vesperia)

**Response**: Array of death objects with character data

## Features Detail

### Death Cards Display
- Player name with skull emoji
- Copy button for exiva command
- Vocation with custom icons
- Server name
- Account status (VIP/Free)
- Residence
- Guild (if applicable)
- Death message with bold level
- Timestamp

### Filters
- **Minimum Level**: Show only deaths above specified level
- **VIP Only**: Show only VIP account deaths

### Performance
- Client-side caching with localStorage
- Server-side caching (1 second)
- Optimized Puppeteer with resource blocking
- Incremental death loading

## License

MIT License - Feel free to use and modify!

## Credits

Developed for RubinOT community.

