"use client";

import "./style.css";
import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import { useSocket } from "../_components/providers/socket-provider";
import { useCXLSocket } from "./_hooks/useCXLSocket";
import { processCXLSocketData } from "./_utils/processCXLSocketData";
import { ReactFlow, useNodesState } from "@xyflow/react";
import { processInitialNodes } from "./_utils/processInitialNodes";
import { processInitialEdges } from "./_utils/processInitialEdges";

// 완성 후에 RootLayout 은 따로 두고, 이 페이지는 page로 옮기자
export default function Overview() {
  const { socket } = useSocket();
  const { portData, deviceData, vcsData } = useCXLSocket(socket);
  const { host, vcs, device, ppb } = processCXLSocketData({
    portData,
    vcsData,
  });
  const [displayData, setDisplayData] = useState({
    host: [],
    vcs: [],
    device: [] /* SLD, MLD 구분이 가능해지면 추후 관련된 데이터 추가 필요 */,
    ppb: [],
  });
  const [socketEventData, setSocketEventData] = useState({
    virtualCxlSwitchId: null,
    vppbId: null,
    physicalPortId: null,
    ld: null,
  });
  const [availableNode, setAvailableNode] = useState({
    vcs: null,
    vppb: null,
    ppb: [],
  });

  const [nodes, setNodes, onNodesChange] = useNodesState();
  const [edges, setEdges, onEdgeschange] = useNodesState();

  useEffect(() => {
    setDisplayData({
      host: host,
      vcs: vcs,
      device: device,
      ppb: ppb,
    });
  }, [portData, vcsData, deviceData]);

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
      });

      setNodes(initialNodes);
    }
  }, [portData, deviceData, vcsData, socket, availableNode]);

  useEffect(() => {
    const initialEdges = [];
    processInitialEdges({
      nodes,
      initialEdges,
    });
    setEdges(initialEdges);
  }, [nodes]);

  const handleClickNode = (_, node) => {
    if (node.data?.type === "vppb") {
      if (availableNode.vppb) {
        setAvailableNode({ vcs: null, vppb: null, ppb: [] });
      } else {
        if (node.data.vppb.boundPortId) {
          const availablePPB = ppb.find(
            (data) => (data.portId = node.data.vppb.boundPortId)
          );
          setAvailableNode({
            vcs: node.data.virtualCxlSwitchId,
            vppb: node.data,
            ppb: [availablePPB],
          });
        } else {
          const availablePPB = ppb.filter(
            (data) => data.boundVPPBId.length === 0
          );
          setAvailableNode({
            vcs: node.data.virtualCxlSwitchId,
            vppb: node.data,
            ppb: [...availablePPB],
          });
        }
      }
    } else if (node.data?.type === "ppb") {
      if (
        node.data.boundVPPBId.some(
          (data) => data === availableNode?.vppb?.vppb.vppbId
        )
      ) {
        socket.emit(
          "vcs:unbind",
          {
            virtualCxlSwitchId: Number(availableNode.vcs),
            vppbId: Number(availableNode.vppb.vppb.vppbId),
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
            virtualCxlSwitchId: Number(availableNode.vcs),
            vppbId: Number(availableNode.vppb.vppb.vppbId),
            physicalPortId: Number(node.data.portId),
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
      // setSocketEventData({
      //   virtualCxlSwitchId: availableNode.vcs,
      //   vppbId: availableNode.vppbId,
      //   physicalPortId: node.portId,
      // });
      // openModal
    }
  };

  return (
    <div className="w-full h-screen overflow-x-auto">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgeschange}
        nodesDraggable={false}
        viewport={{ zoom: 1 }}
        onNodeClick={handleClickNode}
        deleteKeyCode={null}
      />
    </div>
  );
}
