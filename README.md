# HealthCheck - Multi-Service Healthcare Application

A comprehensive, local-first Next.js healthcare application with multiple medical services, appointment booking, and voice-enabled chat interface. This is a learning project that demonstrates modern healthcare app development with clean UI/UX design.

## Features

- 🏥 **Multi-Service Platform**: Six different healthcare services (General, Cardiology, Ophthalmology, Dental, Neurology, Preventive)
- 💬 **Smart Chat Interface**: Professional healthcare chat UI with service-specific contexts
- 🎤 **Voice Input**: Browser-based speech recognition using Web Speech API
- 📅 **Appointment Booking**: Intelligent time slot extraction and conflict management
- 🎨 **Healthcare UI/UX**: Professional design with service-specific branding
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- ♿ **Accessibility**: ARIA labels, keyboard navigation, and screen reader support

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

## Application Structure

### Main Views
1. **Services Dashboard** (`/`): Landing page showcasing all available healthcare services
2. **Chat Interface**: Service-specific appointment booking with AI assistant

### Healthcare Services
- **General Checkup**: Comprehensive health examination (30 min, $150)
- **Cardiology**: Heart and cardiovascular health (45 min, $200)
- **Eye Examination**: Complete eye health checkup (30 min, $120)
- **Dental Care**: Oral health and dental examination (45 min, $180)
- **Neurology**: Neurological health assessment (60 min, $250)
- **Preventive Care**: Preventive health screening (30 min, $100)

## How It Works

### Frontend (`pages/index.tsx`)
- **Service Selection**: Interactive cards with service details, pricing, and duration
- **Chat Interface**: Context-aware chat with service-specific branding and messaging
- **Voice Integration**: Web Speech API with visual feedback and error handling
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **State Management**: React hooks for view switching and chat state

### API Route (`pages/api/message.ts`)
- Accepts POST requests with `{ userId, message, requestId, service }`
- Uses regex to extract timestamps in format `YYYY-MM-DD HH:mm`
- Maintains in-memory array of booked time slots with conflict detection
- Returns structured responses: `{ "data": { "type": "...", "payload": {...} } }`
- Includes service context in booking confirmations

### Response Types
1. **ask_time**: When no valid timestamp is found
2. **no_slot**: When requested time is already booked (includes suggestions)  
3. **booking_confirmed**: When slot is successfully booked

## Example Usage

Try these messages:
- "Book my cardiology appointment for 2025-01-15 14:30"
- "Schedule dental checkup for January 20th at 10 AM"
- "I need an eye exam next Tuesday at 2 PM"
- "Hello" (triggers time request)
- Try booking the same time twice (demonstrates conflict handling)

## Project Structure

```
├── pages/
│   ├── _app.tsx           # Next.js app wrapper
│   ├── index.tsx          # Main app with services + chat
│   └── api/
│       └── message.ts     # Enhanced booking API with service context
├── utils/
│   └── uuid.ts           # Simple UUID generator
├── styles/
│   └── globals.css       # Tailwind + custom healthcare styles
└── README.md
```

## Design System

### Color Palette
- **Primary Blue**: Professional healthcare branding
- **Service Colors**: Unique colors for each medical service
- **Status Colors**: Green (success), Red (error), Yellow (warning)
- **Neutral Grays**: Clean, accessible text and backgrounds

### Typography
- **Headers**: Bold, clear hierarchy for medical information
- **Body Text**: Readable, accessible font sizes and line heights
- **Code/Data**: Monospace for booking IDs and technical details

### Components
- **Service Cards**: Interactive cards with hover effects and service branding
- **Chat Bubbles**: Distinct styling for user, bot, and system messages
- **Input Controls**: Accessible form elements with clear focus states
- **Status Indicators**: Visual feedback for voice recording and connection status

### Local-First Design
- All data stored in memory (resets on server restart)
- No external APIs or cloud services required
- Perfect for learning and local development
- Easy to extend with real databases and services

### Web Speech API Integration
- Automatically detects browser support
- Graceful fallback with clear user messaging
- Auto-sends captured speech transcripts
- Visual feedback during voice recording

### Extensibility Points

#### Replace with n8n Webhook
```typescript
// In pages/api/message.ts, replace the booking logic:
const response = await fetch('https://your-n8n-webhook.com/booking', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, message, requestId, service })
})
return res.json(await response.json())
```

#### Add Real Database
```typescript
// Replace in-memory bookedSlots array:
const existingBooking = await db.appointments.findFirst({ 
  where: { slot: requestedSlot, service: service } 
})
if (existingBooking) { /* handle conflict */ }

const appointment = await db.appointments.create({ 
  data: { slot: requestedSlot, userId, service, status: 'confirmed' } 
})
```

#### Add Authentication
```typescript
// Add user authentication and profiles:
const user = await getCurrentUser(req)
if (!user) return res.status(401).json({ error: 'Authentication required' })

// Include user details in booking:
const appointment = await createAppointment({
  userId: user.id,
  userEmail: user.email,
  service,
  slot: requestedSlot
})
```

## Browser Support

- **Voice Input**: Chrome, Safari, Edge (requires HTTPS in production)
- **Chat Interface**: All modern browsers with ES6+ support
- **TypeScript**: Full type safety throughout
- **Responsive Design**: Mobile-first, works on all screen sizes

## Development

The app uses:
- **Next.js Pages Router** for simple routing
- **TypeScript** for type safety
- **Tailwind CSS** for utility-first styling
- **Lucide React** for consistent iconography
- **Web Speech API** for voice recognition
- **React Hooks** for state management

## Security Notes

For production use:
- Add input validation and sanitization
- Implement user authentication and authorization
- Add rate limiting to prevent API abuse
- Use HTTPS for voice input functionality
- Add rate limiting to API routes
- Implement proper error logging and monitoring
- Add data encryption for sensitive health information
- Replace in-memory storage with HIPAA-compliant database

## License

MIT License - Feel free to use this as a learning resource or starting point for your own healthcare applications.

---

**Note**: This is a demonstration application for learning purposes. For production healthcare applications, ensure compliance with HIPAA, GDPR, and other relevant healthcare data protection regulations.