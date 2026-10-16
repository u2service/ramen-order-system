"use client";

import PosCheckout from '@/components/pos/PosCheckout';
import ProtectedRoute from '@/components/ProtectedRoute'; 

export default function PosPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'cashier']}>
      <main className="min-h-screen bg-gray-100">
        <PosCheckout />
      </main>
    </ProtectedRoute>
  );
}