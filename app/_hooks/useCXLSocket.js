"use client";

import { useEffect, useState } from "react";

export const useCXLSocket = (socket) => {
  const [portData, setPortData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [vcsData, setVCSData] = useState([]);
  const [mldData, setMLDData] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const getDeviceData = () => {
      socket.emit("device:get", (data) => {
        if (JSON.stringify(deviceData) !== JSON.stringify(data["result"])) {
          setDeviceData(data["result"]);
        }
      });
    };
    const getPortData = () => {
      socket.emit("port:get", (data) => {
        if (JSON.stringify(portData) !== JSON.stringify(data["result"])) {
          setPortData(data["result"]);
        }
      });
    };
    const getVCSData = () => {
      socket.emit("vcs:get", (data) => {
        if (JSON.stringify(vcsData) !== JSON.stringify(data["result"])) {
          setVCSData(data["result"]);
        }
      });
    };
    getDeviceData();
    getPortData();
    getVCSData();
    socket.on("device:updated", () => getDeviceData());
    socket.on("port:updated", () => getPortData());
    socket.on("vcs:updated", () => getVCSData());
    return () => {
      socket.off("device:updated");
      socket.off("port:updated");
      socket.off("vcs:updated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    setMLDData([]);
    const mld = portData?.filter(
      (port) => port.connectedDeviceType.split("_").at(-1) === "MLD"
    );

    const getMLDAllocation = () => {
      mld?.forEach((m) => {
        socket.emit(
          "mld:getAllocation",
          {
            portIndex: m.portId,
            startLdId: 0,
            ldAllocationListLimit: 16,
          },
          (data) => {
            setMLDData((prev) => [
              ...prev,
              { ...data["result"], portId: m.portId },
            ]);
          }
        );
      });
    };
    getMLDAllocation();
  }, [portData]);

  return {
    portData,
    deviceData,
    vcsData,
    mldData,
  };
};
