# LD Allocation Implementation

This document describes the implementation of the Logical Device (LD) Allocation feature for the CXL UI.

## Overview

The LD Allocation feature allows users to configure memory allocations for Logical Devices on MLD ports through a web interface. The implementation includes:

- Dynamic form generation based on number of LDs
- Real-time validation
- Socket.IO integration with backend
- Data conversion utilities
- Modern UI with Tailwind CSS

## Components

### 1. LDAllocationForm (`app/_components/LDAllocationForm.js`)

Main form component with the following features:

- **Form Fields:**
  - Port Index (number input)
  - Number of LDs (dropdown: 1-8)
  - Start LD ID (dropdown: 0-255)
  - Dynamic allocation inputs for each LD

- **Functionality:**
  - Dynamic form generation when number of LDs changes
  - Real-time validation
  - Socket.IO integration
  - Response/error display
  - Form reset capability

### 2. Utility Functions (`app/_utils/ldAllocationUtils.js`)

Core utility functions for data conversion and validation:

- `mbTo8ByteArray(mb)` - Converts MB to 8-byte array (big endian)
- `buildAllocationList(ldCount, allocations)` - Builds allocation list from MB values
- `validateAllocations(...)` - Validates form inputs
- `buildAllocationPayload(...)` - Builds complete payload for backend

### 3. Test Component (`app/_components/LDAllocationTest.js`)

Development/testing component for verifying data conversion functions.

## Socket.IO Integration

### Connection
- Connects to backend at `http://0.0.0.0:8200` (configurable via `NEXT_PUBLIC_SOCKET_URL`)
- Uses existing socket provider from the application

### Event Handling
- Emits `mld:setAllocation` event with payload
- Handles response and error callbacks
- Shows connection status

## Data Format

### Input Format
Users input memory allocations in MB (e.g., 16, 32, 64)

### Output Format
Backend receives payload in the following format:
```json
{
  "portIndex": 0,
  "numberOfLds": 3,
  "startLdId": 0,
  "ldAllocationList": [
    {
      "range1": 16384,
      "range2": 0
    },
    {
      "range1": 32768,
      "range2": 0
    },
    {
      "range1": 65536,
      "range2": 0
    }
  ]
}
```

**Note:** range1 values are in KB (16 MB = 16384 KB). range2 is always 0 as it's unused in the current implementation.

### Data Conversion
- MB values are converted to KB: `MB * 1024` (for backend compatibility)
- KB values are returned as integer values
- `range2` is always set to 0 (unused in current implementation)
- The backend uses `pack("<QQ", range_1, range_2)` to pack the values

## Validation Rules

1. **Number of LDs:** Must be between 1 and 8 (configurable)
2. **Start LD ID:** Must be between 0 and 255 (configurable)
3. **Range Validation:** Start LD ID + Number of LDs cannot exceed max LD ID + 1
4. **Allocation Values:** Must be numeric and greater than 0
5. **Array Length:** Number of allocations must match number of LDs
6. **Connection:** Socket connection must be established

## Usage

### Accessing the Form
The LD Allocation Manager is only available when the CXL utility is started with a configuration file that includes `no_mld`.

**To access the form:**
1. Start the CXL utility with a config file containing `no_mld`
2. Navigate to the main application
3. Look for the "LD Allocation Manager" button in the top-left corner (only visible when `no_mld` is in config)
4. Or directly visit `/ld-allocation` (will show access denied if `no_mld` is not in config)

**Configuration Examples:**
```json
// Config with no_mld in filename - LD Allocation Manager will be available
{
  "filename": "2vcs_no_mld.yaml"
}

// Config with no_mld in name property - LD Allocation Manager will be available
{
  "name": "2vcs_no_mld.yaml"
}

// Config with no_mld in configName property - LD Allocation Manager will be available
{
  "configName": "2vcs_no_mld.yaml"
}

// Config without no_mld in name - LD Allocation Manager will be hidden
{
  "filename": "2vcs_normal.yaml"
}
```

### Using the Form
1. Set Port Index (default: 0)
2. Select Number of LDs (1-8)
3. Select Start LD ID (0-255)
4. Enter memory allocations for each LD in MB
5. Click "Submit" to send to backend
6. View response or errors below the form

### Testing
Use the test component at the bottom of the page to:
- Test MB to byte conversion
- Test allocation list generation
- Test complete payload generation
- View example payloads

## Configuration

### Environment Variables
- `NEXT_PUBLIC_SOCKET_URL`: Backend Socket.IO server URL (default: `http://0.0.0.0:8200`)

### Constants
- `maxLdCount`: Maximum number of LDs (default: 8)
- `maxLdId`: Maximum LD ID (default: 255)

### Conditional Display
The LD Allocation Manager is only shown when:
- The CXL utility is started with a configuration file containing `no_mld`
- The backend provides configuration data via the `config:get` Socket.IO event
- The configuration is successfully loaded and parsed

**Configuration Detection:**
The system checks for `no_mld` in the configuration name:
- Filename property: `{ "filename": "2vcs_no_mld.yaml" }`
- Name property: `{ "name": "2vcs_no_mld.yaml" }`
- ConfigName property: `{ "configName": "2vcs_no_mld.yaml" }`
- Any string property containing "no_mld" (case-insensitive)

## Error Handling

### Validation Errors
- Displayed in red box above form
- Prevents submission until resolved
- Clear error messages for each validation rule

### Socket Errors
- Connection status shown at top of form
- Submission disabled when disconnected
- Backend errors displayed in error section

### Network Errors
- Timeout handling
- Connection retry logic
- User-friendly error messages

## Styling

The implementation uses Tailwind CSS for styling with:
- Responsive grid layout
- Modern form design
- Color-coded status indicators
- Hover effects and transitions
- Mobile-friendly design

## Testing Plan

### Manual Testing
1. **Basic Functionality:**
   - Test with 1 LD, start LD ID = 0
   - Test with multiple LDs
   - Test form reset functionality

2. **Validation Testing:**
   - Test invalid inputs
   - Test boundary conditions
   - Test connection loss scenarios

3. **Backend Integration:**
   - Test successful allocation
   - Test backend error responses
   - Test payload format verification

### Automated Testing
- Unit tests for utility functions
- Component testing for form behavior
- Integration tests for Socket.IO communication

## Future Enhancements

1. **Advanced Features:**
   - Save/load allocation configurations
   - Bulk allocation operations
   - Allocation templates

2. **UI Improvements:**
   - Real-time allocation preview
   - Drag-and-drop reordering
   - Advanced validation rules

3. **Backend Integration:**
   - Get current allocations from backend
   - Real-time allocation status updates
   - Allocation history tracking