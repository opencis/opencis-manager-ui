"use client";

import { useState, useEffect } from "react";
import { useSocket } from "./providers/socket-provider";
import {
  validateAllocations,
  buildAllocationPayload,
  integerToMb,
  isDeallocateAllRequest,
  isMixedRequest
} from "../_utils/ldAllocationUtils";

export default function LDAllocationForm({ selectedMLDData = null, onSuccess = null }) {
  const { socket, connected } = useSocket();

  // Form state
  const [numberOfLds, setNumberOfLds] = useState(0);
  const [startLdId, setStartLdId] = useState(0);
  const [portIndex, setPortIndex] = useState(0);
  const [allocations, setAllocations] = useState([]); // Start with no LDs
  const [maxLdCount, setMaxLdCount] = useState(16);
  const [maxLdId, setMaxLdId] = useState(255);
  const [isLoadedFromExisting, setIsLoadedFromExisting] = useState(false);
  const [currentlyAllocatedLdIds, setCurrentlyAllocatedLdIds] = useState(new Set()); // Track which LDs are currently allocated on backend



  // Response and error state
  const [response, setResponse] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Update maxLdCount from backend supportedLdCount if available
  useEffect(() => {
    if (selectedMLDData?.supportedLdCount) {
      setMaxLdCount(selectedMLDData.supportedLdCount || 16);
    }
  }, [selectedMLDData]);

  // Fetch current allocations when component mounts or selectedMLDData changes
  useEffect(() => {
    if (selectedMLDData) {
      console.log('Selected MLD data changed, resetting form state');
      setPortIndex(selectedMLDData.portId); // Set the correct port index
      setNumberOfLds(0);
      setAllocations([]);
      setCurrentlyAllocatedLdIds(new Set());
      setStartLdId(0);

      // Always fetch current allocations from backend to ensure we have the latest state
      if (connected && socket) {
        console.log('Fetching current allocations from backend...');
        fetchCurrentAllocations(selectedMLDData.portId);
      }
    }
  }, [selectedMLDData, connected, socket]);

  // Function to fetch current LD allocations from backend
  const fetchCurrentAllocations = (portId) => {
    if (!connected || !socket) return;

    console.log('=== FETCHING CURRENT LD ALLOCATIONS ===');
    console.log('Port ID:', portId);
    console.log('Socket connected:', connected);

    socket.emit("mld:getAllocation", {
      portIndex: portId,
      startLdId: 0, // Always use 0 as start LD ID
      ldAllocationListLimit: 16,
    }, (response) => {
      console.log('=== ALLOCATION RESPONSE RECEIVED ===');
      console.log('Full response:', response);

      if (response.error) {
        console.error('Error fetching LD allocations:', response.error);
        return;
      }

      const result = response.result;
      console.log('=== PARSING ALLOCATION DATA ===');
      console.log('Result object:', result);
      console.log('ldAllocationList:', result?.ldAllocationList);
      console.log('numberOfLds:', result?.numberOfLds);
      console.log('startLdId:', result?.startLdId);

      if (result && result.ldAllocationList && result.ldAllocationList.length > 0) {
        console.log('=== PROCESSING ALLOCATIONS ===');
        console.log('Original LD allocation list from backend:', result.ldAllocationList);
        console.log('Backend numberOfLds:', result.numberOfLds);
        console.log('Backend startLdId:', result.startLdId);

        // The backend returns a flat array [range1, range2, range1, range2, ...]
        // These are allocation multipliers where each unit = 256 MB
        const mbAllocations = [];
        for (let i = 0; i < result.ldAllocationList.length; i += 2) {
          const range1Value = result.ldAllocationList[i];
          const range2Value = result.ldAllocationList[i + 1] || 0;

          console.log(`Processing allocation ${i/2}: range1=${range1Value}, range2=${range2Value}`);

          if (typeof range1Value === 'number' && !isNaN(range1Value)) {
            // Convert allocation multiplier to MB
            // range1Value = 1 means 256 MB, 2 means 512 MB, etc.
            let mbValue;
            if (range1Value === 0) {
              mbValue = 0; // Deallocated
            } else {
              mbValue = range1Value * 256; // Each unit = 256 MB
            }

            console.log(`Converting allocation multiplier ${range1Value} to ${mbValue} MB`);
            mbAllocations.push(mbValue);
          } else {
            console.warn('Invalid range1 value from backend:', range1Value);
            mbAllocations.push(256); // Default value
          }
        }

        console.log('Converted MB allocations from backend:', mbAllocations);
        console.log('Final allocations to set:', mbAllocations);

        // Always preserve the complete allocation structure including zeros for deallocation support
        // This ensures proper LD ID mapping regardless of load type
        console.log(`Preserving complete allocation structure: ${mbAllocations}`);
        console.log(`Total number of LDs: ${mbAllocations.length}`);

        // Check if there are any non-zero allocations
        const hasNonZeroAllocations = mbAllocations.some(allocation => allocation > 0.001);

        if (hasNonZeroAllocations) {
          // Create allocations array based on actual LD slots, not numberOfLds
          // numberOfLds represents allocated LDs, but we need to show all LD slots
          const totalLdSlots = mbAllocations.length; // This should be 8
          const actualAllocations = new Array(totalLdSlots).fill(0);
          mbAllocations.forEach((allocation, index) => {
            actualAllocations[index] = allocation;
          });

          // Update the form state with the actual allocation structure
          setNumberOfLds(totalLdSlots); // Use total LD slots, not just allocated ones
          setStartLdId(result.startLdId);
          setAllocations(actualAllocations); // Use actual allocations, not padded

          // Track which LDs are currently allocated on the backend
          const allocatedLdIds = new Set();
          actualAllocations.forEach((allocation, index) => {
            if (allocation > 0.001) {
              allocatedLdIds.add(result.startLdId + index);
            }
          });
          setCurrentlyAllocatedLdIds(allocatedLdIds);
          console.log('Currently allocated LD IDs:', Array.from(allocatedLdIds));
        } else {
          // All allocations are zero, treat as no allocations
          console.log('All allocations are zero, clearing form');
          setNumberOfLds(0);
          setAllocations([]);
          setCurrentlyAllocatedLdIds(new Set());
        }

        setIsLoadedFromExisting(true);
        console.log('=== FORM STATE UPDATED ===');
      } else {
        // No allocations found, clear the form
        console.log('=== NO ALLOCATIONS FOUND ===');
        console.log('No LD allocations found, clearing form');
        setNumberOfLds(0);
        setAllocations([]);
        setCurrentlyAllocatedLdIds(new Set()); // Clear allocated LDs tracking
        setIsLoadedFromExisting(true);
        console.log('=== FORM CLEARED ===');
      }
    });
  };



  // Generate LD count options (allow all counts from 0 to 16)
  const ldCountOptions = Array.from({ length: maxLdCount + 1 }, (_, i) => i);

  // Handle number of LDs change
  const handleNumberOfLdsChange = (value) => {
    const newNumberOfLds = parseInt(value);
    console.log(`=== NUMBER OF LDS CHANGE DEBUG ===`);
    console.log(`Changing from ${numberOfLds} LDs to ${newNumberOfLds} LDs`);
    console.log(`Current allocations:`, allocations);

    setNumberOfLds(newNumberOfLds);

    // Adjust allocations array to show the correct number of input fields
    // but preserve existing allocation values
    const newAllocations = [...allocations];
    if (newNumberOfLds > allocations.length) {
      // Add new allocations with default value
      for (let i = allocations.length; i < newNumberOfLds; i++) {
        newAllocations.push(256); // Default 256MB (matches dropdown options)
        console.log(`Added new LD ${i} with default 256 MB`);
      }
    } else if (newNumberOfLds < allocations.length) {
      // Remove excess allocations
      const removedAllocations = newAllocations.splice(newNumberOfLds);
      console.log(`Removed excess allocations:`, removedAllocations);
    }

    console.log(`Final allocations array:`, newAllocations);
    setAllocations(newAllocations);
  };

  // Handle allocation change for specific LD
  const handleAllocationChange = (index, value) => {
    console.log(`=== ALLOCATION CHANGE DEBUG ===`);
    console.log(`Changing LD ${index} allocation from ${allocations[index]} MB to ${value} MB`);
    console.log(`Value type: ${typeof value}, Value: ${value}`);
    console.log(`Current allocations array before change:`, [...allocations]);
    console.log(`Current numberOfLds: ${numberOfLds}`);

    const newAllocations = [...allocations];
    const parsedValue = parseInt(value) || 0;
    console.log(`Parsed value: ${parsedValue}`);

    // Check if this LD is currently allocated on the backend
    const currentLdId = startLdId + index;
    const isCurrentlyAllocated = currentlyAllocatedLdIds.has(currentLdId);

    // Check if this LD is bound to a host
    const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === currentLdId);
    const isBound = boundLdInfo && boundLdInfo.hostId !== -1;

    // Validate maximum allocation size
    if (parsedValue > 4096) {
      console.warn(`Allocation too large: ${parsedValue} MB - maximum is 4096 MB`);
      setValidationErrors([
        `Memory allocation cannot exceed 4096 MB (4 GB). Got ${parsedValue} MB.`
      ]);
      return; // Don't allow the change
    }

    // Allow setting any LD to 0 to maintain position in the allocation list
    // The backend will preserve the LD position and set it to 0
    // No validation needed for deallocation - backend handles position preservation

    // Clear validation errors if the change is valid
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }

    newAllocations[index] = parsedValue;
    console.log(`New allocations array after change:`, newAllocations);
    console.log(`LD ${index} is now set to: ${newAllocations[index]} MB`);

    console.log(`=== SETTING ALLOCATIONS IN handleAllocationChange ===`);
    setAllocations(newAllocations);

    // Don't automatically change numberOfLds - let the user control this
    // The backend will handle 0 MB allocations as deallocated LDs
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!connected) {
      setErrors(["Socket connection not established"]);
      return;
    }

    // Clear previous errors
    setErrors([]);
    setResponse(null);

    // Validate inputs
    console.log('=== VALIDATION DEBUG ===');
    console.log('numberOfLds:', numberOfLds);
    console.log('startLdId:', startLdId);
    console.log('allocations length:', allocations.length);
    console.log('maxLdCount:', maxLdCount);
    console.log('maxLdId:', maxLdId);
    console.log('selectedMLDData.supportedLdCount:', selectedMLDData?.supportedLdCount);

    // Additional validation: check if total memory allocation exceeds device capacity
    const totalCapacity = selectedMLDData?.ldInfo?.totalDeviceCapacity || 4096; // Default 4GB in MB
    const totalAllocatedMemory = allocations.reduce((sum, allocation) => sum + allocation, 0);
    const remainingMemory = totalCapacity - totalAllocatedMemory;

    console.log('Memory validation:', {
      totalCapacity,
      totalAllocatedMemory,
      remainingMemory
    });

    if (remainingMemory < 0) {
      setValidationErrors([
        `Insufficient memory capacity. You are trying to allocate ${totalAllocatedMemory} MB, but the device only has ${totalCapacity} MB available. ` +
        `This would result in ${Math.abs(remainingMemory)} MB over-allocation. Please reduce your memory allocations.`
      ]);
      return;
    }

    const validation = validateAllocations(numberOfLds, startLdId, allocations, maxLdCount, maxLdId);
    console.log('Validation result:', validation);

    if (!validation.isValid) {
      console.log('Validation failed with errors:', validation.errors);
      setValidationErrors(validation.errors);
      return;
    }

    // Additional validation: check for non-256 multiples in allocations
    const hasNon256Multiples = allocations.some(allocation => allocation > 0 && allocation % 256 !== 0);
    if (hasNon256Multiples) {
      setValidationErrors([
        'Memory allocations must be in 256 MB increments. Please correct the following allocations:',
        ...allocations.map((allocation, index) => {
          if (allocation > 0 && allocation % 256 !== 0) {
            return `LD #${startLdId + index}: ${allocation} MB (should be a multiple of 256)`;
          }
          return null;
        }).filter(Boolean)
      ]);
      return;
    }

    setValidationErrors([]);
    setIsSubmitting(true);

    try {
      // Check the type of request based on backend expectations
      const isDeallocateAll = isDeallocateAllRequest(allocations);
      const isMixed = isMixedRequest(allocations);
      const hasZeroAllocations = allocations.some(allocation => allocation === 0);

      console.log('=== REQUEST TYPE ANALYSIS ===');
      console.log('Is deallocate all request:', isDeallocateAll);
      console.log('Is mixed request:', isMixed);
      console.log('Has zero allocations:', hasZeroAllocations);
      console.log('Allocations:', allocations);

      let payload;
      if (isDeallocateAll) {
        console.log('=== DEALLOCATE ALL REQUEST ===');
        console.log('Building payload for "deallocate all" (numberOfLds: 0, empty ldAllocationList)');
        payload = buildAllocationPayload(portIndex, numberOfLds, startLdId, allocations);
      } else if (isMixed) {
        console.log('=== MIXED ALLOCATION/DEALLOCATION REQUEST ===');
        console.log('WARNING: Backend may not handle mixed requests properly');
        console.log('Non-zero allocations:', allocations.filter(allocation => allocation > 0));
        console.log('Zero allocations (to be deallocated):', allocations.filter(allocation => allocation === 0));
        console.log('Attempting to send as individual deallocation request');
        payload = buildAllocationPayload(portIndex, numberOfLds, startLdId, allocations);
      } else {
        console.log('=== NORMAL ALLOCATION REQUEST ===');
        payload = buildAllocationPayload(portIndex, numberOfLds, startLdId, allocations);
      }

      // Enhanced debug logging
      console.log('=== LD ALLOCATION PAYLOAD DEBUG ===');
      console.log('Form inputs:');
      console.log('  - Port Index:', portIndex);
      console.log('  - Number of LDs:', numberOfLds);
      console.log('  - Start LD ID:', startLdId);
      console.log('  - Allocations (MB):', allocations);
      console.log('  - Total requested memory (MB):', allocations.reduce((sum, allocation) => sum + allocation, 0));

      console.log('  - Zero allocations (deallocations):', allocations.filter(allocation => allocation === 0));
      console.log('  - Non-zero allocations (active):', allocations.filter(allocation => allocation > 0));
      console.log('  - Is deallocate all request?', isDeallocateAll);
      console.log('  - Is mixed request?', isMixed);
      console.log('  - Has zero allocations?', hasZeroAllocations);

      console.log('Generated payload:');
      console.log('  - Full payload:', JSON.stringify(payload, null, 2));
      console.log('  - Payload structure:', {
        portIndex: payload.portIndex,
        numberOfLds: payload.numberOfLds,
        startLdId: payload.startLdId,
        ldAllocationListLength: payload.ldAllocationList.length
      });

      if (payload.ldAllocationList.length > 0) {
        console.log('  - LD Allocation details:');
        payload.ldAllocationList.forEach((allocation, index) => {
          console.log(`    LD ${index}: range1=${allocation.range1} KB (${allocation.range1 / 1024} MB), range2=${allocation.range2}`);
        });
      }
      console.log('=== END DEBUG ===');

      socket.emit("mld:setAllocation", payload, (response) => {
        setIsSubmitting(false);

        console.log('=== BACKEND RESPONSE DEBUG ===');
        console.log('Backend response:', response);
        console.log('Response type:', typeof response);
        console.log('Response keys:', Object.keys(response || {}));

        if (response.error) {
          console.error('Backend error:', response.error);

          // Handle specific capacity exceeded error
          if (response.error === 'DYNAMIC_LD_CREATION_FAILED') {
            setErrors([
              'Failed to allocate LDs: Backend capacity exceeded. ' +
              'The backend has insufficient memory capacity to allocate the requested LDs. ' +
              'Try using "Force Clear All LDs" to free up memory, or reduce the number/size of LDs you are trying to allocate.'
            ]);
          } else {
            setErrors([response.error]);
          }
          return;
        } else {
          console.log('Backend success response:', response);
          console.log('Response result type:', typeof response.result);
          console.log('Response result keys:', Object.keys(response.result || {}));
          setResponse(response);
          console.log('Allocation successful!');

          // Check the type of request and analyze the response
          const isDeallocateAll = isDeallocateAllRequest(allocations);
          const isMixed = isMixedRequest(allocations);
          const hasZeroAllocations = allocations.some(allocation => allocation === 0);
          const hasDeallocatedLds = response.result?.deallocated_ld_ids && response.result.deallocated_ld_ids.length > 0;

          if (isDeallocateAll) {
            console.log('=== DEALLOCATE ALL RESPONSE ANALYSIS ===');
            console.log('Backend should have deallocated all LDs');
            console.log(`Response contains deallocated_ld_ids: ${hasDeallocatedLds}`);
            console.log(`Deallocated LD IDs: ${response.result?.deallocated_ld_ids || 'None'}`);

            if (hasDeallocatedLds) {
              console.log('✅ Backend confirmed "deallocate all" success!');
            } else {
              console.log('⚠️ Backend response does not confirm "deallocate all"');
            }
          } else if (isMixed || hasZeroAllocations) {
            console.log('=== INDIVIDUAL DEALLOCATION RESPONSE ANALYSIS ===');
            console.log(`Is mixed request: ${isMixed}`);
            console.log(`Has zero allocations: ${hasZeroAllocations}`);
            console.log(`Response contains deallocated_ld_ids: ${hasDeallocatedLds}`);
            console.log(`Deallocated LD IDs: ${response.result?.deallocated_ld_ids || 'None'}`);

            if (hasDeallocatedLds) {
              console.log('✅ Backend confirmed individual deallocation success!');
            } else {
              console.log('⚠️ Backend response does not confirm individual deallocation');
            }
          }

          // Parse the response data and update form state
          if (response.result) {
            console.log('=== PARSING SET ALLOCATION RESPONSE ===');
            console.log('Response result:', response.result);
            console.log('Response result keys:', Object.keys(response.result));
            console.log('Response ldAllocationList:', response.result.ldAllocationList);
            console.log('Response ldAllocationList type:', typeof response.result.ldAllocationList);
            console.log('Response ldAllocationList length:', response.result.ldAllocationList?.length);

            try {
              // Check if the response contains updated allocation data
              if (response.result.ldAllocationList && Array.isArray(response.result.ldAllocationList) && response.result.ldAllocationList.length > 0) {
                console.log('Response contains ldAllocationList:', response.result.ldAllocationList);

                // Parse the flat array format [range1, range2, range1, range2, ...]
                const responseAllocations = [];
                for (let i = 0; i < response.result.ldAllocationList.length; i += 2) {
                  const range1Value = response.result.ldAllocationList[i];
                  console.log(`Processing response range1[${i}]: ${range1Value} KB`);

                  if (typeof range1Value === 'number' && !isNaN(range1Value)) {
                    const mbValue = integerToMb(range1Value);
                    console.log(`  Converted to MB: ${mbValue} MB`);
                    console.log(`  Using backend response memory size: ${mbValue} MB`);
                    responseAllocations.push(mbValue);
                  } else {
                    console.warn('Invalid range1 value in response:', range1Value);
                    responseAllocations.push(0);
                  }
                }

                console.log('Parsed response allocations:', responseAllocations);
                console.log('Response numberOfLds:', response.result.numberOfLds);
                console.log('Response startLdId:', response.result.startLdId);

                // Handle different types of requests based on backend expectations
                let allocationsToSet;
                if (isDeallocateAll) {
                  // For "deallocate all", clear all allocations
                  allocationsToSet = [];
                  console.log('Deallocate all: Clearing all allocations');
                } else if (isMixed || hasZeroAllocations) {
                  // For individual deallocation, preserve the original structure but update with response values
                  allocationsToSet = [...allocations]; // Start with original
                  responseAllocations.forEach((responseValue, index) => {
                    if (index < allocationsToSet.length) {
                      allocationsToSet[index] = responseValue;
                    }
                  });
                  console.log('Individual deallocation: Preserving allocation structure with updated values');
                } else {
                  // For normal allocation, filter out zero allocations
                  allocationsToSet = responseAllocations.filter(allocation => allocation > 0.001);
                  console.log('Normal allocation: Filtering to active allocations only');
                }

                console.log('Allocations to set:', allocationsToSet);

                // Compare sent vs received allocations
                console.log('=== ALLOCATION COMPARISON ===');
                console.log('Original allocations sent:', allocations);
                console.log('Response allocations received:', responseAllocations);
                console.log('Allocations to set:', allocationsToSet);
                console.log('Response ldAllocationList raw:', response.result.ldAllocationList);

                // Check for discrepancies
                allocations.forEach((original, index) => {
                  const received = responseAllocations[index] || 0;
                  if (Math.abs(original - received) > 0.001) {
                    console.warn(`LD ${index}: Sent ${original} MB, Received ${received} MB - MISMATCH!`);
                    if (received === 0) {
                      console.log(`  Note: Backend returned 0 MB, deallocation successful`);
                    }
                  } else {
                    console.log(`LD ${index}: Sent ${original} MB, Received ${received} MB - OK`);
                  }
                });

                // Update form state with the appropriate allocations
                if (isDeallocateAll) {
                  // For "deallocate all", clear the form
                  setNumberOfLds(0);
                  setStartLdId(response.result.startLdId);
                  console.log(`=== SETTING ALLOCATIONS FROM DEALLOCATE ALL RESPONSE ===`);
                  console.log(`Allocations to set: ${allocationsToSet}`);
                  console.log(`Current allocations: ${allocations}`);
                  console.log(`Will set allocations to: ${allocationsToSet}`);
                  setAllocations(allocationsToSet);

                  // Update currently allocated LDs tracking - all deallocated
                  setCurrentlyAllocatedLdIds(new Set());
                  console.log('Updated currently allocated LD IDs: [] (all deallocated)');

                  setIsLoadedFromExisting(true);
                } else if (isMixed || hasZeroAllocations) {
                  // For individual deallocation, keep the same number of LDs but update the values
                  setNumberOfLds(Math.min(allocationsToSet.length, maxLdCount)); // Limit to maxLdCount
                  setStartLdId(response.result.startLdId);
                  console.log(`=== SETTING ALLOCATIONS FROM INDIVIDUAL DEALLOCATION RESPONSE ===`);
                  console.log(`Allocations to set: ${allocationsToSet}`);
                  console.log(`Current allocations: ${allocations}`);
                  console.log(`Will set allocations to: ${allocationsToSet}`);
                  setAllocations(allocationsToSet);

                  // Update currently allocated LDs tracking
                  const newAllocatedLdIds = new Set();
                  allocationsToSet.forEach((allocation, index) => {
                    if (allocation > 0.001) {
                      newAllocatedLdIds.add(response.result.startLdId + index);
                    }
                  });
                  setCurrentlyAllocatedLdIds(newAllocatedLdIds);
                  console.log('Updated currently allocated LD IDs:', Array.from(newAllocatedLdIds));

                  setIsLoadedFromExisting(true);
                } else {
                  // For normal allocation, use filtered active allocations
                  setNumberOfLds(Math.min(allocationsToSet.length, maxLdCount)); // Limit to maxLdCount
                  setStartLdId(response.result.startLdId);
                  console.log(`=== SETTING ALLOCATIONS FROM NORMAL ALLOCATION RESPONSE ===`);
                  console.log(`Active allocations: ${allocationsToSet}`);
                  console.log(`Current allocations: ${allocations}`);
                  console.log(`Will set allocations to: ${allocationsToSet}`);
                  setAllocations(allocationsToSet);

                  // Update currently allocated LDs tracking
                  const newAllocatedLdIds = new Set();
                  allocationsToSet.forEach((allocation, index) => {
                    if (allocation > 0.001) {
                      newAllocatedLdIds.add(response.result.startLdId + index);
                    }
                  });
                  setCurrentlyAllocatedLdIds(newAllocatedLdIds);
                  console.log('Updated currently allocated LD IDs:', Array.from(newAllocatedLdIds));

                  setIsLoadedFromExisting(true);
                }

                console.log('=== FORM STATE UPDATED FROM RESPONSE ===');
              } else {
                console.log('Response does not contain valid ldAllocationList, fetching current data...');
                console.log('Response result keys available:', Object.keys(response.result || {}));
                console.log('Response result ldAllocationList:', response.result?.ldAllocationList);
                console.log('Response result ldAllocationList is array:', Array.isArray(response.result?.ldAllocationList));
                console.log('Response result ldAllocationList length:', response.result?.ldAllocationList?.length);

                // For deallocation requests, wait longer to ensure backend has processed the change
                const delay = (isDeallocateAll || isMixed || hasZeroAllocations) ? 3000 : 1000; // 3 seconds for deallocation, 1 second for allocation

                console.log(`=== FALLBACK FETCH (${delay}ms delay) ===`);
                console.log(`Is deallocate all: ${isDeallocateAll}`);
                console.log(`Is mixed request: ${isMixed}`);
                console.log(`Has zero allocations: ${hasZeroAllocations}`);
                console.log(`Will fetch current allocations in ${delay}ms`);

                setTimeout(() => {
                  console.log('=== VERIFYING SAVE ===');
                  fetchCurrentAllocations(portIndex);
                }, delay);
              }
            } catch (parseError) {
              console.error('Error parsing response data:', parseError);
              console.log('Falling back to fetching current allocations...');
              // Fallback to fetching current allocations
              setTimeout(() => {
                console.log('=== VERIFYING SAVE ===');
                fetchCurrentAllocations(portIndex);
              }, 1000);
            }
          } else {
            console.log('Response does not contain result, fetching current data...');
            // Fallback to fetching current allocations
            setTimeout(() => {
              console.log('=== VERIFYING SAVE ===');
              fetchCurrentAllocations(portIndex);
            }, 1000);
          }

          // Call the success callback if provided
          if (onSuccess) {
            onSuccess(response, payload);
          }

          // Force refresh the allocation data after successful save
          console.log('=== REFRESHING ALLOCATION DATA AFTER SAVE ===');

          // For deallocation requests, wait longer to ensure backend has processed the change
          const finalDelay = (isDeallocateAll || isMixed || hasZeroAllocations) ? 4000 : 2000; // 4 seconds for deallocation, 2 seconds for allocation

          console.log(`=== FINAL REFRESH (${finalDelay}ms delay) ===`);
          console.log(`Is deallocate all: ${isDeallocateAll}`);
          console.log(`Is mixed request: ${isMixed}`);
          console.log(`Has zero allocations: ${hasZeroAllocations}`);
          console.log(`Will execute final refresh in ${finalDelay}ms`);

          setTimeout(() => {
            console.log('=== EXECUTING DELAYED REFRESH ===');
            fetchCurrentAllocations(portIndex);
          }, finalDelay);
        }
        console.log('=== END RESPONSE DEBUG ===');
      });
    } catch (error) {
      setIsSubmitting(false);
      setErrors([`Submission error: ${error.message}`]);
    }
  };



  return (
    <div className="max-w-4xl mx-auto p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#e59055' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">LD Allocation Manager</h2>
      </div>

      {/* Connection Status */}
      <div className={`mb-4 p-3 rounded ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        <span className="font-semibold">Connection Status:</span> {connected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
        {/* Basic Configuration */}
        {(() => {
          console.log('Dropdown visibility check - numberOfLds:', numberOfLds, 'currentlyAllocatedLdIds.size:', currentlyAllocatedLdIds.size);
          return numberOfLds === 0;
        })() && (
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Number of LDs
            </label>
            <select
              value={numberOfLds}
              onChange={(e) => handleNumberOfLdsChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ldCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count} LD{count !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Allocation Inputs */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-white">
            Memory Allocations
            {isLoadedFromExisting && (
              <span className="text-sm font-normal text-white ml-2">
                (Loaded from existing configuration)
              </span>
            )}
          </h3>
          <ul className="text-sm text-white mb-4 list-disc list-inside">
            <li>Memory allocations must be in 256 MB increments</li>
            <li>Use the up/down arrows to adjust by 256 MB</li>
          </ul>
          {/* LD Allocation Grid - Column Layout */}
          <div className="flex gap-8">
            {/* Column 1: LDs 0 to (maxLdCount/2 - 1) */}
            <div className="flex-1 grid grid-cols-1 gap-4">
              {Array.from({ length: Math.ceil(maxLdCount / 2) }, (_, index) => {
                const isActive = allocations[index] > 0;
                const allocation = allocations[index] || 0;

                return (
                  <div key={index} className={`border rounded-lg p-2 ${isActive ? 'border-gray-200' : 'border-dashed border-gray-300'}`} style={isActive ? { backgroundColor: '#d9d9d9' } : {}}>
                    {isActive ? (
                      <div className="flex flex-col items-center justify-center h-24 space-y-1">
                        <div className="text-xs text-black text-center">
                          LD #{startLdId + index} (MB)
                        </div>
                        {/* Show bound/unbound status */}
                        {(() => {
                          const actualLdId = startLdId + index;
                          const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                          if (boundLdInfo) {
                            if (boundLdInfo.hostId === -1) {
                              return (
                                <div className="text-xs text-blue-600 text-center">
                                  Unbound
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-xs text-purple-600 text-center">
                                  Bound to Host {boundLdInfo.hostId}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        <input
                          type="number"
                          min="0"
                          max="4096"
                          step="256"
                          value={allocation}
                          onChange={(e) => handleAllocationChange(index, e.target.value)}
                          disabled={(() => {
                            const actualLdId = startLdId + index;
                            const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                            return boundLdInfo && boundLdInfo.hostId !== -1;
                          })()}
                          className={`w-full px-2 py-1 border rounded text-xs number-input-arrows ${
                            (() => {
                              const actualLdId = startLdId + index;
                              const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                              if (boundLdInfo && boundLdInfo.hostId !== -1) {
                                return 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-gray-300';
                              }
                              return 'border-gray-300 focus:ring-blue-500';
                            })()
                          }`}
                          placeholder="Enter MB value"
                          title="Use ↑↓ arrows to adjust by 256 MB, or type a value that's a multiple of 256"
                        />
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(index, "0")}
                          disabled={(() => {
                            const actualLdId = startLdId + index;
                            const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                            return boundLdInfo && boundLdInfo.hostId !== -1;
                          })()}
                          className={`px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 ${
                            (() => {
                              const actualLdId = startLdId + index;
                              const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                              if (boundLdInfo && boundLdInfo.hostId !== -1) {
                                return 'bg-gray-300 text-gray-500 cursor-not-allowed';
                              }
                              return 'bg-purple-700 text-white hover:bg-purple-800 focus:ring-purple-700';
                            })()
                          }`}
                          title="Deallocate this LD (set to 0 MB)"
                        >
                          Deallocate
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 space-y-1">
                        <div className="text-xs text-white text-center">
                          LD #{startLdId + index}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(index, "256")}
                          className="px-3 py-2 rounded text-xs bg-[#66878a] text-white hover:bg-[#5a7a7a] focus:outline-none focus:ring-2 focus:ring-[#66878a]"
                        >
                          Allocate
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Column 2: LDs (maxLdCount/2) to (maxLdCount - 1) */}
            <div className="flex-1 grid grid-cols-1 gap-4">
              {Array.from({ length: Math.floor(maxLdCount / 2) }, (_, index) => {
                const actualIndex = index + Math.ceil(maxLdCount / 2); // LDs in second column
                const isActive = allocations[actualIndex] > 0;
                const allocation = allocations[actualIndex] || 0;

                return (
                  <div key={actualIndex} className={`border rounded-lg p-2 ${isActive ? 'border-gray-200' : 'border-dashed border-gray-300'}`} style={isActive ? { backgroundColor: '#d9d9d9' } : {}}>
                    {isActive ? (
                      <div className="flex flex-col items-center justify-center h-24 space-y-1">
                        <div className="text-xs text-black text-center">
                          LD #{startLdId + actualIndex} (MB)
                        </div>
                        {/* Show bound/unbound status */}
                        {(() => {
                          const actualLdId = startLdId + actualIndex;
                          const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                          if (boundLdInfo) {
                            if (boundLdInfo.hostId === -1) {
                              return (
                                <div className="text-xs text-blue-600 text-center">
                                  Unbound
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-xs text-purple-600 text-center">
                                  Bound to Host {boundLdInfo.hostId}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        <input
                          type="number"
                          min="0"
                          max="4096"
                          step="256"
                          value={allocation}
                          onChange={(e) => handleAllocationChange(actualIndex, e.target.value)}
                          disabled={(() => {
                            const actualLdId = startLdId + actualIndex;
                            const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                            return boundLdInfo && boundLdInfo.hostId !== -1;
                          })()}
                          className={`w-full px-2 py-1 border rounded text-xs number-input-arrows ${
                            (() => {
                              const actualLdId = startLdId + actualIndex;
                              const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                              if (boundLdInfo && boundLdInfo.hostId !== -1) {
                                return 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-gray-300';
                              }
                              return 'border-gray-300 focus:ring-blue-500';
                            })()
                          }`}
                          placeholder="Enter MB value"
                          title="Use ↑↓ arrows to adjust by 256 MB, or type a value that's a multiple of 256"
                        />
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(actualIndex, "0")}
                          disabled={(() => {
                            const actualLdId = startLdId + actualIndex;
                            const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                            return boundLdInfo && boundLdInfo.hostId !== -1;
                          })()}
                          className={`px-2 py-1 rounded text-xs focus:outline-none focus:ring-2 ${
                            (() => {
                              const actualLdId = startLdId + actualIndex;
                              const boundLdInfo = selectedMLDData?.logicalDevices?.boundLdId?.find(ld => ld.to === actualLdId);
                              if (boundLdInfo && boundLdInfo.hostId !== -1) {
                                return 'bg-gray-300 text-gray-500 cursor-not-allowed';
                              }
                              return 'bg-purple-700 text-white hover:bg-purple-800 focus:ring-purple-700';
                            })()
                          }`}
                          title="Deallocate this LD (set to 0 MB)"
                        >
                          Deallocate
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 space-y-1">
                        <div className="text-xs text-white text-center">
                          LD #{startLdId + actualIndex}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(actualIndex, "256")}
                          className="px-3 py-2 rounded text-xs bg-[#66878a] text-white hover:bg-[#5a7a7a] focus:outline-none focus:ring-2 focus:ring-[#66878a]"
                        >
                          Allocate
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-red-800 mb-2">Validation Errors:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={!connected || isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          {numberOfLds > 0 && currentlyAllocatedLdIds.size > 0 && (() => {
            // Check if there are any bound LDs
            const hasBoundLds = selectedMLDData?.logicalDevices?.boundLdId?.some(ld => ld.hostId !== -1) || false;

            return (
              <button
                type="button"
                onClick={() => {
                  // Only deallocate LDs that are currently allocated on the backend
                  const newAllocations = [...allocations];
                  currentlyAllocatedLdIds.forEach(ldId => {
                    const index = ldId - startLdId;
                    if (index >= 0 && index < newAllocations.length) {
                      newAllocations[index] = 0;
                    }
                  });
                  setAllocations(newAllocations);
                }}
                disabled={hasBoundLds}
                className="px-6 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={hasBoundLds ? "Cannot deallocate - there are LDs bound to hosts" : "Deallocate all currently allocated LDs (positions will be preserved)"}
              >
                Deallocate All ({currentlyAllocatedLdIds.size} LDs)
              </button>
            );
          })()}
          <button
            type="button"
            onClick={() => {
              // Force deallocate all existing LDs on the backend
              console.log('=== FORCE DEALLOCATE ALL EXISTING LDS ===');
              console.log('Sending deallocate all request to clear backend state');

              if (socket) {
                const deallocateAllPayload = {
                  portIndex: portIndex,
                  numberOfLds: 0,
                  startLdId: 0,
                  ldAllocationList: []
                };

                console.log('Deallocate all payload:', deallocateAllPayload);

                socket.emit("mld:setAllocation", deallocateAllPayload, (response) => {
                  console.log('Deallocate all response:', response);
                  if (response.error) {
                    console.error('Deallocate all failed:', response.error);
                    setErrors([`Failed to deallocate all LDs: ${response.error}`]);
                  } else {
                    console.log('Deallocate all successful');
                    // Clear the form state
                    setNumberOfLds(0);
                    setAllocations([]);
                    setStartLdId(0);
                    setCurrentlyAllocatedLdIds(new Set()); // Clear allocated LDs tracking
                    setIsLoadedFromExisting(false);
                    setResponse(response);
                    // Show success message
                    setErrors([]);
                    // Refresh the data
                    setTimeout(() => {
                      fetchCurrentAllocations(portIndex);
                    }, 1000);
                  }
                });
              }
            }}
            disabled={(() => {
              // Check if there are any bound LDs
              const hasBoundLds = selectedMLDData?.logicalDevices?.boundLdId?.some(ld => ld.hostId !== -1) || false;
              return hasBoundLds;
            })()}
            className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={(() => {
              const hasBoundLds = selectedMLDData?.logicalDevices?.boundLdId?.some(ld => ld.hostId !== -1) || false;
              return hasBoundLds ? "Cannot clear - there are LDs bound to hosts" : "Force clear all LDs from backend (positions will be preserved)";
            })()}
          >
            Force Clear All LDs
          </button>
        </div>
      </form>

      {/* Response Display */}
      {response && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-green-800 mb-2">Success Response:</h4>
          <pre className="text-sm text-green-700 bg-green-100 p-3 rounded overflow-x-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Errors:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Capacity Warning - Disabled to let backend handle validation */}
      {/*
      {(() => {
        const totalCapacity = selectedMLDData?.ldInfo?.totalDeviceCapacity || 4096; // Default 4GB
        const allocatedMemory = allocations.reduce((sum, allocation) => sum + allocation, 0);
        const remainingMemory = totalCapacity - allocatedMemory;
        const isLowCapacity = remainingMemory < 256; // Warning if less than 256MB remaining

        if (isLowCapacity) {
          return (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Low Memory Capacity Warning</h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p><strong>Total Capacity:</strong> {totalCapacity} MB</p>
                <p><strong>Currently Allocated:</strong> {allocatedMemory} MB</p>
                <p><strong>Remaining:</strong> {Math.round(remainingMemory)} MB</p>
                <p className="mt-2">
                  <strong>Warning:</strong> You have limited memory capacity remaining.
                  Consider using "Force Clear All LDs" to free up memory before allocating new LDs.
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}
      */}

      {/* Current LD Allocations Summary */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          {isLoadedFromExisting ? 'Existing LD Allocations:' : 'Current LD Allocations:'}
        </h4>
        {numberOfLds === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p>No LDs configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {allocations.map((allocation, index) => (
              <div key={index} className="bg-white p-2 rounded border">
                <span className="text-sm font-medium text-gray-700">LD #{startLdId + index}:</span>
                <span className="text-sm text-gray-600 ml-2">{allocation} MB</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-sm text-blue-700">
          <p><strong>Total LDs:</strong> {numberOfLds}</p>
          <p><strong>Start LD ID:</strong> {startLdId}</p>
          <p><strong>Total Memory:</strong> {allocations.reduce((sum, allocation) => sum + allocation, 0)} MB</p>
          <p><strong>Memory Remaining:</strong> {(() => {
            const totalCapacity = selectedMLDData?.ldInfo?.totalDeviceCapacity || 4096; // Default 4GB
            const allocatedMemory = allocations.reduce((sum, allocation) => sum + allocation, 0);
            const remainingMemory = totalCapacity - allocatedMemory;
            return `${Math.round(remainingMemory)} MB`;
          })()}</p>
          <p><strong>Currently Allocated LDs:</strong> {currentlyAllocatedLdIds.size} / {maxLdCount}</p>
          <p><strong>Pending Allocation LDs:</strong> {allocations.filter(allocation => allocation > 0).length - currentlyAllocatedLdIds.size}</p>
        </div>
      </div>

      {/* Payload Preview */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Payload Preview:</h4>
        <pre className="text-sm text-gray-700 bg-white p-3 rounded overflow-x-auto">
          {JSON.stringify(buildAllocationPayload(portIndex, numberOfLds, startLdId, allocations), null, 2)}
        </pre>
      </div>
    </div>
  );
}