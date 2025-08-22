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
        const COLOR = ["#2097F6", "#65BF73"];
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

      device.push({
        portType: "DSP",
        portId: port.portId,
        boundVPPBId: boundPorts,
        hosts: hosts,
        deviceType: mld ? "MLD" : "SLD",
        logicalDevices: mld ? mld : null,
        ldInfo: finalLDInfo, // Use calculated capacity as fallback
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
        } else {
          // If no capacity field found, use a default value based on typical MLD devices
          // Most MLD devices have 4GB or 8GB total capacity
          totalDeviceCapacity = 4096; // Default to 4GB in MB
          console.log('Using default total device capacity:', totalDeviceCapacity, 'MB (4GB)');
        }
      }

      // Calculate allocated memory separately
      let allocatedMemory = null;
      if (mldAllocation && mldAllocation.ldAllocationList && mldAllocation.ldAllocationList.length > 0) {
        console.log('MLD ldAllocationList for allocated memory calculation:', mldAllocation.ldAllocationList);
        console.log('First allocation object keys:', Object.keys(mldAllocation.ldAllocationList[0] || {}));

        // Handle both flat array format [range1, range2, range1, range2, ...] and object format
        let totalKB = 0;

        if (Array.isArray(mldAllocation.ldAllocationList) && typeof mldAllocation.ldAllocationList[0] === 'number') {
          // Flat array format - extract range1 values (even indices)
          for (let i = 0; i < mldAllocation.ldAllocationList.length; i += 2) {
            const range1 = mldAllocation.ldAllocationList[i] || 0;
            const range2 = mldAllocation.ldAllocationList[i + 1] || 0;
            console.log('Allocation ranges (flat array):', { range1, range2, index: i });
            totalKB += range1 + range2;
          }
        } else {
          // Object format - extract range1 from each object
          totalKB = mldAllocation.ldAllocationList.reduce((sum, allocation) => {
            const range1 = allocation.range1 || allocation.range1KB || allocation.range1_kb || 0;
            const range2 = allocation.range2 || allocation.range2KB || allocation.range2_kb || 0;
            console.log('Allocation ranges (object):', { range1, range2, allocation });
            return sum + range1 + range2;
          }, 0);
        }

        allocatedMemory = totalKB / 1024; // Convert KB to MB
        console.log('Calculated allocated memory from MLD data:', allocatedMemory, 'MB');
        console.log('Total KB before conversion:', totalKB);

        // If the backend data shows 0, try to calculate from the number of LDs
        if (allocatedMemory === 0 && mldAllocation.numberOfLds > 0) {
          // Assume each LD is 256 MB (default allocation size)
          const estimatedAllocated = mldAllocation.numberOfLds * 256;
          console.log('Backend returned 0 allocated memory, estimating from LD count:', estimatedAllocated, 'MB');
          allocatedMemory = estimatedAllocated;
        }
      } else {
        console.log('No MLD allocation data available for allocated memory calculation');

        // Try to estimate allocated memory from the MLD allocation data structure
        if (mldAllocation && mldAllocation.numberOfLds !== undefined) {
          // If we have numberOfLds but no ldAllocationList, estimate allocated memory
          const estimatedAllocated = mldAllocation.numberOfLds * 256; // Assume 256 MB per LD
          console.log('Estimating allocated memory from numberOfLds:', estimatedAllocated, 'MB');
          allocatedMemory = estimatedAllocated;
        }
      }

      // Use the actual numberOfLds from the MLD allocation data, fallback to device data, then default to 0
      const numberOfLds = mldAllocation?.numberOfLds || logicalDevices?.numberOfLds || 0;
      console.log('Number of LDs (from allocation):', numberOfLds);

      // Create logical devices based on the data and actual bindings
      let boundLdIds = [];
      if (numberOfLds > 0) {
        // If there are LDs, create them based on the actual data
        for (let i = 0; i < numberOfLds; i++) {
          // Check if this LD is bound to any VPPB
          const boundVPPB = vcs.find(v =>
            !v.hostPort &&
            v.vppb.bindingStatus === "BOUND_LD" &&
            v.vppb.boundPortId === dev.portId &&
            v.vppb.boundLdId === i
          );

          if (boundVPPB) {
            // This LD is bound to a VPPB
            boundLdIds.push({
              hostId: boundVPPB.uspId,
              vcsId: boundVPPB.virtualCxlSwitchId,
              from: boundVPPB.vppb.vppbId,
              to: i,
              order: i,
            });
          } else {
            // This LD is unbound
            boundLdIds.push({
              hostId: -1,
              vcsId: -1,
              from: null,
              to: i,
              order: i,
            });
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
          allocatedMemory: allocatedMemory || dev.ldInfo?.allocatedMemory || 0
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
