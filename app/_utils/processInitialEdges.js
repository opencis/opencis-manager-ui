export const processInitialEdges = ({ nodes, initialEdges }) => {
  if (!nodes) {
    return;
  }

  const hosts = [];
  const vppbsForUSP = [];
  const vppbs = [];
  const ppbs = [];
  const devices = [];

  nodes.map((node) => {
    if (!node.data) {
      return;
    } else if (node.data.type === "host") {
      hosts.push({ source: node.id, target: null, data: node.data });
    } else if (node.data.type === "vppbForHost") {
      vppbsForUSP.push({ source: node.id, target: [], data: node.data });
    } else if (node.data.type === "vppbForPPB") {
      vppbs.push({ source: node.id, target: null, data: node.data });
    } else if (node.data.type === "ppb") {
      ppbs.push({ source: node.id, target: null, data: node.data });
    } else if (node.data.type === "device") {
      devices.push({ source: node.id, target: null, data: node.data });
    }
  });

  hosts.forEach((host) => {
    const vppb = vppbsForUSP.filter(
      (data) => data.data.uspId === host.data.portId
    );
    host.target = vppb[0]?.source;
  });

  vppbsForUSP.forEach((vppbForUSP) => {
    vppbs.map((vppb) => {
      if (vppbForUSP.data.uspId === vppb.data.uspId) {
        vppbForUSP.target.push(vppb.source);
      }
    });
  });

  vppbs.forEach((vppb) => {
    ppbs.map((ppb) => {
      if (vppb.data.vppb.boundPortId === ppb.data.portId) {
        vppb.target = ppb.source;
      }
    });
  });

  ppbs.forEach((ppb) => {
    devices.map((device) => {
      if (ppb.data.portId === device.data.portId) {
        ppb.target = device.source;
      }
    });
  });

  const temp = [...hosts, ...vppbsForUSP, ...vppbs, ...ppbs, ...devices];
  temp.map((data) => {
    if (Array.isArray(data.target)) {
      data.target.map((info) => {
        initialEdges.push({
          id: `${data.source}_${info}`,
          source: data.source,
          target: info,
          zIndex: 100, // Higher z-index to appear in front of all elements
          style: { stroke: "#fde073", strokeWidth: 2 }, // Changed from #FF5A43 to #fde073
          type: "default",
          selectable: false,
        });
      });
    }
    initialEdges.push({
      id: `${data.source}_${data.target}`,
      source: data.source,
      target: data.target,
      zIndex: 100, // Higher z-index to appear in front of all elements
      style: { stroke: "#fde073", strokeWidth: 2 }, // Changed from #FF5A43 to #fde073
      type: "default",
      selectable: false,
    });
  });

  return initialEdges;
};
