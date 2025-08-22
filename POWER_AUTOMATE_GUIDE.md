# Power Automate Integration Guide

## Overview
This document provides complete integration details for the Apex PO System's Power Automate workflow. The system automatically sends Purchase Order data to Microsoft Power Automate when forms are submitted.

## ⚠️ CRITICAL: EXACT JSON STRUCTURE REQUIRED
Power Automate expects **EXACTLY** the JSON structure specified below. Any deviation will result in HTTP 400 errors.

## HTTP Endpoint
PO form submissions are sent via HTTP POST to:
```
https://defaulta543e2f6ae4b4d1db263a38786ce68.44.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/146de521bc3a415d9dbbdfec5476be38/triggers/manual/paths/invoke/?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=_bSEuYWnBRzJs_p7EvROZXVi6KLitzuyOtIlD7lEqLA
```

## Required JSON Structure

```json
{
  "meta": {
    "projectName": "string",
    "generalContractor": "string",
    "address": "string", 
    "owner": "string",
    "apexOwner": "string",
    "typeStatus": "string",
    "projectManager": "string",
    "contractAmount": 0,
    "addAltAmount": 0,
    "addAltDetails": "string",
    "retainagePct": 0,
    "requestedBy": "string",
    "companyName": "string",
    "contactName": "string",
    "cellNumber": "string",
    "email": "string",
    "officeNumber": "string",
    "vendorType": "string",
    "workType": "string",
    "importantDates": {
      "noticeToProceed": "string (YYYY-MM-DD format)",
      "anticipatedStart": "string (YYYY-MM-DD format)",
      "substantialCompletion": "string (YYYY-MM-DD format)",
      "hundredPercent": "string (YYYY-MM-DD format)"
    }
  },
  "schedule": [
    {
      "primeLine": "string",
      "budgetCode": "string",
      "description": "string",
      "qty": 0,
      "unit": 0,
      "totalCost": 0,
      "scheduled": 0,
      "apexContractValue": 0,
      "profit": 0
    }
  ],
  "scope": [
    {
      "item": "string", 
      "description": "string",
      "included": true,
      "excluded": false
    }
  ],
  "createdAt": "string (ISO 8601 format)",
  "sent": true,
  "timestamp": 0,
  "id": 0
}
```

## Data Type Requirements

### Strings
- All text fields must be converted using `String(value)`
- Dates must be in YYYY-MM-DD or ISO 8601 format
- Empty values should be empty strings `""`, not null

### Integers
- All numeric fields must be converted using `parseInt(value)`
- **Never use `Number()` - causes schema mismatch**
- Default to 0 for missing values

### Booleans
- Use `Boolean(value)` for true/false fields
- Default to false for missing values

### Arrays
- Always provide arrays, even if empty: `[]`
- Use proper mapping with data type conversion

## Implementation

### shapePOForSend() Function
Located in `js/core/api.js`, this function ensures data matches the exact schema:

```javascript
shapePOForSend(po) {
    const meta = po.meta || {};
    
    return {
        meta: {
            projectName: String(meta.projectName || ""),
            generalContractor: String(meta.generalContractor || ""),
            address: String(meta.address || ""),
            owner: String(meta.owner || ""),
            apexOwner: String(meta.apexOwner || ""),
            typeStatus: String(meta.typeStatus || ""),
            projectManager: String(meta.projectManager || ""),
            contractAmount: parseInt(meta.contractAmount) || 0,
            addAltAmount: parseInt(meta.addAltAmount) || 0,
            addAltDetails: String(meta.addAltDetails || ""),
            retainagePct: parseInt(meta.retainagePct) || 0,
            requestedBy: String(meta.requestedBy || ""),
            companyName: String(meta.companyName || ""),
            contactName: String(meta.contactName || ""),
            cellNumber: String(meta.cellNumber || ""),
            email: String(meta.email || ""),
            officeNumber: String(meta.officeNumber || ""),
            vendorType: String(meta.vendorType || ""),
            workType: String(meta.workType || ""),
            importantDates: {
                noticeToProceed: String((meta.importantDates?.noticeToProceed) || ""),
                anticipatedStart: String((meta.importantDates?.anticipatedStart) || ""),
                substantialCompletion: String((meta.importantDates?.substantialCompletion) || ""),
                hundredPercent: String((meta.importantDates?.hundredPercent) || "")
            }
        },
        schedule: Array.isArray(po.schedule) ? po.schedule.map(item => ({
            primeLine: String(item.primeLine || ""),
            budgetCode: String(item.budgetCode || ""),
            description: String(item.description || ""),
            qty: parseInt(item.qty) || 0,
            unit: parseInt(item.unit) || 0,
            totalCost: parseInt(item.totalCost) || 0,
            scheduled: parseInt(item.scheduled) || 0,
            apexContractValue: parseInt(item.apexContractValue) || 0,
            profit: parseInt(item.profit) || 0
        })) : [],
        scope: Array.isArray(po.scope) ? po.scope.map(item => ({
            item: String(item.item || ""),
            description: String(item.description || ""),
            included: Boolean(item.included),
            excluded: Boolean(item.excluded)
        })) : [],
        createdAt: String(po.createdAt || new Date().toISOString()),
        sent: Boolean(po.sent),
        timestamp: parseInt(po.timestamp) || Date.now(),
        id: parseInt(po.id) || Math.floor(Date.now() / 1000)
    };
}
```

