"use client";

import { useState } from "react";
import { mbTo8ByteArray, mbToInteger, buildAllocationList, buildAllocationPayload } from "../_utils/ldAllocationUtils";

export default function LDAllocationTest() {
  const [testMb, setTestMb] = useState(16);
  const [testAllocations, setTestAllocations] = useState([16, 32, 64]);
  const [testResults, setTestResults] = useState({});

  const handleTestConversion = () => {
    const bytes = mbTo8ByteArray(testMb);
    const integer = mbToInteger(testMb);
    const result = {
      input: `${testMb} MB`,
      output: bytes.join(', '),
      array: bytes,
      integer: integer
    };
    setTestResults(prev => ({ ...prev, conversion: result }));
    console.log(`${testMb} MB = [${bytes.join(', ')}] = ${integer} bytes`);
  };

  const handleTestAllocationList = () => {
    const allocationList = buildAllocationList(testAllocations.length, testAllocations);
    const result = {
      input: testAllocations.map(mb => `${mb} MB`).join(', '),
      output: allocationList
    };
    setTestResults(prev => ({ ...prev, allocationList: result }));
    console.log('Allocation List:', allocationList);
  };

  const handleTestPayload = () => {
    const payload = buildAllocationPayload(0, testAllocations.length, 0, testAllocations);
    const result = {
      input: `Port: 0, LDs: ${testAllocations.length}, Start ID: 0, Allocations: [${testAllocations.join(', ')}]`,
      output: payload
    };
    setTestResults(prev => ({ ...prev, payload: result }));
    console.log('Complete Payload:', payload);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg mt-8">
      <h3 className="text-xl font-bold mb-4 text-gray-800">Data Conversion Test</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test MB Value
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={testMb}
              onChange={(e) => setTestMb(parseInt(e.target.value) || 0)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleTestConversion}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Test Conversion
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Allocations (MB)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={testAllocations.join(', ')}
              onChange={(e) => setTestAllocations(e.target.value.split(',').map(v => parseInt(v.trim()) || 0))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="16, 32, 64"
            />
            <button
              onClick={handleTestAllocationList}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Test List
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={handleTestPayload}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Test Complete Payload
          </button>
        </div>

        {/* Test Results Display */}
        {Object.keys(testResults).length > 0 && (
          <div className="mt-4 space-y-4">
            <h4 className="font-medium text-gray-800">Test Results:</h4>

            {testResults.conversion && (
              <div className="p-4 bg-blue-50 rounded-md">
                <h5 className="font-medium text-blue-800 mb-2">MB to KB Conversion:</h5>
                <p className="text-sm text-blue-700 mb-1">Input: {testResults.conversion.input}</p>
                <p className="text-sm text-blue-700 mb-1">Byte Array: [{testResults.conversion.output}]</p>
                <p className="text-sm text-blue-700">KB Value: {testResults.conversion.integer} KB</p>
                <p className="text-sm text-blue-600 mt-1">(16 MB = 16384 KB for backend compatibility)</p>
              </div>
            )}

            {testResults.allocationList && (
              <div className="p-4 bg-green-50 rounded-md">
                <h5 className="font-medium text-green-800 mb-2">Allocation List:</h5>
                <p className="text-sm text-green-700 mb-1">Input: {testResults.allocationList.input}</p>
                <pre className="text-sm text-green-700 overflow-x-auto">
                  {JSON.stringify(testResults.allocationList.output, null, 2)}
                </pre>
              </div>
            )}

            {testResults.payload && (
              <div className="p-4 bg-purple-50 rounded-md">
                <h5 className="font-medium text-purple-800 mb-2">Complete Payload:</h5>
                <p className="text-sm text-purple-700 mb-1">Input: {testResults.payload.input}</p>
                <pre className="text-sm text-purple-700 overflow-x-auto">
                  {JSON.stringify(testResults.payload.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="font-medium text-gray-800 mb-2">Expected Format (backend expects - KB values):</h4>
          <pre className="text-sm text-gray-700 overflow-x-auto">
{`{
  "portIndex": 0,
  "numberOfLds": 3,
  "startLdId": 0,
  "ldAllocationList": [
    { "range1": 16384, "range2": 0 },
    { "range1": 32768, "range2": 0 },
    { "range1": 65536, "range2": 0 }
  ]
}`}
          </pre>
          <p className="text-sm text-gray-600 mt-2">
            <strong>Note:</strong> range1 values are in KB (16 MB = 16384 KB). range2 is always 0 as it's unused in the current implementation.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Current Output:</strong> The payload above matches exactly what we're sending to the backend.
          </p>
        </div>
      </div>
    </div>
  );
}