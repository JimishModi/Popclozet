# Cost Governance & Alerting

## 1. Budget Thresholds
We monitor spending against a projected monthly budget to prevent run-away costs.

| Environment | Monthly Budget | Soft Fail (80%) | Hard Fail (100%) |
| :--- | :--- | :--- | :--- |
| **Production** | $500 | $400 | $500 |
| **Staging** | $50 | $40 | $50 |
| **Development** | $20 | $16 | $20 |

## 2. Alerting Configuration
Alerts are configured in the Mapbox Billing dashboard to trigger emails/Webhooks:

### A. Soft-Fail Alert (80% Budget)
*   **Trigger**: Spending hits 80% of defined budget.
*   **Action**:
    *   Notify DevOps channel (Slack/Teams).
    *   Frontend switches to "Economy Mode":
        *   Disable 3D terrain/buildings.
        *   Reduce map refresh rate.
        *   Switch from `mapbox://styles/mapbox/satellite-v9` to `streets-v11` (cheaper tile weight).

### B. Hard-Fail Alert (100% Budget)
*   **Trigger**: Spending hits 100% of defined budget.
*   **Action**:
    *   **CRITICAL ALERT** to Engineering Manager.
    *   Frontend switches to "Fallback Mode":
        *   Disable interactive maps on non-critical pages (e.g., Use static images for restaurant previews).
        *   Block Autocomplete API calls; revert to manual address entry.
        *   Only active order tracking maps remain interactive.

## 3. Monitoring Dashboard
Key metrics to track in Grafana/Datadog:
1.  **Map Loads (MAU)**: Count of unique map unit loads.
2.  **Geocoding Requests**: Volume of forward/reverse geocode calls.
3.  **Direction API Calls**: Number of route calculations.

## 4. Kill Switch Protocol
If `Cost Overrun > 20%` of projected spend within 24 hours:

1.  **Immediate Action**: Rotate tokens (invalidates current usage).
2.  **Rollback**: Deploy "No-Map" version of the app (REST-only list views).
3.  **Investigation**: Audit logs to identify source of spike (bot attack vs. legitimate traffic).
