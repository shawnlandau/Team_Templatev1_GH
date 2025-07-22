# Hawks Baseball Photos

A photo sharing platform for Hawks Baseball team.

## About

This is a React-based web application for sharing and viewing baseball photos. The app is built as a single-page application (SPA) and deployed on Netlify.

## Files

- `index.html` - Main HTML entry point
- `manifest.json` - Web app manifest for PWA features
- `static/` - Contains compiled CSS and JavaScript files
- `logo.png` - Main application logo
- `logo192.png` - 192x192 app icon
- `favicon.ico` - Browser favicon
- `sample_players.csv` - Sample player data
- `netlify.toml` - Netlify deployment configuration

## Deployment

This project is configured for deployment on Netlify with:
- Static file serving from root directory
- SPA routing support (all routes redirect to index.html)
- No build process required (pre-built static files)

## Local Development

To run this site locally:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (if you have serve installed)
npx serve .
```

Then visit `http://localhost:8080`

## Notes

- This is a production build of a React application
- Firebase authentication may require environment variables to be configured
- All static assets are included in the repository 