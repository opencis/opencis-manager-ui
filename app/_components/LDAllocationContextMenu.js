"use client";

import { useState, useEffect } from "react";
import { useSocket } from "./providers/socket-provider";
import {
  validateAllocations,
  buildAllocationPayload,
  integerToMb,
  isDeallocateAllRequest,
  isMixedRequest
} from "../_utils/ldAllocationUtils";

export default function LDAllocationContextMenu({
  selectedMLDData = null,
  onSuccess = null,
  onClose = null
}) {
  const { socket, connected } = useSocket();

  // Form state (same as LDAllocationForm)
  const [numberOfLds, setNumberOfLds] = useState(0);
  const [startLdId, setStartLdId] = useState(0);
  const [portIndex, setPortIndex] = useState(0);
  const [allocations, setAllocations] = useState([]);
  const [maxLdCount, setMaxLdCount] = useState(16);
  const [maxLdId, setMaxLdId] = useState(255);
  const [isLoadedFromExisting, setIsLoadedFromExisting] = useState(false);
  const [currentlyAllocatedLdIds, setCurrentlyAllocatedLdIds] = useState(new Set());

  // Response and error state
  const [response, setResponse] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Copy all the existing logic from LDAllocationForm.js
  // ... (all the useEffect, functions, etc.)

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-lg border-2 border-gray-300 relative">
      {/* Tail pointing to MLD */}
      <div className="absolute -left-4 top-1/2 transform -translate-y-1/2">
        <div className="w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white"></div>
        <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-300"></div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl z-10"
      >
        ×
      </button>

      {/* Content */}
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">LD Allocation Manager</h2>
        </div>

        {/* Rest of the form content - copy from LDAllocationForm.js */}
        {/* ... */}
      </div>
    </div>
  );
}