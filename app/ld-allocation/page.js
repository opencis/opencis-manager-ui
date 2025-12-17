"use client";

import LDAllocationForm from "../_components/LDAllocationForm";
import LDAllocationTest from "../_components/LDAllocationTest";

export default function LDAllocationPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Back Navigation */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Overview
          </a>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Logical Device Allocation Manager
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Configure memory allocations for Logical Devices (LDs) on MLD ports.
            Set the number of LDs, starting LD ID, and memory allocation for each device.
          </p>
        </div>

        <LDAllocationForm selectedMLDData={null} onSuccess={null} />

        {/* Test Component for Development */}
        <LDAllocationTest />
      </div>
    </div>
  );
}