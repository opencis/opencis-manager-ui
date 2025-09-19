export const processInitialNodes = ({
  host,
  vcs,
  ppb,
  device,
  initialNodes,
  availableNode,
  availableLD,
}) => {
  console.log('processInitialNodes called with:', {
    host: host.length,
    vcs: vcs.length,
    ppb: ppb.length,
    device: device.length,
    availableNode,
    availableLD
  });

  const vPPBForHOST = [];
  const vPPBForPPB = [];
  vcs.map((data) => {
    data.hostPort ? vPPBForHOST.push(data) : vPPBForPPB.push(data);
  });

  console.log('VPPB categorization:', {
    vPPBForHOST: vPPBForHOST.length,
    vPPBForPPB: vPPBForPPB.length
  });

  const nodeBox = {
    width: 114,
    height: 56,
    borderRadius: 8,
  };

  const gap = {
    row: 24,
    column: 20,
  };

  const padding = {
    vPPB: 20,
    PPB: 38,
  };

  const eachHostvPPBlength = [];
  host.map((data) => {
    eachHostvPPBlength.push(
      vPPBForPPB.filter((info) => data?.portId === info.uspId).length
    );
  });

  const vcsWidth = eachHostvPPBlength.map((data) => {
    return data * nodeBox.width + gap.row * (data - 1) + padding.vPPB * 2;
  });

  const totalVPPBWidth = vcsWidth.reduce((acc, curr) => acc + curr, 0);

  const ppbBoxWidth =
    ppb.length * nodeBox.width + gap.row * (ppb.length - 1) + padding.PPB * 2;

  // Add fallback values to prevent layout issues when arrays are empty
  const fallbackWidth = nodeBox.width * 2 + gap.row + padding.PPB * 2;
  const maxWidth = Math.max(totalVPPBWidth || fallbackWidth, ppbBoxWidth || fallbackWidth);

  const groupBox = {
    vcsWidth: vcsWidth,
    ppbWidth: ppbBoxWidth,
    switchWidth: maxWidth + padding.PPB * 2,
    largeRadius: 53,
    smallRadius: 32,
  };

  console.log('Group box calculations:', {
    vcsWidth,
    ppbBoxWidth,
    maxWidth,
    groupBox
  });

  const defaultZIndex = 0; // default value
  const vppbZIndex = 1; // set when need to focus
  const ppbZIndex = 1; // set when need to focus
  const deviceZIndex = 1; // set when need to focus
  const wrapperZIndex = 1; // set when something focus (vppbZIndex, ppbZIndex, deviceZIndex)
  const backgrounZIndex = 0; // fixed value

  /* backgroud & wrapper */
  initialNodes.push({
    id: "wrapper",
    type: "group",
    position: {
      x: 0,
      y: 0,
    },
    style: {
      width: "100%",
      height: "100%",
      backgroundColor: "black",
      opacity: 0.5,
      zIndex: !availableNode?.vppb ? defaultZIndex : wrapperZIndex,
    },
    selectable: false,
  });

  initialNodes.push({
    id: "background",
    type: "group",
    position: {
      x: 0,
      y: 0,
    },
    style: {
      width: "100%",
      height: "100%",
      backgroundColor: "#616161", // Changed from #554448 to #616161
      opacity: 1,
      zIndex: -1,
    },
    selectable: false,
  });

  /* VCS Group */
  const vcsGroup = {
    id: "group_vcs",
    type: "group",
    position: {
      x:
        (typeof window !== 'undefined' ? window.innerWidth : 1200) -
        groupBox.switchWidth -
        ((typeof window !== 'undefined' ? window.innerWidth : 1200) - groupBox.switchWidth) / 2,
      y: (typeof window !== 'undefined' ? window.innerHeight : 800) / 7,
    },
    data: { label: "Switch" },
    style: {
      width: `${groupBox.switchWidth}px`,
      height: "400px", // Increased from 375px to 400px
      backgroundColor: "#e58c4d",
      borderRadius: groupBox.largeRadius,
      border: "none",
    },
    selectable: false,
  };

  /* vPPB Group */
  const vppbGroup = [];
  if (host.length > 0) {
    host.map((data, index) => {
      vppbGroup.push({
        id: `group_vppb_${data?.portId}`,
        type: "default",
        position: {
          x:
            index * vcsWidth[index === 0 ? index : index - 1] +
            ((groupBox.switchWidth -
              groupBox.vcsWidth.reduce((acc, curr) => acc + curr, 0)) /
              (host.length + 1)) *
              (index + 1),
          y: 50, // Changed from 20 to 50 to move boxes lower
        },
        data: { label: `VCS${index}` },
        style: {
          width: `${vcsWidth[index]}px`,
          height: "212px",
          border: "white",
          borderRadius: 32,
          backgroundColor: "#66888B", // Changed from #7A6A6A to #66888B
          color: "white",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "start",
          padding: "20px",
          fontSize: "14px",
        },
        parentId: "group_vcs",
        extend: "parent",
        className: "vcs_group",
        selectable: false,
      });
    });
  } else {
    // Create a default VCS group when no hosts are present
    vppbGroup.push({
      id: "group_vppb_default",
      type: "default",
      position: {
        x: 20,
        y: 50, // Changed from 20 to 50 to move box lower
      },
      data: { label: "VCS" },
      style: {
        width: `${fallbackWidth}px`,
        height: "212px",
        border: "white",
        borderRadius: 32,
        backgroundColor: "#554448",
        color: "white",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "start",
        padding: "20px",
        fontSize: "14px",
      },
      parentId: "group_vcs",
      extend: "parent",
      className: "vcs_group",
      selectable: false,
    });
  }

  /* ppbGroup */
  const ppbGroup = {
    id: "group_ppb",
    type: "group",
    position: { x: (groupBox.switchWidth - groupBox.ppbWidth) / 2, y: 282 }, // Changed from 252 to 282 to maintain same distance
    style: {
      width: `${groupBox.ppbWidth || fallbackWidth}px`,
      height: "96px",
      border: "none",
      backgroundColor: "#554448", // Changed to #554448
      opacity: 0.7, // Make more transparent
      borderRadius: groupBox.smallRadius,
    },
    parentId: "group_vcs",
    extend: "parent",
    selectable: false,
  };
  initialNodes.push(vcsGroup, ...vppbGroup, ppbGroup);

  // Add Switch label
  initialNodes.push({
    id: "switch_label",
    type: "default",
    position: {
      x: (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2 - 30,
      y: (typeof window !== 'undefined' ? window.innerHeight : 800) / 7 + 10, // Moved inside the box
    },
    data: {
      type: "switchLabel",
      label: "Switch"
    },
    style: {
      width: "60px",
      height: "30px",
      backgroundColor: "transparent",
      border: "none",
      color: "white",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "20px", // Changed from 16px to 20px to match MLD
      fontWeight: "normal", // Changed from bold to normal to match MLD
      textAlign: "center",
      zIndex: 150, // Higher than connections (100) to appear in front
    },
    selectable: false,
    className: "switch-label-node",
  });

  /* Host */
  host.map((data, index) => {
    // Create host box
    initialNodes.push({
      id: `host_${data?.portId}`,
      position: {
        x:
          groupBox.vcsWidth[index] -
            (nodeBox.width - 30) -
            (groupBox.vcsWidth[index] - (nodeBox.width - 30)) / 2 || 0,
        y: -150 + 20, // Move RP box lower
      },
      data: { ...data, type: "host", label: `RP ${index}` }, // Change to RP (Root Port)
      type: "input",
      style: {
        width: `${nodeBox.width - 30}px`, // Make smaller
        height: `${nodeBox.height - 20}px`, // Make smaller
        backgroundColor: `${data?.backgroundColor}`,
        border: "none",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "20px",
        fontWeight: "600",
        color: "white",
        zIndex: 10, // Higher than background box to appear in front
      },
      parentId: `group_vppb_${data?.portId}`,
      extend: "parent",
      selectable: false,
    });

    // Create host text label (white text)
    initialNodes.push({
      id: `host_text_label_${data?.portId}`,
      type: "input", // Change to input type like other labels
      position: {
        x: (() => {
          // Calculate orange box center
          const orangeBoxX = groupBox.vcsWidth[index] - nodeBox.width - (groupBox.vcsWidth[index] - nodeBox.width) / 2 - 15;
          const orangeBoxWidth = nodeBox.width + 30; // 114 + 30 = 144
          const orangeBoxCenterX = orangeBoxX + orangeBoxWidth / 2; // x + 72

          // Center host label in orange box (host label width is 80px)
          const hostLabelWidth = 80;
          const hostLabelX = orangeBoxCenterX - hostLabelWidth / 2; // center_x - 40

          return hostLabelX;
        })(),
        y: -150 - 15, // Move host text label a little higher inside the orange box
      },
      data: { type: "hostTextLabel", label: `Host ${index}` }, // Host text label
      className: "host-label-node", // Add class for CSS targeting
      style: {
        width: "80px", // Make wider to fit text on one line
        height: "30px", // Make taller to fit text
        backgroundColor: "transparent",
        border: "none",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "16px", // Make host label bigger
        color: "white", // Add text color
        fontWeight: "600", // Add font weight
        zIndex: 10,
      },
      parentId: `group_vppb_${data?.portId}`, // Add parentId like other labels
      extend: "parent", // Add extend like other labels
      selectable: false,
    });

    // Create orange background box
    initialNodes.push({
      id: `host_orange_background_${data?.portId}`,
      type: "input", // Same type as host
      position: {
        x: groupBox.vcsWidth[index] - nodeBox.width - (groupBox.vcsWidth[index] - nodeBox.width) / 2 - 15, // Match orange box x position
        y: -150 - 20, // Move host text label higher inside the orange box
      },
      data: { ...data, type: "hostOrangeBackground", label: "" }, // Orange background box
      className: "host-background-node", // Add class for CSS targeting
      style: {
        width: `${nodeBox.width + 30}px`, // Even larger
        height: `${nodeBox.height + 30}px`, // Even larger
        backgroundColor: "#e59055",
        border: "none",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "12px",
        color: "white",
        opacity: 1, // Full opacity
        zIndex: 1, // Higher z-index to ensure visibility
      },
      parentId: `group_vppb_${data?.portId}`, // Same parent as host
      extend: "parent", // Same extend as host
      selectable: false,
      connectable: false,
      draggable: false,
      sourcePosition: null,
      targetPosition: null,
    });
  });

  /* vPPB For Host */
  vPPBForHOST.map((data, index) => {
    initialNodes.push({
      id: `usp_${data.uspId}`,
      position: {
        x:
          groupBox.vcsWidth[index] -
            nodeBox.width -
            (groupBox.vcsWidth[index] - nodeBox.width) / 2 || 0,
        y: 20,
      },
      data: {
        ...data,
        type: "vppbForHost",
        label: "vPPB",
      },
      style: {
        width: `${nodeBox.width}px`,
        height: `${nodeBox.height}px`,
        border: "2px solid #5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        borderRadius: nodeBox.borderRadius,
        backgroundColor: "#554448",
        color: "#5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "20px",
      },
      parentId: `group_vppb_${data?.uspId}`,
      extend: "parent",
      selectable: false,
    });
  });

  /* vPPB For PPB */
  let currentId = null;
  let index = 0;
  vPPBForPPB.map((data) => {
    if (currentId !== data.uspId) {
      currentId = data.uspId;
      index = 0;
    }
    initialNodes.push({
      id: `vppb_usp_${data.uspId}_vcs_${data.virtualCxlSwitchId}_vppb_${data.vppb.vppbId}`,
      position: {
        x: padding.vPPB + index * (nodeBox.width + gap.row) || 0,
        y: 136,
      },
      data: {
        ...data,
        type: "vppbForPPB",
        label: `vPPB ${data.vppb.vppbId}`,
      },
      style: {
        width: `${nodeBox.width}px`,
        height: `${nodeBox.height}px`,
        border: "2px solid #5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        borderRadius: nodeBox.borderRadius,
        backgroundColor:
          (availableNode?.vppb?.vppb.vppbId === data.vppb.vppbId) &
          (availableNode?.vcs === data.virtualCxlSwitchId)
            ? "#554448"
            : "#554448",
        color: "#5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "20px",
        zIndex: !(
          (availableNode?.vppb?.vppb.vppbId === data.vppb.vppbId) &
          (availableNode?.vcs === data.virtualCxlSwitchId)
        )
          ? defaultZIndex
          : vppbZIndex,
        opacity: 1,
        position: "absolute",
      },
      className: "vppb_node",
      parentId: `group_vppb_${data?.uspId}`,
      extend: "parent",
    });
    index++;
  });

  /* PPB */
  ppb.map((data, index) => {
    initialNodes.push({
      id: `ppb_${data?.portId}`,
      position: {
        x: padding.PPB + index * (nodeBox.width + gap.row) || 0,
        y: 20,
      },
      data: { ...data, type: "ppb", label: `PPB ${data?.portId}` },
      style: {
        width: `${nodeBox.width}px`,
        height: `${nodeBox.height}px`,
        backgroundColor: "#554448", // Changed from #613F00 to #554448
        border: "2px solid #5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        borderRadius: nodeBox.borderRadius,
        color: "#5AD3E0", // Changed from #ACA9F1 to #5AD3E0
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "20px",
        zIndex: true ? defaultZIndex : ppbZIndex,
        opacity: 1,
      },
      parentId: "group_ppb",
      extend: "parent",
    });
  });

  /* Device */
  console.log('Processing devices:', device);
  device.forEach((data, index) => {
    console.log('Processing device:', data);
    if (!data) {
      console.log('Skipping null device at index:', index);
      return;
    }
    const h = data.hosts.find((h) => h.hostId !== -1);

    initialNodes.push({
      id: `device_${data?.portId}`,
      type: "output",
      position: {
        x: padding.PPB + index * (nodeBox.width + gap.row) || 0,
        y: 150,
      },
      data: { ...data, type: "device", label: data.deviceType },
      style: {
        width: `${nodeBox.width}px`,
        height: `${data.deviceType === "SLD" ? nodeBox.height : (() => {
          // Calculate MLD height based on supportedLdCount
          const supportedLdCount = data.supportedLdCount || 16;
          const rows = Math.ceil(supportedLdCount / 2);
          const baseHeight = 70; // Increased from 50 to 70 for more space at bottom
          const ldHeight = 40; // Height per LD row
          return baseHeight + (rows * ldHeight);
        })()}px`,
        backgroundColor:
          data.deviceType === "SLD" ? (h ? h.color : "#EEEEFF") : "#e58c4d",
        // data.deviceType === "SLD"
        //   ? data.hosts.length > 0 && data.boundVPPBId.length > 0
        //     ? data.hosts[index].color
        //     : "#EEEEFF"
        //   : "#EEEEFF",
        border: "none",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "center",
        alignItems: `${data.deviceType === "SLD" ? "center" : "start"}`,
        paddingTop: `${data.deviceType === "SLD" ? null : "20px"}`,
        fontSize: "20px",
        color: data.deviceType === "MLD" ? "white" : "black",
        zIndex: !availableNode.ppb?.some((info) => {
          return info.portId === data.portId;
        })
          ? defaultZIndex
          : deviceZIndex,
        opacity: 1,
        cursor: data.deviceType === "MLD" ? "pointer" : "default",
      },
      className: `${
        data.deviceType === "MLD"
          ? ""
          : !availableNode.ppb?.some((info) => {
              return info.portId === data.portId;
            })
          ? defaultZIndex
          : ppbZIndex
          ? availableNode.vppb.vppb.bindingStatus === "BOUND_LD"
            ? "unbound_device_node"
            : "bound_device_node"
          : ""
      }`,
      parentId: "group_ppb",
      extend: "parent",
      selectable: data.deviceType === "MLD" ? true : availableNode.ppb?.some((info) => {
        return info.portId === data.portId;
      }),
    });

    console.log('Created device node:', {
      id: `device_${data?.portId}`,
      type: data.deviceType,
      selectable: data.deviceType === "MLD" ? true : availableNode.ppb?.some((info) => {
        return info.portId === data.portId;
      }),
      data: data
    });


  });

  device.forEach((data) => {
    console.log('Processing MLD logical devices for device:', data);
    if (data.deviceType === "MLD") {
      const { logicalDevices } = data;
      console.log('Logical devices data:', logicalDevices);

      // Create logical device nodes for ALL LDs (allocated and deallocated)
      // Check if ldAllocationList exists and show all LDs
      if (logicalDevices.ldAllocationList && Array.isArray(logicalDevices.ldAllocationList)) {
        // Use supportedLdCount from device data with fallback to 16
        const totalSupportedLds = data.supportedLdCount || 16;
        console.log(`Processing ${totalSupportedLds} supported LDs for device ${data.portId}`);

        for (let ldIndex = 0; ldIndex < totalSupportedLds; ldIndex++) {
          // Check if this LD is allocated by looking at the allocation data
          let isAllocated = false;

          if (Array.isArray(logicalDevices.ldAllocationList) && typeof logicalDevices.ldAllocationList[0] === 'number') {
            // Flat array format [range1, range2, range1, range2, ...]
            const range1Index = ldIndex * 2; // Use ldIndex for allocation lookup
            const range1Value = logicalDevices.ldAllocationList[range1Index];
            const range2Value = logicalDevices.ldAllocationList[range1Index + 1] || 0;

            // LD is allocated if either range1 or range2 is non-zero
            isAllocated = (range1Value && range1Value > 0) || (range2Value && range2Value > 0);
          }

          // Only create nodes for allocated LDs
          if (isAllocated) {
            // Find boundLdId info for this LD if it exists
            const boundLdInfo = logicalDevices.boundLdId?.find(ld => ld.to === ldIndex);

            console.log(`Creating logical device for LD ${ldIndex} (allocated: ${isAllocated}):`, boundLdInfo);
            let hostColor = "#D9D9D9";
            if (boundLdInfo) {
              const h = data.hosts.find(
                (h) => boundLdInfo.hostId === h.hostId && boundLdInfo.vcsId === h.virtualCxlSwitchId
              );
              if (h) {
                hostColor = h.color;
              }
            }

            const getClassName = () => {
              if (!availableNode.vppb) return "logical_device";

              if (availableNode.vppb.vppb.boundPortId) {
                return (availableLD || []).some(
                  (ld) =>
                    ld.to === ldIndex &&
                    ld.to === availableNode.vppb.vppb.boundLdId &&
                    logicalDevices.portId === availableNode.vppb.vppb.boundPortId
                )
                  ? "logical_device unbound_logical_device"
                  : "logical_device";
              } else {
                return boundLdInfo && boundLdInfo.hostId === -1
                  ? "logical_device bound_logical_device"
                  : "logical_device";
              }
            };

            // Calculate positioning based on supportedLdCount
            const ldsPerColumn = Math.ceil(totalSupportedLds / 2);
            const column = Math.floor(ldIndex / ldsPerColumn);
            const row = ldIndex % ldsPerColumn;

            initialNodes.push({
              id: `logicalDevice_${logicalDevices.portId}_${ldIndex}`, // Use ldIndex
              type: "default",
              position: {
                x: 10 + (column * 52), // Dynamic column positioning
                y: 56 + 40 * row,       // Dynamic row positioning
              },
              data: {
                ...(boundLdInfo || {}),
                type: "logicalDevice",
                label: `LD ${ldIndex}`, // Use ldIndex for label
                ldId: ldIndex,          // Use ldIndex for ldId
                mld: data,
              },
              style: {
                width: "42px",
                height: "32px",
                backgroundColor: hostColor,
                border: "none",
                borderRadius: "8px",
                padding: "0px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "14px",
                zIndex: !availableNode.ppb?.some((info) => {
                  return info.portId === data.portId;
                })
                  ? defaultZIndex
                  : deviceZIndex,
                opacity: 1,
              },
              parentId: `device_${data?.portId}`,
              extend: "parent",
              className: getClassName(),
              selectable: availableNode.ppb?.some((info) => {
                return info.portId === data.portId;
              })
                ? true
                : false,
            });
          }
        }
      } else {
        // Fallback: create nodes for all LDs if no allocation data available
        console.log('No ldAllocationList available, creating nodes for all LDs');
      logicalDevices.boundLdId.forEach((ld, index) => {
          console.log('Creating logical device (fallback):', ld, 'at index:', index);
        let hostColor = "#D9D9D9";
        const h = data.hosts.find(
          (h) => ld.hostId === h.hostId && ld.vcsId === h.virtualCxlSwitchId
        );
        if (h) {
          hostColor = h.color;
        }

        const getClassName = () => {
          if (!availableNode.vppb) return "logical_device";

          if (availableNode.vppb.vppb.boundPortId) {
            return (availableLD || []).some(
              (ld) =>
                ld.to === index &&
                ld.to === availableNode.vppb.vppb.boundLdId &&
                logicalDevices.portId === availableNode.vppb.vppb.boundPortId
            )
              ? "logical_device unbound_logical_device"
              : "logical_device";
          } else {
            return ld.hostId === -1
              ? "logical_device bound_logical_device"
              : "logical_device";
          }
        };

        initialNodes.push({
          id: `logicalDevice_${logicalDevices.portId}_${index}`,
          type: "default",
          position: {
            x: 10 + (index / 8 >= 1.0 ? 52 : 0),
            y: 56 + 40 * (index % 8),
          },
          data: {
            ...(ld || {}),
            type: "logicalDevice",
            label: `LD ${index}`,
            ldId: index,
            mld: data,
          },
          style: {
            width: "42px",
            height: "32px",
            backgroundColor: hostColor,
            border: "none",
            borderRadius: "8px",
            padding: "0px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "14px",
            zIndex: !availableNode.ppb?.some((info) => {
              return info.portId === data.portId;
            })
              ? defaultZIndex
              : deviceZIndex,
            opacity: 1,
          },
          parentId: `device_${data?.portId}`,
          extend: "parent",
          className: getClassName(),
          selectable: availableNode.ppb?.some((info) => {
            return info.portId === data.portId;
          })
            ? true
            : false,
        });
      });
    }
    }
  });

  // Add single note below all MLD devices
  const mldDevices = device.filter(data => data.deviceType === "MLD");
  if (mldDevices.length > 0) {
    // Calculate the leftmost and rightmost positions of MLD devices
    const mldPositions = mldDevices.map((data, index) => {
      const deviceIndex = device.findIndex(d => d.portId === data.portId);
      return {
        left: padding.PPB + deviceIndex * (nodeBox.width + gap.row) || 0,
        right: (padding.PPB + deviceIndex * (nodeBox.width + gap.row) || 0) + nodeBox.width
      };
    });

    const leftmostEdge = Math.min(...mldPositions.map(pos => pos.left));
    const rightmostEdge = Math.max(...mldPositions.map(pos => pos.right));
    let totalWidth = rightmostEdge - leftmostEdge;

    // If there's only one MLD, make the note wider for better text readability
    if (mldDevices.length === 1) {
      totalWidth = Math.max(totalWidth + 40, 200); // Add 40px or minimum 200px width
    }

    // Calculate the maximum height among all MLD devices
    const maxMldHeight = Math.max(...mldDevices.map(data => {
      const supportedLdCount = data.supportedLdCount || 16;
      const rows = Math.ceil(supportedLdCount / 2);
      const baseHeight = 70; // Increased from 50 to 70 for more space at bottom
      const ldHeight = 40; // Height per LD row
      return baseHeight + (rows * ldHeight);
    }));

    // Calculate center position for single MLD to keep note centered
    const centerX = mldDevices.length === 1
      ? leftmostEdge + (nodeBox.width / 2) - (totalWidth / 2)
      : leftmostEdge;

    initialNodes.push({
      id: "mld_note_global",
      type: "default",
      position: {
        x: centerX,
        y: 136 + maxMldHeight + 30, // Use calculated max height instead of hardcoded 378
      },
      data: {
        type: "mldNote",
        label: "Click on an MLD device to add/remove LDs"
      },
      style: {
        width: `${totalWidth}px`,
        height: "40px",
        backgroundColor: "#cc5500", // Changed to dark orange
        border: "none",
        borderRadius: "8px",
        color: "white", // Changed to white for better contrast on dark orange
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "14px",
        fontWeight: "500",
        textAlign: "center",
        padding: "6px",
        zIndex: defaultZIndex,
        opacity: 1,
        pointerEvents: "none", // Make it non-interactive
        boxShadow: "none", // Remove any shadows
      },
      className: "mld-note-node",
      parentId: "group_ppb",
      extend: "parent",
      selectable: false,
      connectable: false,
      draggable: false,
      sourcePosition: null,
      targetPosition: null,
    });
  }

  return initialNodes;
};
