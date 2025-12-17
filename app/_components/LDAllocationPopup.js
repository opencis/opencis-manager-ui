"use client";

import { useState, useEffect, useRef } from "react";
import LDAllocationForm from "./LDAllocationForm";

export default function LDAllocationPopup({
  isOpen,
  onClose,
  selectedMLDData,
  mldNodeId,
  onSuccess
}) {
  const popupRef = useRef(null);
  const [mldRect, setMldRect] = useState(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Calculate position relative to MLD node
  useEffect(() => {
    if (isOpen && mldNodeId) {
      const mldElement = document.querySelector(`[data-id="${mldNodeId}"]`);
      if (mldElement && popupRef.current) {
        const rect = mldElement.getBoundingClientRect();
        setMldRect(rect);

        const popup = popupRef.current;

        // Position popup to the right of MLD and higher up
        popup.style.left = `${rect.right + 20}px`;
        popup.style.top = `${rect.top - 500}px`; // Move even higher up by subtracting 500px
        popup.style.transform = 'none'; // Remove centering transform
      }
    }
  }, [isOpen, mldNodeId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Custom backdrop that excludes MLD area */}
      {mldRect && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40"
          style={{
            clipPath: `polygon(0% 0%, 0% 100%, ${mldRect.left - 20}px 100%, ${mldRect.left - 20}px ${mldRect.top - 20}px, ${mldRect.right + 20}px ${mldRect.top - 20}px, ${mldRect.right + 20}px ${mldRect.bottom + 20}px, ${mldRect.left - 20}px ${mldRect.bottom + 20}px, ${mldRect.left - 20}px 100%, 100% 100%, 100% 0%)`
          }}
          onClick={onClose}
        />
      )}

      <div
        ref={popupRef}
        className="fixed z-50"
      >
        {/* Speech bubble tail pointing to MLD */}
        <div
          className="absolute"
          style={{
            left: '0px', // Start at the edge of the manager
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          {/* White tail connected to MLD manager */}
          <div
            className="absolute w-0 h-0"
            style={{
              borderTop: '12px solid transparent',
              borderBottom: '12px solid transparent',
              borderRight: '16px solid white',
              left: '-16px', // Position the arrow to extend left from the manager edge
              top: '-12px'
            }}
          />
        </div>

        {/* White container box with same structure as modal */}
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto relative z-10">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">
              LD Allocation Manager - MLD Port {selectedMLDData?.portId}
            </h2>
            <button
              onClick={onClose}
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
              onSuccess={onSuccess}
            />
          </div>
        </div>
      </div>
    </>
  );
}