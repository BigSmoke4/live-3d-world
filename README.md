# Live 3D World 🌍

An interactive 3D Earth experience with calculated satellite positions, real AIS vessel reports, animated ocean visuals, location/weather panels, and ship-shaped vessel markers.

> **Important deployment detail:** Vercel is used for the static website. The live AIS connection requires a persistent WebSocket backend, so deploy `server.js` separately (for example, on Render) and point the Vercel frontend at it. Do not put the AIS API key in browser code or `config.js`.

## Features

- Interactive 3D globe and close-up exploration.
- Satellite positions calculated from current CelesTrak orbital elements using `satellite.js`; visible passes are computed for the selected location. These are propagated orbital estimates, not satellite telemetry.
- Live vessel positions and metadata relayed from AISStream, displayed using ship-shaped SVG markers oriented by reported course over ground. AIS availability depends on provider coverage and the vessels' transmissions.
- Procedural animated ocean waves (visual simulation, not live wave measurements).
- Location and weather panels using browser geolocation when permitted and public data services.

## Run locally on Windows

1. Install Node.js (LTS recommended).
2. Open PowerShell in this project folder.
3. Install dependencies and start the server:

   ```powershell
   npm.cmd install
   npm.cmd start
   ```

4. Open <http://127.0.0.1:3000>.
5. Click **Live Ships** to connect the AIS feed.

The local `.env` file in your working copy can contain your AISStream key. It is excluded by `.gitignore`; keep it that way. If PowerShell blocks `npm`, use `npm.cmd`. The server reads `PORT` from the environment and defaults to `3000`.

## Publish the frontend on GitHub and Vercel

### 1. Push the project to GitHub

- Create a new GitHub repository.
- Upload/push the project files.
- **Do not upload `.env`**. It contains your private AISStream API key. The `.gitignore` excludes it when using Git normally.
- Keep `index.html`, `config.js`, `README.md`, `package.json`, `server.js`, `render.yaml`, and `.env.example` in the repository.

If the API key has ever been committed to a public repository or placed in `config.js`, revoke/rotate it in AISStream immediately and replace it in your local `.env` and backend environment variables. A browser-side config file is publicly downloadable.

### 2. Deploy the WebSocket backend

Vercel's static hosting does not run this project's persistent Node WebSocket server. Deploy the included backend separately on a host that supports long-lived WebSocket connections, such as Render or another suitable Node host.

For Render:

1. Create a new **Web Service** from this GitHub repository. The included `render.yaml` can be used as a Blueprint configuration.
2. Build command: `npm install`; start command: `npm start`.
3. In the backend service's environment settings, add `AISSTREAM_API_KEY` with your AISStream key. Set `PORT` only if the host does not provide it automatically. Never put the key in Vercel frontend variables or `config.js`.
4. Open `https://YOUR-BACKEND-HOST/api/health`. It should return JSON with `"aisKeyConfigured":true`. If it says `false`, the key is not configured on the backend; add it in the hosting dashboard and redeploy/restart the backend.
4. Wait for the service to deploy and copy its public hostname, for example `your-service.onrender.com`.
5. Confirm the backend is running. The root website is served by the backend too, and `/api/health` reports whether the key is configured.

A free backend service may sleep when idle, and provider usage/connection limits still apply. For production, consider a paid always-on service and limit the AIS bounding box to the geographic area you need.

### 3. Connect the Vercel frontend to the backend

1. Import the GitHub repository into Vercel and deploy it as a static site (no build command is needed for this plain HTML project).
2. After the backend is deployed, edit `config.js` in the repository and set the WebSocket URL to the backend's secure WebSocket endpoint:

   ```js
   window.LIVE3D_AIS_WS_URL = "wss://YOUR-BACKEND-HOST/api/ais-stream";
   ```

   Replace `YOUR-BACKEND-HOST` with the real backend hostname. Use `wss://`, not `https://`. Commit and push this change; Vercel will redeploy. The URL is public configuration, not a secret.
3. Open your Vercel website and click **Live Ships**. The browser connects to the backend, which reads `AISSTREAM_API_KEY` server-side.

If you want only a static globe on Vercel, leave `config.js` empty. Satellite and public weather/geography data can still load, but live ships need the separate WebSocket backend.

## Configuration and security

- `.env` is for local secrets and must not be committed.
- `.env.example` documents the required local variable without containing the real key.
- `config.js` is public and may contain only the public WebSocket endpoint.
- The API key must be configured as `AISSTREAM_API_KEY` in the backend host's environment settings.
- Avoid publishing screenshots, logs, or commits containing the key. If a key was exposed, rotate it.

## Data notes

- **Satellites:** CelesTrak orbital elements are fetched and propagated to the current time; actual precision depends on element age and orbit. Satellite visibility is calculated relative to the selected location and horizon.
- **Ships:** vessel data comes from AISStream reports. AIS is not universal; vessels may be absent or positions may be delayed.
- **Ocean:** animated waves are a procedural rendering effect, not real-time sea-state measurements.
- **Third-party services:** map tiles, geography, satellite data, and weather require internet access and may have independent rate limits or outages.

## License

Add a license file if you intend to publish the project for reuse. Verify the licensing terms of the third-party libraries and data services you use.


## Live ship markers

When **Live Ships** is enabled and the AIS proxy is connected, each reported vessel appears as a small animated ship character. Hover over (or keyboard-focus) a ship to reveal its reported vessel name, speed, and course. Turning Live Ships off closes the feed and removes all ship markers immediately. These details are based on AIS reports; a vessel may show its MMSI when no ship name is supplied by the provider.

The ship marker is drawn with inline SVG and CSS animations, so it does not depend on a paid icon-font kit.


## Fix for `config.js` returning 404

The server explicitly serves `/config.js` with JavaScript content type and no-cache headers. This is required because `index.html` loads `/config.js`; if that request returns 404, the browser falls back to a same-origin WebSocket instead of the Render AIS backend. Ensure `config.js` contains the public WebSocket URL `wss://live-3d-world.onrender.com/api/ais-stream` (replace the hostname if your Render service differs). Never put the AIS API key in this file.
