"use client";

import { getConfigDisplayInfo } from "../_utils/configUtils";

export default function ConfigDisplay({ configData, portData }) {
  const configInfo = getConfigDisplayInfo(configData);

  // Fallback detection
  const fallbackNoMld = !configInfo.configReceived && (
    portData && portData.length > 0 &&
    !portData.some(port => port.connectedDeviceType && port.connectedDeviceType.includes('MLD'))
  );

  const finalConfigInfo = {
    ...configInfo,
    hasNoMld: configInfo.hasNoMld || fallbackNoMld,
    showLdAllocation: configInfo.showLdAllocation || fallbackNoMld,
    status: (configInfo.hasNoMld || fallbackNoMld) ? 'MLD Disabled' : 'MLD Enabled',
    fallbackUsed: fallbackNoMld && !configInfo.configReceived
  };

  if (!configData && !portData) {
    return (
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded text-sm">
          Loading configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Configuration Status</h3>

        <div className="space-y-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            finalConfigInfo.hasNoMld
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {finalConfigInfo.status}
            {finalConfigInfo.fallbackUsed && (
              <span className="ml-1">(inferred)</span>
            )}
          </div>

          <div className="text-xs text-gray-600">
            <strong>LD Allocation Manager:</strong> {finalConfigInfo.showLdAllocation ? 'Available' : 'Hidden'}
          </div>

          {finalConfigInfo.hasNoMld && (
            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              ✓ LD Allocation Manager is available because <code>no_mld</code> is in the configuration
              {finalConfigInfo.fallbackUsed && ' (inferred from port data)'}
            </div>
          )}

          {!finalConfigInfo.hasNoMld && (
            <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
              LD Allocation Manager is hidden because <code>no_mld</code> is not in the configuration
            </div>
          )}

          {finalConfigInfo.fallbackUsed && (
            <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              ⚠ Configuration not received from backend, using fallback detection
            </div>
          )}
        </div>

        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Show Raw Configuration
          </summary>
          <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
            {configInfo.configString}
          </pre>
        </details>
      </div>
    </div>
  );
}