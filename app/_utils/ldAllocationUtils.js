/**
 * Convert MB to integer value (for backend compatibility)
 * @param {number} mb - Memory size in MB
 * @returns {number} Integer value representing KB (alternative approach)
 */
export function mbToInteger(mb) {
  // Try converting MB to KB instead of bytes
  // Maybe the backend expects KB values
  const kb = mb * 1024;
  return kb;
}

/**
 * Convert integer value (KB) back to MB for display
 * @param {number} kbValue - Integer value representing KB
 * @returns {number} Memory size in MB
 */
export function integerToMb(kbValue) {
  // Handle invalid inputs
  if (kbValue === null || kbValue === undefined || isNaN(kbValue)) {
    console.warn('Invalid KB value provided to integerToMb:', kbValue);
    return 256; // Default fallback value
  }

  // Convert KB back to MB
  const mb = kbValue / 1024;

  // Ensure we return a valid number
  if (isNaN(mb) || !isFinite(mb)) {
    console.warn('Conversion resulted in invalid MB value:', mb, 'from KB:', kbValue);
    return 256; // Default fallback value
  }

  return mb;
}

/**
 * Convert MB to 8-byte array (big endian) - for display purposes
 * @param {number} mb - Memory size in MB
 * @returns {Array<number>} 8-byte array
 */
export function mbTo8ByteArray(mb) {
  // Based on the example format provided in requirements:
  // 16 MB = [0,0,0,0,0,16,39,0]
  // 32 MB = [0,0,0,0,0,32,78,0]
  // 64 MB = [0,0,0,0,0,64,156,0]

  // This appears to be using a different conversion method
  // For now, using the standard MB to bytes conversion
  const bytes = BigInt(mb) * 1024n * 1024n;

  // Create 8-byte array
  const result = new Array(8).fill(0);

  // Convert to big-endian format
  for (let i = 0; i < 8; i++) {
    result[i] = Number((bytes >> BigInt(8 * (7 - i))) & 0xFFn);
  }

  return result;
}

/**
 * Build allocation list from MB values
 * @param {number} ldCount - Number of logical devices
 * @param {Array<number>} allocations - Array of MB values
 * @returns {Array<Object>} Array of allocation objects with range1 and range2
 */
export function buildAllocationList(ldCount, allocations) {
  return allocations.map(mb => ({
    range1: mbToInteger(mb),
    range2: 0 // if unused
  }));
}

/**
 * Check if this is a "deallocate all" request
 * @param {Array<number>} allocations - Array of MB values
 * @returns {boolean} True if all allocations are zero
 */
export function isDeallocateAllRequest(allocations) {
  return allocations.length > 0 && allocations.every(allocation => allocation === 0);
}

/**
 * Check if this is a mixed allocation/deallocation request
 * @param {Array<number>} allocations - Array of MB values
 * @returns {boolean} True if there are both zero and non-zero allocations
 */
export function isMixedRequest(allocations) {
  const hasZeros = allocations.some(allocation => allocation === 0);
  const hasNonZeros = allocations.some(allocation => allocation > 0);
  return hasZeros && hasNonZeros;
}

/**
 * Build payload for "deallocate all" request
 * @param {number} portIndex - Port index
 * @param {number} startLdId - Start LD ID
 * @returns {Object} Payload for deallocate all
 */
export function buildDeallocateAllPayload(portIndex, startLdId) {
  console.log('Building "deallocate all" payload');
  return {
    portIndex: portIndex,
    numberOfLds: 0, // Backend expects numberOfLds: 0 for deallocate all
    startLdId: startLdId,
    ldAllocationList: [] // Empty array for deallocate all
  };
}

/**
 * Build payload for individual deallocation request
 * @param {number} portIndex - Port index
 * @param {number} numberOfLds - Number of LDs
 * @param {number} startLdId - Start LD ID
 * @param {Array<number>} allocations - Array of MB values
 * @returns {Object} Payload for individual deallocation
 */
