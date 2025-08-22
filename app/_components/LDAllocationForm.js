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
  const [maxLdCount, setMaxLdCount] = useState(8);
  const [maxLdId, setMaxLdId] = useState(255);
  const [isLoadedFromExisting, setIsLoadedFromExisting] = useState(false);



  // Response and error state
  const [response, setResponse] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Set port index and load existing LD allocations from selected MLD data when component mounts or MLD data changes
  useEffect(() => {
    // Reset loaded state when MLD data changes
    setIsLoadedFromExisting(false);

    if (selectedMLDData && selectedMLDData.portId !== undefined) {
      setPortIndex(selectedMLDData.portId);

      // Load existing LD allocations if available
      if (selectedMLDData.logicalDevices) {
        const logicalDevices = selectedMLDData.logicalDevices;
        console.log('Loading LD data from selectedMLDData:', logicalDevices);

        // Set number of LDs
        if (logicalDevices.numberOfLds && logicalDevices.numberOfLds > 0) {
          setNumberOfLds(logicalDevices.numberOfLds);
          console.log('Set number of LDs to:', logicalDevices.numberOfLds);

          // Convert LD allocation list from KB to MB for display
          if (logicalDevices.ldAllocationList && logicalDevices.ldAllocationList.length > 0) {
            console.log('Original LD allocation list:', logicalDevices.ldAllocationList);
            console.log('Backend numberOfLds:', logicalDevices.numberOfLds);
            console.log('Backend startLdId:', logicalDevices.startLdId);

            // Handle both object format and flat array format
            let mbAllocations = [];
            if (Array.isArray(logicalDevices.ldAllocationList)) {
              // Flat array format - extract range1 values (even indices)
              for (let i = 0; i < logicalDevices.ldAllocationList.length; i += 2) {
                const range1Value = logicalDevices.ldAllocationList[i];
                if (typeof range1Value === 'number' && !isNaN(range1Value)) {
                  const mbValue = integerToMb(range1Value);
                  console.log(`Converting ${range1Value} KB to ${mbValue} MB`);
                  console.log(`  Using backend memory size: ${mbValue} MB`);
                  mbAllocations.push(mbValue);
                } else {
                  console.warn('Invalid range1 value:', range1Value);
                  mbAllocations.push(256);
                }
              }
            } else {
              // Object format - extract range1 from each object
              logicalDevices.ldAllocationList
                .slice(0, logicalDevices.numberOfLds)
                .forEach(allocation => {
                  if (!allocation || typeof allocation.range1 !== 'number') {
                    console.warn('Invalid allocation data:', allocation);
                    mbAllocations.push(256);
                  } else {
                    const mbValue = integerToMb(allocation.range1);
                    console.log(`Converting ${allocation.range1} KB to ${mbValue} MB`);
                    mbAllocations.push(mbValue);
                  }
                });
            }

            console.log('Converted MB allocations:', mbAllocations);
            console.log('Backend numberOfLds:', logicalDevices.numberOfLds);
            console.log('Allocations array length:', mbAllocations.length);

            // Ensure the allocations array length matches numberOfLds
            if (mbAllocations.length !== logicalDevices.numberOfLds) {
              console.warn(`Allocations array length (${mbAllocations.length}) doesn't match numberOfLds (${logicalDevices.numberOfLds})`);

              // If numberOfLds is less than allocations length, filter out zero allocations
              if (logicalDevices.numberOfLds < mbAllocations.length) {
                console.log(`Filtering allocations to match numberOfLds: ${logicalDevices.numberOfLds}`);
                // Keep only non-zero allocations up to numberOfLds
                const filteredAllocations = [];
                let nonZeroCount = 0;

                for (let i = 0; i < mbAllocations.length && nonZeroCount < logicalDevices.numberOfLds; i++) {
                  if (mbAllocations[i] > 0.001) {
                    filteredAllocations.push(mbAllocations[i]);
                    nonZeroCount++;
                  }
                }

                console.log(`Filtered allocations: ${filteredAllocations}`);
                mbAllocations = filteredAllocations;
              } else {
                // Pad with default values if needed
                while (mbAllocations.length < logicalDevices.numberOfLds) {
                  mbAllocations.push(256);
                }
                // Trim if too many
                if (mbAllocations.length > logicalDevices.numberOfLds) {
                  mbAllocations.splice(logicalDevices.numberOfLds);
                }
              }
            }

            setAllocations(mbAllocations);
            console.log('=== FORM INITIALIZATION COMPLETE ===');
            console.log('Final allocations set:', mbAllocations);
            setIsLoadedFromExisting(true);
          }
        }

        // Set start LD ID if available
        if (logicalDevices.startLdId !== undefined) {
          setStartLdId(logicalDevices.startLdId);
          console.log('Set start LD ID to:', logicalDevices.startLdId);
        }
      }

      // If no allocation data in selectedMLDData, try to fetch from backend
      if (!selectedMLDData.logicalDevices?.ldAllocationList && connected && socket) {
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
      startLdId: 0,
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
        // We need to extract only the range1 values (even indices)
        const mbAllocations = [];
        for (let i = 0; i < result.ldAllocationList.length; i += 2) {
          const range1Value = result.ldAllocationList[i];
          if (typeof range1Value === 'number' && !isNaN(range1Value)) {
            const mbValue = integerToMb(range1Value);
            console.log(`Converting ${range1Value} KB to ${mbValue} MB`);

            // Treat very small allocations (like 1 KB = 0.0009765625 MB) as deallocated
            // This handles the backend inconsistency where deallocated LDs still show 1 KB
            const effectiveMbValue = mbValue < 0.001 ? 0 : mbValue;
            console.log(`Effective MB value (after deallocation check): ${effectiveMbValue}`);

            mbAllocations.push(effectiveMbValue);
          } else {
            console.warn('Invalid range1 value from backend:', range1Value);
            mbAllocations.push(256); // Default value
          }
        }

        console.log('Converted MB allocations from backend:', mbAllocations);
        console.log('Final allocations to set:', mbAllocations);

        // Preserve the complete allocation structure including zeros for deallocation support
        // Only filter to effective allocations if this is the initial load (not after deallocation)
        const isInitialLoad = !isLoadedFromExisting;

        if (isInitialLoad) {
          // For initial load, filter to only active allocations
          const effectiveAllocations = mbAllocations.filter(allocation => allocation > 0.001);
          const effectiveNumberOfLds = effectiveAllocations.length;

          console.log(`Initial load - Effective allocations (non-zero): ${effectiveAllocations}`);
          console.log(`Initial load - Effective number of LDs: ${effectiveNumberOfLds}`);

          // Update the form state with only active allocations
          setNumberOfLds(effectiveNumberOfLds);
          setStartLdId(result.startLdId);
          setAllocations(effectiveAllocations);
          setIsLoadedFromExisting(true);
          console.log('=== FORM STATE UPDATED (INITIAL LOAD) ===');
        } else {
          // For subsequent loads (after deallocation), preserve the complete structure
          console.log(`Subsequent load - Preserving complete allocation structure: ${mbAllocations}`);
          console.log(`Subsequent load - Total number of LDs: ${mbAllocations.length}`);

          // Update the form state with the complete allocation structure
          setNumberOfLds(mbAllocations.length);
          setStartLdId(result.startLdId);
          setAllocations(mbAllocations);
          setIsLoadedFromExisting(true);
          console.log('=== FORM STATE UPDATED (SUBSEQUENT LOAD) ===');
        }
      } else {
        // No allocations found, clear the form
        console.log('=== NO ALLOCATIONS FOUND ===');
        console.log('No LD allocations found, clearing form');
        setNumberOfLds(0);
        setAllocations([]);
        setIsLoadedFromExisting(true);
        console.log('=== FORM CLEARED ===');
      }
    });
  };

  // Generate LD ID options
  const ldIdOptions = Array.from({ length: maxLdId + 1 }, (_, i) => i);

  // Calculate the minimum number of LDs based on currently allocated LDs
  const currentlyAllocatedLds = allocations.filter(allocation => allocation > 0.001).length;
  const minLdCount = Math.max(currentlyAllocatedLds, 0);

  // Generate LD count options starting from the minimum (currently allocated LDs)
  const ldCountOptions = Array.from({ length: maxLdCount + 1 }, (_, i) => i).filter(count => count >= minLdCount);

  // Handle number of LDs change
  const handleNumberOfLdsChange = (value) => {
    const newNumberOfLds = parseInt(value);
    console.log(`=== NUMBER OF LDS CHANGE DEBUG ===`);
    console.log(`Changing from ${numberOfLds} LDs to ${newNumberOfLds} LDs`);
    console.log(`Current allocations:`, allocations);

    setNumberOfLds(newNumberOfLds);

    // Adjust allocations array
    const newAllocations = [...allocations];
    if (newNumberOfLds > allocations.length) {
      // Add new allocations with default value
      for (let i = allocations.length; i < newNumberOfLds; i++) {
        newAllocations.push(256); // Default 256MB
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
    const parsedValue = parseFloat(value) || 0;
    console.log(`Parsed value: ${parsedValue}`);

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
    const validation = validateAllocations(numberOfLds, startLdId, allocations, maxLdCount, maxLdId);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Additional validation: prevent reducing LDs below currently allocated count
    const currentlyAllocatedLds = allocations.filter(allocation => allocation > 0.001).length;
    if (numberOfLds < currentlyAllocatedLds) {
      setValidationErrors([
        `Cannot reduce number of LDs to ${numberOfLds}. You have ${currentlyAllocatedLds} LDs currently allocated. ` +
        'Please deallocate LDs first before reducing the total count.'
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
      console.log('Original allocations:', allocations);

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
                  setIsLoadedFromExisting(true);
                } else if (isMixed || hasZeroAllocations) {
                  // For individual deallocation, keep the same number of LDs but update the values
                  setNumberOfLds(allocationsToSet.length);
                  setStartLdId(response.result.startLdId);
                  console.log(`=== SETTING ALLOCATIONS FROM INDIVIDUAL DEALLOCATION RESPONSE ===`);
                  console.log(`Allocations to set: ${allocationsToSet}`);
                  console.log(`Current allocations: ${allocations}`);
                  console.log(`Will set allocations to: ${allocationsToSet}`);
                  setAllocations(allocationsToSet);
                  setIsLoadedFromExisting(true);
                } else {
                  // For normal allocation, use filtered active allocations
                  setNumberOfLds(allocationsToSet.length);
                  setStartLdId(response.result.startLdId);
                  console.log(`=== SETTING ALLOCATIONS FROM NORMAL ALLOCATION RESPONSE ===`);
                  console.log(`Active allocations: ${allocationsToSet}`);
                  console.log(`Current allocations: ${allocations}`);
                  console.log(`Will set allocations to: ${allocationsToSet}`);
                  setAllocations(allocationsToSet);
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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">LD Allocation Manager</h2>
      </div>

      {/* Connection Status */}
      <div className={`mb-4 p-3 rounded ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        <span className="font-semibold">Connection Status:</span> {connected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
        {/* Basic Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Port Index
            </label>
            <input
              type="number"
              min="0"
              value={portIndex}
              onChange={(e) => setPortIndex(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={selectedMLDData !== null} // Disable if MLD data is provided
            />
            {selectedMLDData && (
              <p className="text-sm text-gray-500 mt-1">
                Auto-populated from selected MLD device
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of LDs
              {currentlyAllocatedLds > 0 && (
                <span className="text-orange-600 ml-2">
                  (Minimum: {currentlyAllocatedLds} - you have {currentlyAllocatedLds} LDs allocated)
                </span>
              )}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start LD ID
            </label>
            <select
              value={startLdId}
              onChange={(e) => setStartLdId(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ldIdOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Allocation Inputs */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Memory Allocations
            {isLoadedFromExisting && (
              <span className="text-sm font-normal text-green-600 ml-2">
                (Loaded from existing configuration)
              </span>
            )}
          </h3>
          {numberOfLds === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium mb-2">No LDs configured</p>
              <p className="text-sm">Select a number of LDs above to start configuring memory allocations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allocations.map((allocation, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      LD #{startLdId + index} (MB)
                      {isLoadedFromExisting && (
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          - Current allocation
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAllocationChange(index, "0")}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                      title="Deallocate this LD (set to 0 MB)"
                    >
                      Deallocate
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={allocation}
                    onChange={(e) => handleAllocationChange(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter MB value"
                  />
                </div>
              ))}
            </div>
          )}
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
          {numberOfLds > 0 && (
            <button
              type="button"
              onClick={() => {
                // Set all allocations to 0 MB instead of clearing the array
                const zeroAllocations = new Array(numberOfLds).fill(0);
                setAllocations(zeroAllocations);
              }}
              className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Deallocate All
            </button>
          )}
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
            className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Capacity Warning */}
      {(() => {
        const totalCapacity = selectedMLDData?.ldInfo?.totalDeviceCapacity || 4096; // Default 4GB
        const allocatedMemory = allocations.reduce((sum, allocation) => sum + allocation, 0);
        const remainingMemory = totalCapacity - allocatedMemory;
        const isLowCapacity = remainingMemory < 1024; // Warning if less than 1GB remaining

        if (isLowCapacity) {
          return (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Low Memory Capacity Warning</h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p><strong>Total Capacity:</strong> {totalCapacity} MB</p>
                <p><strong>Currently Allocated:</strong> {allocatedMemory} MB</p>
                <p><strong>Remaining:</strong> {remainingMemory.toFixed(1)} MB</p>
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
            return `${remainingMemory.toFixed(1)} MB`;
          })()}</p>
          <p><strong>Allocated LDs:</strong> {allocations.filter(allocation => allocation > 0).length} / {numberOfLds}</p>
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