### syncDirectly() Method
Also in `js/core/api.js`, handles the HTTP POST to Power Automate:

```javascript
async syncDirectly(po) {
    const endpoint = 'https://defaulta543e2f6ae4b4d1db263a38786ce68.44.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/146de521bc3a415d9dbbdfec5476be38/triggers/manual/paths/invoke/?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=_bSEuYWnBRzJs_p7EvROZXVi6KLitzuyOtIlD7lEqLA';
    
    const shapedPO = this.shapePOForSend(po);
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(shapedPO)
    });
    
    if (!response.ok) {
        throw new Error(`Power Automate sync failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
}
```

## Common Errors to Avoid

### ❌ WRONG - Will cause HTTP 400
```json
{
  "projectName": "test",           // Missing meta wrapper
  "contractAmount": "50000",       // String instead of integer
  "profit": 45000,                 // At root level instead of schedule items
  "schedule": [{
    "qty": "5"                     // String instead of integer
  }]
}
```

### ✅ CORRECT - Will work
```json
{
  "meta": {
    "projectName": "test",         // Properly nested in meta
    "contractAmount": 50000        // Integer, not string
  },
  "schedule": [{
    "qty": 5,                      // Integer
    "profit": 100                  // At item level
  }],
  "scope": [],                     // Always provide arrays
  "createdAt": "2025-08-22T14:35:47.724Z",
  "sent": false,
  "timestamp": 1755873347724,
  "id": 7
}
```

## Testing Checklist

- [ ] All meta fields are under `meta` object
- [ ] Schedule items include `profit` field at item level
- [ ] All integers use `parseInt()` conversion
- [ ] All strings use `String()` conversion
- [ ] All booleans use `Boolean()` conversion
- [ ] Arrays are provided even if empty
- [ ] Dates are in proper format
- [ ] No null values in required fields

## Integration Flow

1. **Form Submission**: User submits PO form in `pages/form.html`
2. **Data Collection**: `js/pages/form.js` collects form data into structured object
3. **Data Shaping**: `shapePOForSend()` method converts data to exact Power Automate schema
4. **HTTP Request**: `syncDirectly()` sends POST request to Power Automate endpoint
5. **Response Handling**: Success/error responses are processed and displayed to user
6. **Local Storage**: PO data is also saved locally for tracking and admin review

## Files Involved

- `js/core/api.js` - Power Automate integration methods
- `js/pages/form.js` - Form submission handling
- `js/Module/dynamic-form.js` - Dynamic table data collection
- `pages/form.html` - PO form interface
- `pages/admin.html` - Manual Power Automate sync for admins

## Troubleshooting

### HTTP 400 Errors
- Verify JSON structure matches schema exactly
- Check all integers are using `parseInt()` not `Number()`
- Ensure all required fields are present
- Validate no null values in payload

### Network Errors
- Check Power Automate endpoint URL is correct
- Verify network connectivity
- Check browser console for CORS issues

### Data Issues
- Validate form inputs before submission
- Check dynamic table data collection
- Verify date formats (YYYY-MM-DD for dates, ISO 8601 for timestamps)

## Last Updated
August 23, 2025 - Consolidated from multiple documentation files
