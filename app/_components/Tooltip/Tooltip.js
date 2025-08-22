import ReactDOM from "react-dom";

const DeviceTooltip = ({ isOpen, node }) => {
  if (!isOpen) return;

  const tooltipContainer = document.querySelector(`[data-id="${node.id}"]`);

  // Check if the container exists before trying to get its bounds
  if (!tooltipContainer) {
    console.warn(`Tooltip container not found for node ID: ${node.id}`);
    return null;
  }

  const rect = tooltipContainer.getBoundingClientRect();

  // Check if node data exists
  if (!node.data) {
    console.warn(`Node data not found for node ID: ${node.id}`);
    return null;
  }

  // Debug logging for MLD data
  if (node.data.deviceType === "MLD") {
    console.log('MLD tooltip data:', node.data);
    console.log('MLD logical devices data:', node.data.logicalDevices);
    console.log('MLD LD info data:', node.data.ldInfo);
    console.log('MLD LD info type:', typeof node.data.ldInfo);
    console.log('MLD LD info keys:', node.data.ldInfo ? Object.keys(node.data.ldInfo) : 'null');

    // Try to find memory size in the data
    const memorySize = node.data.ldInfo?.totalCapacity ||
                      node.data.logicalDevices?.memorySize ||
                      node.data.logicalDevices?.totalCapacity ||
                      node.data.memorySize ||
                      'Unknown';
    console.log('Memory size found:', memorySize);
    console.log('LD info totalCapacity:', node.data.ldInfo?.totalCapacity);
  }

  return ReactDOM.createPortal(
    <div className="relative pointer-events-none">
      {node.data.deviceType === "SLD" ? (
        <div
          style={{
            position: "fixed",
            top: `${rect.top + 78}px`,
            left: `${rect.right - 155}px`,
          }}
        >
          <div className="absolute w-0 h-0 -top-9 left-1/2 transform -translate-x-1/2 border-[20px] border-solid border-t-transparent border-x-transparent border-b-black rounded-lg"></div>
          <div className="w-[196px] text-left p-6 z-4 rounded-lg text-white text-sm bg-black flex flex-col gap-6">
            <p className="font-bold">Single Logical Device</p>
            <p className="font-regular">
              Port ID <br /> {node.data.portId}
            </p>
          </div>
        </div>
      ) : node.data.deviceType === "MLD" ? (
        <div
          style={{
            position: "fixed",
            top: `${rect.top + 92}px`,
            left: `${rect.left - 220}px`,
          }}
        >
          <div className="absolute w-0 h-0 -right-9 top-1/2 transform -translate-y-1/2 border-[20px] border-solid border-r-transparent border-y-transparent border-l-black rounded-lg"></div>
          <div className="w-[196px] text-left p-6 z-4 rounded-lg text-white text-sm bg-black flex flex-col gap-6">
            <p className="font-bold">Multi Logical Device</p>
            <p className="font-regular">
              Total Capacity <br /> {(() => {
                const totalCapacity = node.data.ldInfo?.totalDeviceCapacity ||
                                    node.data.ldInfo?.totalCapacity ||
                                    node.data.ldInfo?.capacity ||
                                    node.data.ldInfo?.totalMemory ||
                                    node.data.ldInfo?.memory ||
                                    node.data.logicalDevices?.memorySize ||
                                    node.data.logicalDevices?.totalCapacity ||
                                    node.data.memorySize ||
                                    'Unknown';

                if (totalCapacity === 'Unknown') {
                  return 'Unknown';
                }

                // Convert to appropriate unit (MB or GB)
                if (totalCapacity >= 1024) {
                  return `${(totalCapacity / 1024).toFixed(1)} GB`;
                } else {
                  return `${totalCapacity} MB`;
                }
              })()}
            </p>

            <p className="font-regular">
              Total LDs Supported <br /> {node.data.ldInfo?.maxLds || 16}
            </p>
            <p className="font-regular">
              LDs Currently Allocated <br /> {node.data.logicalDevices?.boundLdId?.length || 0}
            </p>
            {node.data.ldInfo?.ldSize && (
              <p className="font-regular">
                LD Size <br /> {node.data.ldInfo.ldSize} MB
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "fixed",
            top: `${rect.top - 82}px`,
            left: `${rect.left - 215}px`,
          }}
        >
          <div className="absolute w-0 h-0 -right-9 top-1/2 transform -translate-y-1/2 border-[20px] border-solid border-r-transparent border-y-transparent border-l-black rounded-lg"></div>
          <div className="w-[196px] text-left p-6 z-4 rounded-lg text-white text-sm bg-black flex flex-col gap-6">
            <p className="font-bold">Logical Device</p>
            <p className="font-regular">
              LD ID <br /> {node.data.ldId}
            </p>
            <p className="font-regular">
              Size <br />{" "}
              {(() => {
                // Get the actual memory size from the LD allocation data
                if (node.data.mld && node.data.mld.logicalDevices && node.data.mld.logicalDevices.ldAllocationList) {
                  const ldAllocationList = node.data.mld.logicalDevices.ldAllocationList;
                  const ldId = node.data.ldId;

                  // Handle flat array format [range1, range2, range1, range2, ...]
                  if (Array.isArray(ldAllocationList) && typeof ldAllocationList[0] === 'number') {
                    const range1Index = ldId * 2;
                    const range1Value = ldAllocationList[range1Index];
                    if (typeof range1Value === 'number' && !isNaN(range1Value)) {
                      // Convert KB to MB
                      const mbValue = range1Value / 1024;
                      return `${mbValue} MB`;
                    }
                  }
                }

                // Fallback to 256 MB if data is not available
                return "256 MB";
              })()}
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default DeviceTooltip;
