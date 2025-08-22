"use client";

import { ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import Dialog from "./_components/Dialog/Dialog";
import DeviceTooltip from "./_components/Tooltip/Tooltip";
import LDAllocationForm from "./_components/LDAllocationForm";

import { useSocket } from "./_components/providers/socket-provider";
import { useCXLSocket } from "./_hooks/useCXLSocket";
import { processCXLSocketData } from "./_utils/processCXLSocketData";
import { processInitialEdges } from "./_utils/processInitialEdges";
import { processInitialNodes } from "./_utils/processInitialNodes";

import "./style.css";

export default function Overview() {
  const { socket, connected } = useSocket();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);

  // MLD Modal state
  const [isMLDModalOpen, setIsMLDModalOpen] = useState(false);
  const [selectedMLDData, setSelectedMLDData] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { portData, deviceData, vcsData, mldData, ldInfoData, refreshMLDData } = useCXLSocket(socket);
  const { host, vcs, device, ppb } = processCXLSocketData({
    portData,
    vcsData,
    deviceData,
    mldData,
    ldInfoData,
    isConnected: connected,
  });
  const [displayData, setDisplayData] = useState({
    host: [],
    vcs: [],
    device: [],
    ppb: [],
  });
  const [socketEventData, setSocketEventData] = useState({
    virtualCxlSwitchId: null,
    vppbId: null,
    physicalPortId: null,
    ldId: null,
    eventName: null,
  });
  const [availableNode, setAvailableNode] = useState({
    vcs: null,
    vppb: null,
    ppb: [],
  });
  const [availableLD, setAvailableLD] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState();
  const [edges, setEdges, onEdgesChange] = useEdgesState();

  useEffect(() => {
    setDisplayData({
      host: host,
      vcs: vcs,
      device: device,
      ppb: ppb,
    });
  }, [portData, vcsData, deviceData, mldData, refreshTrigger]);

  useEffect(() => {
    if (host.length && vcs.length && ppb.length && device.length) {
      const initialNodes = [];
      processInitialNodes({
        host,
        vcs,
        ppb,
        device,
        initialNodes,
        availableNode,
        availableLD,
      });
      setNodes(initialNodes);
    }
  }, [portData, deviceData, vcsData, mldData, socket, availableNode, availableLD, refreshTrigger]);

  useEffect(() => {
    if (!nodes) return;

    const initialEdges = [];
    processInitialEdges({
      nodes,
      initialEdges,
    });
    setEdges(initialEdges);
  }, [nodes]);

  const handleClickNode = (_, node) => {
    if (node.data?.type === "vppbForPPB") {
      if (availableNode.vppb) {
        setAvailableNode({ vcs: null, vppb: null, ppb: [] });
        setAvailableLD(null);
      } else {
        if (node.data.vppb.bindingStatus === "BOUND_LD") {
          const availableDevice = device.find(
            (data) => data.portId === node.data.vppb.boundPortId
          );
          setAvailableNode({
            vcs: node.data.virtualCxlSwitchId,
            vppb: node.data,
            ppb: [availableDevice],
          });
          if (availableDevice.deviceType === "MLD") {
            setAvailableLD(availableDevice.logicalDevices.boundLdId);
          }
        } else {
          const availableDevices = device.filter(
            (data) =>
              data.boundVPPBId.length === 0 ||
              (data.deviceType === "MLD" &&
                data.logicalDevices.boundLdId.some((ld) => ld.hostId === -1))
          );
          setAvailableNode({
            vcs: node.data.virtualCxlSwitchId,
            vppb: node.data,
            ppb: [...availableDevices],
          });

          const lds = [];
          availableDevices.forEach((dev) => {
            if (dev.deviceType === "MLD") {
              lds.push(
                ...dev.logicalDevices.boundLdId.filter((ld) => ld.hostId === -1)
              );
            }
          });
          setAvailableLD(lds);
        }
      }
    } else if (node.data?.type === "device" && node.data?.deviceType === "SLD") {
      if (availableNode.vppb) {
        if (
          node.data.boundVPPBId.some(
            (data) => data === availableNode?.vppb?.vppb.vppbId
          )
        ) {
          setSocketEventData({
            virtualCxlSwitchId: Number(availableNode.vcs),
            vppbId: Number(availableNode.vppb.vppb.vppbId),
            eventName: "unbinding",
          });
          openDialog();
        } else {
          setSocketEventData({
            virtualCxlSwitchId: Number(availableNode.vcs),
            vppbId: Number(availableNode.vppb?.vppb.vppbId),
            physicalPortId: Number(node.data.portId),
            eventName: "binding",
          });
          openDialog();
        }
      }
    } else if (node.data?.type === "logicalDevice") {
      if (!availableNode.vcs && !availableNode.vppb) return;
      if (
        availableNode.vppb?.vppb.boundPortId === node.data.mld.portId &&
        availableNode.vppb?.vppb.boundLdId === node.data.ldId
      ) {
        setSocketEventData({
          virtualCxlSwitchId: Number(availableNode.vcs),
          vppbId: Number(availableNode.vppb.vppb.vppbId),
          eventName: "unbinding",
        });
        openDialog();
      } else if (
        !availableNode.vppb?.vppb.boundPortId &&
        node.data.hostId === -1
      ) {
        setSocketEventData({
          virtualCxlSwitchId: Number(availableNode.vcs),
          vppbId: Number(availableNode.vppb?.vppb.vppbId),
          physicalPortId: Number(node.data.mld.portId),
          ldId: Number(node.data.ldId),
          eventName: "binding",
        });
        openDialog();
      }
    } else if (node.data?.type === "device" && node.data?.deviceType === "MLD") {
      // Open MLD allocation modal when clicking on MLD device
      console.log('MLD device clicked, opening modal');
      setSelectedMLDData(node.data);
      setIsMLDModalOpen(true);
    }
  };

  const handleSocketEvent = () => {
    if (!socketEventData.physicalPortId) {
      socket.emit(
        "vcs:unbind",
        {
          virtualCxlSwitchId: socketEventData.virtualCxlSwitchId,
          vppbId: socketEventData.vppbId,
        },
        (args) => {
          if (args.error) {
            setOpen({
              ...open,
              loading: false,
            });
            showError(args.error, vppb);
            return;
          }
          setAvailableNode({ vcs: null, vppb: null, ppb: [] });
        }
      );
    } else {
      socket.emit(
        "vcs:bind",
        {
          virtualCxlSwitchId: socketEventData.virtualCxlSwitchId,
          vppbId: socketEventData.vppbId,
          physicalPortId: socketEventData.physicalPortId,
          ldId: socketEventData.ldId || null,
        },
        (args) => {
          if (args.error) {
            setOpen({
              ...open,
              loading: false,
            });
            showError(args.error, vppb);
            return;
          }
          setAvailableNode({ vcs: null, vppb: null, ppb: [] });
        }
      );
    }
    closeDialog();
  };

  const handleMouseEnter = (_, node) => {
    if (node.data?.type === "device" || node.data?.type === "logicalDevice") {
      setIsTooltipOpen(true);
      setTooltipData(node);
      return;
    }
  };

  const handleMouseLeave = (_, node) => {
    if (node.data?.type === "device" || node.data?.type === "logicalDevice") {
      setIsTooltipOpen(false);
      setTooltipData(null);
      return;
    }
  };

  const closeMLDModal = () => {
    setIsMLDModalOpen(false);
    setSelectedMLDData(null);
  };

  const handleLDAllocationSuccess = async (response, payload) => {
    console.log('LD Allocation successful:', response);
    console.log('Payload sent:', payload);

    // Close the modal
    closeMLDModal();

    // Show success message
    setSuccessMessage('LD allocation completed successfully! Refreshing MLD display...');

    // Clear success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);

    // Trigger a comprehensive refresh of all data
    if (socket) {
      console.log('Starting data refresh sequence...');

      // First refresh device data
      await new Promise((resolve) => {
        socket.emit("device:get", (data) => {
          console.log('Device data refreshed after LD allocation:', data);
          resolve();
        });
      });

      // Then refresh port data
      await new Promise((resolve) => {
        socket.emit("port:get", (data) => {
          console.log('Port data refreshed after LD allocation:', data);
          resolve();
        });
      });

      // Wait a moment for data to propagate, then refresh MLD data
      setTimeout(() => {
        console.log('Refreshing MLD data...');
        refreshMLDData();

        // Force a final re-render
        setRefreshTrigger(prev => prev + 1);

        // Update success message
        setSuccessMessage('LD allocation completed successfully! MLD display updated.');
      }, 1000);
    } else {
      // If no socket, just force a re-render
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <>
      <div className="w-full h-screen overflow-x-auto z-0">
        {/* Connection Status */}
        <div className="fixed top-4 left-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {connected ? 'Backend Connected' : 'Backend Disconnected'}
            </span>
          </div>
        </div>

        {/* Disconnected Message */}
        {!connected && (
          <div className="fixed top-16 left-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium">
                No data will be displayed until backend connection is established
              </span>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg cursor-pointer" onClick={() => setSuccessMessage(null)}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
              <button
                className="ml-4 text-white hover:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setSuccessMessage(null);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleClickNode}
          onNodeMouseEnter={handleMouseEnter}
          onNodeMouseLeave={handleMouseLeave}
          viewport={{ zoom: 1 }}
          nodesDraggable={false}
          deleteKeyCode={null}
        ></ReactFlow>
        <Dialog
          isOpen={isDialogOpen}
          closeDialog={closeDialog}
          socketEventData={socketEventData}
          handleSocketEvent={handleSocketEvent}
        />
      </div>

      {/* MLD Allocation Modal */}
      {isMLDModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                LD Allocation Manager - MLD Port {selectedMLDData?.portId}
              </h2>
              <button
                onClick={closeMLDModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <LDAllocationForm
                selectedMLDData={selectedMLDData}
                onSuccess={handleLDAllocationSuccess}
              />
            </div>
          </div>
        </div>
      )}

      <DeviceTooltip isOpen={isTooltipOpen} node={tooltipData} />
    </>
  );
}
