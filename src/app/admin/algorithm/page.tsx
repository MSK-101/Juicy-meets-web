"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRandom,
  faRepeat,
  faCog,
  faInfoCircle,
  faPlus
} from "@fortawesome/free-solid-svg-icons";
import { usePools, usePool, useCreateSequence, useUpdateSequence, useDeleteSequence, useReorderSequences } from "@/api/hooks/usePoolsQueries";
import type { Sequence } from "@/api/services/poolsService";
import { useAdminToken, useClearAdmin } from "@/store/adminAuth";
import AdminLogin from "@/components/AdminLogin";
import SequenceEditModal from "@/components/SequenceEditModal";
import SortableSequenceItem from "@/components/SortableSequenceItem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function Algorithm() {
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [algorithmBehavior, setAlgorithmBehavior] = useState<"random" | "exact">("exact");
  const [selectedSequencesForRandom, setSelectedSequencesForRandom] = useState<number[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Admin authentication
  const adminToken = useAdminToken();
  const clearAdmin = useClearAdmin();

  // API hooks
  const { data: poolsData, isLoading: poolsLoading, error: poolsError } = usePools();
  const { data: poolData, isLoading: poolLoading } = usePool(selectedPoolId!);
  const createSequenceMutation = useCreateSequence();
  const updateSequenceMutation = useUpdateSequence();
  const deleteSequenceMutation = useDeleteSequence();
  const reorderSequencesMutation = useReorderSequences();

  // Set first pool as selected when pools load
  useEffect(() => {
    if (poolsData && poolsData.length > 0 && !selectedPoolId) {
      setSelectedPoolId(poolsData[0].id);
    }
  }, [poolsData, selectedPoolId]);

  // Check authentication status
  useEffect(() => {
    if (adminToken) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [adminToken]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAdmin();
    setIsAuthenticated(false);
  };

  const currentPool = poolData;
  const pools = poolsData || [];

  const handleRandomSequenceToggle = (sequenceId: number) => {
    setSelectedSequencesForRandom(prev => {
      if (prev.includes(sequenceId)) {
        return prev.filter(id => id !== sequenceId);
      } else {
        return [...prev, sequenceId];
      }
    });
  };

  const handleAddSequence = () => {
    setModalMode("create");
    setSelectedSequence(null);
    setIsModalOpen(true);
  };

  const handleEditSequence = (sequence: Sequence) => {
    setModalMode("edit");
    setSelectedSequence(sequence);
    setIsModalOpen(true);
  };

  const handleModalSave = (data: { name: string; active: boolean; video_count: number; content_type: string[] }) => {
    if (modalMode === "create" && selectedPoolId) {
      createSequenceMutation.mutate({
        poolId: selectedPoolId,
        data: {
          name: data.name,
          pool_id: selectedPoolId,
          video_count: data.video_count,
          active: data.active,
          content_type: data.content_type
        }
      });
    } else if (modalMode === "edit" && selectedSequence && selectedPoolId) {
      updateSequenceMutation.mutate({
        poolId: selectedPoolId,
        sequenceId: selectedSequence.id,
        data: {
          name: data.name,
          video_count: data.video_count,
          active: data.active,
          content_type: data.content_type
        }
      });
    }
    setIsModalOpen(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSequence(null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id && currentPool) {
      const oldIndex = currentPool.sequences.findIndex(seq => seq.id === active.id);
      const newIndex = currentPool.sequences.findIndex(seq => seq.id === over.id);

      const newSequences = arrayMove(currentPool.sequences, oldIndex, newIndex);
      const sequenceIds = newSequences.map(seq => seq.id);

      reorderSequencesMutation.mutate({
        poolId: selectedPoolId!,
        sequenceIds
      }, {
        onSuccess: () => {
          // Force refetch the pool data to get updated positions
          // This ensures the position numbers are updated immediately
        }
      });
    }
  };

  const handleDeleteSequence = (sequenceId: number) => {
    if (!currentPool || !selectedPoolId) return;

    if (currentPool.sequences.length <= 1) {
      alert("Cannot delete the last sequence. At least one sequence must remain.");
      return;
    }

    if (confirm("Are you sure you want to delete this sequence?")) {
      deleteSequenceMutation.mutate({
        poolId: selectedPoolId,
        sequenceId
      });
    }
  };

  if (poolsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pools...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (poolsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Error loading pools. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-poppins">Algorithm</h1>
          <p className="text-gray-600 font-poppins mt-1">Manage video sequences and algorithm behavior</p>
        </div>
      </div>

      {/* Pool Selection Tabs */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FontAwesomeIcon icon={faCog} className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Pool Configuration</h2>
            <p className="text-gray-600 font-poppins">Select and manage video pools</p>
          </div>
        </div>
       <div className="flex flex-col mb-8 text-sm text-gray-600">
        <p className="font-semibold">
          <span className="text-blue-600">Pool A:</span> Free Trial &nbsp; | &nbsp;
          <span className="text-green-600">Pool B:</span> Paid User (Paid Coins) &nbsp; | &nbsp;
          <span className="text-red-600">Pool C:</span> Unpaid User (No Coins)
        </p>
      </div>

        {/* Pool Tabs */}
        <div className="flex space-x-2 mb-8">
          {pools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => setSelectedPoolId(pool.id)}
              className={`px-6 py-3 rounded-xl font-semibold font-poppins transition-all duration-200 ${
                selectedPoolId === pool.id
                  ? "bg-gray-200 text-gray-900 shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {pool.name}
            </button>
          ))}
        </div>

        {/* Sequences List */}
        {selectedPoolId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 font-poppins">
                Sequences for {currentPool?.name}
              </h3>
              <button
                onClick={handleAddSequence}
                disabled={createSequenceMutation.isPending}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold font-poppins hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Sequence</span>
              </button>
            </div>

            {poolLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : currentPool?.sequences && currentPool.sequences.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentPool.sequences.map(seq => seq.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {currentPool.sequences.map((sequence) => (
                      <SortableSequenceItem
                        key={sequence.id}
                        sequence={sequence}
                        onEdit={handleEditSequence}
                        onDelete={handleDeleteSequence}
                        isDeleting={deleteSequenceMutation.isPending}
                        isReordering={reorderSequencesMutation.isPending}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No sequences found for this pool.</p>
                <p className="text-sm mt-2">Click &quot;Add Sequence&quot; to create your first sequence.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sequence Edit Modal */}
      <SequenceEditModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        sequence={selectedSequence}
        onSave={handleModalSave}
        isLoading={createSequenceMutation.isPending || updateSequenceMutation.isPending}
        mode={modalMode}
      />
    </div>
  );
}
