# Cadenza PWA

A comprehensive Progressive Web Application for music school management, built with the PERN stack (PostgreSQL, Express, React, Node.js).

## 🎯 Project Overview

Cadenza is a sophisticated music education management system designed for a network of three private music schools (Music art incubator). The platform facilitates seamless interaction between administrators, mentors, and students while providing robust tools for educational resource management and financial tracking.

### Key Statistics
- **Total Files**: 260
- **Lines of Code**: 70,063
  - Code: 62,497
  - Comments: 1,903
  - Blank Lines: 5,663

### Technology Stack
- **Frontend**: React.js, Redux, CSS Modules
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Sequelize ORM
- **Real-time**: Socket.io, WebRTC
- **Authentication**: Firebase Auth
- **Build Tool**: Vite
- **Testing**: Jest

## 🚀 Features

### 1. User Management
- Multi-role system (Admin, Mentor, Student)
- Profile management with avatars
- Firebase authentication
- Role-based access control

### 2. Educational Management
- Program/Course administration
- Classroom allocation
- Resource scheduling
- Capacity management

### 3. Scheduling System
- Individual & group lesson scheduling
- Theory class management
- Schedule conflict detection
- Calendar views and analytics

### 4. Communication Platform
- Real-time chat (individual & group)
- Video calls via WebRTC
- Push notifications
- Message status tracking

### 5. Document Management
- Document creation & sharing
- Version control
- Access management
- PDF support & templates

### 6. Financial Management
- Invoice generation & tracking
- PDF417 barcode support
- Payment monitoring
- School-specific configurations

### 7. Analytics & Reporting
- Usage analytics dashboard
- Performance metrics
- Attendance tracking
- Error reporting system

## 💻 Technical Architecture

### Frontend Architecture
- **State Management**: Redux + Context API
- **Real-time Updates**: Socket.io
- **UI Components**: Custom React components
- **Styling**: CSS Modules + Global styles
- **PWA Features**: Service workers, offline support

### Backend Architecture
- **API**: RESTful + WebSocket endpoints
- **Database**: Sequelize models & migrations
- **Security**: JWT, CORS, Rate limiting
- **File Handling**: Cloud storage integration

### Security Implementation
- Firebase Authentication
- Role-based access control
- Data encryption
- XSS & CSRF protection
- Input validation & sanitization

## 📦 Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install client dependencies
   cd client
   npm install

   # Install server dependencies
   cd ../server
   npm install
   ```
3. Configure environment variables
4. Set up the database
5. Run migrations:
   ```bash
   cd server
   npx sequelize-cli db:migrate
   ```

## 🔧 Development

Start the development servers:

```bash
# Start client (in client directory)
npm run dev

# Start server (in server directory)
npm run dev
```

## 🌐 Deployment

### Client Deployment
- Static file hosting
- CDN integration
- Service worker configuration
- Cache management

### Server Deployment
- Node.js runtime environment
- Database server setup
- WebSocket server configuration
- File storage system
- Background workers

## 📊 Project Structure

### Client-side (40,002 lines, 126 files)
- React Components: ~5,337 lines
- Pages/Scenes: ~16,450 lines
- Styles: ~1,135 lines
- Utils: ~327 lines
- Services: ~225 lines

### Server-side (19,878 lines, 129 files)
- Controllers: ~5,897 lines
- Routes: ~2,067 lines
- Models: ~1,662 lines
- Migrations: ~1,931 lines
- Utils: ~349 lines

## 🔍 Quality Assurance

- Unit testing with Jest
- Integration testing
- Error handling & logging
- Performance monitoring
- Security testing
- Code quality with ESLint

## 🤝 Third-Party Integrations

- Firebase (Auth, Storage, Notifications)
- WebRTC Services
- PDF Processing
- Analytics Services
- Payment Processing
- Email Services

## 📝 License

This project is proprietary software. All rights reserved.

**Copyright © 2025 Leon Šilipetar**

The source code is available for viewing and educational purposes only. Commercial use, redistribution, or deployment in production environments requires explicit written permission from the copyright holder.

See the [LICENSE](LICENSE) file for full terms and conditions.

For commercial licensing inquiries, please contact the developer.

## 👨‍💻 Developer

**Leon Šilipetar** - Full Stack Developer

This application was designed and built from the ground up as a complete music school management solution, encompassing:
- Full PERN stack architecture and implementation
- Comprehensive PWA functionality with offline support
- Real-time communication systems (chat, video calls, notifications)
- Complex scheduling and resource management systems
- Financial management and invoicing systems
- Database architecture and migration strategies
- Responsive UI/UX design and implementation

## 📞 Contact

For commercial licensing, collaboration opportunities, or inquiries:

- **Developer**: Leon Šilipetar
- **Project**: Cadenza - Music School Management PWA
- **GitHub**: https://github.com/leonsilipetar

---

*Built with ❤️ for music education*