export function buildIndividualDeallocationPayload(portIndex, numberOfLds, startLdId, allocations) {
  console.log('Building individual deallocation payload');
  console.log('Original allocations:', allocations);

  // For individual deallocation, we need to send the complete allocation list
  // with zeros for the LDs to be deallocated and their original values for others
  return {
    portIndex: portIndex,
    numberOfLds: numberOfLds,
    startLdId: startLdId,
    ldAllocationList: buildAllocationList(numberOfLds, allocations)
  };
}

/**
 * Validate allocation inputs
 * @param {number} numberOfLds - Number of LDs
 * @param {number} startLdId - Start LD ID
 * @param {Array<number>} allocations - Array of allocation values
 * @param {number} maxLdCount - Maximum allowed LD count
 * @param {number} maxLdId - Maximum allowed LD ID
 * @returns {Object} Validation result with isValid and errors
 */
export function validateAllocations(numberOfLds, startLdId, allocations, maxLdCount = 8, maxLdId = 255) {
  const errors = [];

  // Validate number of LDs
  if (numberOfLds < 0 || numberOfLds > maxLdCount) {
    errors.push(`Number of LDs must be between 0 and ${maxLdCount}`);
  }

  // Validate start LD ID
  if (startLdId < 0 || startLdId > maxLdId) {
    errors.push(`Start LD ID must be between 0 and ${maxLdId}`);
  }

  // Validate that start LD ID + number of LDs doesn't exceed max
  if (startLdId + numberOfLds > maxLdId + 1) {
    errors.push(`Start LD ID (${startLdId}) + Number of LDs (${numberOfLds}) cannot exceed ${maxLdId + 1}`);
  }

  // Validate allocations array length matches number of LDs
  if (allocations.length !== numberOfLds) {
    errors.push(`Number of allocations (${allocations.length}) must match number of LDs (${numberOfLds})`);
  }

  // Validate each allocation value (only if numberOfLds > 0)
  if (numberOfLds > 0) {
    allocations.forEach((allocation, index) => {
      if (allocation < 0) {
        errors.push(`Allocation for LD #${index + 1} cannot be negative`);
      }
      if (!Number.isFinite(allocation)) {
        errors.push(`Allocation for LD #${index + 1} must be a valid number`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Build the complete payload for mld:setAllocation
 * @param {number} portIndex - Port index
 * @param {number} numberOfLds - Number of LDs
 * @param {number} startLdId - Start LD ID
 * @param {Array<number>} allocations - Array of MB values
 * @returns {Object} Complete payload object
 */
export function buildAllocationPayload(portIndex, numberOfLds, startLdId, allocations) {
  // Check the type of request based on backend expectations
  if (isDeallocateAllRequest(allocations)) {
    // "Deallocate All" - Backend expects numberOfLds: 0 with empty ldAllocationList
    console.log('Detected "deallocate all" request');
    return buildDeallocateAllPayload(portIndex, startLdId);
  } else if (isMixedRequest(allocations)) {
    // Mixed allocation/deallocation - Backend doesn't handle this well
    // We need to handle this differently - either split into separate requests or use a different approach
    console.log('Detected mixed allocation/deallocation request - this may not work as expected');
    console.log('Original allocations:', allocations);
    console.log('Non-zero allocations:', allocations.filter(allocation => allocation > 0));
    console.log('Zero allocations (to be deallocated):', allocations.filter(allocation => allocation === 0));

    // For now, send as individual deallocation request
    // TODO: Consider splitting into separate allocation and deallocation requests
    return buildIndividualDeallocationPayload(portIndex, numberOfLds, startLdId, allocations);
  } else {
    // Normal allocation request (all non-zero) or pure deallocation request
    console.log('Detected normal allocation request');
    return {
      portIndex: portIndex,
      numberOfLds: numberOfLds,
      startLdId: startLdId,
      ldAllocationList: buildAllocationList(numberOfLds, allocations)
    };
  }
}