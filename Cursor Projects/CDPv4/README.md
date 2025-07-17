# Hawks Baseball Photos

A React.js web application for sharing photos from the Hawks Baseball 12U tournament. Built with Firebase for authentication, storage, and real-time updates.

## Features

- **User Authentication**: Email/password signup and login
- **Photo Upload**: Upload images with optional captions
- **Real-time Gallery**: View all photos in a responsive grid with real-time updates
- **Modern UI**: Clean, responsive design using Tailwind CSS
- **Error Handling**: User-friendly error messages and feedback

## Technology Stack

- **Frontend**: React.js 18
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication, Cloud Firestore, Cloud Storage)
- **Font**: Inter (Google Fonts)

## Setup Instructions

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Firebase project with Authentication, Firestore, and Storage enabled

### Installation

1. **Clone or download the project**
   ```bash
   # If you have the project files, navigate to the directory
   cd hawks-baseball-photos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase configuration**

   Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   REACT_APP_FIREBASE_CONFIG={"apiKey":"your-api-key","authDomain":"your-project.firebaseapp.com","projectId":"your-project-id","storageBucket":"your-project.appspot.com","messagingSenderId":"123456789","appId":"your-app-id"}
   REACT_APP_APP_ID=your-app-id
   ```

   **Important**: Replace the placeholder values with your actual Firebase project configuration.

4. **Configure Firebase Security Rules**

   **Firestore Rules** (in Firebase Console > Firestore Database > Rules):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/public/data/photos/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   **Storage Rules** (in Firebase Console > Storage > Rules):
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /artifacts/{appId}/public/data/photos/{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

5. **Start the development server**
   ```bash
   
   npm start
   ```

   The app will open at [http://localhost:3000](http://localhost:3000).

## Usage

1. **Sign Up/Login**: Create an account or log in with existing credentials
2. **Upload Photos**: Click the "Upload" tab to select and upload images with optional captions
3. **View Gallery**: Browse all uploaded photos in the responsive gallery view
4. **Real-time Updates**: New photos appear automatically in the gallery

## Project Structure

```
hawks-baseball-photos/
├── public/
│   ├── index.html          # Main HTML entry point
│   ├── manifest.json       # PWA manifest
│   └── favicon.ico         # App icon
├── src/
│   ├── App.js             # Main React component with all functionality
│   ├── index.js           # React entry point
│   └── index.css          # Global styles with Tailwind
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── README.md             # This file
```

## Firebase Configuration

The app supports multiple Firebase configuration sources:

1. **Environment Variables** (for Netlify/deployment):
   - `REACT_APP_FIREBASE_CONFIG`: JSON string of Firebase config
   - `REACT_APP_APP_ID`: Firebase project ID

2. **Global Variables** (for Canvas environment):
   - `__firebase_config`: Firebase configuration
   - `__initial_auth_token`: Initial authentication token
   - `__app_id`: App ID

## Deployment

### Netlify

1. Build the project: `npm run build`
2. Deploy the `build` folder to Netlify
3. Set environment variables in Netlify dashboard

### Other Platforms

The app can be deployed to any static hosting service. Ensure environment variables are properly configured for your deployment platform.

## Security Notes

- Firebase security rules are configured to require authentication for all operations
- User data is isolated by authentication state
- File uploads are restricted to authenticated users only

## Troubleshooting

- **Firebase initialization errors**: Check your Firebase configuration in environment variables
- **Upload failures**: Verify Firebase Storage rules allow authenticated uploads
- **Gallery not loading**: Ensure Firestore rules allow authenticated reads

## License

This project is for the Hawks Baseball team use only.

---

**Note**: Remember to configure your Firebase project with appropriate security rules and enable the necessary services (Authentication, Firestore, Storage) before using the application. 