"use client";

import { useEffect, useState } from "react";

export const useCXLSocket = (socket) => {
  const [portData, setPortData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [vcsData, setVCSData] = useState([]);
  const [mldData, setMLDData] = useState([]);
  const [ldInfoData, setLDInfoData] = useState({});

  const refreshMLDData = () => {
    if (!socket || !portData) return;

    const mld = portData.filter(
      (port) => port.connectedDeviceType.split("_").at(-1) === "MLD"
    );

    if (mld && mld.length > 0) {
      console.log('Manually refreshing MLD data for ports:', mld.map(m => m.portId));
      const newMLDData = [];
      let pendingRequests = mld.length;

      mld.forEach((m) => {
        socket.emit(
          "mld:getAllocation",
          {
            portIndex: m.portId,
            startLdId: 0,
            ldAllocationListLimit: 16,
          },
          (data) => {
            console.log('Got MLD data for port', m.portId, ':', data);
            newMLDData.push({ ...data["result"], portId: m.portId });
            pendingRequests--;

            // When all requests are complete, update the state
            if (pendingRequests === 0) {
              console.log('All MLD data received, updating state:', newMLDData);
              setMLDData(newMLDData);
            }
          }
        );
      });
    }
  };

  useEffect(() => {
    if (!socket) {
      console.log("❌ No socket available for data requests");
      return;
    }

    console.log("🔌 Socket available, making data requests...");

    const getDeviceData = () => {
      console.log("📡 Requesting device data...");
      socket.emit("device:get", (data) => {
        console.log("📥 Device data response:", data);
        if (JSON.stringify(deviceData) !== JSON.stringify(data["result"])) {
          console.log("✅ Device data updated");
          setDeviceData(data["result"]);
        } else {
          console.log("⏭️ Device data unchanged");
        }
      });
    };
    const getPortData = () => {
      console.log("📡 Requesting port data...");
      socket.emit("port:get", (data) => {
        console.log("📥 Port data response:", data);
        if (JSON.stringify(portData) !== JSON.stringify(data["result"])) {
          console.log("✅ Port data updated");
          setPortData(data["result"]);
        } else {
          console.log("⏭️ Port data unchanged");
        }
      });
    };
    const getVCSData = () => {
      console.log("📡 Requesting VCS data...");
      socket.emit("vcs:get", (data) => {
        console.log("📥 VCS data response:", data);
        if (JSON.stringify(vcsData) !== JSON.stringify(data["result"])) {
          console.log("✅ VCS data updated");
          setVCSData(data["result"]);
        } else {
          console.log("⏭️ VCS data unchanged");
        }
      });
    };

    const getLDInfoData = () => {
      console.log("📡 Requesting LD info data...");
      // Try the primary command first
      console.log("📡 Emitting mld:getLdInfo command...");
      const startTime = Date.now();
      socket.emit("mld:getLdInfo", {}, (data) => {
        const responseTime = Date.now() - startTime;
        console.log(`📥 LD info data response received after ${responseTime}ms:`, data);
        console.log("📥 LD info data result:", data?.result);
        console.log("📥 LD info data type:", typeof data?.result);
        console.log("📥 LD info data stringified:", JSON.stringify(data?.result, null, 2));

        if (data && data.result) {
          console.log("✅ LD info data updated");
          console.log("✅ LD info data keys:", Object.keys(data.result));
          console.log("✅ LD info data values:", data.result);
          setLDInfoData(data.result);
        } else {
          console.log("⏭️ LD info data unchanged or empty");
          console.log("⏭️ Setting empty LD info data");
          setLDInfoData({});
        }
      });

      // Add a timeout to check if the callback is never called
      setTimeout(() => {
        console.log("⏰ LD info command timeout - callback not received within 5 seconds");
      }, 5000);

            // Also try alternative command names if the first one doesn't work
      setTimeout(() => {
        console.log("📡 Trying alternative LD info command: mld:getInfo");
        socket.emit("mld:getInfo", {}, (data) => {
          console.log("📥 Alternative LD info response:", data);
          if (data && data.result && Object.keys(data.result).length > 0) {
            console.log("✅ Alternative LD info data found");
            setLDInfoData(data.result);
          }
        });
      }, 1000);

      // Try more alternative commands
      setTimeout(() => {
        console.log("📡 Trying alternative command: mld:getCapacity");
        socket.emit("mld:getCapacity", {}, (data) => {
          console.log("📥 Capacity command response:", data);
          if (data && data.result) {
            console.log("✅ Capacity data found");
            setLDInfoData(data.result);
          }
        });
      }, 2000);

      setTimeout(() => {
        console.log("📡 Trying alternative command: mld:getMemoryInfo");
        socket.emit("mld:getMemoryInfo", {}, (data) => {
          console.log("📥 Memory info command response:", data);
          if (data && data.result) {
            console.log("✅ Memory info data found");
            setLDInfoData(data.result);
          }
        });
      }, 3000);
    };

    getDeviceData();
    getPortData();
    getVCSData();
    getLDInfoData();
    socket.on("device:updated", () => {
      console.log("🔄 Device data update event received");
      getDeviceData();
    });
    socket.on("port:updated", () => {
      console.log("🔄 Port data update event received");
      getPortData();
    });
    socket.on("vcs:updated", () => {
      console.log("🔄 VCS data update event received");
      getVCSData();
    });

    socket.on("mld:updated", () => {
      console.log("🔄 MLD data update event received");
      getLDInfoData();
    });

    // Listen for MLD allocation updates
    socket.on("mld:updated", () => {
      console.log("🔄 MLD data updated, refreshing...");
      // Refresh port data which will trigger MLD data refresh
      getPortData();
    });

    return () => {
      console.log("🧹 Cleaning up socket event listeners");
      socket.off("device:updated");
      socket.off("port:updated");
      socket.off("vcs:updated");
      socket.off("mld:updated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const mld = portData?.filter(
      (port) => port.connectedDeviceType.split("_").at(-1) === "MLD"
    );

    if (mld && mld.length > 0) {
      // Clear existing MLD data before fetching new data
      setMLDData([]);

      const newMLDData = [];
      let pendingRequests = mld.length;

      mld.forEach((m) => {
        socket.emit(
          "mld:getAllocation",
          {
            portIndex: m.portId,
            startLdId: 0,
            ldAllocationListLimit: 16,
          },
          (data) => {
            newMLDData.push({ ...data["result"], portId: m.portId });
            pendingRequests--;

            // When all requests are complete, update the state
            if (pendingRequests === 0) {
              setMLDData(newMLDData);
            }
          }
        );
      });
    } else {
      // No MLD ports found, clear the data
      setMLDData([]);
    }
  }, [portData, socket]);

  return {
    portData,
    deviceData,
    vcsData,
    mldData,
    ldInfoData,
    refreshMLDData,
  };
};
