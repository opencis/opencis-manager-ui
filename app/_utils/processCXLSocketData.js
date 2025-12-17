export const processCXLSocketData = ({
  portData,
  vcsData,
  deviceData,
  mldData,
  ldInfoData = {},
  isConnected = false,
}) => {
  console.log('Processing CXL Socket Data:', {
    portData: portData?.length,
    vcsData: vcsData?.length,
    deviceData: deviceData?.length,
    mldData: mldData?.length
  });

  console.log('Device data details:', deviceData);
  console.log('Port data details:', portData);
  console.log('MLD data details:', mldData);
  console.log('LD Info data details:', ldInfoData);
  console.log('LD Info data type:', typeof ldInfoData);
  console.log('LD Info data keys:', Object.keys(ldInfoData || {}));

  const host = [];
  const vcs = [];
  const device = [];
  const ppb = [];

  let hostColorIndex = 0;
  portData?.forEach((port) => {
    console.log('Processing port:', port);
    if (port.currentPortConfigurationState === "USP") {
      if (port.ltssmState === "L0") {
        const COLOR = ["#8B7D9A", "#5A8A5A"]; // Changed first color from #366C9A to #8B7D9A (muted purple)
        host.push({
          portType: "USP",
          portId: port.portId,
          backgroundColor: COLOR[hostColorIndex],
        });
        vcs.push({
          uspId: port.portId,
          hostPort: true,
          vppb: {
            bindingStatus: null,
            boundLdId: null,
            boundPortId: port.portId,
            vppbId: null,
          },
        });
        hostColorIndex++;
      }
    }
  });

  vcsData?.forEach((data) => {
    console.log('Processing VCS data:', data);
    data.vppbs.forEach((vppb) => {
      // Use the actual binding status from the backend
      vcs.push({
        virtualCxlSwitchId: data.virtualCxlSwitchId,
        uspId: data.uspId,
        vppb: {
          ...vppb,
          hostId: data.uspId,
          // Keep the actual binding status and boundPortId from the backend
          bindingStatus: vppb.bindingStatus,
          boundPortId: vppb.boundPortId
        },
      });
    });
  });

  // Create devices from ports that have connected devices
  const devicesFromPorts = [];
  portData?.forEach((port) => {
    if (port.currentPortConfigurationState === "DSP" &&
        port.connectedDeviceType !== "NO_DEVICE_DETECTED" &&
        port.ltssmState === "L0") {
      devicesFromPorts.push({
        boundPortId: port.portId,
        deviceType: port.connectedDeviceType
      });
    }
  });

  console.log('Devices created from ports:', devicesFromPorts);

  // Use devicesFromPorts instead of deviceData
  const devicesToProcess = devicesFromPorts.length > 0 ? devicesFromPorts : deviceData;
  console.log('Devices to process:', devicesToProcess);

  devicesToProcess.forEach((dev) => {
    console.log('Processing device:', dev);
    const mld = mldData.find((m) => m.portId === dev.boundPortId);
    console.log('Found MLD for device port', dev.boundPortId, ':', mld);
    if (mld) {
      console.log('MLD allocation data:', {
        portId: mld.portId,
        numberOfLds: mld.numberOfLds,
        ldAllocationList: mld.ldAllocationList
      });
    }
    let hosts = [];
    let boundPorts = [];

    // Check for bound VPPBs to this device
    vcs.forEach((v) => {
      if (!v.hostPort) {
        if (v.vppb.bindingStatus === "BOUND_LD" && v.vppb.boundPortId === dev.boundPortId) {
          // This VPPB is bound to this device
          const relatedHost = host.find((h) => h.portId === v.uspId);
          hosts.push({
            hostId: v.uspId,
            color: relatedHost?.backgroundColor,
            vppbId: v.vppb.vppbId,
            virtualCxlSwitchId: v.virtualCxlSwitchId,
          });
          boundPorts.push(v.vppb.vppbId);
        } else {
          // This VPPB is unbound
          hosts.push({
            hostId: -1,
            color: "#D9D9D9",
            vppId: v.vppb.vppbId,
            virtualCxlSwitchId: v.virtualCxlSwitchId,
            uspId: v.uspId,
          });
        }
      }
    });

    const port = portData?.find((p) => p.portId === dev.boundPortId);
    console.log('Found port for device:', port);
    console.log('Port ltssmState:', port?.ltssmState);

    if (port && port.ltssmState === "L0") {
      console.log('Creating device for port:', port.portId);
      // Check if we have LD info data for this port
      let deviceLDInfo = null;
      if (ldInfoData && typeof ldInfoData === 'object') {
        // The LD info might be indexed by port ID or might be a single object
        deviceLDInfo = ldInfoData[port.portId] || ldInfoData;
        console.log('LD Info for port', port.portId, ':', deviceLDInfo);
        console.log('LD Info data type:', typeof deviceLDInfo);
        console.log('LD Info keys:', deviceLDInfo ? Object.keys(deviceLDInfo) : 'null');
      }

      // Process LD info data to convert memory size from bytes to MB
      let finalLDInfo = null;
      if (deviceLDInfo) {
        let totalCapacity = null;

        // Check if we have memorySize in bytes
        if (deviceLDInfo.memorySize) {
          totalCapacity = deviceLDInfo.memorySize / (1024 * 1024); // Convert bytes to MB
          console.log('Converting memorySize from bytes to MB:', deviceLDInfo.memorySize, 'bytes =', totalCapacity, 'MB');
        }

        finalLDInfo = {
          ...deviceLDInfo,
          totalCapacity: totalCapacity
        };
      }

      console.log('Final LD info being set on device:', finalLDInfo);
      console.log('Final LD info totalCapacity:', finalLDInfo?.totalCapacity);

      // Get supportedLdCount from port data with fallback to 16
      const supportedLdCount = port.supportedLdCount || 16;
      console.log('Supported LD count for port', port.portId, ':', supportedLdCount);

      device.push({
        portType: "DSP",
        portId: port.portId,
        boundVPPBId: boundPorts,
        hosts: hosts,
        deviceType: mld ? "MLD" : "SLD",
        logicalDevices: mld ? mld : null,
        ldInfo: finalLDInfo, // Use calculated capacity as fallback
        supportedLdCount: supportedLdCount, // Add supported LD count
      });
      ppb.push({
        portType: "DSP",
        portId: port.portId,
        boundVPPBId: boundPorts,
        deviceType: mld ? "MLD" : "SLD",
      });
      console.log('Device and PPB created for port:', port.portId);
    } else {
      console.log('Port not in L0 state or not found, pushing null');
      device.push(null);
      ppb.push(null);
    }
  });

  device.forEach((dev, index) => {
    if (dev?.deviceType === "MLD") {
      const { logicalDevices } = dev;
      console.log('Processing MLD device:', dev);
      console.log('Logical devices data:', logicalDevices);

      // Get the actual MLD allocation data for this device
      const mldAllocation = mldData.find((m) => m.portId === dev.portId);
      console.log('MLD allocation data for device:', mldAllocation);
      console.log('MLD allocation data keys:', mldAllocation ? Object.keys(mldAllocation) : 'null');
      console.log('MLD allocation data stringified:', JSON.stringify(mldAllocation, null, 2));

      // Debug capacity information
      console.log('=== CAPACITY DEBUG ===');
      console.log('totalCapacity field:', mldAllocation?.totalCapacity);
      console.log('maxCapacity field:', mldAllocation?.maxCapacity);
      console.log('deviceCapacity field:', mldAllocation?.deviceCapacity);
      console.log('remainingCapacity field:', mldAllocation?.remainingCapacity);
      console.log('usedCapacity field:', mldAllocation?.usedCapacity);
      console.log('=== END CAPACITY DEBUG ===');

      // Calculate total device capacity (not allocated memory)
      let totalDeviceCapacity = null;

      // Try to get total capacity from MLD allocation data
      if (mldAllocation) {
        // Check if there's a total capacity field in the MLD data
        if (mldAllocation.totalCapacity) {
          totalDeviceCapacity = mldAllocation.totalCapacity / (1024 * 1024); // Convert bytes to MB
          console.log('Total device capacity from MLD data:', totalDeviceCapacity, 'MB');
        } else if (mldAllocation.maxCapacity) {
          totalDeviceCapacity = mldAllocation.maxCapacity / (1024 * 1024); // Convert bytes to MB
          console.log('Total device capacity from maxCapacity:', totalDeviceCapacity, 'MB');
        } else if (mldAllocation.deviceCapacity) {
          totalDeviceCapacity = mldAllocation.deviceCapacity / (1024 * 1024); // Convert bytes to MB
          console.log('Total device capacity from deviceCapacity:', totalDeviceCapacity, 'MB');
        } else if (mldAllocation.remainingCapacity !== undefined && mldAllocation.usedCapacity !== undefined) {
          // Calculate total from remaining + used capacity
          const totalBytes = mldAllocation.remainingCapacity + mldAllocation.usedCapacity;
          totalDeviceCapacity = totalBytes / (1024 * 1024); // Convert bytes to MB
          console.log('Total device capacity calculated from remaining + used:', totalDeviceCapacity, 'MB');
        } else {
          // If no capacity field found, use a default value based on typical MLD devices
          // Most MLD devices have 4GB or 8GB total capacity
          totalDeviceCapacity = 4096; // Default to 4GB in MB
          console.log('Using default total device capacity:', totalDeviceCapacity, 'MB (4GB)');
          console.warn('Backend should provide capacity information for accurate tracking');
        }
      }

      // Calculate allocated memory from backend capacity fields
      let allocatedMemory = null;
      if (mldAllocation) {
        // Use deviceCapacity field from backend (already in bytes)
        if (mldAllocation.deviceCapacity !== undefined) {
          allocatedMemory = mldAllocation.deviceCapacity / (1024 * 1024); // Convert bytes to MB
          console.log('Allocated memory from deviceCapacity:', allocatedMemory, 'MB');
        } else if (mldAllocation.ldAllocationList && mldAllocation.ldAllocationList.length > 0) {
          // Fallback: Calculate from allocation list
          console.log('MLD ldAllocationList for allocated memory calculation:', mldAllocation.ldAllocationList);

          // Handle allocation multipliers where each unit = 256 MB
          let totalMB = 0;

          if (Array.isArray(mldAllocation.ldAllocationList) && typeof mldAllocation.ldAllocationList[0] === 'number') {
            // Flat array format [range1, range2, range1, range2, ...]
            for (let i = 0; i < mldAllocation.ldAllocationList.length; i += 2) {
              const range1 = mldAllocation.ldAllocationList[i] || 0;
              console.log('Allocation multiplier:', { range1, index: i/2 });
              totalMB += range1 * 256; // Each unit = 256 MB
            }
          } else {
            // Object format (fallback)
            totalMB = mldAllocation.ldAllocationList.reduce((sum, allocation) => {
              const range1 = allocation.range1 || 0;
              return sum + (range1 * 256);
            }, 0);
          }

          allocatedMemory = totalMB;
          console.log('Calculated allocated memory from allocation list:', allocatedMemory, 'MB');
        } else {
          console.log('No allocation data available for allocated memory calculation');
        }
      }

      // Use the actual numberOfLds from the MLD allocation data, fallback to device data, then default to 0
      const numberOfLds = mldAllocation?.numberOfLds || logicalDevices?.numberOfLds || 0;
      console.log('=== LD ALLOCATION DEBUG ===');
      console.log('mldAllocation:', mldAllocation);
      console.log('logicalDevices:', logicalDevices);
      console.log('Number of LDs (from allocation):', numberOfLds);
      console.log('LD Info (ldCount):', dev.ldInfo?.ldCount);
      console.log('Total supported LDs should be:', dev.ldInfo?.ldCount || 16);

      // Create logical devices based on the allocation list
      // Only create LD slots for LDs where range1 = 1 (allocated)
      let boundLdIds = [];

      if (mldAllocation?.ldAllocationList && Array.isArray(mldAllocation.ldAllocationList)) {
        console.log('Processing allocation list:', mldAllocation.ldAllocationList);

        // Process the allocation list in pairs (range1, range2 for each LD)
        for (let i = 0; i < mldAllocation.ldAllocationList.length; i += 2) {
          const range1 = mldAllocation.ldAllocationList[i];
          const range2 = mldAllocation.ldAllocationList[i + 1] || 0;

          const ldIndex = i / 2; // LD index (0, 1, 2, ...)

          console.log(`LD ${ldIndex}: range1=${range1}, range2=${range2}`);

          // Create LD slot if range1 = 1 (allocated) OR if there's any memory allocated
          if (range1 === 1 || range1 > 0) {
            console.log(`LD ${ldIndex} is allocated, creating slot`);

            // Check if this LD is bound to any VPPB
            const boundVPPB = vcs.find(v =>
              !v.hostPort &&
              v.vppb.bindingStatus === "BOUND_LD" &&
              v.vppb.boundPortId === dev.portId &&
              v.vppb.boundLdId === ldIndex
            );

            if (boundVPPB) {
              // This LD is bound to a VPPB
              boundLdIds.push({
                hostId: boundVPPB.uspId,
                vcsId: boundVPPB.virtualCxlSwitchId,
                from: boundVPPB.vppb.vppbId,
                to: ldIndex,
                order: ldIndex,
              });
            } else {
              // This LD is unbound but allocated
              boundLdIds.push({
                hostId: -1,
                vcsId: -1,
                from: null,
                to: ldIndex,
                order: ldIndex,
              });
            }
          } else {
            console.log(`LD ${ldIndex} is deallocated (range1=${range1}), skipping`);
          }
        }
      }

      boundLdIds.sort((a, b) => a.to - b.to);
      console.log('Created boundLdIds:', boundLdIds);

      device[index] = {
        ...dev,
        logicalDevices: {
          ...dev.logicalDevices,
          numberOfLds: numberOfLds,
          boundLdId: boundLdIds,
        },
        ldInfo: {
          ...dev.ldInfo,
          totalDeviceCapacity: totalDeviceCapacity || dev.ldInfo?.totalDeviceCapacity || 4096, // Default to 4GB
          allocatedMemory: allocatedMemory || dev.ldInfo?.allocatedMemory || 0,
          // Add the raw capacity fields from backend for reference
          totalCapacity: mldAllocation?.totalCapacity,
          deviceCapacity: mldAllocation?.deviceCapacity,
          remainingCapacity: mldAllocation?.remainingCapacity
        },
      };
              console.log('Updated device:', device[index]);
        console.log('Updated device ldInfo:', device[index].ldInfo);
        console.log('Updated device ldInfo totalCapacity:', device[index].ldInfo?.totalCapacity);
    }
  });

  // If no real data is available and backend is connected, create some test data for demonstration
  if (host.length === 0 && vcs.length === 0 && device.length === 0 && ppb.length === 0 && isConnected) {
    console.log('No real data available but backend is connected, creating test data for demonstration');

    // Create test host
    host.push({
      portType: "USP",
      portId: 0,
      backgroundColor: "#2097F6",
    });

    // Create test VCS
    vcs.push({
      uspId: 0,
      hostPort: true,
      vppb: {
        bindingStatus: null,
        boundLdId: null,
        boundPortId: 0,
        vppbId: null,
      },
    });

    // Create test VPPB
    vcs.push({
      virtualCxlSwitchId: 0,
      uspId: 0,
      vppb: {
        bindingStatus: "UNBOUND",
        boundLdId: null,
        boundPortId: null,
        vppbId: 0,
      },
    });

    // Create test MLD device with 0 LDs initially
    const testMLD = {
      portType: "DSP",
      portId: 1,
      boundVPPBId: [],
      hosts: [{
        hostId: -1,
        color: "#D9D9D9",
        vppId: 0,
        virtualCxlSwitchId: 0,
        uspId: 0,
      }],
      deviceType: "MLD",
      logicalDevices: {
        portId: 1,
        numberOfLds: 0,
        boundLdId: [],
      },
    };

    device.push(testMLD);
    ppb.push({
      portType: "DSP",
      portId: 1,
      boundVPPBId: [],
      deviceType: "MLD",
    });
  } else if (host.length === 0 && vcs.length === 0 && device.length === 0 && ppb.length === 0 && !isConnected) {
    console.log('No real data available and backend is not connected, returning empty data');
  }

  console.log('Processed data result:', {
    host: host.length,
    vcs: vcs.length,
    device: device.length,
    ppb: ppb.length
  });

  return {
    host,
    vcs,
    device,
    ppb,
  };
};
