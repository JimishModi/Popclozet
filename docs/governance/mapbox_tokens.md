# Mapbox Token Governance & Security

## 1. Account Structure
To ensure isolation and cost control, we utilize a multi-project Mapbox account strategy:

*   **Production (PROD)**: Live application usage. Strict budget caps.
*   **Staging (STG)**: Pre-release testing. Mirror of prod environment.
*   **Development (DEV)**: Local development. High rate limits, lower budget caps.

## 2. Token Scoping Strategy
We adhere to the Principle of Least Privilege. Never use the "Default Public Token" for backend operations.

### A. Frontend Token (Public)
*   **Scope**: `styles:tiles`, `fonts:read`, `datasets:read`
*   **Usage**: GL JS map rendering, basic interactive maps.
*   **Restriction**: URL-restricted to `*.popclozet.com` (Prod) and `localhost` (Dev).

### B. Backend API Token (Secret)
*   **Scope**: `directions:read`, `geocoding:places`, `search:read`
*   **Usage**: Server-side routing calculations, permanent geocoding (if compliant), matrix API.
*   **Restriction**: IP-restricted to backend server NAT gateway IPs.

### C. CI/CD Data Token (Secret)
*   **Scope**: `uploads:write`, `tilesets:write`, `styles:write`
*   **Usage**: Automated tileset uploads during deployment.
*   **Restriction**: Scoped strictly to CI runner environments.

## 3. Token Rotation Plan (90-Day Cycle)
Tokens must be rotated quarterly to minimize leak impact.

1.  **Day 1**: Generate new tokens (v2) for all 3 scopes. Add to `MAPBOX_ROTATION_CANDIDATE` in secrets manager.
2.  **Day 1-7**: Deploy v2 tokens to Staging. Verify all map loads and API calls.
3.  **Day 8**: Promote v2 tokens to Production (`MAPBOX_ACCESS_TOKEN`). Keep v1 as fallback.
4.  **Day 14**: Revoke v1 tokens in Mapbox dashboard.

## 4. Secret Management
*   **Local**: Stored in `.env` (git-ignored).
*   **Repo**: Stored in GitHub Secrets / GitLab CI variables.
*   **Runtime**: Injected via environment variables at build/runtime. Post-build tokens are bundled but URL-restricted.
